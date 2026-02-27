import {ethers} from "ethers";
import {getL1Provider, getL2Provider, getSigner} from "@/infra/provider/providerManager.js";
import {approve, getAllowance, getErc20Contract} from "@/infra/erc20/erc20.js";
import {L1_BRIDGE_ABI, L1_MESSENGER_ABI, L2_MESSENGER_ABI} from "@/config/abi.js";

export async function getGasPrice() {
	const provider = getL1Provider();
	return provider.getFeeData();
}

export async function getTokenAllowance(tokenAddress, owner, spender) {
	const provider = getL1Provider();
	const contract = getErc20Contract(tokenAddress, provider);
	return getAllowance(contract, owner, spender);
}

export async function approveErc20(token, spender, amount) {
	const {address, decimals} = token;
	const value = ethers.parseUnits(amount.toString(), decimals);
	const signer = await getSigner();
	const contract = getErc20Contract(address, signer);
	return approve(contract, spender, value);
}

export async function bridgeToken(bridgeAddress, l1Token, l2TokenAddress, to, amount, l2Gas = 200000) {
	const {address, decimals} = l1Token;
	const signer = await getSigner();
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

export async function waitForL2ERC20Bridge(Bridge, l1TxHash, l2Rpc) {
	const {L1CrossDomainMessengerProxy, L2CrossDomainMessenger} = Bridge;
	const l1Provider = getL1Provider();
	const receipt = await l1Provider.getTransactionReceipt(l1TxHash);
	if (!receipt) throw new Error("L1 Transaction not found");


	const l1MessengerIface = new ethers.Interface(L1_MESSENGER_ABI);
	let msgHash = null;
	for (const log of receipt.logs) {
		if (log.address.toLowerCase() !== L1CrossDomainMessengerProxy.toLowerCase()) continue;

		try {
			const parsed = l1MessengerIface.parseLog(log);
			const {target, sender, message, messageNonce, gasLimit} = parsed.args;
			const iface = new ethers.Interface([
				"function relayMessage(uint256,address,address,uint256,uint256,bytes)"
			]);
			const encoded = iface.encodeFunctionData("relayMessage", [
				messageNonce,
				sender,
				target,
				0n,
				gasLimit,
				message
			]);
			msgHash = ethers.keccak256(encoded);
			break;
		} catch (e) {
		}
	}
	if (!msgHash) throw new Error("SentMessage event not found in L1 receipt");


	const l2Provider = getL2Provider(l2Rpc);
	const l2Messenger = new ethers.Contract(L2CrossDomainMessenger, L2_MESSENGER_ABI, l2Provider);
	const start = Date.now();
	while (Date.now() - start < 300000) {
		const [isSuccessful, isFailed] = await Promise.all([
			l2Messenger.successfulMessages(msgHash),
			l2Messenger.failedMessages(msgHash)
		]);

		if (isSuccessful) {
			return {status: "SUCCESS", msgHash};
		}

		if (isFailed) {
			return {status: "FAILED", msgHash};
		}

		await new Promise(r => setTimeout(r, 5000));
	}

	return {status: "FAILED", msgHash};
}
