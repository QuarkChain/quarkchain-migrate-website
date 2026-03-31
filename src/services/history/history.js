import pLimit from "p-limit";
import { ethers } from "ethers";
import { loadProgress, saveTransactions, updateProgress } from "./db.js";
import { BRIDGE_DIRECTION, BRIDGE_STATUS, API_CONFIG } from "@/config/constant.js";
import { getTokenConfig } from "@/config/tokens.ts";
import { getL1Provider, getL2Provider } from "@/infra/provider/providerManager.js";


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

function throwIfAborted(signal) {
	if (signal?.aborted) {
		const err = new Error("Sync aborted");
		err.name = "AbortError";
		throw err;
	}
}

// L1 use history
async function fetchTxPageV2(apiUrl, address, oQKC, nextPageParams = null) {
	let url = `${apiUrl}/v2/addresses/${address}/token-transfers?type=ERC-20&token=${oQKC}`;

	if (nextPageParams) {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(nextPageParams)) {
			params.append(key, value);
		}
		url = `${url}&${params.toString()}`;
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

async function syncConvertTransfers({ layer, chainId, convertAddr, userAddress, opts }) {
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

		const { items, nextPage } = await fetchTxPageV2(apiUrl, userAddress, oQKC, nextPageParams);
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

async function syncBridgeLogs({ layer, chainId, bridgeAddr, userAddress, direction, opts }) {
	const { signal, onChunk } = opts;
	const apiUrl = API_CONFIG[chainId];
	if (!apiUrl) return;

	// 1. load last block
	const isL1ToL2 = direction === BRIDGE_DIRECTION.L1_TO_L2;
	const blockTime = isL1ToL2 ? L1_BLOCK_TIME : L2_BLOCK_TIME;
	const HALF_YEAR_BLOCKS = Math.floor(HALF_YEAR_MS / 1000 / blockTime);

	const provider = isL1ToL2 ? getL1Provider(chainId) : getL2Provider(chainId);
	const [latest, progress] = await Promise.all([
		provider.getBlockNumber(),
		loadProgress(userAddress, layer)
	]);

	const halfYearAgoBlock = Math.max(0, latest - HALF_YEAR_BLOCKS);
	let current = Math.max(
			progress.lastBlock + 1,
			BRIDGE_DEPLOY_BLOCK[chainId] || 0,
			halfYearAgoBlock
	);
	const lastSynced = progress.lastBlock || 0;
	const syncThreshold = isL1ToL2 ? 5 : 50;
	if (lastSynced > 0 && (latest - lastSynced) < syncThreshold) {
		return;
	}

	const userTopic = ethers.zeroPadValue(userAddress.toLowerCase(), 32);
	// 2. scan
	const step = 1000000; // 100w block
	while (current <= latest) {
		throwIfAborted(signal);

		const to = Math.min(current + step, latest);
		try {
			const rawLogs = await fetchLogsViaAPI(apiUrl, bridgeAddr, BRIDGE_TOPIC, userTopic, current, to);
			if (rawLogs && rawLogs.length > 0) {
				const txs = processBridgeLogs(rawLogs, userAddress, direction);
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
		// 1. L1 Bridge (scan Logs)
		syncBridgeLogs({
			layer: "L1_BRIDGE",
			chainId: l1ChainId,
			bridgeAddr: L1StandardBridge,
			userAddress: account,
			direction: BRIDGE_DIRECTION.L1_TO_L2,
			opts
		}),

		// 2. L2 Bridge (scan Logs)
		syncBridgeLogs({
			layer: "L2_WITHDRAW",
			chainId: l2ChainId,
			bridgeAddr: L2StandardBridge,
			userAddress: account,
			direction: BRIDGE_DIRECTION.L2_TO_L1,
			opts
		}),

		// 3. L1 Convert (Token Transfer API)
		syncConvertTransfers({
			layer: "L1_CONVERT",
			chainId: l1ChainId,
			convertAddr: conversion,
			userAddress: account,
			opts
		})
	]);
}
