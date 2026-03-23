import { ethers } from "ethers";
import { loadProgress, saveTransactions, updateProgress } from "./db.js";
import { BRIDGE_DIRECTION, BRIDGE_STATUS, API_CONFIG } from "@/config/constant.js";
import { CONVERT_ABI, L1_BRIDGE_ABI, L2_BRIDGE_ABI } from "@/config/abi.js";

const BRIDGE_DEPLOY_BLOCK = {
	'0x1': 23874421,      // Ethereum mainnet
	'0xaa36a7': 9605535, // Sepolia
	'0x186ab': 170563,    // QKC mainnet
	'0x1adbb': 169841      // QKC Sepolia
}

const METHOD_IDS = {
	CONVERT: "0xba00600a",    // convert(uint256)
	L1_BRIDGE: "0x2567f814",  // depositERC20To(address,address,address,uint256,uint32,bytes)
	L2_BRIDGE: "0x370897cc"   // withdrawTo(address,address,uint256,uint32,bytes)
};

const IFACES = {
	CONVERT: new ethers.Interface(CONVERT_ABI),
	L1_BRIDGE: new ethers.Interface(L1_BRIDGE_ABI),
	L2_BRIDGE: new ethers.Interface(L2_BRIDGE_ABI)
};

const MAX_HISTORY_DAYS = 180;
const HALF_YEAR_MS = MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;

function throwIfAborted(signal) {
	if (signal?.aborted) {
		const err = new Error("Sync aborted");
		err.name = "AbortError";
		throw err;
	}
}

async function fetchTxPageDesc(apiUrl, address, page, offset, startblock) {
	const params = new URLSearchParams({
		module: 'account',
		action: 'txlist',
		address,
		startblock: startblock.toString(),
		page: page.toString(),
		offset: offset.toString(),
		sort: 'desc'
	});
	const response = await fetch(`${apiUrl}?${params}`);
	const data = await response.json();
	if (data.status !== "1" || !Array.isArray(data.result)) {
		return [];
	}
	return data.result;
}

async function syncAccountHistory({ layer, chainId, bridgeAddr, convertAddr, userAddress, opts }) {
	const { signal, onChunk } = opts;
	const apiUrl = API_CONFIG[chainId];
	if (!apiUrl) return;

	const direction = (layer === "L1") ? BRIDGE_DIRECTION.L1_TO_L2 : BRIDGE_DIRECTION.L2_TO_L1;
	const now = Date.now();

	// load last block
	const progress = await loadProgress(userAddress, layer);
	const lastSyncedBlock = Math.max(progress.lastBlock || 0, BRIDGE_DEPLOY_BLOCK[chainId]);

	let page = 1;
	let hasMore = true;
	let lastProcessedBlock = lastSyncedBlock;
	while (hasMore) {
		throwIfAborted(signal);

		const txs = await fetchTxPageDesc(apiUrl, userAddress, page, PAGE_SIZE, lastSyncedBlock + 1);
		if (!txs || txs.length === 0) break;

		if (page === 1) {
			lastProcessedBlock = parseInt(txs[0].blockNumber);
		}

		const txsToSave = [];
		for (const tx of txs) {
			const bn = parseInt(tx.blockNumber);
			const ts = parseInt(tx.timeStamp) * 1000;
			const to = tx.to?.toLowerCase();
			const input = tx.input.toLowerCase();

			if (bn <= lastSyncedBlock) {
				hasMore = false;
				break;
			}
			if (now - ts > HALF_YEAR_MS) {
				hasMore = false;
				break;
			}

			// decode
			let parsed = null;
			if (layer === "L1" && convertAddr && to === convertAddr.toLowerCase() && input.startsWith(METHOD_IDS.CONVERT)) {
				try {
					const decoded = IFACES.CONVERT.decodeFunctionData("convert", input);
					parsed = { type: 'CONVERT', amount: decoded[0].toString(), token: 'NATIVE' };
				} catch (e) {}
			}
			else if (layer === "L1" && to === bridgeAddr.toLowerCase() && input.startsWith(METHOD_IDS.L1_BRIDGE)) {
				try {
					const decoded = IFACES.L1_BRIDGE.decodeFunctionData("depositERC20To", input);
					parsed = { type: 'BRIDGE', amount: decoded[3].toString(), token: decoded[0] };
				} catch (e) {}
			}
			else if (layer === "L2" && to === bridgeAddr.toLowerCase() && input.startsWith(METHOD_IDS.L2_BRIDGE)) {
				try {
					const decoded = IFACES.L2_BRIDGE.decodeFunctionData("withdrawTo", input);
					parsed = { type: 'BRIDGE', amount: decoded[2].toString(), token: decoded[0] };
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
					direction,
					status: BRIDGE_STATUS.UNKNOWN
				});
			}
		}

		if (txsToSave.length > 0) {
			await saveTransactions(txsToSave);
			if (onChunk) onChunk({ layer });
		}

		// count < PAGE_SIZE, no more data
		if (txs.length < PAGE_SIZE) {
			hasMore = false;
		}

		page++;
		// safe limit
		if (page > 100) break;
	}

	// update block
	if (lastProcessedBlock > lastSyncedBlock) {
		await updateProgress(userAddress, layer, lastProcessedBlock);
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
		syncAccountHistory({
			layer: "L2",
			chainId: l2ChainId,
			bridgeAddr: L2StandardBridge,
			convertAddr: null,
			userAddress: account,
			opts
		})
	]);
}
