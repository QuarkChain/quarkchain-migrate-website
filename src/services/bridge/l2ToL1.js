import { ethers } from "ethers";
import { getL1Provider, getL2Provider, getSigner } from "@/infra/provider/providerManager.js";
import { L1_OPTIMISM_PORTAL_ABI, L2_BRIDGE_ABI, L2_DISPUTE_GAME_ABI } from "@/config/abi.js";

// // 仅用于与 L1 OptimismPortal 交互
// const L1_OPTIMISM_PORTAL_ABI = [
// 	"function proveWithdrawalTransaction((uint256,address,address,uint256,uint256,bytes),uint256,(bytes32,bytes32,bytes32,bytes32),bytes[]) external",
// 	"function finalizeWithdrawalTransactionExternalProof((uint256,address,address,uint256,uint256,bytes),address) external"
// ];
//
// function createWithdrawalTool(Bridge, l2Rpc) {
// 	const l1Provider = getL1Provider();
// 	const l2Provider = getL2Provider(l2Rpc);
//
// 	return new WithdrawalTool(l1Provider, l2Provider, {
// 		portal: Bridge.L1OptimismPortalProxy,
// 		factory: Bridge.L1DisputeGameFactoryProxy,
// 		messagePasser: Bridge.L2ToL1MessagePasser
// 	});
// }
//
// export { WithdrawalStatus };
//
// /**
//  * 查询某一笔 L2 → L1 提款当前所处状态
//  */
// export async function getL2ToL1WithdrawalStatus(Bridge, l2Rpc, l2TxHash, userAddress) {
// 	const tool = createWithdrawalTool(Bridge, l2Rpc);
// 	return tool.getWithdrawalUIStatus(l2TxHash, userAddress);
// }
//
// /**
//  * 发起 Prove 交易（L2 → L1 提款的第一步）
//  */
// export async function proveL2ToL1Withdrawal(Bridge, l2Rpc, l2TxHash, userAddress) {
// 	const tool = createWithdrawalTool(Bridge, l2Rpc);
//
// 	// 先确认当前状态 & 获取 gameIndex
// 	const info = await tool.getWithdrawalUIStatus(l2TxHash, userAddress);
// 	if (info.status !== WithdrawalStatus.READY_TO_PROVE) {
// 		throw new Error("Withdrawal not ready to prove on L1");
// 	}
//
// 	const params = await tool.getParams(l2TxHash, info.gameIndex);
//
// 	const signer = await getSigner(); // L1 签名者
// 	const portal = new ethers.Contract(Bridge.L1OptimismPortalProxy, L1_OPTIMISM_PORTAL_ABI, signer);
//
// 	const tx = await portal.proveWithdrawalTransaction(
// 		params.txStruct,
// 		params.l2OutputIndex,
// 		params.outputRootProof,
// 		params.withdrawalProof
// 	);
//
// 	return tx.wait();
// }
//
// /**
//  * 发起 Finalize 交易（L2 → L1 提款的第二步）
//  */
// export async function finalizeL2ToL1Withdrawal(Bridge, l2Rpc, l2TxHash, userAddress) {
// 	const tool = createWithdrawalTool(Bridge, l2Rpc);
//
// 	// 确认已满足 Finalize 条件
// 	const info = await tool.getWithdrawalUIStatus(l2TxHash, userAddress);
// 	if (info.status !== WithdrawalStatus.READY_TO_FINALIZE) {
// 		throw new Error("Withdrawal not ready to finalize on L1");
// 	}
//
// 	const params = await tool.getParams(l2TxHash); // 仅需要 txStruct
//
// 	const signer = await getSigner(); // L1 签名者（与 prove 时相同地址）
// 	const portal = new ethers.Contract(Bridge.L1OptimismPortalProxy, L1_OPTIMISM_PORTAL_ABI, signer);
//
// 	const tx = await portal.finalizeWithdrawalTransactionExternalProof(
// 		params.txStruct,
// 		userAddress
// 	);
//
// 	return tx.wait();
// }

// get
export async function getL1GasPrice(L1ChainId) {
	const provider = getL1Provider(L1ChainId);
	const raw = await provider.send("eth_gasPrice", []);
	return BigInt(raw);
}

export async function getL2GasPrice(L2ChainId) {
	const provider = getL2Provider(L2ChainId);
	const raw = await provider.send("eth_gasPrice", []);
	return BigInt(raw);
}


// send
export async function bridgeTokenToL1(L2ChainId, bridgeAddress, l2Token, to, amount, l2Gas = 200000) {
	const { address, decimals } = l2Token;
	const signer = await getSigner(L2ChainId);
	const contract = new ethers.Contract(bridgeAddress, L2_BRIDGE_ABI, signer);

	const data = "0x";
	const value = ethers.parseUnits(amount.toString(), decimals);
	const tx = await contract.withdrawTo(
			address,
			to,
			value,
			l2Gas,
			data
	);
	return await tx.wait();
}

export async function checkCanProve(l1ChainId, l2ChainId, l2TxHash, L1DisputeGameFactoryProxy) {
	const l2Provider = getL2Provider(l2ChainId);
	const l1Provider = getL1Provider(l1ChainId);

	// 1. get L2 tx info
	const receipt = await l2Provider.getTransactionReceipt(l2TxHash);
	const l2Block = await l2Provider.getBlock(receipt.blockNumber);
	const l2TxTimestamp = l2Block.timestamp;

	// 2. is ready
	const factory = new ethers.Contract(L1DisputeGameFactoryProxy, L2_DISPUTE_GAME_ABI, l1Provider);
	const gameCount = await factory.gameCount();
	const latestIdx = Number(gameCount) - 1;
	if (latestIdx >= 0) {
		const [,, proxyLatest] = await factory.gameAtIndex(latestIdx);
		const gameContract = new ethers.Contract(proxyLatest, ["function l2BlockNumber() view returns (uint256)"], l1Provider);
		const blockLatest = await gameContract.l2BlockNumber();

		if (Number(blockLatest) >= receipt.blockNumber) {
			return { canProve: true, estimateSeconds: 0 };
		}
	}

	// 3. estimate
	const TOTAL_WAIT_TIME = 14 * 3600; // 50400
	const now = Math.floor(Date.now() / 1000);
	const expectedTime = l2TxTimestamp + TOTAL_WAIT_TIME;

	let estimate = expectedTime - now;

	if (estimate <= 0) {
		estimate = 300;
	}

	return {
		canProve: false,
		estimateSeconds: estimate,
	};
}

function _getSlot(withdrawalHash) {
	return ethers.keccak256(ethers.concat([withdrawalHash, ethers.zeroPadValue("0x00", 32)]));
}

async function _getParams(l1ChainId, l2ChainId, Bridge, l2TxHash, gameIndex = null) {
	const {L1OptimismPortalProxy, L1DisputeGameFactoryProxy, L2ToL1MessagePasser} = Bridge;
	const l2Provider = getL2Provider(l2ChainId);
	const receipt = await l2Provider.getTransactionReceipt(l2TxHash);

	// 1. 解析交易结构体 _tx
	const iface = new ethers.Interface(["event MessagePassed(uint256 indexed nonce, address indexed sender, address indexed target, uint256 value, uint256 gasLimit, bytes data, bytes32 withdrawalHash)"]);
	const log = receipt.logs.find(l => l.address.toLowerCase() === L2ToL1MessagePasser.toLowerCase());
	const parsed = iface.parseLog(log);
	const txStruct = {
		nonce: parsed.args.nonce,
		sender: parsed.args.sender,
		target: parsed.args.target,
		value: parsed.args.value,
		gasLimit: parsed.args.gasLimit,
		data: parsed.args.data
	};

	if (gameIndex === null) return {txStruct}; // only is Finalize

	// 2. 只有 Prove 需要计算以下复杂 Proof
	const l1Provider = getL1Provider(l1ChainId);
	const factory = new ethers.Contract(L1DisputeGameFactoryProxy, L2_DISPUTE_GAME_ABI, l1Provider);
	const [, , proxy] = await factory.gameAtIndex(gameIndex);
	const game = new ethers.Contract(proxy, ["function l2BlockNumber() view returns (uint256)"], l1Provider);
	const snapshotBlockNumber = await game.l2BlockNumber();

	const [snapshotBlock, proofResponse] = await Promise.all([
		l2Provider.getBlock(Number(snapshotBlockNumber)),
		l2Provider.send("eth_getProof", [L2ToL1MessagePasser, [_getSlot(parsed.args.withdrawalHash)], ethers.toBeHex(snapshotBlockNumber)])
	]);

	return {
		txStruct,
		l2OutputIndex: gameIndex,
		outputRootProof: {
			version: ethers.ZeroHash,
			stateRoot: snapshotBlock.stateRoot,
			messagePasserStorageRoot: proofResponse.storageHash,
			latestBlockhash: snapshotBlock.hash
		},
		withdrawalProof: proofResponse.storageProof[0].proof
	};
}

async function _findValidGame(l1ChainId, l2BlockNumber) {
	const factory = new ethers.Contract(this.config.factory, ["function gameCount() view returns (uint256)", "function gameAtIndex(uint256) view returns (uint8, uint256, address)"], this.l1Provider);
	const count = await factory.gameCount();
	// 仅检查最新的 5 个即可，性能最优
	for (let i = Number(count) - 1; i >= Math.max(0, Number(count) - 5); i--) {
		const [,, proxy] = await factory.gameAtIndex(i);
		const game = new ethers.Contract(proxy, ["function l2BlockNumber() view returns (uint256)"], this.l1Provider);
		const gBlock = await game.l2BlockNumber();
		if (Number(gBlock) >= l2BlockNumber) return { index: i };
	}
	return null;
}

export async function proveL2ToL1Withdrawal(l1ChainId, l2ChainId, Bridge, l2TxHash, gameIndex) {
	const params = await _getParams(l1ChainId, l2ChainId, Bridge, l2TxHash, gameIndex);

	const signer = await getSigner(l1ChainId);
	const portal = new ethers.Contract(Bridge.L1OptimismPortalProxy, L1_OPTIMISM_PORTAL_ABI, signer);
	const tx = await portal.proveWithdrawalTransaction(
		params.txStruct,
		params.l2OutputIndex,
		params.outputRootProof,
		params.withdrawalProof
	);

	return tx.wait();
}
