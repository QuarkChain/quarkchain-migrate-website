import { getL1Provider, getL2Provider } from "@/infra/provider/providerManager.js";
import { getBalance } from "@/infra/erc20/erc20.js";

// L1 balance
export async function getErc20BalanceByL1(l1ChainId, tokenAddress, userAddress) {
	const provider = getL1Provider(l1ChainId);
	return getBalance(tokenAddress, provider, userAddress);
}

// L2 balance
export async function getErc20BalanceByL2(l2ChainId, tokenAddress, userAddress) {
	const provider = getL2Provider(l2ChainId);
	return getBalance(tokenAddress, provider, userAddress);
}
