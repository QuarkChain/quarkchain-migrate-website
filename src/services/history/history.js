import pLimit from 'p-limit';
import { ethers } from "ethers";
import { loadProgress, saveTransactions, updateProgress } from "./db.js";
import { getL1Provider, getL2Provider } from "@/infra/provider/providerManager.js";

const L1_BRIDGE_DEPLOY_BLOCK = {
	1: 23874421,      // Ethereum mainnet
	11155111: 9605535 // Sepolia
}

const L2_BRIDGE_DEPLOY_BLOCK = {
	100011: 170563,    // QKC mainnet
	110011: 169841      // QKC Sepolia
}

const EVENT_TOPIC = ethers.id(
		"ERC20BridgeInitiated(address,address,address,address,uint256,bytes)"
);

async function scanLogs(provider, bridgeAddress, userAddress, fromBlock, toBlock) {
	return await provider.getLogs({
		address: bridgeAddress,
		fromBlock,
		toBlock,
		topics: [
			EVENT_TOPIC,
			null,
			null,
			ethers.zeroPadValue(userAddress, 32)
		]
	});
}

const iface = new ethers.Interface([
	"event ERC20BridgeInitiated(address indexed localToken,address indexed remoteToken,address indexed from,address to,uint256 amount,bytes extraData)"
]);

export async function parseLogs(logs, provider, direction, address) {
	const txs = [];
	const blockCache = new Map();

	const blockNumbers = [...new Set(logs.map(l => l.blockNumber))];
	const limit = pLimit(10);
	await Promise.all(
			blockNumbers.map(bn =>
					limit(async () => {
						const block = await provider.getBlock(bn);
						blockCache.set(bn, block.timestamp);
					})
			)
	);

	for (const log of logs) {
		const timestamp = blockCache.get(log.blockNumber);
		const parsed = iface.parseLog(log);
		txs.push({
			id: `${log.transactionHash}-${log.logIndex}`,
			address,
			hash: log.transactionHash,
			logIndex: log.logIndex,

			direction,

			token: parsed.args.localToken,
			from: parsed.args.from,
			to: parsed.args.to,
			amount: parsed.args.amount.toString(),
			timestamp: timestamp,
			blockNumber: log.blockNumber,
			status: "initiated"
		});
	}
	return txs;
}

const L1_WINDOW = 2000;
const L2_WINDOW = 5000;

async function syncL1(chainId, bridgeAddress, address) {
	const progress = await loadProgress(address, "L1")

	const provider = getL1Provider(chainId);
	const latest = (await provider.getBlockNumber()) - 2;
	const chain = typeof chainId === "string"
			? parseInt(chainId, 16)
			: chainId;
	let from = Math.max(progress.lastBlock + 1, L1_BRIDGE_DEPLOY_BLOCK[chain]);
	if (latest <= from) return;

	while (from <= latest) {
		const to = Math.min(from + L1_WINDOW, latest);
		const logs = await scanLogs(
				provider,
				bridgeAddress,
				address,
				from,
				to
		);
		const txs = await parseLogs(
				logs,
				provider,
				"L1→L2",
				address
		);

		await saveTransactions(txs);
		await updateProgress(address, "L1", to)

		from = to + 1;
	}
}

async function syncL2(chainId, bridgeAddress, address) {
	const progress = await loadProgress(address, "L2")

	const provider = getL2Provider(chainId);
	const latest = (await provider.getBlockNumber()) - 6;
	const chain = typeof chainId === "string"
			? parseInt(chainId, 16)
			: chainId;
	let from = Math.max(progress.lastBlock + 1, L2_BRIDGE_DEPLOY_BLOCK[chain]);
	if (latest <= from) return;

	while (from <= latest) {
		const to = Math.min(from + L2_WINDOW, latest);
		const logs = await scanLogs(
				provider,
				bridgeAddress,
				address,
				from,
				to
		);

		const txs = await parseLogs(
				logs,
				provider,
				"L2→L1",
				address
		);

		await saveTransactions(txs);
		await updateProgress(address, "L2", to)

		from = to + 1;
	}
}

export async function syncUserTransactions(l1ChainId, l2ChainId, bridge,address) {
	await Promise.all([
		syncL1(l1ChainId, bridge.L1StandardBridge, address),
		syncL2(l2ChainId, bridge.L2StandardBridge, address)
	]);
}
