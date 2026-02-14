import { ethers } from 'ethers'

export function getL1Provider() {
	return new ethers.BrowserProvider(window.ethereum)
}

export function getL2Provider(l2Rpc) {
	return new ethers.JsonRpcProvider(l2Rpc)
}

export async function getSigner() {
	const provider = new ethers.BrowserProvider(window.ethereum)
	return await provider.getSigner()
}
