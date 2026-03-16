import pLimit from 'p-limit';
import { ethers } from 'ethers';
import { loadPendingTransactions, saveTransactions } from "@/services/history/db.js";
import { BRIDGE_DIRECTION, BRIDGE_STATUS } from "@/config/constant.js";
import { checkL1ToL2Status, getL1ToL2MessageHash } from "@/services/bridge/l1ToL2.js";
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
	if (tx.direction === BRIDGE_DIRECTION.L1_TO_L2) {
		// l1 to l2
		const l2Provider = getL2Provider(l2ChainId);
		const status = await checkL1ToL2Status(l2Provider, bridge.L2CrossDomainMessenger, tx.msgHash);
		tx.status = status || tx.status;

		if (tx.status === BRIDGE_STATUS.COMPLETED || tx.status === BRIDGE_STATUS.FAILED) {
			tx.remaining = 0;
		} else {
			const EXPECTED_DURATION = 3 * 60;
			const now = Math.floor(Date.now() / 1000);
			const elapsed = now - tx.timestamp;
			tx.remaining = Math.max(60, EXPECTED_DURATION - elapsed);
		}
	} else {
		// l2 to l1
		try {
			// can withdraw
			let finalize = { canFinalize: false, seconds: 0 };
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
			} else {
				// can prove
				const prove = await checkProveStatus(tx.hash, l1ChainId, l2ChainId);
				if (prove.canProve) {
					tx.status = BRIDGE_STATUS.READY_TO_PROVE;
					tx.remaining = 0;
				} else {
					tx.status = BRIDGE_STATUS.WAITING_PROVE_WINDOW;
					tx.remaining = prove.seconds || 0;
				}
			}
		} catch (e) {
			console.warn("L2 to L1 status check failed", e);
		}
	}

	return tx;
}

export async function syncPendingStatus(l1ChainId, l2ChainId, bridge, multicall, address, opts = {}) {
	const { signal } = opts;
	const pendings = await loadPendingTransactions(address);
	if (pendings.length === 0) return;

	const l1Provider = getL1Provider(l1ChainId);
	// 1. get all Hash
	const msgHashLimit = pLimit(5);
	const msgHashTasks = pendings.map(tx => msgHashLimit(async () => {
		if (signal?.aborted) return;
		if (!tx.msgHash) {
			try {
				if (tx.direction === BRIDGE_DIRECTION.L2_TO_L1) {
					const { withdrawal } = await extractWithdrawal(tx.hash, l2ChainId);
					tx.msgHash = withdrawal.withdrawalHash;
				} else {
					tx.msgHash = await getL1ToL2MessageHash(l1Provider, tx.hash, bridge.L1CrossDomainMessengerProxy);
				}
				if (tx.msgHash) {
					await saveTransactions({ id: tx.id, msgHash: tx.msgHash });
				} else {
					console.warn(`Cannot fill msgHash for tx ${tx.id}, will be skipped`);
				}
			} catch (e) {
				if (e.name === 'AbortError') throw e;
				console.warn(`Fill msgHash failed for tx ${tx.id}`, e);
			}
		}
	}));
	await Promise.all(msgHashTasks);
	throwIfAborted(signal);

	// 2. L1 Multicall
	const validPendings = pendings.filter(tx => tx.msgHash);
	if (validPendings.length === 0) return;

	const l2ToL1Txs = validPendings.filter(tx => tx.direction === BRIDGE_DIRECTION.L2_TO_L1);
	let finalizedMap = {};
	if (l2ToL1Txs.length > 0) {
		finalizedMap = await batchCheckFinalized(l1Provider, bridge.L1OptimismPortalProxy, multicall, l2ToL1Txs, signal);
	}
	throwIfAborted(signal);

	// 3. get status
	const statusLimit = pLimit(3);
	const tasks = pendings.map(tx => statusLimit(async () => {
		if (signal?.aborted) return;

		try {
			if (finalizedMap[tx.id]) {
				await saveTransactions({ id: tx.id, status: BRIDGE_STATUS.COMPLETED, remaining: 0, msgHash: tx.msgHash });
				return;
			}

			const latest = await getLatestStatus(l1ChainId, l2ChainId, bridge, tx, signal);
			await saveTransactions({
				id: tx.id, status: latest.status, remaining: latest.remaining, msgHash: latest.msgHash
			});
		} catch (e) {
			console.error("Sync failed", tx.id, e);
		}
	}));

	await Promise.all(tasks);
}
