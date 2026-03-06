import { ethers } from "ethers";
import { getL1Provider, getL2Provider, getSigner } from "@/infra/provider/providerManager.js";
import { getWithdrawals } from 'viem/op-stack';
import { L2_BRIDGE_ABI } from "@/config/abi.js";
import { getPublicClientL1, getPublicClientL2, getWalletClient } from "@/infra/viem/clients.js";

// get
export async function getL1GasPrice(L1ChainId) {
	const provider = getL1Provider(L1ChainId);
	const fee = await provider.getFeeData();
	return fee.gasPrice;
}

export async function getL2GasPrice(L2ChainId) {
	const provider = getL2Provider(L2ChainId);
	const raw = await provider.send("eth_gasPrice", []);
	return BigInt(raw);
}

// l2 send
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


// l2 send
async function extractWithdrawal(l2TxHash, l2ChainId) {
	const pL2 = getPublicClientL2(l2ChainId);
	const receipt = await pL2.getTransactionReceipt({ hash: l2TxHash });
	const [withdrawal] = getWithdrawals(receipt);
	return { pL2, receipt, withdrawal };
}

export async function checkProveStatus(l2TxHash, l1ChainId, l2ChainId) {
	const { pL2, receipt } = await extractWithdrawal(l2TxHash, l2ChainId);
	const pL1 = getPublicClientL1(l1ChainId);
	const timeToProve = await pL1.getTimeToProve({
		receipt,
		targetChain: pL2.chain,
	});

	return {
		canProve: timeToProve.seconds === 0,
		seconds: timeToProve.seconds,
	};
}

export async function proveWithdrawal(l2TxHash, l1ChainId, l2ChainId) {
	const wL1 = await getWalletClient(l1ChainId);
	const pL1 = getPublicClientL1(l1ChainId);
	const { pL2, receipt, withdrawal } = await extractWithdrawal(l2TxHash, l2ChainId);
	const output = await pL1.getL2Output({
		l2BlockNumber: receipt.blockNumber,
		targetChain: pL2.chain,
	});

	const args = await pL2.buildProveWithdrawal({
		output,
		withdrawal,
	});
	const hash = await wL1.proveWithdrawal(args);
	return await pL1.waitForTransactionReceipt({ hash });
}

export async function checkFinalizeStatus(l2TxHash, l1ChainId, l2ChainId) {
	const { pL2, withdrawal } = await extractWithdrawal(l2TxHash, l2ChainId);

	const pL1 = getPublicClientL1(l1ChainId);
	const timeToFinalize = await pL1.getTimeToFinalize({
		withdrawalHash: withdrawal.withdrawalHash,
		targetChain: pL2.chain,
	});
	return {
		canFinalize: timeToFinalize.seconds === 0,
		seconds: timeToFinalize.seconds,
		timestamp: timeToFinalize.timestamp,
	};
}

export async function finalizeWithdrawal(l2TxHash, l1ChainId, l2ChainId) {
	const { pL2, withdrawal } = await extractWithdrawal(l2TxHash, l2ChainId);
	const pL1 = getPublicClientL1(l1ChainId);
	const wL1 = await getWalletClient(l1ChainId);
	const hash = await wL1.finalizeWithdrawal({
		withdrawal,
		targetChain: pL2.chain,
	});
	return await pL1.waitForTransactionReceipt({ hash });
}
