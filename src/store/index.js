import { createStore } from 'vuex';
import { chains } from './state';

export default createStore({
  state() {
    return {
      activeEnvId: import.meta.env.TARGET_L1_CHAIN_ID || '0xaa36a7',
      account: '',
      chainId: '',
    };
  },
  getters: {
    currentConfig: (state) => {
      return chains.find(v => v.chainID === state.activeEnvId) || {};
    },
    Conversion: (state, getters) => getters.currentConfig.Conversion || null,
    OldToken: (state, getters) => getters.currentConfig.OldToken || null,
    L2Rpc: (state, getters) => getters.currentConfig.L2Rpc || null,
  },
  mutations: {
    SET_ACCOUNT: (state, p) => state.account = p,
    SET_CHAIN: (state, id) => state.chainId = id,
  },
  actions: {
    setAccount({ commit }, p) { commit('SET_ACCOUNT', p); },
    setChainId({ commit }, id) { commit('SET_CHAIN', id); },
  }
});
