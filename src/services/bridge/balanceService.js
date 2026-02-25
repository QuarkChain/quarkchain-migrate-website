import { getL1Provider, getL2Provider } from "@/infra/provider/providerManager.js";
import { getErc20Contract, getBalance } from "@/infra/erc20/erc20.js";

// L1 balance
export async function getErc20BalanceByL1(tokenAddress, userAddress) {
	const provider = getL1Provider();
	const contract = getErc20Contract(tokenAddress, provider);
	return getBalance(contract, userAddress);
}

// L2 balance
export async function getErc20BalanceByL2(rpc, tokenAddress, userAddress) {
	const provider = getL2Provider(rpc);
	const contract = getErc20Contract(tokenAddress, provider);
	return getBalance(contract, userAddress);
}
