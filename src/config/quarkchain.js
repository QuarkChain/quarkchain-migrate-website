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
				address: '0x05F9613aDB30026FFd634f38e5C4dFd30a197Fa1',
			},
		},
		l2OutputOracle: {
			[sourceId]: {
				address: '0x90E9c4f8a994a250F6aEfd61CAFb4F2e895D458F',
			},
		},
		multicall3: {
			address: '0xca11bde05977b3631167028862be2a173976ca11',
			blockCreated: 1620204,
		},
		portal: {
			[sourceId]: {
				address: '0x16Fc5058F25648194471939df75CF27A2fdC48BC',
			},
		},
		l1StandardBridge: {
			[sourceId]: {
				address: '0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1',
			},
		},
	},
	sourceId,
})
