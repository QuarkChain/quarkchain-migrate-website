import { ethers } from 'ethers'
import { NETWORKS } from "@/config/networks.js";

const providerCache = new Map();

export function getL1Provider(targetChainId) {
	const walletChainId = window.ethereum?.chainId;
	const chainIdNum = Number(targetChainId);
	const isWalletMatched = walletChainId && parseInt(walletChainId, 16) === chainIdNum;

	const cacheKey = `${targetChainId}-${isWalletMatched}`;
	if (providerCache.has(cacheKey)) return providerCache.get(cacheKey);

	if (isWalletMatched) {
		const p = new ethers.BrowserProvider(window.ethereum);
		providerCache.set(cacheKey, p);
		return p;
	}

	const rpcConfigs = [];
	const rpcPool = NETWORKS[targetChainId]?.rpcUrls || [];
	rpcPool.forEach((url, index) => {
		rpcConfigs.push({
			provider: new ethers.JsonRpcProvider(url, chainIdNum, { staticNetwork: true }),
			priority: index,
			stallTimeout: 2000,
		});
	});

	const p = new ethers.FallbackProvider(rpcConfigs, chainIdNum, { quorum: 1 });
	providerCache.set(cacheKey, p);
	return p;
}

export function getL2Provider(targetChainId) {
	const rpcPool = NETWORKS[targetChainId]?.rpcUrls || [];
	if (rpcPool.length === 0) {
		throw new Error(`No RPC configuration found for ${targetChainId}`);
	}

	const cacheKey = `${targetChainId}`;
	if (providerCache.has(cacheKey)) return providerCache.get(cacheKey);

	const chainIdNum = Number(targetChainId);
	const p = new ethers.JsonRpcProvider(rpcPool[0], {
		chainId: chainIdNum,
		name: 'l2-network'
	}, { staticNetwork: true });
	providerCache.set(cacheKey, p);
	return p;
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

export function clearProvider() {
	providerCache.clear();
}
