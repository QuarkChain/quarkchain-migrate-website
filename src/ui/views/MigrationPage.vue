<template>
	<div class="home-container">
		<div class="home-message">
			To seamlessly integrate QuarkChain with Ethereum’s rollup infrastructure, the original ERC-20 QKC token (L1)
			needs to be migrated to a new native token (L2) at a 1:1 ratio.
		</div>

		<el-card class="home-convert">
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
		</el-card>

		<p class="show-more">My Balance</p>
		<el-card class="convert-detail">
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
		</el-card>

		<cross-chain-dialog ref="progressDialog" @finish="onFinish" />
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ethers } from 'ethers'
import { useStore } from 'vuex'
import { getErc20Balance, getL2QKCBalance } from '@/services/migration/nativeMigration.js'
import CrossChainDialog from '@/ui/components/CrossChainDialog.vue'

const store = useStore()
const progressDialog = ref(null)

const oldBalance = ref(0n)
const newBalance = ref(0n)
const isFetching = ref(false)
const input = ref('')

const account = computed(() => store.state.account)
const Conversion = computed(() => store.getters.Conversion);
const OldToken = computed(() => store.getters.OldToken);
const L2Rpc = computed(() => store.getters.L2Rpc);

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
	width: 700px;
	margin: 50px auto 0;
	padding: 30px;
}

.home-message {
	font-style: normal;
	font-weight: 400;
	font-size: 18px;
	line-height: 24px;
	color: #181ea9;
	opacity: 0.8;
	text-align: left;
	font-family: CoinbaseSans;
}

.home-convert {
	margin-top: 30px;
	padding: 30px 25px;
	border: 1px solid rgba(24, 30, 169, 0.15);
	border-radius: 12px;
	background: #fff;

	.row-layout {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		gap: 20px;
	}

	.convert-title {
		color: #181ea9;
		font-size: 15px;
		line-height: 20px;
		font-weight: 500;
		font-family: CoinbaseSansBlob;
	}

	.convert-input {
		flex: 1;
	}
	.convert-input :deep(.el-input__inner) {
		color: #1a1a1a;
		font-size: 16px;
		line-height: 20px;
		border-color: rgba(24, 30, 169, 0.2);
		font-family: CoinbaseDisplay;
	}

	.convert-input :deep(.el-input-group__append) {
		background-color: transparent;
		color: #181ea9;
		font-weight: 600;
		border-color: rgba(24, 30, 169, 0.2);
		font-family: CoinbaseDisplay;
	}
	:deep(input[type="number"]::-webkit-outer-spin-button),
	:deep(input[type="number"]::-webkit-inner-spin-button) {
		-webkit-appearance: none;
		margin: 0;
	}


	.convert-button {
		cursor: pointer;
		width: auto;
		background: #181ea9;
		border: none;
		font-size: 15px;
		line-height: 20px;
		color: rgb(255, 255, 255);
		border-radius: 24px;
		font-family: CoinbaseSansBlob;
		padding: 8px 16px;
		transition: all 0.3s ease;
	}
	.convert-button:hover {
		background-color: #12168a;
		box-shadow: 0 3px 10px rgba(24,30,169,0.25);
		border: 0;
	}
	.convert-button:disabled {
		background: rgba(24, 30, 169, 0.4);
		color: rgba(255, 255, 255, 0.8);
		cursor: not-allowed;
	}

	.convert-note {
		font-style: normal;
		font-size: 13px;
		line-height: 1.5;
		color: #e63946;
		width: 100%;
		margin: 20px 0 0;
		font-family: CoinbaseDisplay;
		text-align: left;
	}
}


.show-more {
	font-size: 18px;
	color: #181ea9;
	text-align: left;
	margin: 30px 0 15px;
	font-family: CoinbaseSansBlob;
}

.convert-detail {
	border: 1px solid rgba(24, 30, 169, 0.15);
	border-radius: 12px;
	padding: 30px 25px;
	background: #fff;

	.row-layout {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		gap: 20px;
	}

	.detail-margin {
		margin-top: 18px;
	}

	.detail-title {
		font-style: normal;
		line-height: 20px;
		color: #666666;
		font-size: 14px;
		font-weight: 500;
		font-family: CoinbaseSans;
	}

	.detail-value {
		font-style: normal;
		line-height: 20px;
		font-size: 14px;
		font-weight: 400;
		font-family: CoinbaseSans;
	}
	.convert-value-old {
		color: #e67e22;
	}
	.convert-value-new {
		color: #181ea9;
	}
	.convert-value-address {
		color: #666666;
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
		margin: 30px auto 0;
		padding: 0 20px;
	}

	.home-message {
		font-size: 15px;
		line-height: 20px;
	}

	.home-convert {
		padding: 20px;

		.row-layout {
			gap: 12px;
		}

		.convert-title {
			font-size: 14px;
			line-height: 18px;
			width: auto;
		}

		.convert-input {
			flex: 1;
		}
		.convert-input :deep(.el-input__inner) {
			font-size: 14px;
			line-height: 18px;
		}
		.convert-input :deep(.el-input-group__append) {
			font-size: 14px;
			line-height: 18px;
			padding-left: 8px;
			padding-right: 8px;
			font-weight: 500;
		}


		.convert-button {
			width: auto;
			font-size: 14px;
			line-height: 18px;
			padding: 6px 12px;
		}

		.convert-note {
			width: 100%;
			margin: 15px 0 0;
		}
	}


	.show-more {
		font-size: 16px;
		margin: 30px 0 15px;
	}

	.convert-detail {
		padding: 20px;
	}
}
</style>
