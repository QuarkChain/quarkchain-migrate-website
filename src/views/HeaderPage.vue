<template>
  <b-navbar class="nav-container">
    <template #brand>
      <b-navbar-item tag="router-link" :to="{ path: '/' }">
        <img class="logo" src="../assets/logo.svg">
      </b-navbar-item>
    </template>
    <template #end>
      <b-navbar-item class="connection" tag="div">
        <Wallet/>
      </b-navbar-item>
    </template>
  </b-navbar>
</template>

<script>
import Wallet from "@/components/Wallet.vue";

export default {
  name: 'HeaderComponent',
  components: {
    Wallet
  }
}
</script>

<style lang="less">
.nav-container {
  margin: 0 auto;
  max-width: 1400px;
  height: 64px;
  background: transparent !important;
}

.connection {
  cursor: default !important;
}

.connection:hover {
  background-color: transparent !important;
}

.logo {
  min-height: 36px;
  max-height: 36px;
}

@media screen and (max-width: 420px) {
  .logo {
    min-height: 25px;
  }
  .navbar-menu {
    background: #F9F8FD;
    border-radius: 10px;
  }
}
</style>
