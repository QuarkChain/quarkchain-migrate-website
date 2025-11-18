import { ethers } from "ethers";

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)"
];

const CONVERT_ABI = [
    "function convert(uint256 _amount) external",
];

function isSystemSender(address) {
    return address?.toLowerCase().startsWith("0xdeaddeaddeaddeaddeaddeaddeaddead");
}

export async function getErc20Balance(tokenAddress, userAddress) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    return await contract.balanceOf(userAddress);
}

export async function getErc20Allowance(tokenAddress, userAddress, convertAddress) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    return await contract.allowance(userAddress, convertAddress);
}

export async function getL2QKCBalance(rpc, userAddress) {
    const provider = new ethers.JsonRpcProvider(rpc);
    return await provider.getBalance(userAddress);
}

export async function approveErc20(tokenAddress, convertAddress, amount) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const tx = await contract.approve(convertAddress, ethers.parseEther(amount));
    return await tx.wait();
}

export async function convert(convertAddress, amount) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(convertAddress, CONVERT_ABI, signer);
    const estimatedGas = await contract.convert.estimateGas(ethers.parseEther(amount));
    const tx = await contract.convert(ethers.parseEther(amount), {
        gasLimit: estimatedGas * 15n / 10n
    });
    return await tx.wait();
}

const INTERVAL = 3000;
const MAX_RETRY = 100;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForL2Mint(rpc, userAddress) {
    const provider = new ethers.JsonRpcProvider(rpc);
    const user = userAddress.toLowerCase();
    let lastCheckedBlock = await provider.getBlockNumber() - 1;

    console.log(`Start watching L2 from block ${lastCheckedBlock}`);
    for (let retry = 0; retry < MAX_RETRY; retry++) {
        const latestBlock = await provider.getBlockNumber();

        for (let i = lastCheckedBlock + 1; i <= latestBlock; i++) {
            const block = await provider.getBlock(i, true);
            if (!block || block.transactions.length === 0) continue;

            for (const txHash of block.transactions) {
                const tx = await provider.getTransaction(txHash);
                const from = tx.from?.toLowerCase();
                const to = tx.to?.toLowerCase();
                if (isSystemSender(from) && to === user) {
                    console.log(`L2 Mint found at block ${i}, tx: ${tx.hash}`);
                    return tx.hash;
                }
            }
        }

        lastCheckedBlock = latestBlock;
        console.log(`Waiting for L2 mint... checked up to block ${latestBlock}`);
        await delay(INTERVAL);
    }
    throw Error("L2 mint not found within time limit");
}
