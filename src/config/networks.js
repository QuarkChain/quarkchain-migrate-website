import ethereumIcon from '@/assets/l1.svg'
import quarkIcon from '@/assets/quarkchain.svg'

export const NETWORKS = {
	'0x1': {
		type: 'L1',
		chainId: '0x1',
		name: 'Ethereum',
		icon: ethereumIcon,
		rpcUrls: [
			'https://rpc.ankr.com/eth',
			'https://ethereum.publicnode.com',
			'https://cloudflare-eth.com',
			'https://eth.merkle.io',
		],
		explorer: 'https://etherscan.io',
		nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
	},

	'0xaa36a7': {
		type: 'L1',
		chainId: '0xaa36a7',
		name: 'Sepolia',
		icon: ethereumIcon,
		rpcUrls: [
			'https://ethereum-sepolia-rpc.publicnode.com',
			'https://sepolia.gateway.tenderly.co',
			'https://11155111.rpc.thirdweb.com',
			'https://1rpc.io/sepolia'
		],
		explorer: 'https://sepolia.etherscan.io',
		nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 }
	},

	'0x186ab': {
		type: 'L2',
		chainId: '0x186ab',
		name: 'QuarkChain L2',
		icon: quarkIcon,
		rpcUrls: ['https://rpc.mainnet.l2.quarkchain.io:8545'],
		explorer: 'https://explorer.mainnet.l2.quarkchain.io',
		nativeCurrency: { name: 'QKC', symbol: 'QKC', decimals: 18 }
	},

	'0x1adbb': {
		type: 'L2',
		chainId: '0x1adbb',
		name: 'QuarkChain L2 Testnet',
		icon: quarkIcon,
		rpcUrls: ['https://rpc.delta.testnet.l2.quarkchain.io:8545'],
		explorer: 'https://explorer.delta.testnet.l2.quarkchain.io',
		nativeCurrency: { name: 'QKC', symbol: 'QKC', decimals: 18 }
	}
}
