// src/infra/wallet/walletManager.js
import store from '@/app/store/index.js';
import { NETWORKS } from "@/config/networks.js";
import { ElMessage } from 'element-plus';
import { startSync, stopSync } from '@/services/history/syncManager.js';
import { clearProvider } from "@/infra/provider/providerManager.js";

const getL1Id = () => store.state.l1ChainId.toLowerCase();
const getL2Id = () => store.state.l2ChainId.toLowerCase();

export function initWalletEvents() {
    if (!window.ethereum) return;
    window.ethereum.on('accountsChanged', async (accounts) => {
        const account = accounts[0] || null;
        await store.dispatch('setAccount', account);

        if (account) startSync(account);
        else stopSync();
    });
    window.ethereum.on("chainChanged", async (chainId) => {
        await store.dispatch('setChainId', chainId)
        clearProvider();
    });
}

function formatAddChainParams(networkConfig) {
    return {
        chainId: networkConfig.chainId,
        chainName: networkConfig.name,
        nativeCurrency: networkConfig.nativeCurrency,
        rpcUrls: networkConfig.rpcUrls,
        blockExplorerUrls: [networkConfig.explorer],
    };
}

export async function connectWallet() {
    if (!window.ethereum) {
        ElMessage.error('Can\'t connect: no wallet provider')
        return;
    }

    try {
        const l1 = getL1Id();
        const l2 = getL2Id();

        // add network
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [formatAddChainParams(NETWORKS[l2])]
            });
        } catch (e) {
            if (e.code === 4001) {
                ElMessage.error('User rejected: L2 network is required for bridging.');
                return;
            }
            console.log("L2 Network already exists or internal, moving on...");
        }

        // switch network
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (currentChainId !== l1) {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: l1 }],
            });
        }
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts',
        });

        await store.dispatch('setAccount', accounts[0] || null)
        await store.dispatch('setChainId', l1);
        startSync(accounts[0]);
    } catch (error) {
        if (error.code === 4001) {
            ElMessage.error('User rejected');
        } else {
            ElMessage.error('Connection Error: ' + error.message);
        }
    }
}
