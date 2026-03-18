import { ethers } from "ethers";
import { CONVERT_ABI } from "@/config/abi.js";
import { getL1Provider, getL2Provider, getSigner } from "@/infra/provider/providerManager.js";
import { getBalance, getAllowance, approve } from "@/infra/erc20/erc20.js";

// query
export async function getL1Erc20Balance(l1ChainId, tokenAddress, userAddress) {
    const provider = getL1Provider(l1ChainId);
    return getBalance(tokenAddress, provider, userAddress);
}

export async function getL1Erc20Allowance(l1ChainId, tokenAddress, userAddress, convertAddress) {
    const provider = getL1Provider(l1ChainId);
    return getAllowance(tokenAddress, provider, userAddress, convertAddress);
}

export async function getL2QKCBalance(l2ChainId, userAddress) {
    const provider = getL2Provider(l2ChainId);
    return provider.getBalance(userAddress);
}

// send
export async function approveErc20(l1ChainId, tokenAddress, convertAddress, amount) {
    const signer = await getSigner(l1ChainId);
    return approve(tokenAddress, signer, convertAddress, ethers.parseEther(amount));
}

function isSystemSender(address) {
    return address?.toLowerCase().startsWith("0xdeaddeaddeaddeaddeaddeaddeaddead");
}

export async function convert(l1ChainId, convertAddress, amount) {
    const signer = await getSigner(l1ChainId);
    const contract = new ethers.Contract(convertAddress, CONVERT_ABI, signer);
    const estimatedGas = await contract.convert.estimateGas(ethers.parseEther(amount));
    return await contract.convert(ethers.parseEther(amount), {
        gasLimit: estimatedGas * 15n / 10n
    });
}

const INTERVAL = 3000;
const MAX_RETRY = 100;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForL2Mint(l2ChainId, userAddress, signal) {
    const provider = getL2Provider(l2ChainId);
    const user = userAddress.toLowerCase();
    let lastCheckedBlock = await provider.getBlockNumber() - 1;

    console.log(`Start watching L2 from block ${lastCheckedBlock}`);
    for (let retry = 0; retry < MAX_RETRY; retry++) {
        if (signal?.aborted) {
            throw new Error("Polling aborted");
        }
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
