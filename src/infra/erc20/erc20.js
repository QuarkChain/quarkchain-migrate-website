import { ethers } from "ethers";
import { ERC20_ABI } from "@/config/abi.js";

function getErc20Contract(address, providerOrSigner) {
	return new ethers.Contract(address, ERC20_ABI, providerOrSigner);
}

export async function getBalance(address, providerOrSigner, user) {
	const contract = getErc20Contract(address, providerOrSigner);
	return contract.balanceOf(user);
}

export async function getAllowance(address, providerOrSigner, owner, spender) {
	const contract = getErc20Contract(address, providerOrSigner);
	return contract.allowance(owner, spender);
}

export async function approve(address, providerOrSigner, spender, amount) {
	const contract = getErc20Contract(address, providerOrSigner);
	const tx = await contract.approve(spender, amount);
	return tx.wait();
}
