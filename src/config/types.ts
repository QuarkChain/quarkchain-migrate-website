export interface TokenNetwork {
    address: string;
    decimals: number;
}

export interface TokenItem {
    symbol: string;
    icon: string;
    networks: Record<string, TokenNetwork>;
}
