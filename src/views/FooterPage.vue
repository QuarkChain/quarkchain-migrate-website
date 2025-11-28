<template>
	<div class="footer-div">
		<div class="footer-b">
			<div class="footer-b-text">BUILT BY QUARKCHAIN WITH ❤️️</div>
			<div class="foot-img">
				<span v-if="Conversion" class="foot-link" @click="goEtherscan">Contract</span>
				<span class="foot-link" @click="goTwitter">Twitter</span>
				<span class="foot-link" @click="goDiscord">Discord</span>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from 'vuex'

const store = useStore()

const Conversion = computed(() => store.state.chainConfig?.Conversion || null)

function goTwitter() {
	window.open('https://x.com/quark_chain', "_blank")
}

function goDiscord() {
	window.open('https://discord.com/invite/GbkGhY3qkh', "_blank")
}

function goEtherscan() {
	if (!Conversion.value) return
	window.open(`https://etherscan.io/address/${Conversion.value}#code`, "_blank")
}
</script>

<style scoped lang="less">
.footer-div {
	position: relative;
	width: 100%;
	height: 82px;
}

.footer-b {
	max-width: 1200px;
	margin: 20px auto;
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;

	.footer-b-text {
		color: #000;
		font-size: 10px;
		font-style: normal;
		font-weight: 700;
		line-height: normal;
		text-transform: uppercase;
		font-feature-settings: 'liga' off, 'clig' off;
		font-family: CoinbaseDisplay;
	}

	.foot-img {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;

		.foot-link {
			cursor: pointer;
			color: #1722A2;
			font-size: 14px;
			font-weight: 600;
			margin-right: 18px;
			text-decoration: underline;
			transition: color 0.2s;

			&:hover {
				color: #648BFD;
			}
		}
	}
}

@media screen and (max-width: 500px) {
	.footer-div {
		height: auto;
	}

	.footer-b {
		padding: 0 0 30px;
		width: 92%;
		margin: 48px auto 0;

		.footer-b-text {
			font-size: 10px;
		}

		.foot-img {
			.foot-link {
				font-size: 11px;
				margin-right: 10px;
			}
		}
	}
}
</style>
