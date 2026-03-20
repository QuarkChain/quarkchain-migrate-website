// services/history/syncManager.js

import store from "@/app/store/index.js";
import { syncing, txList } from "@/app/store/txStore.js";
import { syncUserTransactions } from "@/services/history/history.js";
import { loadTransactions } from "@/services/history/db.js";
import {syncPendingStatus} from "@/services/history/bridgeStatus.js";

const STATUS_POLL_INTERVAL = 30000;

let statusTimer = null;
let currentSession = 0;
let abortController = null;

function isContextValid(account, session) {
	return currentSession === session && store.state.account === account;
}

export function stopSync() {
	currentSession += 1;
	if (abortController) {
		abortController.abort();
		abortController = null;
	}
	if (statusTimer) {
		clearTimeout(statusTimer);
		statusTimer = null;
	}
	syncing.value = false;
}

export async function startSync(account) {
	stopSync();
	if (!account) return;

	const mySession = currentSession;
	abortController = new AbortController();
	const signal = abortController.signal;

	try {
		txList.value = await loadTransactions(account);
		await performOneTimeScan(account, mySession, signal);
		runStatusPolling(account, mySession, signal);
	} catch (err) {
		if (err.name !== 'AbortError') console.error("Sync initialization failed", err);
	}
}

async function performOneTimeScan(account, session, signal) {
	if (!isContextValid(account, session)) return;

	syncing.value = true;
	try {
		await syncUserTransactions(
				store.state.l1ChainId,
				store.state.l2ChainId,
				store.getters.Bridge,
				store.getters.Conversion,
				account,
				{
					signal,
					onChunk: async () => {
						if (isContextValid(account, session)) {
							txList.value = await loadTransactions(account);
						}
					}
				}
		);
	} catch (err) {
		console.warn("Scan logs error:", err);
	} finally {
		if (isContextValid(account, session)) syncing.value = false;
	}
}

async function runStatusPolling(account, session, signal) {
	if (!isContextValid(account, session) || signal.aborted) return;

	try {
		const l1ChainId = store.state.l1ChainId;
		const l2ChainId = store.state.l2ChainId;
		const bridge = store.getters.Bridge;
		const multicallL1 = store.getters.MulticallL1;
		const multicallL2 = store.getters.MulticallL2;
		await syncPendingStatus(l1ChainId, l2ChainId, bridge, multicallL1, multicallL2, account, { signal });
	} catch (err) {
		console.error("Poll status error:", err);
	} finally {
		if (isContextValid(account, session)) {
			txList.value = await loadTransactions(account);
		}
	}

	statusTimer = setTimeout(() => {
		runStatusPolling(account, session, signal);
	}, STATUS_POLL_INTERVAL);
}

export async function refreshLocalList() {
	const account = store.state.account;
	if (!account) return;
	txList.value = await loadTransactions(account);
}
