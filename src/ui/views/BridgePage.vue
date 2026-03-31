<template>
	<div class="bridge-container">
		<div class="bridge-header">
			<div></div>
			<HistoryButton :count="actionCount" @click="handleActionClick"/>
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
					<el-button size="small" link class="max-btn" :disabled="isMigration && !isL1ToL2" @click="setMax">MAX</el-button>
				</div>
			</div>

			<!-- Migration notice-->
			<transition name="migration-collapse">
				<div v-if="isMigration" class="migration-alert-wrapper">
					<div class="migration-alert">
						<div class="alert-content">
							<p class="alert-title">⚠️ Note: Confirm Migration to L2 Native</p>
							<p class="alert-desc">You are migrating ERC-20 QKC to Native QKC on L2. This is a permanent protocol conversion and cannot be reversed.</p>
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
		<MigrationDialog ref="migrationDialog" @finish="onFinish" />

		<!--	history dialog	-->
		<HistoryPage v-model="showHistory" />
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { Switch, Loading } from '@element-plus/icons-vue'
import { useStore } from 'vuex';
import { TOKEN_LIST } from "@/config/tokens.ts";
import { NETWORKS } from "@/config/networks.js";
import { actionCount } from "@/app/store/txStore.js";
import { getErc20BalanceByL1, getErc20BalanceByL2, getQKCBalanceByL2 } from "@/services/bridge/balanceService.js";
import { refreshLocalList } from "@/services/history/syncManager.js";
import { formatTokenAmount } from "@/infra/uitls/utils.js";

// Components
import BridgeDialogL1 from '@/ui/components/BridgeDialogL1.vue';
import BridgeDialogL2 from '@/ui/components/BridgeDialogL2.vue';
import MigrationDialog from '@/ui/components/MigrationDialog.vue';
import HistoryButton from '@/ui/components/HistoryButton.vue';
import HistoryPage from '@/ui/views/HistoryPage.vue';

// --- Global State ---
const store = useStore();
const account = computed(() => store.state.account);
const L1ChainId = computed(() => store.state.l1ChainId.toLowerCase());
const L2ChainId = computed(() => store.state.l2ChainId.toLowerCase());

// --- UI State ---
const showHistory = ref(false);
const isL1ToL2 = ref(true); // true: L1->L2, false: L2->L1
const amount = ref('');
const selectedTokenSymbol = ref(TOKEN_LIST[0].symbol);
const balance = ref('0.0000');
const isBalanceLoading = ref(false);

const progressDialogL1 = ref(null);
const progressDialogL2 = ref(null);
const migrationDialog = ref(null);

// --- Computed Logic ---
const currentToken = computed(() => TOKEN_LIST.find(t => t.symbol === selectedTokenSymbol.value));
const isMigration = computed(() => selectedTokenSymbol.value === 'QKC');

const fromNetworkConfig = computed(() => {
	const chainId = isL1ToL2.value ? L1ChainId.value : L2ChainId.value;
	return NETWORKS[chainId] || {};
});
const toNetworkConfig = computed(() => {
	const chainId = isL1ToL2.value ? L2ChainId.value : L1ChainId.value;
	return NETWORKS[chainId] || {};
});

const currentTokenContract = computed(() => {
	if (!currentToken.value) return null;
	const chainId = isL1ToL2.value ? L1ChainId.value : L2ChainId.value;
	return currentToken.value.networks[chainId] || null;
});

const isAmountValid = computed(() => {
	if (isMigration.value && !isL1ToL2.value) return false;
	const val = parseFloat(amount.value || '0');
	const bal = parseFloat(balance.value || '0');
	return val > 0 && val <= bal;
});

const buttonText = computed(() => {
	if (isMigration.value && !isL1ToL2.value) {
		return 'Migration Only via L1';
	}
	const val = parseFloat(amount.value || '0');
	if (val <= 0) return 'Enter Amount';
	if (val > parseFloat(balance.value)) return 'Insufficient Balance';
	return isMigration.value ? 'Start Migration' : 'Bridge Assets';
});

// --- Methods ---
async function fetchBalance(isSilent = false) {
	if (!account.value || !currentTokenContract.value) {
		balance.value = '0.0000';
		return;
	}

	if (!isSilent) isBalanceLoading.value = true;
	try {
		const { address, decimals } = currentTokenContract.value;
		const currentAccount = account.value;
		let rawBalance;
		if (isL1ToL2.value) {
			rawBalance = await getErc20BalanceByL1(L1ChainId.value, address, account.value);
		} else {
			rawBalance = isMigration.value
					? await getQKCBalanceByL2(L2ChainId.value, account.value)
					: await getErc20BalanceByL2(L2ChainId.value, address, account.value);
		}
		if (currentAccount === account.value) {
			balance.value = formatTokenAmount(rawBalance, decimals);
		}
	} catch (e) {
		console.error("Fetch balance failed:", e);
		if (!isSilent) balance.value = '0.0000';
	} finally {
		if (!isSilent) isBalanceLoading.value = false;
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
	if (!isAmountValid.value) return;
	if (isMigration.value) {
		migrationDialog.value?.show({
			amount: amount.value,
		});
	} else {
		const payload = {
			fromNetwork: fromNetworkConfig.value,
			toNetwork: toNetworkConfig.value,
			token: currentToken.value,
			amount: amount.value,
			account: account.value,
		};
		(isL1ToL2.value ? progressDialogL1.value : progressDialogL2.value)?.show(payload);
	}
}

async function syncHistory() {
	if (!account.value) return;
	try {
		await refreshLocalList();
	} catch (e) {
		console.error("Sync actions failed:", e);
	}
}

async function onFinish() {
	await fetchBalance();
	await syncHistory();
}

function handleActionClick() {
	showHistory.value = true;
}

// --- Watchers & Lifecycle ---
watch([selectedTokenSymbol, isL1ToL2], () => {
	fetchBalance(false);
}, { immediate: true });
watch([account], async () => {
	if (!account.value) return;

	await fetchBalance();
	await syncHistory();
}, { immediate: true });

watch(isMigration, (newVal) => {
	if (newVal) {
		isL1ToL2.value = true;
		amount.value = '';
	}
});

let timer;
onMounted(() => {
	timer = setInterval(() => {
		fetchBalance(true);
	}, 30000);
});
onBeforeUnmount(() => {
	clearInterval(timer);
});
</script>

<style scoped lang="less">
@primary-blue: #181ea9;
@primary-hover: #12168a;

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
	border-radius: 12px;
	background: #fff;
	border: 1px solid rgba(24, 30, 169, 0.15);
	box-shadow: 0 4px 16px rgba(24, 30, 169, 0.06);
	transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);

	.network-row {
		display: flex;
		align-items: center;
		justify-content: space-between;

		.network-box {
			flex: 1;
			border: 1px solid rgba(24, 30, 169, 0.1);
			background: #FAFCFF;
			padding: 18px 20px;
			border-radius: 12px;
			cursor: pointer;
			display: flex;
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
					color: #666;
					margin-bottom: 2px;
				}
				.value {
					font-size: 17px;
					color: #1a1a1a;
					font-weight: 600;
					transition: color 0.3s ease;
				}
			}
			&:hover {
				box-shadow: 0 2px 6px rgba(24, 30, 169, 0.1);
				.text .value {
					color: @primary-blue;
				}
			}
			&.left {
				justify-content: flex-start;
				.text {
					margin-left: 15px;
					align-items: flex-start;
					text-align: left;
				}
			}
			&.right {
				justify-content: flex-end;
				.text {
					margin-right: 15px;
					align-items: flex-end;
					text-align: right;
				}
			}
		}

		.switch-btn {
			margin: 0 12px;
			background: @primary-blue;
			color: #fff;
			border-color: @primary-blue;
			&:hover {
				background: @primary-hover;
				border-color: @primary-hover;
				box-shadow: 0 3px 10px rgba(24, 30, 169, 0.25);
			}
		}
	}

	.amount-box {
		margin-top: 22px;
		padding: 20px;
		border-radius: 12px;
		background: #FAFCFF;
		border: 1px solid rgba(24, 30, 169, 0.1);

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
				color: #666;
			}

			.max-btn {
				background: @primary-blue;
				color: #fff;
				border: none;
				border-radius: 24px;
				padding: 6px 16px;
				font-size: 13px;
				font-weight: 600;
				&:hover:not(:disabled) {
					background: @primary-hover;
					box-shadow: 0 3px 10px rgba(24, 30, 169, 0.25);
				}
			}
		}
	}

	.migration-alert-wrapper {
		overflow: hidden;
		display: block;

		.migration-alert {
			margin-top: 16px;
			padding: 12px 16px;
			border-radius: 12px;
			background: rgba(245, 158, 11, 0.06);
			border: 1px dashed rgba(245, 158, 11, 0.3);

			.alert-title {
				font-size: 14px;
				font-weight: 700;
				color: #f59e0b;
				margin-bottom: 4px;
				display: flex;
				align-items: center;
			}

			.alert-desc {
				text-align: left;
				font-size: 13px;
				color: #6b7280;
				line-height: 1.5;
			}
		}
	}

	.bridge-button-row {
		margin-top: 28px;
		width: 100%;

		.bridge-submit-btn {
			width: 100%;
			height: 54px;
			border: none;
			border-radius: 16px;
			background: @primary-blue;
			color: #fff;
			font-size: 17px;
			font-weight: 600;
			transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			font-family: CoinbaseSans, sans-serif;

			&:hover:not(:disabled) {
				background: @primary-hover;
				transform: translateY(-2px);
				box-shadow: 0 8px 20px rgba(24, 30, 169, 0.25);
			}

			&:disabled {
				background: #f0f2f7;
				color: #94a3b8;
				cursor: not-allowed;
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
			&:hover:not(:disabled) {
				background: @migration-hover;
				border-color: @migration-hover;
				box-shadow: 0 4px 12px @migration-glow;
			}
			&:disabled {
				background: #ededf2 !important;
				color: #8e91b5 !important;
				border: 1px solid @migration-border !important;
				cursor: not-allowed;
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
			&:disabled {
				background: #e2e4ed;
				color: #8e91b5 !important;
				opacity: 0.9;
			}
		}
		.network-box:hover .text .value {
			color: @migration-blue;
		}
	}

	:deep(.amount-input) {
		.el-input__wrapper { box-shadow: none !important; background: transparent !important; border: none; padding: 0 4px; }
		input { font-size: 28px; font-weight: 600; color: #1a1a1a; font-family: CoinbaseSansBlob; }
		input[type="number"]::-webkit-outer-spin-button,
		input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
		.el-input-group__append { background: transparent !important; border: none !important; box-shadow: none !important; }
	}
	:deep(.token-select) {
		.el-select__wrapper {
			background: #fff !important; border-radius: 20px !important; border: 1px solid rgba(24, 30, 169, 0.2) !important;
			box-shadow: none !important; padding: 0 14px !important; min-height: 40px; display: flex; align-items: center; transition: border-color 0.3s ease;
		}
		.el-select__wrapper:hover { border-color: @primary-blue !important; }
		.el-select__selected-item.el-select__placeholder {
			width: 0 !important; height: 0 !important;
			overflow: hidden !important;  opacity: 0 !important; margin: 0 !important;
		}
	}

	&.is-migration-mode :deep(.token-select .el-select__wrapper:hover) {
		border-color: @migration-blue !important;
	}
}

/* --- anim --- */
.migration-collapse-enter-active, .migration-collapse-leave-active {
	transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	max-height: 200px;
}
.migration-collapse-enter-from, .migration-collapse-leave-to {
	opacity: 0; max-height: 0; transform: scale(0.96) translateY(-10px); margin-top: 0;
}


@media screen and (max-width: 500px) {
	.bridge-container {
		width: 100%;
		margin: 0 auto;
		padding: 0;
	}

	.bridge-card {
		margin-top: 20px;
		padding: 0;

		.network-row {
			align-items: stretch;
			justify-content: space-between;

			.network-box {
				flex: 1;
				padding: 10px 5px;

				.network-icon {
					width: 35px;
					height: 35px;
				}

				.text {
					line-height: 1.3;

					.label {
						font-size: 12px;
					}
					.value {
						font-size: 12px;
					}
				}
				&.left {
					.text {
						margin-left: 6px;
					}
				}
				&.right {
					.text {
						margin-right: 6px;
					}
				}
			}

			.switch-btn {
				align-self: center;
				flex-shrink: 0;
				margin: 0 8px;
			}
		}

		.amount-box {
			margin-top: 12px;
			padding: 10px;

			.token-option {
				gap: 5px;

				.token-icon {
					width: 20px;
					height: 20px;
				}
				.token-text {
					font-size: 13px;
				}
			}

			.balance-row {
				margin-top: 12px;

				.balance-info {
					font-size: 12px;
				}

				.max-btn {
					padding: 6px 12px;
					font-size: 12px;
				}
			}
		}

		.migration-alert-wrapper {
			.migration-alert {
				margin-top: 12px;
				padding: 10px;

				.alert-title {
					font-size: 12px;
				}
				.alert-desc {
					font-size: 12px;
				}
			}
		}

		.bridge-button-row {
			margin-top: 12px;

			.bridge-submit-btn {
				height: 45px;
				font-size: 16px;
				font-weight: 600;
			}
		}
	}

	:deep(.amount-input) {
		input { font-size: 18px !important; }
	}
	:deep(.token-select) {
		.el-select__wrapper {
			border-radius: 16px !important;
			padding: 0 !important;
			min-height: 35px !important;
			gap: 3px !important;
			min-width: 92px;

			&.el-tooltip__trigger {
				padding: 0 8px !important;
			}
		}

		.el-select__suffix {
			display: flex;
			align-items: center;
			margin-left: 0;
		}
	}
}
</style>
