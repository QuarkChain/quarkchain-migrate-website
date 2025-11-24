// src/utils/walletManager.js
import store from '@/store';
import { chains } from '@/store/state';
import { ElMessage } from 'element-plus';

const targetChain = 1;
const chainID = `0x${targetChain.toString(16)}`;

export async function connectWallet() {
    if (!window.ethereum) {
        ElMessage.error('Can\'t connect: no wallet provider')
        return;
    }

    try {
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (currentChainId !== chainID) {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainID }],
            });
        }
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts',
        });

        await handleAccountsChanged(accounts);
        await handleChainChanged();
    } catch (error) {
        if (error.code === 4001) {
            ElMessage.error('User rejected wallet connection');
        } else {
            ElMessage.error('Connection Error: ' + error.message);
        }
    }
}

export function initWalletEvents() {
    if (!window.ethereum) return;
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
}

async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        await store.dispatch('setAccount', null);
        console.warn("No account connected");
        return;
    }
    await store.dispatch('setAccount', accounts[0]);
}

async function handleChainChanged() {
    const newChainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainID !== newChainId) {
        await store.dispatch('setAccount', null);
        await store.dispatch('setChainConfig', {});
    } else {
        const config = chains.find(v => v.chainID === chainID);
        if (config) {
            await store.dispatch('setChainConfig', JSON.parse(JSON.stringify(config)));
        }
    }
}
