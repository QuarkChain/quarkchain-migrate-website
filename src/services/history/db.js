import { openDB } from "idb";
import { BRIDGE_STATUS } from "@/config/constant.js";

const DB_NAME = "BridgeHistoryDB";
const TX_STORE = "transactions";
const PROGRESS_STORE = "progress";

let dbPromise;

function getDB() {
	if (!dbPromise) {
		dbPromise = openDB(DB_NAME, 1, {
			upgrade(db) {
				const txStore = db.createObjectStore(TX_STORE, {
					keyPath: "id"
				});

				txStore.createIndex("address", "address");
				txStore.createIndex("timestamp", "timestamp");

				db.createObjectStore(PROGRESS_STORE);
			}
		});
	}
	return dbPromise;
}

export async function saveTransactions(data) {
	const items = Array.isArray(data) ? data : [data];
	if (!items.length) return;

	const db = await getDB();
	const tx = db.transaction(TX_STORE, "readwrite");
	const store = tx.store;
	for (const newItem of items) {
		if (!newItem.id) continue;

		const existing = await store.get(newItem.id);
		if (existing) {
			await store.put({ ...existing, ...newItem });
		} else {
			await store.put(newItem);
		}
	}
	await tx.done;
}

export async function loadTransactions(address) {
	const db = await getDB();
	const index = db
			.transaction(TX_STORE)
			.store
			.index("address");

	const txs = await index.getAll(address);
	return txs.sort((a, b) => b.timestamp - a.timestamp);
}

export async function loadPendingTransactions(address) {
	const db = await getDB();
	const txs = await db.getAllFromIndex(TX_STORE, "address", address);

	const FINAL_STATUS = [BRIDGE_STATUS.COMPLETED, BRIDGE_STATUS.FAILED];
	return txs.filter(tx => !FINAL_STATUS.includes(tx.status));
}

export async function loadProgress(address, layer) {
	const db = await getDB();
	return (
			await db.get(PROGRESS_STORE, `${address}-${layer}`)
	) || {lastBlock: 0};
}

export async function updateProgress(address, layer, block) {
	const db = await getDB();
	await db.put(
			PROGRESS_STORE,
			{ lastBlock: block },
			`${address}-${layer}`
	);
}
