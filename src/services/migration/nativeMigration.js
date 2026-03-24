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
export async function queryL2MintStatuses(l2ChainId, userAddress, pendings, signal) {
    if (!pendings || pendings.length === 0) return new Map();

    // 1. get first time
    const earliestLimit = Math.min(...pendings.map(p => p.timestamp)) - 600;

    const apiV2Base = API_CONFIG[l2ChainId].replace('/api', '/api/v2');

    let fetchedL2Txs = [];
    let nextParams = "";
    try {
        // 2. query tx
        while (true) {
            if (signal?.aborted) return;

            const url = `${apiV2Base}/addresses/${userAddress}/transactions${nextParams ? '?' + nextParams : ''}`;
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            const items = data?.items || [];
            if (items.length === 0) break;

            fetchedL2Txs = fetchedL2Txs.concat(items);
            const lastTxTs = Math.floor(new Date(items[items.length - 1].timestamp).getTime() / 1000);
            // is query all pending
            if (lastTxTs < earliestLimit || !data.next_page_params) {
                break;
            }

            const p = data.next_page_params;
            nextParams = `block_number=${p.block_number}&index=${p.index}&items_count=${p.items_count}`;
        }

        // 3. compare
        const resultMap = new Map();
        for (const p of pendings) {
            const matches = fetchedL2Txs.filter(l2 => {
                const l2From = l2.from?.hash?.toLowerCase();
                const isSameAmount = BigInt(l2.value) === BigInt(p.amount);
                const l2Time = Math.floor(new Date(l2.timestamp).getTime() / 1000);
                const isTimingValid = l2Time >= (p.timestamp - 60) && l2Time <= (p.timestamp + 600);
                return isSystemSender(l2From) && isSameAmount && isTimingValid;
            });
            if (matches.length > 0) {
                resultMap.set(p.id, true);
            }
        }
        return resultMap;
    } catch (error) {
        console.error("Query L2 Status Failed:", error);
        throw error;
    }
}
