import { defineChain } from 'viem'
import { chainConfig } from 'viem/op-stack'

const sourceId = 11155111 // sepolia

export const quarkchainL2Testnet = /*#__PURE__*/ defineChain({
	...chainConfig,
	id: 110011,
	name: 'QuarkChain L2',
	nativeCurrency: { name: 'QuarkChain', symbol: 'QKC', decimals: 18 },
	rpcUrls: {
		default: {
			http: ['https://rpc.delta.testnet.l2.quarkchain.io:8545'],
		},
	},
	blockExplorers: {
		default: {
			name: 'Blockscout',
			url: 'https://explorer.delta.testnet.l2.quarkchain.io',
			apiUrl: 'https://explorer.delta.testnet.l2.quarkchain.io/api',
		},
	},
	contracts: {
		...chainConfig.contracts,
		disputeGameFactory: {
			[sourceId]: {
				address: '0x10ffc150ebad96e483d0af6bbe8b48803b7f65d4',
			},
		},
		l2OutputOracle: {
			[sourceId]: {
				address: '0x0000000000000000000000000000000000000000',
			},
		},
		multicall3: {
			address: '0xca11bde05977b3631167028862be2a173976ca11',
			blockCreated: 1620204,
		},
		portal: {
			[sourceId]: {
				address: '0x7f59517cd129c29da65768fd028990bcb436b02e',
			},
		},
		l1StandardBridge: {
			[sourceId]: {
				address: '0x2a3e379c6689d4b37efe00843c2bcf6b4574187b',
			},
		},
	},
	sourceId,
})
