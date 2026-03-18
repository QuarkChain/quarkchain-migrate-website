<template>
	<b-navbar class="nav-container">
		<template #brand>
			<b-navbar-item tag="div" class="logo-wrapper">
				<img class="logo" src="@/assets/logo.svg">
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
import Wallet from "@/ui/components/Wallet.vue"
</script>

<style lang="less">
.nav-container {
	margin: 0 auto;
	max-width: 1440px;
	height: 70px;
	background: transparent !important;
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
