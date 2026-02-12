<template>
	<b-navbar class="nav-container">
		<template #brand>
			<b-navbar-item tag="div" class="logo-wrapper">
				<img class="logo" src="../assets/logo.svg">
			</b-navbar-item>
		</template>

		<template #start>
			<b-navbar-item tag="router-link" to="/migration">
				<span style="margin: 0 10px 0 20px">QKC Migration</span>
			</b-navbar-item>
			<b-navbar-item tag="router-link" to="/bridge">
				Bridge
			</b-navbar-item>
		</template>

		<template #end>
			<b-navbar-item class="connection" tag="div">
				<Wallet/>
			</b-navbar-item>
		</template>
	</b-navbar>
</template>

<script setup>
import Wallet from "@/components/Wallet.vue"
</script>

<style lang="less">
.nav-container {
  margin: 0 auto;
  max-width: 1400px;
  height: 64px;
  background: transparent !important;

	.navbar-item {
		font-weight: 400;
		font-size: 20px;
		line-height: 27px;
		font-family: CoinbaseSans;
		background-color: transparent !important;
	}
	.navbar-item:hover {
		background-color: transparent !important;
	}
	.navbar-item:focus {
		background-color: transparent !important;
	}
	.navbar-item:active {
		background-color: transparent !important;
	}

	.navbar-start .navbar-item {
		transition: all 0.2s ease;
	}
	.navbar-start .navbar-item:hover {
		background-color: transparent !important;
		transform: translateY(-2px);
		color: #181ea9;
		font-weight: 500;
	}

	.router-link-exact-active {
		color: #181ea9;
	}
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
