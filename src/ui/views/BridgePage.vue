<template>
	<div class="bridge-container">
		<div class="bridge-header">
			<div></div>
			<HistoryButton :hasAction="hasAction" @click="handleActionClick"/>
		</div>

		<el-card class="bridge-card" :class="{ 'is-migration-mode': isMigration }">
			<!-- Network Select -->
			<div class="network-row">
				<div class="network-box left" @click="switchNetwork">
					<img class="network-icon" :src="fromNetworkConfig.icon"  alt="network-from"/>
					<div class="text">
						<span class="label">From</span>
						<span class="value">{{ fromNetworkConfig.name }}</span>
					</div>
				</div>

				<el-button class="switch-btn" circle @click="switchNetwork">
					<el-icon><Switch/></el-icon>
				</el-button>

				<div class="network-box right" @click="switchNetwork">
					<div class="text">
						<span class="label">To</span>
						<span class="value">{{ toNetworkConfig.name }}</span>
					</div>
					<img class="network-icon" :src="toNetworkConfig.icon" alt="network-to"/>
				</div>
			</div>

			<!-- Amount -->
			<div class="amount-box">
				<el-input v-model="amount" placeholder="0" type="number" class="amount-input">
					<template #append>
						<el-select v-model="selectedTokenSymbol" class="token-select">
							<template #prefix>
								<div class="token-option">
									<img :src="TOKEN_LIST.find(t => t.symbol === selectedTokenSymbol).icon" class="token-icon" />
									<span class="token-text">{{ selectedTokenSymbol }}</span>
								</div>
							</template>

							<el-option
									v-for="item in TOKEN_LIST"
									:key="item.symbol"
									:label="item.symbol"
									:value="item.symbol"
							>
								<div style="display:flex; align-items: center; gap: 8px;">
									<img :src="item.icon" style="width:20px; height:20px; border-radius:50%; object-fit: cover;"  alt="item-icon"/>
									<span style="color: #000; font-family: CoinbaseSans;">{{ item.symbol }}</span>
								</div>
							</el-option>
						</el-select>
					</template>
				</el-input>

				<div class="balance-row">
					<div class="balance-info">
						<span>Balance: </span>
						<span v-if="isBalanceLoading" class="balance-loading">
               <el-icon class="is-loading"><Loading /></el-icon>
            </span>
						<span v-else>{{ balance }} {{ selectedTokenSymbol }}</span>
					</div>
					<el-button size="small" link class="max-btn" @click="setMax">MAX</el-button>
				</div>
			</div>

			<!-- Migration notice-->
			<transition name="migration-collapse">
				<div v-if="isMigration" class="migration-alert-wrapper">
					<div class="migration-alert">
						<div class="alert-content">
							<p class="alert-title">⚠️ Note: One-Way Migration</p>
							<p class="alert-desc">ERC-20 QKC will be converted to L2 Native Token. This cannot be undone.</p>
						</div>
					</div>
				</div>
			</transition>

			<div class="bridge-button-row">
				<el-button
						:disabled="!isAmountValid || isBalanceLoading"
						class="bridge-submit-btn"
						type="primary"
						@click="handleBridge"
				>
					{{ buttonText }}
				</el-button>
			</div>
		</el-card>

		<!-- bridge dialogs -->
		<BridgeDialogL1 ref="progressDialogL1" @finish="onFinish" />
		<BridgeDialogL2 ref="progressDialogL2" @finish="onFinish" />

		<!--	history dialog	-->
		<HistoryPage v-model="showHistory" />
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { Switch, Loading } from '@element-plus/icons-vue'
import { useStore } from 'vuex';
import { TOKEN_LIST } from "@/config/tokens.js";
import { NETWORKS } from "@/config/networks.js";
import { getErc20BalanceByL1, getErc20BalanceByL2 } from "@/services/bridge/balanceService.js";
import { refreshLocalList } from "@/services/history/syncManager.js";
import { formatTokenAmount } from "@/infra/uitls/utils.js";

import BridgeDialogL1 from '@/ui/components/BridgeDialogL1.vue';
import BridgeDialogL2 from '@/ui/components/BridgeDialogL2.vue';
import HistoryButton from '@/ui/components/HistoryButton.vue';
import HistoryPage from '@/ui/views/HistoryPage.vue';

const store = useStore();
const account = computed(() => store.state.account);
const L1ChainId = computed(() => store.state.l1ChainId.toLowerCase());
const L2ChainId = computed(() => store.state.l2ChainId.toLowerCase());

// History state
//  TODO
const hasAction = ref(false);
const showHistory = ref(false);

// Bridge state
const isL1ToL2 = ref(true); // true: L1->L2, false: L2->L1
const amount = ref('');
const selectedTokenSymbol = ref(TOKEN_LIST[0].symbol);
const balance = ref('0.0000');
const isBalanceLoading = ref(false);

const progressDialogL1 = ref(null);
const progressDialogL2 = ref(null);

// Computed: network config
const fromNetworkConfig = computed(() => {
	const chainId = isL1ToL2.value ? L1ChainId.value : L2ChainId.value;
	return NETWORKS[chainId] || {};
});
const toNetworkConfig = computed(() => {
	const chainId = isL1ToL2.value ? L2ChainId.value : L1ChainId.value;
	return NETWORKS[chainId] || {};
});

// Computed: token contract
const currentTokenContract = computed(() => {
	const token = TOKEN_LIST.find(t => t.symbol === selectedTokenSymbol.value);
	if (!token) return null;

	const chainId = isL1ToL2.value ? L1ChainId.value : L2ChainId.value;
	return token.networks[chainId] || null;
});

// Computed: button state
const isAmountValid = computed(() => {
	const val = parseFloat(amount.value);
	return val > 0 && val <= parseFloat(balance.value);
});

const isMigration = computed(() => {
	return selectedTokenSymbol.value === 'QKC';
});

const buttonText = computed(() => {
	const val = parseFloat(amount.value);
	if (!amount.value || val === 0) return 'Enter Amount';
	if (val > parseFloat(balance.value)) return 'Insufficient Balance';
	if (isMigration.value) return 'Start Migration';
	return 'Bridge Assets';
});

// -----------------------------
// Methods
// -----------------------------
async function fetchBalance() {
	if (!account.value || !currentTokenContract.value) {
		balance.value = '0.0000';
		return;
	}

	isBalanceLoading.value = true;
	try {
		const { address, decimals } = currentTokenContract.value;
		let rawBalance;

		if (isL1ToL2.value) {
			rawBalance = await getErc20BalanceByL1(L1ChainId.value, address, account.value);
		} else {
			rawBalance = await getErc20BalanceByL2(L2ChainId.value, address, account.value);
		}

		balance.value = formatTokenAmount(rawBalance, decimals);
	} catch (e) {
		console.error("Fetch balance failed:", e);
		balance.value = '0.0000';
	} finally {
		isBalanceLoading.value = false;
	}
}

function switchNetwork() {
	isL1ToL2.value = !isL1ToL2.value;
	amount.value = '';
}

function setMax() {
	amount.value = balance.value;
}

function handleBridge() {
	const token = TOKEN_LIST.find(t => t.symbol === selectedTokenSymbol.value);
	if (!token) return;

	const payload = {
		fromNetwork: fromNetworkConfig.value,
		toNetwork: toNetworkConfig.value,
		token,
		amount: amount.value,
		account: account.value,
	};

	if (isL1ToL2.value) {
		progressDialogL1.value?.show(payload);
	} else {
		progressDialogL2.value?.show(payload);
	}
}

function handleActionClick() {
	showHistory.value = true
}

function onFinish() {
	fetchBalance();
	refreshLocalList();
}

// -----------------------------
// Watchers
// -----------------------------
watch([selectedTokenSymbol, isL1ToL2, account], fetchBalance, { immediate: true });

let timer;
onMounted(() => {
	fetchBalance();
	timer = setInterval(fetchBalance, 30_000);
});
onBeforeUnmount(() => {
	clearInterval(timer);
});
</script>


<style scoped lang="less">
@migration-blue: #5b5f97;
@migration-hover: #4a4e87;
@migration-bg: rgba(91, 95, 151, 0.03);
@migration-border: rgba(91, 95, 151, 0.2);
@migration-glow: rgba(91, 95, 151, 0.15);

.bridge-container {
	width: 700px;
	margin: 45px auto 0;
	padding: 30px;
}

.bridge-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.bridge-card {
	margin-top: 20px;
	padding: 30px 25px;
	border: 1px solid rgba(24, 30, 169, 0.15);
	border-radius: 12px;
	background: #fff;
	box-shadow: 0 4px 16px rgba(24, 30, 169, 0.06);
	transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);

	.network-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;

		.network-box {
			flex: 1;
			border: 1px solid rgba(24, 30, 169, 0.1);
			background: #FAFCFF;
			padding: 18px 20px;
			border-radius: 12px;
			cursor: pointer;
			display: flex;
			flex-direction: row;
			align-items: center;
			transition: all 0.3s ease;

			.network-icon {
				width: 52px;
				height: 52px;
				padding: 4px;
				border-radius: 20%;
				object-fit: cover;
			}

			.text {
				display: flex;
				flex-direction: column;
				line-height: 1.3;

				.label {
					font-size: 14px;
					color: #666666;
					margin-bottom: 2px;
				}
				.value {
					font-size: 17px;
					color: #1a1a1a;
					font-weight: 600;
					transition: color 0.3s ease;
				}
			}
		}
		.network-box:hover {
			box-shadow: 0 2px 6px rgba(24, 30, 169, 0.1);
			.text .value {
				color: #181ea9;
			}
		}
		.left {
			justify-content: flex-start;
		}
		.right {
			justify-content: flex-end;
		}
		.network-box.left .text {
			margin-left: 15px;
			align-items: flex-start;
			text-align: left;
		}
		.network-box.right .text {
			margin-right: 15px;
			align-items: flex-end;
			text-align: right;
		}

		.switch-btn {
			margin: 0 12px;
			background: #181ea9;
			color: #fff;
			border-color: #181ea9;
			transition: all 0.3s ease;
		}
		.switch-btn:hover {
			box-shadow: 0 3px 10px rgba(24, 30, 169, 0.25);
			background: #12168a;
			border-color: #12168a;
			color: #fff;
		}
	}

	.amount-box {
		margin-top: 22px;
		border: 1px solid rgba(24, 30, 169, 0.1);
		background: #FAFCFF;
		padding: 20px;
		border-radius: 12px;
		transition: background 0.3s ease, border-color 0.3s ease;

		.token-option {
			display: flex;
			align-items: center;
			gap: 10px;

			.token-icon {
				width: 22px;
				height: 22px;
				border-radius: 50%;
				object-fit: cover;
			}
			.token-text {
				color: #1a1a1a;
				font-weight: 500;
				font-family: CoinbaseDisplay;
			}
		}

		.balance-row {
			display: flex;
			justify-content: space-between;
			margin-top: 18px;

			.balance-info {
				font-size: 14px;
				color: #666666;
			}

			.max-btn {
				background: #181ea9;
				border: none;
				border-radius: 24px;
				padding: 6px 16px;
				font-size: 13px;
				font-weight: 600;
				color: #fff;
				transition: all 0.3s ease;
			}
			.max-btn:hover {
				box-shadow: 0 3px 10px rgba(24, 30, 169, 0.25);
				background: #12168a;
				color: #fff;
			}
		}
	}

	.migration-alert-wrapper {
		overflow: hidden;
		display: block;
	}
	.migration-alert {
		margin-top: 16px;
		padding: 12px 16px;
		border-radius: 12px;
		background: rgba(245, 158, 11, 0.06);
		border: 1px dashed rgba(245, 158, 11, 0.3);
		display: flex;
		align-items: flex-start;

		.alert-content {
			.alert-title {
				font-size: 14px;
				font-weight: 700;
				color: #f59e0b;
				margin-bottom: 4px;
				display: flex;
				align-items: center;
			}

			.alert-desc {
				font-size: 13px;
				color: #6b7280;
				line-height: 1.5;
			}
		}
	}
	.migration-collapse-enter-active,
	.migration-collapse-leave-active {
		transition:
				all 0.4s cubic-bezier(0.4, 0, 0.2, 1),
				max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		max-height: 200px;
	}
	.migration-collapse-enter-from,
	.migration-collapse-leave-to {
		opacity: 0;
		max-height: 0;
		transform: scale(0.96) translateY(-10px);
		margin-top: 0;
	}

	.bridge-button-row {
		margin-top: 28px;
		width: 100%;

		.bridge-submit-btn {
			width: 100%;
			height: 54px;
			background: #181ea9;
			color: #fff;
			border: none;
			font-size: 17px;
			font-weight: 600;
			border-radius: 16px;
			transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			letter-spacing: 0.5px;
			font-family: CoinbaseSans, sans-serif;

			&:hover:not(:disabled) {
				background: #12168a;
				transform: translateY(-2px);
				box-shadow: 0 8px 20px rgba(24, 30, 169, 0.25);
			}

			&:active:not(:disabled) {
				transform: translateY(0);
			}

			&:disabled {
				background: #f0f2f7;
				color: #94a3b8;
				cursor: not-allowed;
				border: 1px solid rgba(24, 30, 169, 0.05);
			}
		}
	}

	&.is-migration-mode {
		.network-box, .amount-box {
			background: @migration-bg;
			border-color: @migration-border;
		}

		.switch-btn {
			background: @migration-blue;
			border-color: @migration-blue;
			color: white;
			&:hover {
				background: @migration-hover;
				border-color: @migration-hover;
				box-shadow: 0 4px 12px @migration-glow;
			}
		}

		.amount-box .balance-row .max-btn {
			background: @migration-blue;
			border-color: @migration-blue;
			color: white;
			&:hover {
				background: @migration-hover;
				border-color: @migration-hover;
				box-shadow: 0 4px 12px @migration-glow;
			}
		}

		.bridge-button-row .bridge-submit-btn {
			background: linear-gradient(135deg, @migration-blue, @migration-hover);
			border: none;
			&:hover:not(:disabled) {
				background: linear-gradient(135deg, darken(@migration-hover, 5%), darken(@migration-hover, 10%));
				box-shadow: 0 8px 20px @migration-glow;
				transform: translateY(-2px);
			}
		}

		.network-box:hover .text .value {
			color: @migration-blue;
		}

		:deep(.token-select .el-select__wrapper:hover) {
			border-color: @migration-blue !important;
		}
	}

	:deep(.amount-input .el-input__wrapper) {
		box-shadow: none !important;
		background: transparent !important;
		padding: 0 4px;
		border: none;
	}
	:deep(.amount-input input) {
		font-size: 28px;
		font-weight: 600;
		color: #1a1a1a;
		font-family: CoinbaseSansBlob;
	}
	:deep(input[type="number"]::-webkit-outer-spin-button),
	:deep(input[type="number"]::-webkit-inner-spin-button) {
		-webkit-appearance: none;
		margin: 0;
	}
	:deep(.amount-input .el-input-group__append) {
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
	}
	:deep(.token-select .el-select__wrapper) {
		background: #fff !important;
		border-radius: 20px !important;
		border: 1px solid rgba(24, 30, 169, 0.2) !important;
		box-shadow: none !important;
		padding: 0 14px !important;
		min-height: 40px;
		display: flex;
		align-items: center;
		transition: border-color 0.3s ease;
	}
	:deep(.token-select .el-select__wrapper:hover) {
		border-color: #181ea9 !important;
	}
}
</style>
