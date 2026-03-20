import { ethers } from "ethers";
import { CONVERT_ABI } from "@/config/abi.js";
import { API_CONFIG } from "@/config/constant.js";
import { getL1Provider, getL2Provider, getSigner } from "@/infra/provider/providerManager.js";
import { getAllowance, approve } from "@/infra/erc20/erc20.js";

// query
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

function isSystemSender(address) {
    return address?.toLowerCase().startsWith("0xdeaddeaddeaddeaddeaddeaddeaddead");
}

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


// batch query
const PAGE_SIZE = 500;

export async function queryL2MintStatuses(l2ChainId, userAddress, pendings, signal) {
    if (!pendings || pendings.length === 0) return new Map();

    // 1. get first time
    const earliestLimit = Math.min(...pendings.map(p => p.timestamp)) - 600;

    const api = API_CONFIG[l2ChainId];
    let page = 1;
    let fetchedL2Txs = [];
    let hasMore = true;
    try {
        // 2. query tx
        while (hasMore) {
            if (signal?.aborted) return;

            const params = new URLSearchParams({
                module: 'account',
                action: 'txlist',
                address: userAddress,
                page: page.toString(),
                offset: PAGE_SIZE.toString(),
                sort: 'desc'
            });
            const response = await fetch(`${api}?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const txs = data?.result;
            // is finish
            if (!Array.isArray(txs) || txs.length === 0) break;

            fetchedL2Txs = fetchedL2Txs.concat(txs);
            const lastTxTimestamp = parseInt(txs[txs.length - 1].timeStamp);
            // is query all pending
            if (lastTxTimestamp < earliestLimit || txs.length < PAGE_SIZE) {
                hasMore = false;
            } else {
                page++;
            }

            // too old
            if (page > 20) break;
        }

        // 3. compare
        const resultMap = new Map();
        for (const p of pendings) {
            const matches = fetchedL2Txs.filter(l2 => {
                const isSameAmount = BigInt(l2.value) === BigInt(p.amount);
                const l2Time = parseInt(l2.timeStamp);
                const isTimingValid = l2Time >= (p.timestamp - 60) && l2Time <= (p.timestamp + 600);
                return isSystemSender(l2.from.toLowerCase()) && isSameAmount && isTimingValid;
            });
            let match = null;
            if (matches.length > 0) {
                match = matches.reduce((closest, current) => {
                    const closestDiff = Math.abs(parseInt(closest.timeStamp) - p.timestamp);
                    const currentDiff = Math.abs(parseInt(current.timeStamp) - p.timestamp);
                    return currentDiff < closestDiff ? current : closest;
                });
            }
            resultMap.set(p.id, match ? { hash: match.hash, timestamp: parseInt(match.timeStamp) } : null);
        }
        return resultMap;
    } catch (error) {
        console.error("Query L2 Status Failed:", error);
        throw error;
    }
}
