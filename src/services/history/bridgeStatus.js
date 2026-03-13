import { loadPendingTransactions, saveTransactions } from "@/services/history/db.js";
import { BRIDGE_DIRECTION, BRIDGE_STATUS } from "@/config/constant.js";
import { checkL1ToL2Status, getL1ToL2MessageHash } from "@/services/bridge/l1ToL2.js";
import { getL1Provider, getL2Provider } from "@/infra/provider/providerManager.js";
import {
	checkFinalizeStatus,
	checkIsWithdrawalFinalized,
	checkProveStatus,
	extractWithdrawal
} from "@/services/bridge/l2ToL1.js";

async function getLatestStatus(l1ChainId, l2ChainId, bridge, tx) {
	if (tx.direction === BRIDGE_DIRECTION.L1_TO_L2) {
		// l1 to l2
		// 1. get msgHash
		let msgHash = tx.msgHash;
		if (!msgHash) {
			const l1Provider = getL1Provider(l1ChainId);
			msgHash = await getL1ToL2MessageHash(l1Provider, tx.hash, bridge.L1CrossDomainMessengerProxy);
			tx.msgHash = msgHash;
		}

		// 2. get status
		if (msgHash) {
			const l2Provider = getL2Provider(l2ChainId);
			const status = await checkL1ToL2Status(l2Provider, bridge.L2CrossDomainMessenger, msgHash);
			if (status) tx.status = status;
		}

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
			// is finish
			if (!tx.msgHash) {
				const {withdrawal} = await extractWithdrawal(tx.hash, l2ChainId);
				tx.msgHash = withdrawal.withdrawalHash;
			}
			const isDone = await checkIsWithdrawalFinalized(l1ChainId, bridge.L1OptimismPortalProxy, tx.msgHash);
			if (isDone) {
				tx.status = BRIDGE_STATUS.COMPLETED;
				tx.remaining = 0;
				return tx;
			}

			// can withdraw
			const finalize = await checkFinalizeStatus(tx.hash, l1ChainId, l2ChainId);
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

export async function syncPendingStatus(l1ChainId, l2ChainId, bridge, address, opts = {}) {
	const pendings = await loadPendingTransactions(address);
	if (pendings.length === 0) return;

	const updates = [];
	for (const tx of pendings) {
		try {
			const latest = await getLatestStatus(l1ChainId, l2ChainId, bridge, tx);
			updates.push({
				id: tx.id,
				status: latest.status,
				remaining: latest.remaining,
				msgHash: latest.msgHash
			});
		} catch (e) {
			console.error("Fetch status failed", tx.id, e);
		}
	}

	if (updates.length > 0) {
		await saveTransactions(updates);
	}
}
