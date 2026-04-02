import { ethers } from "ethers";
import { loadProgress, saveTransactions, updateProgress } from "./db.js";
import { BRIDGE_DIRECTION, BRIDGE_STATUS, API_CONFIG } from "@/config/constant.js";
import { getTokenConfig } from "@/config/tokens.ts";


const BRIDGE_DEPLOY_BLOCK = {
	'0x1': 23874421,      // Ethereum mainnet
	'0xaa36a7': 9605535, // Sepolia
	'0x186ab': 170563,    // QKC mainnet
	'0x1adbb': 169841      // QKC Sepolia
}

const CONVERT_METHOD_IDS = "0xba00600a"; // convert(uint256)

const MAX_HISTORY_DAYS = 180;
const HALF_YEAR_MS = MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;

const BRIDGE_ABI = [
	"event ERC20BridgeInitiated(address indexed localToken, address indexed remoteToken, address indexed from, address to, uint256 amount, bytes extraData)"
];
const BRIDGE_IFACE = new ethers.Interface(BRIDGE_ABI);
const BRIDGE_TOPIC = ethers.id("ERC20BridgeInitiated(address,address,address,address,uint256,bytes)");

const L1_BLOCK_TIME = 12;
const L2_BLOCK_TIME = 2;
// retry
const FETCH_RETRIES = 3;

function throwIfAborted(signal) {
	if (signal?.aborted) {
		const err = new Error("Sync aborted");
		err.name = "AbortError";
		throw err;
	}
}

async function fetchWithRetry(url, signal = null) {
	for (let attempt = 0; attempt < FETCH_RETRIES; attempt++) {
		try {
			const res = await fetch(url, { signal });
			if (!res.ok) throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
			return await res.json();
		} catch (err) {
			if (err.name === 'AbortError') {
				throw err;
			}
			if (attempt === FETCH_RETRIES - 1) {
				throw new Error(`Request fail: ${err.message}`);
			}
			const delay = 1000 * Math.pow(2, attempt);
			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}
}


// L1 use history
async function fetchTxPageV2(apiUrl, address, oQKC, nextPageParams = null, signal) {
	let url = `${apiUrl}/v2/addresses/${address}/token-transfers?type=ERC-20&token=${oQKC}`;

	if (nextPageParams) {
		const params = new URLSearchParams(nextPageParams);
		url = `${url}&${params.toString()}`;
	}

	const data = await fetchWithRetry(url, signal);
	return {
		items: data.items || [],
		nextPage: data.next_page_params || null
	};
}

const isMethod = (txMethod, targetId, targetName) => {
	const m = txMethod?.toLowerCase();
	return m === targetId.toLowerCase() || m === targetName.toLowerCase();
};

async function syncConvertTransfers({ layer, chainId, convertAddr, userAddress, currentCount, opts }) {
	const { signal, onChunk } = opts;
	const apiUrl = API_CONFIG[chainId];
	if (!apiUrl) return;

	// load last block
	const progress = await loadProgress(userAddress, layer);
	const lastSyncedBlock = Math.max(progress.lastBlock || 0, BRIDGE_DEPLOY_BLOCK[chainId]);

	const { address: oQKC } = getTokenConfig('QKC', chainId);
	const convertAddrLower = convertAddr.toLowerCase();

	let nextPageParams = null;
	let hasMore = true;
	let lastProcessedBlock = lastSyncedBlock;
	let isFirstPage = true;
	while (hasMore) {
		throwIfAborted(signal);

		const { items, nextPage } = await fetchTxPageV2(apiUrl, userAddress, oQKC, nextPageParams, signal);
		if (!items || items.length === 0) break;

		if (isFirstPage) {
			lastProcessedBlock = parseInt(items[0].block_number);
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

			// decode
			if (tx.to?.hash?.toLowerCase() === convertAddrLower && isMethod(tx.method, CONVERT_METHOD_IDS, "convert")) {
				txsToSave.push({
					type: 'CONVERT',
					amount: tx.total.value,
					token: oQKC,
					id: tx.transaction_hash,
					hash: tx.transaction_hash,
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
		nextPageParams = (hasMore && nextPage) ? nextPage : null;
		hasMore = !!nextPageParams;
	}

	// update block
	if (lastProcessedBlock >= lastSyncedBlock) {
		await updateProgress(userAddress, layer, lastProcessedBlock, currentCount);
	}
}

// L2 use logs
async function fetchLogsViaAPI(apiUrl, address, topic0, topic3, from, to, signal) {
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

	const data = await fetchWithRetry(`${apiUrl}?${params}`, signal);
	return data.status === "1" ? data.result : [];
}

function processBridgeLogs(logs, userAddress, direction) {
	return logs.map(log => {
		try {
			const parsed = BRIDGE_IFACE.parseLog({ data: log.data, topics: log.topics });
			return {
				id: log.transactionHash,
				hash: log.transactionHash,
				type: 'BRIDGE',
				direction,
				status: BRIDGE_STATUS.UNKNOWN,
				address: userAddress,
				blockNumber: parseInt(log.blockNumber, 16),
				timestamp: parseInt(log.timeStamp, 16),
				token: parsed.args.localToken,
				amount: parsed.args.amount.toString(),
			};
		} catch (e) {
			return null;
		}
	}).filter(r => r !== null);
}

async function syncBridgeLogs({ layer, chainId, bridgeAddr, userAddress, direction, latest, currentCount, opts }) {
	const { signal, onChunk } = opts;
	const apiUrl = API_CONFIG[chainId];
	if (!apiUrl) return;

	// 1. load last block
	const isL1ToL2 = direction === BRIDGE_DIRECTION.L1_TO_L2;
	const blockTime = isL1ToL2 ? L1_BLOCK_TIME : L2_BLOCK_TIME;
	const HALF_YEAR_BLOCKS = Math.floor(HALF_YEAR_MS / 1000 / blockTime);
	const userTopic = ethers.zeroPadValue(userAddress.toLowerCase(), 32);

	const halfYearAgoBlock = Math.max(0, latest - HALF_YEAR_BLOCKS);
	const progress = await loadProgress(userAddress, layer);
	let current = Math.max(
			progress.lastBlock + 1,
			BRIDGE_DEPLOY_BLOCK[chainId] || 0,
			halfYearAgoBlock
	);

	// 2. scan
	const step = isL1ToL2 ? 500000 : 1000000;
	let isAllSuccess = true;
	while (current <= latest) {
		throwIfAborted(signal);

		const to = Math.min(current + step, latest);
		try {
			const rawLogs = await fetchLogsViaAPI(apiUrl, bridgeAddr, BRIDGE_TOPIC, userTopic, current, to, signal);
			if (rawLogs?.length) {
				const txs = processBridgeLogs(rawLogs, userAddress, direction);
				if (txs.length) {
					await saveTransactions(txs);
					if (onChunk) onChunk({ count: txs.length, from: current, to });
				}
			}

			await updateProgress(userAddress, layer, to, progress.lastCount);
			current = to + 1;
		} catch (e) {
			console.error(`[${layer}] Log Sync Error:`, e);
			isAllSuccess = false;
			break;
		}
	}

	if (isAllSuccess) {
		await updateProgress(userAddress, layer, latest, currentCount);
	}
}

export async function syncUserTransactions(l1ChainId, l2ChainId, bridge, conversion, account, opts = {}) {
	const { signal } = opts;
	const [l1Stats, l1Counters, l2Stats, l2Counters] = await Promise.all([
		fetchWithRetry(`${API_CONFIG[l1ChainId]}/v2/stats`, signal).catch(() => null),
		fetchWithRetry(`${API_CONFIG[l1ChainId]}/v2/addresses/${account}/counters`, signal).catch(() => null),
		fetchWithRetry(`${API_CONFIG[l2ChainId]}/v2/stats`, signal).catch(() => null),
		fetchWithRetry(`${API_CONFIG[l2ChainId]}/v2/addresses/${account}/counters`, signal).catch(() => null)
	]);
	const [pL1Bridge, pL1Convert, pL2Bridge] = await Promise.all([
		loadProgress(account, "L1_BRIDGE"),
		loadProgress(account, "L1_CONVERT"),
		loadProgress(account, "L2_WITHDRAW"),
	]);

	const { L1StandardBridge, L2StandardBridge } = bridge;
	const tasks = [];
	// l1
	if (l1Stats && l1Counters) {
		const l1Latest = parseInt(l1Stats.total_blocks) || 0;
		const l1Count = parseInt(l1Counters.transactions_count) || 0;

		// L1 Bridge
		if (l1Count !== pL1Bridge?.lastCount) {
			tasks.push(syncBridgeLogs({
				layer: "L1_BRIDGE",
				chainId: l1ChainId,
				bridgeAddr: L1StandardBridge,
				userAddress: account,
				direction: BRIDGE_DIRECTION.L1_TO_L2,
				latest: l1Latest,
				currentCount: l1Count,
				opts
			}));
		} else {
			await updateProgress(account, "L1_BRIDGE", l1Latest, l1Count);
		}

		// L1 Convert
		if (l1Count !== pL1Convert?.lastCount) {
			tasks.push(syncConvertTransfers({
				layer: "L1_CONVERT",
				chainId: l1ChainId,
				convertAddr: conversion,
				userAddress: account,
				currentCount: l1Count,
				opts
			}));
		}
	}

	// l2
	if (l2Stats && l2Counters) {
		const l2Latest = parseInt(l2Stats.total_blocks) || 0;
		const l2Count = parseInt(l2Counters.transactions_count) || 0;

		if (l2Count !== pL2Bridge?.lastCount) {
			tasks.push(syncBridgeLogs({
				layer: "L2_WITHDRAW",
				chainId: l2ChainId,
				bridgeAddr: L2StandardBridge,
				userAddress: account,
				direction: BRIDGE_DIRECTION.L2_TO_L1,
				latest: l2Latest,
				currentCount: l2Count,
				opts
			}));
		} else {
			await updateProgress(account, "L2_WITHDRAW", l2Latest, l2Count);
		}
	}

	if (tasks.length > 0) {
		await Promise.all(tasks);
	}
}
