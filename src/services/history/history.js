import pLimit from "p-limit";
import { ethers } from "ethers";
import { loadProgress, saveTransactions, updateProgress } from "./db.js";
import { BRIDGE_DIRECTION, BRIDGE_STATUS, API_CONFIG } from "@/config/constant.js";
import { CONVERT_ABI, L1_BRIDGE_ABI } from "@/config/abi.js";
import { getTokenConfig } from "@/config/tokens.js";
import { getL2Provider } from "@/infra/provider/providerManager.js";


const BRIDGE_DEPLOY_BLOCK = {
	'0x1': 23874421,      // Ethereum mainnet
	'0xaa36a7': 9605535, // Sepolia
	'0x186ab': 170563,    // QKC mainnet
	'0x1adbb': 169841      // QKC Sepolia
}

const METHOD_IDS = {
	CONVERT: "0xba00600a",    // convert(uint256)
	L1_BRIDGE: "0x2567f814",  // depositERC20To(address,address,address,uint256,uint32,bytes)
};

const IFACES = {
	CONVERT: new ethers.Interface(CONVERT_ABI),
	L1_BRIDGE: new ethers.Interface(L1_BRIDGE_ABI),
};

const MAX_HISTORY_DAYS = 180;
const HALF_YEAR_MS = MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;

const BRIDGE_ABI = [
	"event ERC20BridgeInitiated(address indexed localToken, address indexed remoteToken, address indexed from, address to, uint256 amount, bytes extraData)"
];
const BRIDGE_IFACE = new ethers.Interface(BRIDGE_ABI);
const BRIDGE_TOPIC = ethers.id("ERC20BridgeInitiated(address,address,address,address,uint256,bytes)");

const L2_BLOCK_TIME = 2;
const HALF_YEAR_BLOCKS = Math.floor(HALF_YEAR_MS / 1000 / L2_BLOCK_TIME);

function throwIfAborted(signal) {
	if (signal?.aborted) {
		const err = new Error("Sync aborted");
		err.name = "AbortError";
		throw err;
	}
}

// L1 use history
async function fetchTxPageV2(apiUrl, address, nextPageParams = null) {
	let url = `${apiUrl}/v2/addresses/${address}/transactions`;

	if (nextPageParams) {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(nextPageParams)) {
			params.append(key, value);
		}
		url = `${url}?${params.toString()}`;
	}

	const response = await fetch(url);
	const data = await response.json();
	return {
		items: data.items || [],
		nextPage: data.next_page_params || null
	};
}

const isMethod = (txMethod, targetId, targetName) => {
	const m = txMethod?.toLowerCase();
	return m === targetId.toLowerCase() || m === targetName.toLowerCase();
};

async function syncAccountHistory({ layer, chainId, bridgeAddr, convertAddr, userAddress, opts }) {
	const { signal, onChunk } = opts;
	const apiUrl = API_CONFIG[chainId];
	if (!apiUrl) return;

	// load last block
	const progress = await loadProgress(userAddress, layer);
	const lastSyncedBlock = Math.max(progress.lastBlock || 0, BRIDGE_DEPLOY_BLOCK[chainId]);

	let nextPageParams = null;
	let hasMore = true;
	let lastProcessedBlock = lastSyncedBlock;
	let isFirstPage = true;
	while (hasMore) {
		throwIfAborted(signal);

		const { items, nextPage } = await fetchTxPageV2(apiUrl, userAddress, nextPageParams);
		if (!items || items.length === 0) break;

		if (isFirstPage) {
			lastProcessedBlock = items[0].block_number;
			isFirstPage = false;
		}

		const txsToSave = [];
		for (const tx of items) {
			const bn = parseInt(tx.block_number);
			if (bn <= lastSyncedBlock) {
				hasMore = false;
				break;
			}

			const ts = new Date(tx.timestamp).getTime();
			if (Date.now() - ts > HALF_YEAR_MS) {
				hasMore = false;
				break;
			}

			const input = tx.raw_input?.toLowerCase() || "";
			const toHash = tx.to?.hash?.toLowerCase();
			const method = tx.method;
			// decode
			let parsed = null;
			if (toHash === convertAddr.toLowerCase() && isMethod(method, METHOD_IDS.CONVERT, "convert")) {
				try {
					const decoded = IFACES.CONVERT.decodeFunctionData("convert", input);
					const { address } = getTokenConfig('QKC', chainId);
					parsed = { type: 'CONVERT', amount: decoded[0].toString(), token: address };
				} catch (e) {}
			} else if (toHash === bridgeAddr.toLowerCase() && isMethod(method, METHOD_IDS.L1_BRIDGE, "depositERC20To")) {
				try {
					const decoded = IFACES.L1_BRIDGE.decodeFunctionData("depositERC20To", input);
					parsed = {type: 'BRIDGE', amount: decoded[3].toString(), token: decoded[0]};
				} catch (e) {}
			}

			if (parsed) {
				txsToSave.push({
					...parsed,
					id: tx.hash,
					hash: tx.hash,
					blockNumber: bn,
					timestamp: Math.floor(ts / 1000),
					address: userAddress,
					direction: BRIDGE_DIRECTION.L1_TO_L2,
					status: BRIDGE_STATUS.UNKNOWN
				});
			}
		}

		if (txsToSave.length > 0) {
			await saveTransactions(txsToSave);
			if (onChunk) onChunk({ layer });
		}

		// next page
		if (hasMore && nextPage) {
			nextPageParams = nextPage;
		} else {
			hasMore = false;
		}
	}

	// update block
	if (lastProcessedBlock > lastSyncedBlock) {
		await updateProgress(userAddress, layer, lastProcessedBlock);
	}
}

// L2 use logs
async function fetchLogsViaAPI(apiUrl, address, topic0, topic3, from, to) {
	const params = new URLSearchParams({
		module: 'logs',
		action: 'getLogs',
		address,
		fromBlock: from.toString(),
		toBlock: to.toString(),
		topic0,
		topic3,
		topic0_3_opr: 'and'
	});

	const res = await fetch(`${apiUrl}?${params}`);
	const data = await res.json();
	return data.status === "1" ? data.result : [];
}

async function processBridgeLogs(logs, provider, userAddress) {
	const limit = pLimit(5);

	return Promise.all(logs.map(log => limit(async () => {
		try {
			const parsed = BRIDGE_IFACE.parseLog({ data: log.data, topics: log.topics });
			const block = await provider.getBlock(log.blockNumber);
			return {
				id: log.transactionHash,
				hash: log.transactionHash,
				type: 'BRIDGE',
				direction: BRIDGE_DIRECTION.L2_TO_L1,
				status: BRIDGE_STATUS.UNKNOWN,
				address: userAddress,
				blockNumber: Number(log.blockNumber),
				timestamp: block?.timestamp || Math.floor(Date.now() / 1000),
				token: parsed.args.localToken,
				amount: parsed.args.amount.toString(),
			};
		} catch (e) {
			return null;
		}
	}))).then(results => results.filter(r => r !== null));
}

export async function syncL2Withdrawals({ layer, chainId, bridgeAddr, userAddress, opts }) {
	const { signal, onChunk } = opts;
	const apiUrl = API_CONFIG[chainId];
	if (!apiUrl) return;

	// 1. load last block
	const provider = getL2Provider(chainId);
	const progress = await loadProgress(userAddress, layer);
	let latest = await provider.getBlockNumber();
	const halfYearAgoBlock = Math.max(0, latest - HALF_YEAR_BLOCKS);
	let current = Math.max(
			progress.lastBlock + 1,
			BRIDGE_DEPLOY_BLOCK[chainId] || 0,
			halfYearAgoBlock
	);

	const userTopic = ethers.zeroPadValue(userAddress.toLowerCase(), 32);

	// 2. scan
	while (current <= latest) {
		throwIfAborted(signal);

		const step = 1000000; // 100w block
		const to = Math.min(current + step, latest);
		try {
			let rawLogs = await fetchLogsViaAPI(apiUrl, bridgeAddr, BRIDGE_TOPIC, userTopic, current, to);
			if (rawLogs.length > 0) {
				const txs = await processBridgeLogs(rawLogs, provider, userAddress);
				if (txs.length > 0) {
					await saveTransactions(txs);
					if (onChunk) onChunk({ count: txs.length, from: current, to });
				}
			}

			await updateProgress(userAddress, layer, to);
			current = to + 1;
		} catch (e) {
			console.error("L2 Log Sync Error:", e);
			break;
		}
	}
}

export async function syncUserTransactions(l1ChainId, l2ChainId, bridge, conversion, account, opts = {}) {
	const { L1StandardBridge, L2StandardBridge } = bridge;
	await Promise.all([
		syncAccountHistory({
			layer: "L1",
			chainId: l1ChainId,
			bridgeAddr: L1StandardBridge,
			convertAddr: conversion,
			userAddress: account,
			opts
		}),
		syncL2Withdrawals({
			layer: "L2",
			chainId: l2ChainId,
			bridgeAddr: L2StandardBridge,
			userAddress: account,
			opts
		})
	]);
}
