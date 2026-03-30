
export const BRIDGE_STATUS = {
	UNKNOWN: "unknown",

	COMPLETED: "completed",
	FAILED: "failed",

	WAITING_PROVE_WINDOW: "waiting-prove-window",
	READY_TO_PROVE: "ready-to-prove",

	CHALLENGE_PERIOD: "challenge-period",
	READY_TO_WITHDRAW: "ready-to-withdraw"
}

export const BRIDGE_STATUS_PRIORITY = {
	[BRIDGE_STATUS.UNKNOWN]: 0,

	// L1 -> L2
	[BRIDGE_STATUS.WAITING_PROVE_WINDOW]: 1,
	[BRIDGE_STATUS.READY_TO_PROVE]: 2,
	[BRIDGE_STATUS.CHALLENGE_PERIOD]: 3,
	[BRIDGE_STATUS.READY_TO_WITHDRAW]: 4,

	// final
	[BRIDGE_STATUS.COMPLETED]: 5,
	[BRIDGE_STATUS.FAILED]: 5
};

export const BRIDGE_DIRECTION = {
	L1_TO_L2: "L1→L2",
	L2_TO_L1: "L2→L1"
}

export const STATUS = {
	IDLE: 'idle',
	LOADING: 'loading',
	SUCCESS: 'success',
	DISABLED: 'disabled',
	FAILED: 'failed',
}

export const API_CONFIG = {
	'0x1': 'https://eth.blockscout.com/api',
	'0xaa36a7': 'https://eth-sepolia.blockscout.com/api',
	'0x186ab': 'https://explorer.mainnet.l2.quarkchain.io/api',
	'0x1adbb': 'https://explorer.delta.testnet.l2.quarkchain.io/api'
};
