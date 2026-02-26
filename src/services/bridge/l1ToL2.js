import {ethers} from "ethers";
import {getL1Provider, getSigner} from "@/infra/provider/providerManager.js";
import {approve, getAllowance, getErc20Contract} from "@/infra/erc20/erc20.js";
import {ERC20_ABI, L1_BRIDGE_ABI} from "@/config/abi.js";

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

export async function waitForL2ERC20Bridge(
		{
			l2Rpc,
			l2Token,
			userAddress,
			amount,
			startBlock,
			timeoutMs = 5 * 60 * 1000,
			pollInterval = 5000,
		}
) {
	const {address, decimals} = l2Token;
	const expected = ethers.parseUnits(amount.toString(), decimals);
	const provider = new ethers.JsonRpcProvider(l2Rpc);
	const contract = new ethers.Contract(address, ERC20_ABI, provider);

	const user = userAddress.toLowerCase();
	const zero = ethers.ZeroAddress;

	const initialBalance = await contract.balanceOf(user);
	const startTime = Date.now();

	let fromBlock = startBlock;
	console.log("Watching L2 mint from block:", fromBlock);
	while (Date.now() - startTime < timeoutMs) {
		const latest = await provider.getBlockNumber();
		if (latest >= fromBlock) {
			// 1️⃣ Transfer event
			const events = await contract.queryFilter(
					contract.filters.Transfer(zero, user),
					fromBlock,
					latest
			);
			for (const ev of events) {
				const value = BigInt(ev.args.value.toString());
				if (value === expected) {
					return {
						txHash: ev.transactionHash,
						blockNumber: ev.blockNumber,
					};
				}
			}

			// 2️⃣ balance check
			const currentBalance = await contract.balanceOf(user);
			if (currentBalance - initialBalance >= expected) {
				return {
					txHash: "balance-increase-detected",
					blockNumber: latest,
				};
			}

			fromBlock = latest + 1;
		}
		await new Promise((r) => setTimeout(r, pollInterval));
	}

	const error = new Error("L2 ERC20 mint not detected within timeout");
	error.lastCheckedBlock = fromBlock;
	throw error;
}
