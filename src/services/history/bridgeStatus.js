import pLimit from 'p-limit';
import { ethers } from 'ethers';
import { loadPendingTransactions, saveTransactions } from "@/services/history/db.js";
import { BRIDGE_DIRECTION, BRIDGE_STATUS } from "@/config/constant.js";
import { queryL2MintStatuses } from "@/services/migration/nativeMigration.js";
import { batchCheckL1ToL2Status, getL1ToL2MessageHash } from "@/services/bridge/l1ToL2.js";
import { getL1Provider, getL2Provider } from "@/infra/provider/providerManager.js";
import {
	checkFinalizeStatusByHash,
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

async function batchCheckFinalized(l1Provider, portalAddress, multicallAddress, txs, signal) {
	const validTxs = txs.filter(tx => tx.msgHash);
	if (validTxs.length === 0) return {};

	const iface = new ethers.Interface(["function finalizedWithdrawals(bytes32) view returns (bool)"]);
	const multicall = new ethers.Contract(multicallAddress, [
		"function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)"
	], l1Provider);

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

async function getLatestStatus(l1ChainId, l2ChainId, bridge, tx, signal) {
	throwIfAborted(signal);

	// l2 to l1
	try {
		// can withdraw
		let finalize = {canFinalize: false, seconds: 0};
		try {
			finalize = await checkFinalizeStatusByHash(tx.hash, l1ChainId, l2ChainId, tx.msgHash);
		} catch (e) {
		}

		if (finalize.canFinalize) {
			tx.status = BRIDGE_STATUS.READY_TO_WITHDRAW;
			tx.remaining = 0;
		} else if (finalize.seconds > 0) {
			tx.status = BRIDGE_STATUS.CHALLENGE_PERIOD;
			tx.remaining = finalize.seconds;
			tx.canDoTimestamp = finalize.canDoTimestamp;
		} else {
			// can prove
			const prove = await checkProveStatus(tx.hash, l1ChainId, l2ChainId);
			if (prove.canProve) {
				tx.status = BRIDGE_STATUS.READY_TO_PROVE;
				tx.remaining = 0;
			} else {
				tx.status = BRIDGE_STATUS.WAITING_PROVE_WINDOW;
				tx.remaining = prove.seconds || 0;
				tx.canDoTimestamp = prove.canDoTimestamp || 0;
			}
		}
	} catch (e) {
		console.warn("L2 to L1 status check failed", e);
	}
	return tx;
}

export async function syncPendingStatus(l1ChainId, l2ChainId, bridge, multicallL1, multicallL2, address, opts = {}) {
	const { signal } = opts;
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
		syncTasks.push(handleMigrationSync(l2ChainId, address, migrationTxs, signal));
	}
	if (l1ToL2BridgeTxs.length > 0) {
		syncTasks.push(handleL1ToL2Sync(l1ChainId, l2ChainId, bridge, multicallL2, l1ToL2BridgeTxs, signal));
	}
	if (l2ToL1BridgeTxs.length > 0) {
		syncTasks.push(handleL2ToL1Sync(l1ChainId, l2ChainId, bridge, multicallL1, l2ToL1BridgeTxs, signal));
	}
	await Promise.all(syncTasks);
}

const MIGRATION_FINALITY_THRESHOLD = 3 * 24 * 60 * 60;

async function handleMigrationSync(l2ChainId, address, txs, signal) {
	const now = Date.now();
	const toQuery = [];
	const autoCompleted = [];
	txs.forEach(tx => {
		const elapsed = now/1000 - tx.timestamp * 1000;
		if (elapsed > MIGRATION_FINALITY_THRESHOLD) {
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
		}
	} catch (e) {
		console.error("Migration sync failed", e);
	}
}

async function handleL1ToL2Sync(l1ChainId, l2ChainId, bridge, multicall, txs, signal) {
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
}

async function handleL2ToL1Sync(l1ChainId, l2ChainId, bridge, multicall, txs, signal) {
	const now = Math.floor(Date.now() / 1000);
	const toSaveLocallyTxs = [];
	const toQueryOnChainTxs = [];
	// 0. local filter
	txs.forEach(tx => {
		if (tx.canDoTimestamp && now < (tx.canDoTimestamp - 120)) {
			toSaveLocallyTxs.push({
				id: tx.id,
				remaining: Math.max(0, tx.canDoTimestamp - now)
			});
		} else {
			toQueryOnChainTxs.push(tx);
		}
	});
	if (toSaveLocallyTxs.length > 0) {
		await saveTransactions(toSaveLocallyTxs);
	}
	if (toQueryOnChainTxs.length === 0) return;

	// 1.get msgHash
	const extractLimit = pLimit(3);
	const extractTasks = toQueryOnChainTxs.map(tx => extractLimit(async () => {
		if (!tx.msgHash) {
			try {
				const { withdrawal } = await extractWithdrawal(tx.hash, l2ChainId);
				tx.msgHash = withdrawal.withdrawalHash;
				if (tx.msgHash) await saveTransactions({ id: tx.id, msgHash: tx.msgHash });
			} catch (e) {
				console.warn(`L2->L1 withdrawal error, Tx: ${tx.id}`, e);
			}
		}
	}));
	await Promise.all(extractTasks);

	throwIfAborted(signal);
	// 2. multicall query Finalized
	const l1Provider = getL1Provider(l1ChainId);
	const finalizedMap = await batchCheckFinalized(
			l1Provider,
			bridge.L1OptimismPortalProxy,
			multicall,
			toQueryOnChainTxs.filter(t => t.msgHash),
			signal
	);

	// 3. query item
	const limit = pLimit(3);
	const tasks = toQueryOnChainTxs.map(tx => limit(async () => {
		if (finalizedMap[tx.id]) {
			await saveTransactions({ id: tx.id, status: BRIDGE_STATUS.COMPLETED, remaining: 0 });
			return;
		}
		const latest = await getLatestStatus(l1ChainId, l2ChainId, bridge, tx, signal);
		await saveTransactions({ id: tx.id, status: latest.status, remaining: latest.remaining, canDoTimestamp: latest.canDoTimestamp });
	}));
	await Promise.all(tasks);
}
