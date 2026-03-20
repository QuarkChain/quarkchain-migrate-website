import pLimit from 'p-limit';
import { ethers } from "ethers";
import { loadProgress, saveTransactions, updateProgress } from "./db.js";
import { getL1Provider, getL2Provider } from "@/infra/provider/providerManager.js";
import { BRIDGE_DIRECTION, BRIDGE_STATUS, API_CONFIG } from "@/config/constant.js";

const BRIDGE_DEPLOY_BLOCK = {
	'0x1': 23874421,      // Ethereum mainnet
	'0xaa36a7': 9605535, // Sepolia
	'0x186ab': 170563,    // QKC mainnet
	'0x1adbb': 169841      // QKC Sepolia
}

const TOPICS = {
	BRIDGE: ethers.id("ERC20BridgeInitiated(address,address,address,address,uint256,bytes)"),
	CONVERT: ethers.id("TransactionDeposited(address,address,uint256,bytes)")
};

const IFACES = {
	BRIDGE: new ethers.Interface(["event ERC20BridgeInitiated(address indexed localToken,address indexed remoteToken,address indexed from,address to,uint256 amount,bytes extraData)"]),
	CONVERT: new ethers.Interface(["event TransactionDeposited(address indexed from, address indexed to, uint256 indexed version, bytes opaqueData)"])
};

const PARSERS = {
	BRIDGE: (parsed) => ({
		type: 'BRIDGE',
		token: parsed.args.localToken,
		amount: parsed.args.amount.toString(),
	}),
	CONVERT: (parsed) => {
		const amount = parseAmountFromOpaqueData(parsed.args.opaqueData);
		return {
			type: 'CONVERT',
			amount: amount,
		};
	}
};

function throwIfAborted(signal) {
	if (signal?.aborted) {
		const err = new Error("Sync aborted");
		err.name = "AbortError";
		throw err;
	}
}

function parseAmountFromOpaqueData(opaqueData) {
	try {
		const normalizedData = opaqueData.startsWith('0x') ? opaqueData : `0x${opaqueData}`;
		if (!normalizedData || normalizedData === '0x' || normalizedData.length < 66) {
			return "0";
		}

		const amountHex = normalizedData.substring(0, 66);
		return BigInt(amountHex).toString();
	} catch (error) {
		return "0";
	}
}

async function processLogs(logs, provider, type, userAddress, direction) {
	const blocksToFetch = [];
	const parsedLogs = logs.map(log => {
		try {
			const parsed = IFACES[type].parseLog({ data: log.data, topics: log.topics });
			const data = PARSERS[type](parsed);

			const bn = typeof log.blockNumber === 'string' ? parseInt(log.blockNumber, 16) : log.blockNumber;
			let ts = null;
			if (log.timeStamp) {
				ts = log.timeStamp.startsWith('0x') ? parseInt(log.timeStamp, 16) : parseInt(log.timeStamp);
			} else {
				blocksToFetch.push(bn);
			}

			return { ...data, hash: log.transactionHash, blockNumber: bn, timestamp: ts };
		} catch (e) { return null; }
	}).filter(l => l !== null);

	if (blocksToFetch.length > 0) {
		const blockCache = new Map();
		const uniqueBlocks = [...new Set(blocksToFetch)];
		const limit = pLimit(10);
		await Promise.all(uniqueBlocks.map(bn => limit(async () => {
			const block = await provider.getBlock(bn);
			blockCache.set(bn, block?.timestamp || 0);
		})));

		parsedLogs.forEach(tx => {
			if (tx.timestamp === null) tx.timestamp = blockCache.get(tx.blockNumber);
		});
	}

	return parsedLogs.map(tx => ({
		...tx,
		id: tx.hash,
		address: userAddress,
		direction,
		status: BRIDGE_STATUS.UNKNOWN
	}));
}

async function fetchLogsWithAPIOnce(apiUrl, chainId, { address, topic0, topic1, topic2, topic3, fromBlock, toBlock }) {
	const params = new URLSearchParams({
		module: 'logs',
		action: 'getLogs',
		address,
		fromBlock: fromBlock.toString(),
		toBlock: toBlock.toString(),
		topic0
	});
	if (topic1) { params.append('topic1', topic1); params.append('topic0_1_opr', 'and'); }
	if (topic2) { params.append('topic2', topic2); params.append('topic0_2_opr', 'and'); }
	if (topic3) { params.append('topic3', topic3); params.append('topic0_3_opr', 'and'); }

	const response = await fetch(`${apiUrl}?${params}`);
	const data = await response.json();
	if (data.status === "0") {
		if (data.message === "No logs found" || data.result === null) return [];
		throw new Error(`API Error: ${data.result}`);
	}

	return Array.isArray(data.result) ? data.result : [];
}

async function syncContractLogs({ layer, chainId, contractAddress, userAddress, type, opts }) {
	const { signal, onChunk } = opts;
	const isL1 = layer === "L1";
	const direction = isL1 ? BRIDGE_DIRECTION.L1_TO_L2 : BRIDGE_DIRECTION.L2_TO_L1;
	const provider = isL1 ? getL1Provider(chainId) : getL2Provider(chainId);
	const apiUrl = API_CONFIG[chainId];

	const progressKey = `${layer}_${type}_${contractAddress.slice(0, 8)}`;
	const progress = await loadProgress(userAddress, progressKey);

	let current = Math.max(progress.lastBlock + 1, BRIDGE_DEPLOY_BLOCK[chainId] || 0);
	let latest = (await provider.getBlockNumber()) - (isL1 ? 1 : 6);

	const topic0 = TOPICS[type];
	const userTopic = ethers.zeroPadValue(userAddress, 32);

	const apiParams = { address: contractAddress, topic0 };
	const rpcTopics = [topic0, null, null, null];
	if (type === 'BRIDGE') {
		// BRIDGE: from  -> topic3
		apiParams.topic3 = userTopic;
		rpcTopics[3] = userTopic;
	} else if (type === 'CONVERT') {
		// CONVERT: to -> topic2
		apiParams.topic2 = userTopic;
		rpcTopics[2] = userTopic;
	}

	// --- Use Api ---
	if (apiUrl) {
		try {
			while (current <= latest) {
				throwIfAborted(signal);
				const to = Math.min(current + 800000, latest);

				const rawLogs = await fetchLogsWithAPIOnce(apiUrl, chainId,{
					...apiParams, fromBlock: current, toBlock: to
				});
				if (rawLogs.length > 0) {
					const txs = await processLogs(rawLogs, provider, type, userAddress, direction);
					if (txs.length > 0) await saveTransactions(txs);
				}

				await updateProgress(userAddress, progressKey, to);
				if (onChunk) onChunk({ type, method: 'API', from: current, to });
				current = to + 1;
			}
			return;
		} catch (e) {
			console.warn(`[${type}] API error: ${e.message}. Falling back to RPC...`);
		}
	}

	// --- Use RPC ---
	const RPC_WINDOW = isL1 ? 5000 : 50000;
	while (current <= latest) {
		throwIfAborted(signal);

		const to = Math.min(current + RPC_WINDOW, latest);

		const rawLogs = await provider.getLogs({
			address: contractAddress,
			fromBlock: current,
			toBlock: to,
			topics: rpcTopics
		});
		if (rawLogs.length > 0) {
			const txs = await processLogs(rawLogs, provider, type, userAddress, direction);
			if (txs.length > 0) await saveTransactions(txs);
		}

		await updateProgress(userAddress, progressKey, to);
		current = to + 1;
	}
}

export async function syncUserTransactions(l1ChainId, l2ChainId, bridge, conversion, account, opts = {}) {
	const { L1StandardBridge, L2StandardBridge } = bridge;
	await Promise.all([
		// 1. L1
		syncContractLogs({ layer: "L1", chainId: l1ChainId, contractAddress: L1StandardBridge, userAddress: account, type: 'BRIDGE', opts }),
		// 2. L2
		syncContractLogs({ layer: "L2", chainId: l2ChainId, contractAddress: L2StandardBridge, userAddress: account, type: 'BRIDGE', opts }),
		// 3. Conversion
		syncContractLogs({ layer: "L1", chainId: l1ChainId, contractAddress: conversion, userAddress: account, type: 'CONVERT', opts })
	]);
}
