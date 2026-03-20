import { ethers } from "ethers";
import { getL1Provider, getL2Provider, getSigner } from "@/infra/provider/providerManager.js";
import { approve, getAllowance } from "@/infra/erc20/erc20.js";
import { L1_BRIDGE_ABI, L1_MESSENGER_ABI, L2_MESSENGER_ABI } from "@/config/abi.js";
import { BRIDGE_STATUS } from "@/config/constant.js";

export async function getGasPrice(L1ChainId) {
	const provider = getL1Provider(L1ChainId);
	const fee = await provider.getFeeData();
	return fee.gasPrice;
}

export async function getTokenAllowance(L1ChainId, tokenAddress, owner, spender) {
	const provider = getL1Provider(L1ChainId);
	return getAllowance(tokenAddress, provider, owner, spender);
}

export async function approveErc20(L1ChainId, token, spender, amount) {
	const { address, decimals } = token;
	const value = ethers.parseUnits(amount.toString(), decimals);
	const signer = await getSigner(L1ChainId);
	return approve(address, signer, spender, value);
}

export async function bridgeToken(L1ChainId, bridgeAddress, l1Token, l2TokenAddress, to, amount, l2Gas = 200000) {
	const { address, decimals } = l1Token;
	const signer = await getSigner(L1ChainId);
	const contract = new ethers.Contract(bridgeAddress, L1_BRIDGE_ABI, signer);

	const data = "0x";
	const value = ethers.parseUnits(amount.toString(), decimals);
	const tx = await contract.depositERC20To(
		address,
		l2TokenAddress,
		to,
		value,
		l2Gas,
		data
	);
	return await tx.wait();
}

export async function getL1ToL2MessageHash(l1Provider, l1TxHash, messengerAddress) {
	const receipt = await l1Provider.getTransactionReceipt(l1TxHash);
	if (!receipt) return null;

	const l1MessengerIface = new ethers.Interface(L1_MESSENGER_ABI);
	for (const log of receipt.logs) {
		if (log.address.toLowerCase() !== messengerAddress.toLowerCase()) continue;

		try {
			const parsed = l1MessengerIface.parseLog(log);
			if (parsed.name === "SentMessage") {
				const { target, sender, message, messageNonce, gasLimit } = parsed.args;
				const iface = new ethers.Interface([
					"function relayMessage(uint256,address,address,uint256,uint256,bytes)"
				]);
				const encoded = iface.encodeFunctionData("relayMessage", [
					messageNonce, sender, target, 0n, gasLimit, message
				]);
				return ethers.keccak256(encoded);
			}
		} catch (e) {
		}
	}
	return null;
}

export async function waitForL2ERC20Bridge(L1ChainId, L2ChainId, Bridge, l1TxHash, signal) {
	const { L1CrossDomainMessengerProxy, L2CrossDomainMessenger } = Bridge;
	const l1Provider = getL1Provider(L1ChainId);

	const msgHash = await getL1ToL2MessageHash(l1Provider, l1TxHash, L1CrossDomainMessengerProxy);
	if (!msgHash) throw new Error("SentMessage event not found in L1 receipt");

	const l2Provider = getL2Provider(L2ChainId);
	const l2Messenger = new ethers.Contract(L2CrossDomainMessenger, L2_MESSENGER_ABI, l2Provider);
	while (true) {
		if (signal?.aborted) {
			throw new Error("Polling aborted");
		}

		const [isSuccessful, isFailed] = await Promise.all([
			l2Messenger.successfulMessages(msgHash),
			l2Messenger.failedMessages(msgHash)
		]);
		if (isSuccessful) {
			return { status: "SUCCESS", msgHash };
		}
		if (isFailed) {
			return { status: "FAILED", msgHash };
		}

		await new Promise(r => setTimeout(r, 5000));
	}
}

export async function batchCheckL1ToL2Status(l2Provider, messengerAddress, multicallAddress, txs, signal) {
	const validTxs = txs.filter(tx => tx.msgHash);
	if (validTxs.length === 0) return {};

	const multicall = new ethers.Contract(multicallAddress, [
		"function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)"
	], l2Provider);

	const iface = new ethers.Interface(L2_MESSENGER_ABI);
	const results = {};
	const BATCH_SIZE = 25;
	for (let i = 0; i < validTxs.length; i += BATCH_SIZE) {
		if (signal?.aborted) return;

		const batch = validTxs.slice(i, i + BATCH_SIZE);
		const calls = [];
		batch.forEach(tx => {
			calls.push({ target: messengerAddress, callData: iface.encodeFunctionData("successfulMessages", [tx.msgHash]) });
			calls.push({ target: messengerAddress, callData: iface.encodeFunctionData("failedMessages", [tx.msgHash]) });
		});

		try {
			const [, returnData] = await multicall.aggregate(calls);
			batch.forEach((tx, idx) => {
				const successData = returnData[idx * 2];
				const failedData = returnData[idx * 2 + 1];
				const [isSuccessful] = iface.decodeFunctionResult("successfulMessages", successData);
				const [isFailed] = iface.decodeFunctionResult("failedMessages", failedData);

				if (isSuccessful) {
					results[tx.id] = BRIDGE_STATUS.COMPLETED;
				} else if (isFailed) {
					results[tx.id] = BRIDGE_STATUS.FAILED;
				}
			});
		} catch (e) {
			console.error("L1->L2 Multicall failed", e);
		}
	}
	return results;
}
