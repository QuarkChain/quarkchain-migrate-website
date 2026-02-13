<template>
	<b-navbar class="nav-container">
		<template #brand>
			<b-navbar-item tag="div" class="logo-wrapper">
				<img class="logo" src="../assets/logo.svg">
			</b-navbar-item>
		</template>

		<template #start>
			<b-navbar-item tag="router-link" to="/migration">
				<span class="nav-text">QKC Migration</span>
			</b-navbar-item>
			<b-navbar-item tag="router-link" to="/bridge">
				<span class="nav-text">Bridge</span>
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
	max-width: 1440px;
	height: 70px;
	background: transparent !important;

	.navbar-item {
		font-weight: 400;
		font-size: 20px;
		line-height: 27px;
		font-family: CoinbaseSans;
		background-color: transparent !important;
	}
	.navbar-item:hover,
	.navbar-item:focus,
	.navbar-item:active {
		background-color: transparent !important;
	}

	.navbar-start .navbar-item {
		transition: all 0.3s ease;
	}
	.navbar-start .navbar-item:hover {
		background-color: transparent !important;
		transform: translateY(-2px);
		color: #181ea9;
		font-weight: 500;
	}

	.router-link-exact-active {
		color: #181ea9;
		font-weight: 500;
	}
}

.connection {
	cursor: default !important;
}
.connection:hover {
	background-color: transparent !important;
}

.logo {
	min-height: 40px;
	max-height: 40px;
	padding: 2px 0;
}

@media screen and (max-width: 420px) {
	.logo {
		min-height: 30px;
		max-height: 30px;
	}
	.navbar-menu {
		background: #F9F8FD;
		border-radius: 12px;
	}
}
</style>
