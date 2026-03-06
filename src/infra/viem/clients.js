import { createPublicClient, createWalletClient, http, custom, fallback } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { publicActionsL1, walletActionsL1, publicActionsL2 } from 'viem/op-stack';
import { quarkchainL2 } from "@/config/quarkchain.js";
import { quarkchainL2Testnet } from "@/config/quarkchainTestet.js";
import { NETWORKS } from "@/config/networks.js";

export const CHAINS = {
	'0x1': mainnet,
	'0xaa36a7': sepolia,
	'0x186ab': quarkchainL2,
	'0x1adbb': quarkchainL2Testnet
};

function getChain(chainIdHex) {
	const chain = CHAINS[chainIdHex];
	if (!chain) throw new Error(`Network ${chainIdHex} not support`);
	return chain;
}

export function getPublicClientL1(chainIdHex) {
	const chain = getChain(chainIdHex);
	const rpcUrls = NETWORKS[chainIdHex]?.rpcUrls || [];

	const transports = [];
	if (typeof window !== 'undefined' && window.ethereum?.chainId === chainIdHex) {
		transports.push(custom(window.ethereum));
	}
	rpcUrls.forEach(url => transports.push(http(url)));

	return createPublicClient({
		chain,
		transport: fallback(transports, { rank: true }),
	}).extend(publicActionsL1());
}

export function getPublicClientL2(chainIdHex) {
	const chain = getChain(chainIdHex);
	const rpcUrls = NETWORKS[chainIdHex]?.rpcUrls;
	return createPublicClient({
		chain,
		transport: http(rpcUrls[0]),
	}).extend(publicActionsL2())
}

export async function getWalletClient(chainIdHex) {
	if (!window.ethereum) throw new Error("Wallet not found");

	const chain = getChain(chainIdHex);
	if (window.ethereum.chainId !== chainIdHex) {
		await window.ethereum.request({
			method: 'wallet_switchEthereumChain',
			params: [{ chainId: chainIdHex }],
		});
	}

	const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });
	return createWalletClient({
		account,
		chain,
		transport: custom(window.ethereum)
	}).extend(walletActionsL1());
}
