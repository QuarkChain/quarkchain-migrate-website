import { ethers } from "ethers";
import { loadProgress, saveTransactions, updateProgress } from "./db.js";
import { getL1Provider, getL2Provider } from "@/infra/provider/providerManager.js";

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

	for (const log of logs) {
		let block = blockCache.get(log.blockNumber);
		if (!block) {
			block = await provider.getBlock(log.blockNumber);
			blockCache.set(log.blockNumber, block);
		}

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
			timestamp: block.timestamp,
			blockNumber: log.blockNumber,
			status: "initiated"
		});
	}
	return txs;
}

const L1_WINDOW = 2000;
const L2_WINDOW = 5000;

async function syncL1(chainId, bridgeAddress, address, progress) {
	const provider = getL1Provider(chainId);

	const latest = (await provider.getBlockNumber()) - 2;
	let from = progress.l1LastBlock + 1;
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
		progress.l1LastBlock = to;
		await updateProgress(address, progress);

		from = to + 1;
	}
}

async function syncL2(chainId, bridgeAddress, address, progress) {
	const provider = getL2Provider(chainId);

	const latest = (await provider.getBlockNumber()) - 6;
	let from = progress.l2LastBlock + 1;
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
		progress.l2LastBlock = to;
		await updateProgress(address, progress);

		from = to + 1;
	}
}

export async function syncUserTransactions(l1ChainId, l2ChainId, bridge,address) {
	const progress = await loadProgress(address);
	await Promise.all([
		syncL1(l1ChainId, bridge.L1StandardBridge, address, progress),
		syncL2(l2ChainId, bridge.L2StandardBridge, address, progress)
	]);
}
