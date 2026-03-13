// src/app/store/index.js
import { createStore } from 'vuex';
import { CONTRACTS } from "@/config/contracts.js";

export default createStore({
  state() {
    const activeEnvId = import.meta.env.VITE_TARGET_L1_CHAIN_ID || '0xaa36a7'
    const l1ChainId = activeEnvId
    const l2ChainId = activeEnvId === '0x1' ? '0x186ab' : '0x1adbb'

    return {
      activeEnvId,
      l1ChainId,
      l2ChainId,
      account: '',
      walletChainId: '',
    }
  },
  getters: {
    isWalletConnected: (state) => !!state.account,
    isOnL1: (state) => BigInt(state.walletChainId || 0) === BigInt(state.l1ChainId),
    isOnL2: (state) => BigInt(state.walletChainId || 0) === BigInt(state.l2ChainId),

    // ----------------------
    // Contract / Bridge
    // ----------------------
    Conversion: (state) => CONTRACTS[state.l1ChainId].Conversion || {},
    OldToken: (state) => CONTRACTS[state.l1ChainId].OldToken || {},

    Bridge: (state) => CONTRACTS[state.l1ChainId].Bridge || {},
    L1StandardBridge: (state, getters) => getters.Bridge.L1StandardBridge || null,
    L2StandardBridge: (state, getters) => getters.Bridge.L2StandardBridge || null,
  },
  mutations: {
    SET_ACCOUNT: (state, p) => state.account = p,
    SET_CHAIN: (state, id) => state.walletChainId = id,
  },
  actions: {
    setAccount({ commit }, p) { commit('SET_ACCOUNT', p); },
    setChainId({ commit }, id) { commit('SET_CHAIN', id); },
  }
});
