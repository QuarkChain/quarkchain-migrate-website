<template>
	<div id="app">
		<el-container>
			<el-header class="header">
				<Header />
			</el-header>

			<el-main :style="{ minHeight: fullHeight - 90 - 82 + 'px' }">
				<router-view :key="$route.fullPath" />
			</el-main>

			<Footer />
		</el-container>
	</div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Header from '@/views/HeaderPage.vue'
import Footer from '@/views/FooterPage.vue'

const fullHeight = ref(document.documentElement.clientHeight)
let timer = false

const updateHeight = () => {
	if (!timer) {
		fullHeight.value = document.documentElement.clientHeight
		timer = true
		setTimeout(() => {
			timer = false
		}, 400)
	}
}

onMounted(() => {
	window.addEventListener('resize', updateHeight)
})

onBeforeUnmount(() => {
	window.removeEventListener('resize', updateHeight)
})
</script>

<style>
#app {
	background: #FAFCFF;
	text-align: center;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
	margin: 0 auto;
}

.header {
	margin-top: 26px;
	height: 64px !important;
	padding: 5px 20px !important;
}

@media screen and (max-width: 420px) {
	.header {
		margin-top: 10px;
		height: 64px !important;
		padding: 5px 15px !important;
	}
}
</style>
