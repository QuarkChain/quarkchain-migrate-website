import { ethers } from "ethers";
import { ERC20_ABI } from "@/config/abi.js";
import {getL1Provider, getL2Provider} from "@/utils/providerManager.js";

export async function getErc20Balance(provider, tokenAddress, userAddress) {
	const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
	return await contract.balanceOf(userAddress);
}

export async function getErc20BalanceByL1(tokenAddress, userAddress) {
	const provider = getL1Provider();
	return getErc20Balance(provider, tokenAddress, userAddress);
}

export async function getErc20BalanceByL2(rpc, tokenAddress, userAddress) {
	const provider = getL2Provider(rpc);
	return getErc20Balance(provider, tokenAddress, userAddress);
}
