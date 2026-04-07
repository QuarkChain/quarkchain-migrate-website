import { defineChain } from 'viem'
import { chainConfig } from 'viem/op-stack'

const sourceId = 1 // mainnet

export const quarkchainL2 = /*#__PURE__*/ defineChain({
	...chainConfig,
	id: 100011,
	name: 'QuarkChain L2',
	nativeCurrency: { name: 'QuarkChain', symbol: 'QKC', decimals: 18 },
	rpcUrls: {
		default: {
			http: ['https://rpc.mainnet.l2.quarkchain.io:8545'],
		},
	},
	blockExplorers: {
		default: {
			name: 'Blockscout',
			url: 'https://explorer.mainnet.l2.quarkchain.io',
			apiUrl: 'https://explorer.mainnet.l2.quarkchain.io/api',
		},
	},
	contracts: {
		...chainConfig.contracts,
		disputeGameFactory: {
			[sourceId]: {
				address: '0x61870a40eaa988515060e91e39da9c4a690b5c9b',
			},
		},
		l2OutputOracle: {
			[sourceId]: {
				address: '0x0000000000000000000000000000000000000000',
			},
		},
		multicall3: {
			address: '0x5FBDaD3AE3C5Af36d7c09455E1123e3a8DbDF5e5',
			blockCreated: 5136157,
		},
		portal: {
			[sourceId]: {
				address: '0xf9ea3f50acbacb122bfb9ceb6cf79c6cfcf35c7a',
			},
		},
		l1StandardBridge: {
			[sourceId]: {
				address: '0x326798c62fc0d7281f3840e08226a671aa949e98',
			},
		},
	},
	sourceId,
})
