export const chains = [{
	chainID: '0x1', // 1
	Conversion: '0x47e2609C842a12c395623298114587C616e142c3',
	OldToken: '0xEA26c4aC16D4a5A106820BC8AEE85fd0b7b2b664',
	L2Rpc: 'https://rpc.mainnet.l2.quarkchain.io:8545',
	Bridge: {
		L1StandardBridgeProxy: '',
		L1DisputeGameFactoryProxy: '',
		L1OptimismPortalProxy: '',

		L2_TO_L1_MESSAGE_PASSER: '',
	}
}, {
	chainID: '0xaa36a7', // 11155111
	Conversion: '0x6309Ab1d95b12FbBd256FC1aEe9154A18fC961d1',
	OldToken: '0xC359FCF9328143f798C197B86856e656411aBC48',
	L2Rpc: 'https://rpc.delta.testnet.l2.quarkchain.io:8545',
	Bridge: {
		L1StandardBridgeProxy: '0x2a3e379c6689d4b37efe00843c2bcf6b4574187b',
		L1DisputeGameFactoryProxy: '0x10ffc150ebad96e483d0af6bbe8b48803b7f65d4',
		L1OptimismPortalProxy: '0x7f59517cd129c29da65768fd028990bcb436b02e',

		L2_TO_L1_MESSAGE_PASSER: '0x4200000000000000000000000000000000000016',
	}
}];
