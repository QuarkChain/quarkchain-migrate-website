// services/history/syncManager.js

import store from "@/app/store/index.js";
import { syncing, txList } from "@/app/store/txStore.js";
import { syncUserTransactions } from "@/services/history/history.js";
import { loadTransactions } from "@/services/history/db.js";

const POLL_INTERVAL = 180000;

let timer = null;
let sessionId = 0;
let controller = null;
let lastRefreshAt = 0;

function isActive(account, mySession, signal) {
	if (sessionId !== mySession) return false;
	if (signal?.aborted) return false;
	if (store.state.account !== account) return false;
	return true;
}

export function stopSync() {
	sessionId += 1;
	if (controller) {
		controller.abort();
		controller = null;
	}
	if (timer) {
		clearTimeout(timer);
		timer = null;
	}
	syncing.value = false;
}

export async function startSync(account) {
	stopSync();
	if (!account) return;

	const mySession = sessionId;
	controller = new AbortController();
	const signal = controller.signal;

	// Initial list load can race with a fast account switch; guard it.
	try {
		const list = await loadTransactions(account);
		if (!isActive(account, mySession, signal)) return;
		txList.value = list;
	} catch (err) {
		console.error("load tx error", err);
	}

	runPoll(account, mySession, signal);
}

async function refreshListThrottled(account, mySession, minIntervalMs = 2500) {
	const now = Date.now();
	if (now - lastRefreshAt < minIntervalMs) return;
	lastRefreshAt = now;

	const list = await loadTransactions(account);
	if (!isActive(account, mySession, controller?.signal)) return;
	txList.value = list;
}

async function runPoll(account, mySession, signal) {
	if (!isActive(account, mySession, signal)) return;

	syncing.value = true;
	try {
		const l1ChainId = store.state.l1ChainId;
		const l2ChainId = store.state.l2ChainId;
		const bridge = store.getters.Bridge;
		await syncUserTransactions(l1ChainId, l2ChainId, bridge, account, {
			signal,
			onChunk: async () => {
				// First-time sync can be slow; refresh periodically as chunks land.
				await refreshListThrottled(account, mySession);
			}
		});

		await refreshListThrottled(account, mySession, 0);
	} catch (err) {
		if (err?.name === "AbortError") return;
		console.error("sync error", err);
	} finally {
		if (sessionId === mySession) {
			syncing.value = false;
		}
	}

	scheduleNext(account, mySession, signal);
}

function scheduleNext(account, mySession, signal) {
	if (!isActive(account, mySession, signal)) return;

	timer = setTimeout(() => {
		runPoll(account, mySession, signal);
	}, POLL_INTERVAL);
}

export async function refreshLocalList() {
	const account = store.state.account;
	if (!account) return;

	try {
		txList.value = await loadTransactions(account);
	} catch (err) {
		console.error("refresh local list error", err);
	}
}
