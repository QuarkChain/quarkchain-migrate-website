import { ethers } from 'ethers'
import { NETWORKS } from "@/config/networks.js";

export function getL1Provider(targetChainId) {
	const chainIdNum = Number(targetChainId);
	const currentWalletChainId = window.ethereum?.chainId;
	const isWalletMatched = currentWalletChainId && parseInt(currentWalletChainId, 16) === chainIdNum;

	const rpcConfigs = [];
	if (isWalletMatched) {
		rpcConfigs.push({
			provider: new ethers.BrowserProvider(window.ethereum),
			priority: 0,
			stallTimeout: 3000,
			weight: 2
		});
	}

	const rpcPool = NETWORKS[targetChainId]?.rpcUrls || [];
	rpcPool.forEach((url, index) => {
		rpcConfigs.push({
			provider: new ethers.JsonRpcProvider(url, chainIdNum, { staticNetwork: true }),
			priority: index + 1,
			stallTimeout: 2000 + (index * 1000),
		});
	});

	return new ethers.FallbackProvider(rpcConfigs, parseInt(targetChainId, 16), {
		quorum: 1,
		cacheTimeout: 15000
	});
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
