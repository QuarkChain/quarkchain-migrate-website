import { ethers } from "ethers";
import { CONVERT_ABI } from "@/config/abi.js";
import { getL1Provider, getL2Provider, getSigner } from "@/infra/provider/providerManager.js";
import {getErc20Contract, getBalance, getAllowance, approve } from "@/infra/erc20/erc20.js";

// query
export async function getErc20Balance(tokenAddress, userAddress) {
    const provider = getL1Provider();
    const contract = getErc20Contract(tokenAddress, provider);
    return getBalance(contract, userAddress);
}

export async function getErc20Allowance(tokenAddress, userAddress, convertAddress) {
    const provider = getL1Provider();
    const contract = getErc20Contract(tokenAddress, provider);
    return getAllowance(contract, userAddress, convertAddress);
}

export async function getL2QKCBalance(rpc, userAddress) {
    const provider = getL2Provider(rpc);
    return provider.getBalance(userAddress);
}

// send
export async function approveErc20(tokenAddress, convertAddress, amount) {
    const signer = await getSigner();
    const contract = getErc20Contract(tokenAddress, signer);
    return approve(contract, convertAddress, ethers.parseEther(amount));
}

function isSystemSender(address) {
    return address?.toLowerCase().startsWith("0xdeaddeaddeaddeaddeaddeaddeaddead");
}

export async function convert(convertAddress, amount) {
    const signer = await getSigner();
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
