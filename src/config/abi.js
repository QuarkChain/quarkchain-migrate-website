
export const ERC20_ABI = [
	"event Transfer(address indexed from, address indexed to, uint256 value)",
	"function balanceOf(address owner) view returns (uint256)",
	"function allowance(address owner, address spender) view returns (uint256)",
	"function approve(address spender, uint256 amount) returns (bool)"
];

export const CONVERT_ABI = [
	"function convert(uint256 _amount) external",
];

export const L1_BRIDGE_ABI = [
	"function depositERC20To(address _l1Token,address _l2Token,address _to,uint256 _amount,uint32 _l2Gas,bytes _data) external"
]
