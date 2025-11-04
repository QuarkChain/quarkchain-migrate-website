import { createStore } from 'vuex';

const store = createStore({
  state() {
    return {
      chainConfig: {},
      account: '',
    };
  },
  mutations: {
    chainMutation(state, payload) {
      state.chainConfig = payload;
    },
    accountMutation(state, payload) {
      state.account = payload;
    },
  },
  actions: {
    setChainConfig({ commit }, payload) {
      commit('chainMutation', payload);
    },
    setAccount({ commit }, payload) {
      commit('accountMutation', payload);
    },
  },
  modules: {},
});

export default store;
