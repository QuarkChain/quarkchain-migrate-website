// erc20
export const ERC20_ABI = [
	"event Transfer(address indexed from, address indexed to, uint256 value)",
	"function balanceOf(address owner) view returns (uint256)",
	"function allowance(address owner, address spender) view returns (uint256)",
	"function approve(address spender, uint256 amount) returns (bool)"
];

// migration
export const CONVERT_ABI = [
	"function convert(uint256 _amount) external",
];

//bridge
// l1
export const L1_BRIDGE_ABI = [
	"function depositERC20To(address _l1Token,address _l2Token,address _to,uint256 _amount,uint32 _l2Gas,bytes _data) external"
]
export const L1_MESSENGER_ABI = [
	"event SentMessage(address indexed target, address sender, bytes message, uint256 messageNonce, uint256 gasLimit)"
];
export const L1_OPTIMISM_PORTAL_ABI = [
	"function proveWithdrawalTransaction((uint256 nonce, address sender, address target, uint256 value, uint256 gasLimit, bytes data) _tx, uint256 _disputeGameIndex, (bytes32 version, bytes32 stateRoot, bytes32 messagePasserStorageRoot, bytes32 latestBlockhash) _outputRootProof, bytes[] _withdrawalProof) external",
	"function finalizeWithdrawalTransaction((uint256 nonce, address sender, address target, uint256 value, uint256 gasLimit, bytes data) _tx) external"
];

// l2
export const L2_MESSENGER_ABI = [
	"function successfulMessages(bytes32) view returns (bool)",
	"function failedMessages(bytes32) view returns (bool)"
];
export const L2_BRIDGE_ABI = [
	"function withdrawTo(address _l2Token, address _to, uint256 _amount, uint32 _minGasLimit, bytes _extraData) external",
];

// ========== Dispute Game ==========
export const DISPUTE_GAME_FACTORY_ABI = [
	"function gameCount() view returns (uint256)",
	"function gameAtIndex(uint256 _index) view returns (uint8 _gameType, uint256 _createdAt, address _gameProxy)"
];

export const DISPUTE_GAME_ABI = [
	"function l2BlockNumber() view returns (uint256)",
	"function status() view returns (uint8)",           // 0: IN_PROGRESS, 1: CHALLENGER_WON, 2: DEFENDER_WON
	"function createdAt() view returns (uint256)",
	"function gameType() view returns (uint8)",
	"function resolve() external returns (uint8)"
];
