
export const ERC20_ABI = [
	"function balanceOf(address owner) view returns (uint256)",
	"function allowance(address owner, address spender) view returns (uint256)",
	"function approve(address spender, uint256 amount) returns (bool)"
];

export const CONVERT_ABI = [
	"function convert(uint256 _amount) external",
];
