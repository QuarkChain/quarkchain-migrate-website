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


// l2
export const L2_MESSENGER_ABI = [
	"function successfulMessages(bytes32) view returns (bool)",
	"function failedMessages(bytes32) view returns (bool)"
];
