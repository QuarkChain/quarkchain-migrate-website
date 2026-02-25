import ethereumIcon from '@/assets/l1.svg'
import quarkIcon from '@/assets/quarkchain.svg'

import usdcIcon from '@/assets/usdc.png'

export const TOKEN_LIST = [
	{
		symbol: 'USDC',
		icon: usdcIcon,
		networks: {
			'0x1': { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 }, // Ethereum Mainnet
			'0xaa36a7': { address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', decimals: 6 }, // Sepolia
			'0x186ab': { address: '0x65003adbdf3014f7E38FC6BE752EB047b95da89A', decimals: 6 }, // QuarkChain L2
			'0x1adbb': { address: '0x64003adbdf3014f7E38FC6BE752EB047b95da89A', decimals: 6 }, // QuarkChain L2 Testnet
		}
	},
];

export const NETWORKS = {
	L1: {
		mainnet: {
			name: 'Ethereum',
			icon: ethereumIcon,
			chainId: '0x1',
			explorer: 'https://etherscan.io/address/',
		},
		testnet: {
			name: 'Sepolia',
			icon: ethereumIcon,
			chainId: '0xaa36a7',
			explorer: 'https://sepolia.etherscan.io/address/',
		},
	},

	L2: {
		mainnet: {
			name: 'QuarkChain L2',
			icon: quarkIcon,
			chainId: '0x186ab',
			explorer: 'https://explorer.mainnet.l2.quarkchain.io/address/',
		},
		testnet: {
			name: 'QuarkChain L2 Testnet',
			icon: quarkIcon,
			chainId: '0x1adbb',
			explorer: 'https://explorer.delta.testnet.l2.quarkchain.io/address/',
		},
	},
};
