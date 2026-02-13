// src/utils/walletManager.js
import store from '@/store';
import { ElMessage } from 'element-plus';

const getTargetL1 = () => store.state.activeEnvId;

export function initWalletEvents() {
    if (!window.ethereum) return;
    window.ethereum.on("accountsChanged", async (accounts) => {
        await store.dispatch('setAccount', accounts[0] || null)
    });
    window.ethereum.on("chainChanged", async (chainId) => {
        await store.dispatch('setChainId', chainId)
    });
}

export async function connectWallet() {
    if (!window.ethereum) {
        ElMessage.error('Can\'t connect: no wallet provider')
        return;
    }

    try {
        const targetId = getTargetL1();
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (currentChainId !== targetId) {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: targetId }],
            });
        }
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts',
        });

        await store.dispatch('setAccount', accounts[0] || null)
        await store.dispatch('setChainId', targetId);
    } catch (error) {
        if (error.code === 4001) {
            ElMessage.error('User rejected');
        } else {
            ElMessage.error('Connection Error: ' + error.message);
        }
    }
}

export async function ensureNetwork(targetHexId, params) {
    if (!window.ethereum) return;

    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (currentChainId.toLowerCase() !== targetHexId.toLowerCase()) {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: targetHexId }],
            });
        } catch (error) {
            if (error.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [params]
                })
            } else {
                ElMessage.error('Switch network failed: ' + error.message);
                return false;
            }
        }
    }
    return true;
}
