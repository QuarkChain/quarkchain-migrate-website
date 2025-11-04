<template>
	<div class="home-container">
		<p class="home-title">QuarkChain Token Migration</p>
		<div class="home-message">
			To seamlessly integrate QuarkChain with Ethereum’s rollup infrastructure, the original ERC-20 QKC token (L1)
			needs to be migrated to a new native token (L2) at a 1:1 ratio.
		</div>

		<div class="home-convert">
			<div class="row-layout">
				<p class="convert-title">Amount to Migrate:</p>

				<el-input
						v-model="input"
						type="number"
						step="any"
						placeholder="Enter amount"
						class="convert-input"
				>
					<template #append>QKC</template>
				</el-input>

				<el-button
						class="convert-button"
						@click="clickButton"
						:disabled="isButtonDisabled"
				>
					Start
				</el-button>
			</div>
			<p class="convert-note">
				⚠️ Note: This is a one-way migration. Once your QKC is migrated, it cannot be transferred back.
			</p>
		</div>

		<p class="show-more">My Balance</p>
		<div class="convert-detail">
			<div class="row-layout">
				<p class="detail-title">QKC (L1):</p>
				<div class="detail-value convert-value-old">{{ oldBalStr }} QKC</div>
			</div>
			<div class="row-layout detail-margin">
				<p class="detail-title">QKC (L2):</p>
				<div class="detail-value convert-value-new">{{ newBalStr }} QKC</div>
			</div>
			<div class="row-layout detail-margin">
				<p class="detail-title">Address:</p>
				<div class="convert-value convert-value-address">{{ accountStr }}</div>
			</div>
		</div>

		<cross-chain-dialog ref="progressDialog" @finish="onFinish" />
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ethers } from 'ethers'
import { useStore } from 'vuex'
import { getErc20Balance, getL2QKCBalance } from '@/utils/web3'
import CrossChainDialog from '@/components/CrossChainDialog.vue'

const store = useStore()
const progressDialog = ref(null)

const oldBalance = ref(0n)
const newBalance = ref(0n)
const isFetching = ref(false)
const input = ref('')

const account = computed(() => store.state.account)
const Conversion = computed(() => store.state.chainConfig?.Conversion || null)
const OldToken = computed(() => store.state.chainConfig?.OldToken || null)
const L2Rpc = computed(() => store.state.chainConfig?.L2Rpc || null)

const oldBalStr = computed(() => {
	if (account.value) {
		return parseFloat(ethers.formatEther(oldBalance.value)).toFixed(2)
	}
	return '0.00'
})

const newBalStr = computed(() => {
	if (account.value) {
		return parseFloat(ethers.formatEther(newBalance.value)).toFixed(2)
	}
	return '0.00'
})

const accountStr = computed(() => {
	if (account.value) {
		return (
				account.value.substring(0, 6) +
				'...' +
				account.value.substring(account.value.length - 4)
		)
	}
	return '-'
})

const isButtonDisabled = computed(() => {
	try {
		if (!input.value || isNaN(input.value)) return true
		const inputWei = ethers.parseUnits(input.value.toString(), 18)
		return !account.value || oldBalance.value <= 0n || inputWei > oldBalance.value
	} catch (e) {
		return true
	}
})

const accountAndTokensReady = computed(
		() => !!(account.value && OldToken.value && L2Rpc.value)
)

watch(accountAndTokensReady, async (ready) => {
	if (ready) {
		await fetchBalances()
	}
}, { immediate: true })

async function fetchBalances() {
	if (!account.value) return
	if (isFetching.value) {
		console.log('Skip fetch: already in progress')
		return
	}
	isFetching.value = true
	try {
		const [oldToken, newToken] = await Promise.all([
			getErc20Balance(OldToken.value, account.value),
			getL2QKCBalance(L2Rpc.value, account.value),
		])
		oldBalance.value = oldToken
		newBalance.value = newToken
	} finally {
		isFetching.value = false
	}
}

function clickButton() {
	progressDialog.value.show({
		amount: input.value,
		balance: oldBalance.value,
		account: account.value,
		conversion: Conversion.value,
		oldToken: OldToken.value,
		l2Rpc: L2Rpc.value,
	})
}

function onFinish() {
	fetchBalances()
}

let timer
onMounted(() => {
	fetchBalances()
	timer = setInterval(fetchBalances, 30000)
})

onBeforeUnmount(() => {
	clearInterval(timer)
})
</script>

<style scoped lang="less">
.home-container {
	width: 750px;
	margin: 35px auto;
	padding: 25px;
}

.home-title {
	font-weight: 400;
	font-size: 24px;
	line-height: 15px;
	letter-spacing: 2px;
	margin: 0 auto 25px;
	color: #181ea9;
	font-family: CoinbaseSansBlob;
}


.home-message {
	font-style: normal;
	font-weight: 300;
	font-size: 15px;
	line-height: 19px;
	color: #1722a2;
	opacity: 0.7;
	text-align: left;
	font-family: CoinbaseSans;
}

.home-convert {
	margin-top: 45px;
	padding: 25px 30px;
	border: 1px solid rgba(24, 30, 169, 0.3);

	.row-layout {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		gap: 25px;
	}

	.convert-title {
		color: rgb(23, 34, 162);
		font-size: 14px;
		line-height: 14px;
		font-family: CoinbaseSansBlob;
	}

	.convert-input {
		flex: 1;
	}
	.convert-input ::v-deep .el-input__inner {
		color: rgb(24, 30, 169);
		font-size: 14px;
		line-height: 14px;
		border-color: rgba(24, 30, 169, 0.3);
		font-family: CoinbaseDisplay;
	}
	.convert-input ::v-deep .el-input-group__append {
		background-color: transparent;
		color: rgb(24, 30, 169);
		font-weight: 500;
		border-color: rgba(24, 30, 169, 0.3);
		font-family: CoinbaseDisplay;
	}


	.convert-button {
		cursor: pointer;
		width: 20%;
		background: rgb(24, 30, 169);
		border: none;
		font-size: 14px;
		line-height: 14px;
		color: rgb(255, 255, 255);
		border-radius: 4px;
		font-family: CoinbaseSansBlob;
	}
	.convert-button:hover {
		background-color: rgba(24, 30, 169, 0.7);
		border: 0;
	}
	.convert-button:disabled {
		background: rgba(24, 30, 169, 0.4);
		color: rgba(255, 255, 255, 0.8);
		cursor: not-allowed;
	}

	.convert-note {
		font-style: normal;
		font-size: 12px;
		line-height: 1.5;
		color: red;
		width: 85%;
		margin: 15px auto 0;
		font-family: CoinbaseDisplay;
	}
}


.show-more {
	font-size: 18px;
	color: rgb(24, 30, 169);
	text-align: left;
	margin: 38px 0 15px;
	font-family: CoinbaseSansBlob;
}

.convert-detail {
	border: 1px solid rgba(24, 30, 169, 0.3);
	padding: 25px 30px;

	.row-layout {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		gap: 25px;
	}

	.detail-margin {
		margin-top: 15px;
	}

	.detail-title {
		font-style: normal;
		line-height: 18px;
		color: rgb(24, 30, 169);
		font-size: 13px;
		font-weight: 500;
		opacity: 0.8;
		font-family: CoinbaseSans;
	}

	.detail-value {
		font-style: normal;
		line-height: 18px;
		font-size: 13px;
		font-weight: 400;
		font-family: CoinbaseSans;
	}
	.convert-value-old {
		color: #F4A261;
	}
	.convert-value-new {
		color: #3B4BFF;
	}
	.convert-value-address {
		color: #666;
		font-family: "Roboto Mono", monospace;
	}
}

.fade-enter-active, .fade-leave-active {
	transition: opacity 0.3s ease;
}

.fade-enter, .fade-leave-to {
	opacity: 0;
}

@media screen and (max-width: 500px) {
	.home-container {
		width: 95%;
		margin: 20px auto;
		padding: 0;
	}

	.home-title {
		font-size: 20px;
		margin-bottom: 15px;
	}
	.home-message {
		font-size: 13px;
	}

	.home-convert {
		padding: 15px;

		.row-layout {
			gap: 8px;
		}

		.convert-title {
			font-size: 12px;
			line-height: 16px;
			width: 20%;
		}

		.convert-input {
			flex: 1;
		}
		.convert-input ::v-deep .el-input__inner {
			font-size: 12px;
			line-height: 12px;
		}
		.convert-input ::v-deep .el-input-group__append {
			font-size: 12px;
			line-height: 12px;
			padding-left: 8px;
			padding-right: 8px;
			font-weight: 400;
		}


		.convert-button {
			width: 20%;
			font-size: 12px;
			line-height: 12px;
			padding-left: 0px;
			padding-right: 0px;
		}

		.convert-note {
			width: 90%;
			margin: 15px auto 0;
		}
	}


	.show-more {
		font-size: 15px;
		margin: 40px 0 15px;
	}

	.convert-detail {
		padding: 15px;
	}
}
</style>
