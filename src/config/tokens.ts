import usdcIcon from '@/assets/usdc.png';
import usdtIcon from '@/assets/usdt.png';
import quarkIcon from '@/assets/quarkchain.svg'
import type { TokenItem } from "@/config/types";

const isMainnet = import.meta.env.VITE_TARGET_L1_CHAIN_ID === '0x1';

const MAINNET_TOKENS: TokenItem[] = [
	{
		symbol: 'QKC',
		icon: quarkIcon,
		networks: {
			'0x1': { address: '0xEA26c4aC16D4a5A106820BC8AEE85fd0b7b2b664', decimals: 18 }, // Ethereum Mainnet
			'0x186ab': { address: '', decimals: 18 }, // QuarkChain L2
		}
	},
	{
		symbol: 'USDT',
		icon: usdtIcon,
		networks: {
			'0x1': { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 }, // Ethereum Mainnet
			'0x186ab': { address: '0xA68295D77766d4e04854746e3C1873c891C1765E', decimals: 6 }, // QuarkChain L2
		}
	}
];

const TESTNET_TOKENS: TokenItem[] = [
	{
		symbol: 'QKC',
		icon: quarkIcon,
		networks: {
			'0xaa36a7': { address: '0xC359FCF9328143f798C197B86856e656411aBC48', decimals: 18 }, // Sepolia
			'0x1adbb': { address: '', decimals: 18 }, // L2 Testnet
		}
	},
	{
		symbol: 'USDC',
		icon: usdcIcon,
		networks: {
			'0xaa36a7': { address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', decimals: 6 }, // Sepolia
			'0x1adbb': { address: '0x64003adbdf3014f7E38FC6BE752EB047b95da89A', decimals: 6 }, // QuarkChain L2 Testnet
		}
	}
];

export const TOKEN_LIST = isMainnet ? MAINNET_TOKENS : TESTNET_TOKENS;

export const getTokenConfig = (symbol, chainId) => {
	const token = TOKEN_LIST.find(t => t.symbol === symbol);
	if (!token || !token.networks[chainId]) return null;

	return {
		...token.networks[chainId],
		symbol: token.symbol,
		icon: token.icon
	};
};
