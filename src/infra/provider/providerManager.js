import { ethers } from 'ethers'
import { NETWORKS } from "@/config/networks.js";

export function getL1Provider(targetChainId) {
	const currentWalletChainId = window.ethereum?.chainId;
	if (currentWalletChainId === targetChainId) {
		console.log(`[Provider] Using Wallet RPC for ${targetChainId}`);
		return new ethers.BrowserProvider(window.ethereum);
	}

	const rpcPool = NETWORKS[targetChainId]?.rpcUrls || [];
	if (rpcPool.length === 0) {
		throw new Error(`No RPC configuration found for ${targetChainId}`);
	}

	const configs = rpcPool.map((url, index) => ({
		provider: new ethers.JsonRpcProvider(url, Number(targetChainId), {
			staticNetwork: true
		}),
		priority: index,
		stallTimeout: 1200,
		weight: 1
	}));
	return new ethers.FallbackProvider(configs);
}

export function getL2Provider(targetChainId) {
	const rpcPool = NETWORKS[targetChainId]?.rpcUrls || [];
	if (rpcPool.length === 0) {
		throw new Error(`No RPC configuration found for ${targetChainId}`);
	}
	return new ethers.JsonRpcProvider(rpcPool[0])
}

export async function getSigner(targetChainId) {
	if (!window.ethereum) throw new Error("Wallet not found");
	const provider = new ethers.BrowserProvider(window.ethereum);
	const network = await provider.getNetwork();

	if (targetChainId && network.chainId !== BigInt(targetChainId)) {
		await window.ethereum.request({
			method: 'wallet_switchEthereumChain',
			params: [{ chainId: targetChainId }],
		});
		return (new ethers.BrowserProvider(window.ethereum)).getSigner();
	}

	return await provider.getSigner()
}
