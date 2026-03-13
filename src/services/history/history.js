import pLimit from 'p-limit';
import { ethers } from "ethers";
import { loadProgress, saveTransactions, updateProgress } from "./db.js";
import { getL1Provider, getL2Provider } from "@/infra/provider/providerManager.js";
import { BRIDGE_DIRECTION, BRIDGE_STATUS } from "@/config/constant.js";
import { syncPendingStatus } from "@/services/history/bridgeStatus.js";

const BRIDGE_DEPLOY_BLOCK = {
	'0x1': 23874421,      // Ethereum mainnet
	'0xaa36a7': 9605535, // Sepolia
	'0x186ab': 170563,    // QKC mainnet
	'0x1adbb': 169841      // QKC Sepolia
}

const API_CONFIG = {
	'0x1': 'https://api.etherscan.io/v2/api',
	'0xaa36a7': 'https://api.etherscan.io/v2/api',
	'0x186ab': 'https://explorer.mainnet.l2.quarkchain.io/api',
	'0x1adbb': 'https://explorer.delta.testnet.l2.quarkchain.io/api'
};

const EVENT_TOPIC = ethers.id("ERC20BridgeInitiated(address,address,address,address,uint256,bytes)");
const iface = new ethers.Interface([
	"event ERC20BridgeInitiated(address indexed localToken,address indexed remoteToken,address indexed from,address to,uint256 amount,bytes extraData)"
]);

const L1_WINDOW = 5000;
const L2_WINDOW = 50000;
const API_THRESHOLD_L1 = 50000;
const API_THRESHOLD_L2 = 10000;
const MAX_API_STEP = 800000;

function hasL1ApiSupport(chainId) {
	if (chainId !== '0x1' && chainId !== '0xaa36a7') return true;
	return Boolean(import.meta.env.VITE_ETHERSCAN_KEY);
}

function throwIfAborted(signal) {
	if (signal?.aborted) {
		const err = new Error("Sync aborted");
		err.name = "AbortError";
		throw err;
	}
}

async function parseLogs(logs, provider, direction, address) {
	const txs = [];
	const blockCache = new Map();

	const blockNumbers = [...new Set(logs.map(l => l.blockNumber))];
	const limit = pLimit(5);
	await Promise.all(
			blockNumbers.map(bn =>
					limit(async () => {
						const block = await provider.getBlock(bn);
						blockCache.set(bn, block.timestamp);
					})
			)
	);

	for (const log of logs) {
		const timestamp = blockCache.get(log.blockNumber);
		const parsed = iface.parseLog(log);
		txs.push({
			id: log.transactionHash,
			address,
			direction,
			hash: log.transactionHash,
			msgHash: null,
			token: parsed.args.localToken,
			from: parsed.args.from,
			to: parsed.args.to,
			amount: parsed.args.amount.toString(),
			timestamp: timestamp,
			blockNumber: log.blockNumber,
			status: BRIDGE_STATUS.UNKNOWN,
			remaining: 0
		});
	}
	return txs;
}

async function scanLogs(provider, bridgeAddress, userAddress, fromBlock, toBlock) {
	return await provider.getLogs({
		address: bridgeAddress,
		fromBlock,
		toBlock,
		topics: [
			EVENT_TOPIC,
			null,
			null,
			ethers.zeroPadValue(userAddress, 32)
		]
	});
}

async function fetchLogsWithAPIOnce(apiUrl, chainId, { address, topic0, topic3, fromBlock, toBlock }) {
	const params = new URLSearchParams();
	if (chainId === '0x1' || chainId === '0xaa36a7') {
		params.append('chainid', parseInt(chainId, 16).toString());
		params.append('apikey', import.meta.env.VITE_ETHERSCAN_KEY);
	}
	params.append('module', 'logs');
	params.append('action', 'getLogs');
	params.append('address', address);
	params.append('fromBlock', fromBlock.toString());
	params.append('toBlock', toBlock.toString());
	params.append('topic0', topic0);
	params.append('topic0_3_opr', 'and');
	params.append('topic3', topic3);

	const response = await fetch(`${apiUrl}?${params}`);
	if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

	const data = await response.json();
	if (data.status === "0") {
		if (data.message === "No logs found" || data.result === null) return [];
		throw new Error(`API Error: ${data.result}`);
	}

	return Array.isArray(data.result) ? data.result : [];
}

async function fetchLogsWithAPI(apiUrl, chainId, account, direction, { address, topic0, topic3, fromBlock, toBlock }, opts = {}) {
	const {
		resultLimitHint = 1000,
		minSplitSpan = 1
	} = opts;

	const rawToTx = (log) => {
		try {
			const parsed = iface.parseLog({
				data: log.data,
				topics: log.topics
			});
			return {
				id: log.transactionHash,
				address: account,
				direction: direction,
				hash: log.transactionHash,
				msgHash: null,

				token: parsed.args.localToken,
				from: parsed.args.from,
				to: parsed.args.to,
				amount: parsed.args.amount.toString(),
				timestamp: parseInt(log.timeStamp, 16),
				blockNumber: parseInt(log.blockNumber, 16),
				status: BRIDGE_STATUS.UNKNOWN,
				remaining: 0
			};
		} catch (e) {
			return null;
		}
	};

	async function fetchRangeAdaptive(a, b) {
		const logs = await fetchLogsWithAPIOnce(apiUrl, chainId, { address, topic0, topic3, fromBlock: a, toBlock: b });
		if (logs.length === 0) return [];

		if (logs.length >= resultLimitHint && (b - a) > minSplitSpan) {
			const mid = Math.floor((a + b) / 2);
			const left = await fetchRangeAdaptive(a, mid);
			const right = await fetchRangeAdaptive(mid + 1, b);
			return [...left, ...right];
		}

		if (logs.length >= resultLimitHint && (b - a) <= minSplitSpan) {
			const err = new Error("API log window hit result limit; fallback to RPC for completeness");
			err.name = "ApiWindowLimitError";
			throw err;
		}

		return logs;
	}

	const allLogs = await fetchRangeAdaptive(fromBlock, toBlock);
	return allLogs.map(rawToTx).filter(tx => tx !== null);
}

async function syncLayer(layer, chainId, bridgeAddress, userAddress, opts = {}) {
	const { signal, onChunk } = opts;
	const isL1 = layer === "L1";
	const direction = isL1 ? BRIDGE_DIRECTION.L1_TO_L2 : BRIDGE_DIRECTION.L2_TO_L1;

	const progress = await loadProgress(userAddress, layer);
	const provider = isL1 ? getL1Provider(chainId) : getL2Provider(chainId);

	const deployBlock = BRIDGE_DEPLOY_BLOCK[chainId];
	let latest = await provider.getBlockNumber();
	latest = latest - (isL1 ? 1 : 6);
	let from = Math.max(progress.lastBlock + 1, deployBlock);
	if (latest <= from) return;

	const apiUrl = API_CONFIG[chainId];
	const blockDiff = latest - from;
	const threshold = isL1 ? API_THRESHOLD_L1 : API_THRESHOLD_L2;
	const canUseApi = apiUrl && blockDiff > threshold && hasL1ApiSupport(chainId);

	// api scan
	if (canUseApi) {
		try {
			let currentFrom = from;
			while (currentFrom <= latest) {
				throwIfAborted(signal);

				const currentTo = Math.min(currentFrom + MAX_API_STEP, latest);
				const txs = await fetchLogsWithAPI(apiUrl, chainId, userAddress, direction, {
					address: bridgeAddress,
					topic0: EVENT_TOPIC,
					topic3: ethers.zeroPadValue(userAddress, 32),
					fromBlock: currentFrom,
					toBlock: currentTo
				});

				if (txs.length > 0) {
					await saveTransactions(txs);
				}
				await updateProgress(userAddress, layer, currentTo);
				if (onChunk) {
					await onChunk({ layer, fromBlock: currentFrom, toBlock: currentTo, added: txs.length });
				}
				currentFrom = currentTo + 1;
			}
			return;
		} catch (err) {
			console.warn(`[${layer}] API load error`, err.message);
			const freshProgress = await loadProgress(userAddress, layer);
			from = Math.max(freshProgress.lastBlock + 1, deployBlock);
		}
	}

	// RPC scan
	const windowSize = isL1 ? L1_WINDOW : L2_WINDOW;
	while (from <= latest) {
		throwIfAborted(signal);
		const to = Math.min(from + windowSize, latest);
		const logs = await scanLogs(provider, bridgeAddress, userAddress, from, to);
		throwIfAborted(signal);

		if (logs.length > 0) {
			const txs = await parseLogs(logs, provider, isL1 ? BRIDGE_DIRECTION.L1_TO_L2 : BRIDGE_DIRECTION.L2_TO_L1, userAddress);
			await saveTransactions(txs);
		}

		await updateProgress(userAddress, layer, to);
		if (onChunk) await onChunk({ layer, fromBlock: from, toBlock: to, added: logs.length });
		from = to + 1;
	}
}

export async function syncUserTransactions(l1ChainId, l2ChainId, bridge, address, opts = {}) {
	await Promise.all([
		syncLayer("L1", l1ChainId, bridge.L1StandardBridge, address, opts),
		syncLayer("L2", l2ChainId, bridge.L2StandardBridge, address, opts)
	]);
	await syncPendingStatus(l1ChainId, l2ChainId, bridge, address, opts);
}
