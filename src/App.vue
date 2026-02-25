<template>
	<div id="app">
		<el-container class="full-height">
			<el-header class="header">
				<Header />
			</el-header>

			<el-main class="main-content">
				<router-view :key="$route.fullPath" />
			</el-main>

			<Footer />
		</el-container>
	</div>
</template>

<script setup>
import Header from '@/ui/components/HeaderPage.vue'
import Footer from '@/ui/components/FooterPage.vue'
</script>

<style>
#app {
	background: #FAFCFF;
	text-align: center;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
	margin: 0 auto;
}

.full-height {
	display: flex;
	flex-direction: column;
	min-height: 100vh;
}

.header {
	margin-top: 26px;
	height: 64px !important;
	padding: 5px 20px !important;
}

.main-content {
	flex: 1;
	overflow: auto;
}

@media screen and (max-width: 420px) {
	.header {
		margin-top: 10px;
		height: 64px !important;
		padding: 5px 15px !important;
	}

	.full-height {
		min-height: auto;
	}
	.main-content {
		flex: unset;
		height: auto;
		overflow: visible;
	}
}
</style>
