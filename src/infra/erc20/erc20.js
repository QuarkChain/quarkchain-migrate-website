import { ethers } from "ethers";
import { ERC20_ABI } from "@/config/abi.js";

export function getErc20Contract(address, providerOrSigner) {
	return new ethers.Contract(address, ERC20_ABI, providerOrSigner);
}

export async function getBalance(contract, user) {
	return await contract.balanceOf(user);
}

export async function getAllowance(contract, owner, spender) {
	return await contract.allowance(owner, spender);
}

export async function approve(contract, spender, amount) {
	const tx = await contract.approve(spender, amount);
	return await tx.wait();
}
