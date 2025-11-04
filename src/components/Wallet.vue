<template>
  <div id="wallet">
    <button
      class="btn-connect"
      v-if="!account"
      @click.stop="connect"
    >
      Connect
    </button>
    <div v-else class="account">
      {{ accountShort }}
      &nbsp;|&nbsp;
      {{ "Ethereum" }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';
import { connectWallet } from '@/utils/walletManager.js';

const store = useStore();

const account = computed(() => store.state.account);

const accountShort = computed(() => {
	if (!account.value) return null;
	return account.value.substring(0, 6) + '...' + account.value.slice(-4);
});

function connect() {
	connectWallet();
}
</script>

<style scoped>
#wallet {
  display: flex;
  justify-content: center;
}

.btn-connect {
  cursor: pointer;
  transition: all 0.1s ease 0s;
  width: 120px;
  height: 44px;
  color: #ffffff;
  font-size: 18px;
  border: 0;
  background: rgb(24, 30, 169);
  border-radius: 4px;
}
.btn-connect:hover {
  background-color: rgba(24, 30, 169, 0.7);
  border: 0;
}

.account {
  height: 38px;
  font-size: 15px;
  line-height: 38px;
  background: #FFFFFF;
  border: 1px solid #6D71CB;
  color: #1722a2;
  padding: 0 15px;
  text-align: center;
}
</style>
