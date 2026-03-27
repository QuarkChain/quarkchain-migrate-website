import pLimit from 'p-limit';
import { ethers } from 'ethers';
import { loadPendingTransactions, saveTransactions } from "@/services/history/db.js";
import { BRIDGE_DIRECTION, BRIDGE_STATUS } from "@/config/constant.js";
import { MUTILCALL_ABI } from "@/config/abi.js";
import { queryL2MintStatuses } from "@/services/migration/nativeMigration.js";
import { batchCheckL1ToL2Status, getL1ToL2MessageHash } from "@/services/bridge/l1ToL2.js";
import { getL1Provider, getL2Provider } from "@/infra/provider/providerManager.js";
import { getPublicClientL1, getPublicClientL2 } from "@/infra/viem/clients.js";
import {
	checkProveStatus,
	extractWithdrawal
} from "@/services/bridge/l2ToL1.js";

const MULTICALL_BATCH_SIZE = 50;

function throwIfAborted(signal) {
	if (signal?.aborted) {
		const err = new Error("Sync aborted");
		err.name = "AbortError";
		throw err;
	}
}

function refresh(onChunk) {
	if(onChunk) onChunk({ refresh: true });
}

async function batchCheckFinalized(l1Provider, portalAddress, multicallAddress, txs, signal) {
	const validTxs = txs.filter(tx => tx.msgHash);
	if (validTxs.length === 0) return {};

	const iface = new ethers.Interface(["function finalizedWithdrawals(bytes32) view returns (bool)"]);
	const multicall = new ethers.Contract(multicallAddress, MUTILCALL_ABI, l1Provider);

	const results = {};
	for (let i = 0; i < validTxs.length; i += MULTICALL_BATCH_SIZE) {
		throwIfAborted(signal);
		const batch = validTxs.slice(i, i + MULTICALL_BATCH_SIZE);
		const calls = batch.map(tx => ({
			target: portalAddress,
			callData: iface.encodeFunctionData("finalizedWithdrawals", [tx.msgHash])
		}));

		try {
			const [, returnData] = await multicall.aggregate(calls);
			returnData.forEach((data, idx) => {
				const [isDone] = iface.decodeFunctionResult("finalizedWithdrawals", data);
				results[batch[idx].id] = isDone;
			});
		} catch (e) {
			console.error(`Multicall batch failed for ${batch.length} txs, skipping`, e);
		}
	}
	return results;
}

async function batchCheckProved(l1Provider, portalAddress, multicallAddress, txs, signal) {
	const validTxs = txs.filter(tx => tx.msgHash);
	if (validTxs.length === 0) return {};

	const iface = new ethers.Interface(["function provenWithdrawals(bytes32 withdrawalHash, address proofSubmitter) view returns (address disputeGameProxy, uint64 timestamp)"]);
	const multicall = new ethers.Contract(multicallAddress, MUTILCALL_ABI, l1Provider);

	const results = {};
	for (let i = 0; i < validTxs.length; i += MULTICALL_BATCH_SIZE) {
		throwIfAborted(signal);

		const batch = validTxs.slice(i, i + MULTICALL_BATCH_SIZE);
		const calls = batch.map(tx => ({
			target: portalAddress,
			allowFailure: true,
			callData: iface.encodeFunctionData("provenWithdrawals", [
				tx.msgHash,
				tx.address
			])
		}));

		try {
			const resultData = await multicall.aggregate3.staticCall(calls);
			batch.forEach((tx, idx) => {
				const { success, returnData } = resultData[idx];
				if (success && returnData !== "0x") {
					const [, timestamp] = iface.decodeFunctionResult("provenWithdrawals", returnData);
					const ts = Number(timestamp);
					if (ts > 0) {
						results[tx.id] = { isProven: true, provenTimestamp: ts };
					} else {
						results[tx.id] = { isProven: false };
					}
				}
			});
		} catch (e) {
			console.error("L2->L1 Proven Multicall failed", e);
		}
	}
	return results;
}

export async function syncPendingStatus(l1ChainId, l2ChainId, bridge, multicallL1, multicallL2, address, opts = {}) {
	const allPendings = await loadPendingTransactions(address);
	if (allPendings.length === 0) return;

	// 1. Native Migration (CONVERT)
	const migrationTxs = allPendings.filter(tx => tx.type === 'CONVERT');

	// 2. Bridge (BRIDGE)
	const bridgeTxs = allPendings.filter(tx => tx.type === 'BRIDGE');
	const l1ToL2BridgeTxs = bridgeTxs.filter(tx => tx.direction === BRIDGE_DIRECTION.L1_TO_L2);
	const l2ToL1BridgeTxs = bridgeTxs.filter(tx => tx.direction === BRIDGE_DIRECTION.L2_TO_L1);

	const syncTasks = [];
	if (migrationTxs.length > 0) {
		syncTasks.push(handleMigrationSync(l2ChainId, address, migrationTxs, opts));
	}
	if (l1ToL2BridgeTxs.length > 0) {
		syncTasks.push(handleL1ToL2Sync(l1ChainId, l2ChainId, bridge, multicallL2, l1ToL2BridgeTxs, opts));
	}
	if (l2ToL1BridgeTxs.length > 0) {
		syncTasks.push(handleL2ToL1Sync(l1ChainId, l2ChainId, bridge, multicallL1, l2ToL1BridgeTxs, opts));
	}
	await Promise.all(syncTasks);
}

const MIGRATION_FINALITY_THRESHOLD = 3 * 24 * 60 * 60;

async function handleMigrationSync(l2ChainId, address, txs, opts) {
	const { signal, onChunk } = opts;
	const now = Date.now();
	const toQuery = [];
	const autoCompleted = [];
	txs.forEach(tx => {
		const elapsed = now / 1000 - tx.timestamp;
		if (elapsed > MIGRATION_FINALITY_THRESHOLD) { // filter > 3 days
			autoCompleted.push({
				id: tx.id,
				status: BRIDGE_STATUS.COMPLETED,
				remaining: 0
			});
		} else {
			// 3 days
			toQuery.push(tx);
		}
	});
	if (autoCompleted.length > 0) {
		await saveTransactions(autoCompleted);
		refresh(onChunk);
	}

	if (toQuery.length === 0) return;

	try {
		const resultMap = await queryL2MintStatuses(l2ChainId, address, toQuery, signal);
		const updates = [];
		for (const [id, result] of resultMap) {
			if (result) {
				updates.push({
					id,
					status: BRIDGE_STATUS.COMPLETED,
					remaining: 0
				});
			}
		}
		if (updates.length > 0) {
			await saveTransactions(updates);
			refresh(onChunk);
		}
	} catch (e) {
		console.error("Migration sync failed", e);
	}
}

async function handleL1ToL2Sync(l1ChainId, l2ChainId, bridge, multicall, txs, opts) {
	const { signal, onChunk } = opts;
	const l1Provider = getL1Provider(l1ChainId);
	const l2Provider = getL2Provider(l2ChainId);

	// 1. batch get msgHash
	const limit = pLimit(3);
	const hashTasks = txs.map(tx => limit(async () => {
		if (!tx.msgHash) {
			try {
				tx.msgHash = await getL1ToL2MessageHash(l1Provider, tx.hash, bridge.L1CrossDomainMessengerProxy);
				if (tx.msgHash) await saveTransactions({ id: tx.id, msgHash: tx.msgHash });
			} catch (e) {
				console.warn(`L1->L2 msgHash error，Tx: ${tx.id}`, e);
			}
		}
	}));
	await Promise.all(hashTasks);

	// 2. use Multicall
	const validTxs = txs.filter(tx => tx.msgHash);
	const statusMap = await batchCheckL1ToL2Status(
			l2Provider,
			bridge.L2CrossDomainMessenger,
			multicall,
			validTxs,
			signal
	);

	// 3. update status
	const updates = txs.map(tx => {
		const status = statusMap[tx.id];
		return {
			id: tx.id,
			status: status || tx.status,
			msgHash: tx.msgHash
		};
	});
	await saveTransactions(updates);
	refresh(onChunk);
}

async function handleL2ToL1Sync(l1ChainId, l2ChainId, bridge, multicall, txs, opts) {
	const { signal, onChunk } = opts;
	const now = Math.floor(Date.now());
	const toSaveLocallyTxs = [];
	const toQueryOnChainTxs = [];
	// 0. local filter
	txs.forEach(tx => {
		if (tx.canDoTimestamp && now < (tx.canDoTimestamp - 120000)) {
			toSaveLocallyTxs.push({
				id: tx.id,
				remaining: Math.max(0, (tx.canDoTimestamp - now) / 1000)
			});
		} else {
			toQueryOnChainTxs.push(tx);
		}
	});
	if (toSaveLocallyTxs.length > 0) {
		await saveTransactions(toSaveLocallyTxs);
		refresh(onChunk);
	}
	if (toQueryOnChainTxs.length === 0) return;

	// 1.get msgHash
	const extractLimit = pLimit(3);
	const extractTasks = toQueryOnChainTxs.map(tx => extractLimit(async () => {
		if (!tx.msgHash) {
			try {
				const { receipt, withdrawal } = await extractWithdrawal(tx.hash, l2ChainId);
				tx.msgHash = withdrawal.withdrawalHash;
				tx.receipt = receipt;
				if (tx.msgHash) await saveTransactions({ id: tx.id, msgHash: tx.msgHash });
			} catch (e) {
				console.warn(`L2->L1 withdrawal error, Tx: ${tx.id}`, e);
			}
		}
	}));
	await Promise.all(extractTasks);

	// 2. multicall query Finalized
	throwIfAborted(signal);
	const l1Provider = getL1Provider(l1ChainId);
	const finalizedMap = await batchCheckFinalized(
			l1Provider,
			bridge.L1OptimismPortalProxy,
			multicall,
			toQueryOnChainTxs,
			signal
	);
	const finalizedUpdates = [];
	txs.forEach(tx => {
		if (finalizedMap[tx.id]) {
			finalizedUpdates.push({ id: tx.id, status: BRIDGE_STATUS.COMPLETED, remaining: 0 });
		}
	});
	if (finalizedUpdates.length > 0) {
		await saveTransactions(finalizedUpdates);
		refresh(onChunk);
	}

	// 3. multicall query prove
	throwIfAborted(signal);
	const stillPending = txs.filter(tx => !finalizedMap[tx.id]);
	if (stillPending.length === 0) return;
	const provenStatusMap = await batchCheckProved(
			l1Provider,
			bridge.L1OptimismPortalProxy,
			multicall,
			stillPending,
			signal
	);
	const portalContract = new ethers.Contract(bridge.L1OptimismPortalProxy, ["function proofMaturityDelaySeconds() view returns (uint256)"], l1Provider);
	const CHALLENGE_PERIOD = await portalContract.proofMaturityDelaySeconds()
			.then(v => Number(v))
			.catch(() => 604800);
	// 3.1 filter
	const provenUpdates = [];
	stillPending.forEach(tx => {
		const pInfo = provenStatusMap[tx.id]; // { isProven: true, provenTimestamp: 123... }
		if (pInfo?.isProven) {
			const canWithdrawTime = (pInfo.provenTimestamp + CHALLENGE_PERIOD) * 1000;
			const isReady = now > canWithdrawTime;
			provenUpdates.push({
				id: tx.id,
				status: isReady ? BRIDGE_STATUS.READY_TO_WITHDRAW : BRIDGE_STATUS.CHALLENGE_PERIOD,
				remaining: Math.max(0, (canWithdrawTime - now) / 1000),
				canDoTimestamp: canWithdrawTime
			});
		}
	});
	if (provenUpdates.length > 0) {
		await saveTransactions(provenUpdates);
		refresh(onChunk);
	}

	// 4. query prove item
	throwIfAborted(signal);
	const unprovenTxs = stillPending.filter(tx => !provenStatusMap[tx.id]?.isProven);
	if (unprovenTxs.length === 0) return;
	// 4.1. query item
	const limit = pLimit(3);
	const pL1 = getPublicClientL1(l1ChainId);
	const pL2 = getPublicClientL2(l2ChainId);
	const tasks = unprovenTxs.map(tx => limit(async () => {
		if (tx.status === BRIDGE_STATUS.READY_TO_PROVE) {
			return;
		}

		try {
			const proveInfo = await checkProveStatus(tx.hash, l1ChainId, l2ChainId, {
				pL1, pL2, receipt: tx.receipt
			});
			const updateData = {
				id: tx.id,
				status: proveInfo.canProve ? BRIDGE_STATUS.READY_TO_PROVE : BRIDGE_STATUS.WAITING_PROVE_WINDOW,
				remaining: proveInfo.seconds || 0,
				canDoTimestamp: proveInfo.canDoTimestamp || 0
			};
			await saveTransactions(updateData);
			refresh(onChunk);
		} catch (e) {
			console.warn("L2->L1 Sample Prove Check Failed", e);
		}
	}));
	await Promise.all(tasks);
}
