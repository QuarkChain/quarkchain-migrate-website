import { ethers } from "ethers";
import { getL1Provider, getL2Provider, getSigner } from "@/infra/provider/providerManager.js";
import { WithdrawalTool, WithdrawalStatus } from "./bridg.js";
import { L2_BRIDGE_ABI } from "@/config/abi.js";

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
