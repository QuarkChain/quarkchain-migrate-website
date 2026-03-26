<template>
	<el-dialog
			:model-value="visible"
			:show-close="false"
			class="bridge-dialog"
			@close="visible = false"
	>
		<div class="dialog-header">
			<button
					class="icon-btn"
					:class="{ invisible: currentPage === 1 || isHistoryMode }"
					@click="currentPage = 1"
			>
				←
			</button>

			<div v-if="!isHistoryMode" class="step-indicator">
				<div :class="['dot', currentPage === 1 ? 'active' : '']"></div>
				<div :class="['dot', currentPage === 2 ? 'active' : '']"></div>
			</div>

			<button class="icon-btn" @click="visible = false">✕</button>
		</div>

		<div v-if="currentPage === 1" class="page-container">
			<h2 class="page-container-title">Review Bridge</h2>

			<BridgeItemCard
					:title="`Bridge from ${safeFromNetwork.name}`"
					:networkIcon="safeFromNetwork.icon"
					:addressUrl="safeFromNetwork.explorer + '/address/' + account"
					:address="account"
					:amount="amount"
					:tokenIcon="safeToken.icon"
					:symbol="safeToken.symbol"
			/>

			<BridgeItemCard
					:title="`Get on ${safeToNetwork.name}`"
					:networkIcon="safeToNetwork.icon"
					:addressUrl="safeToNetwork.explorer + '/address/' + account"
					:address="account"
					:amount="amount"
					:tokenIcon="safeToken.icon"
					:symbol="safeToken.symbol"
			/>

			<div class="review-card">
				<!-- Transfer Time -->
				<div class="review-item">
					<div class="item-left">
						<Timer class="el-icon"/>
						<span>Transfer time</span>
					</div>
					<div class="item-right">
						<span>~3 mins</span>
					</div>
				</div>

				<!-- Fees -->
				<div class="review-item">
					<div class="item-left">
						<Coin class="el-icon"/>
						<span>Fees</span>
					</div>
					<div class="item-right">
						<span>0 fees</span>
					</div>
				</div>
			</div>

			<div class="review-btn-row">
				<el-button
						class="review-btn"
						type="primary"
						@click="currentPage = 2"
				>
					Continue
				</el-button>
			</div>
		</div>

		<div v-if="currentPage === 2" class="page-container">
			<div class="token-header">
				<img
						class="token-logo"
						:src="safeToken.icon"
						alt="token-logo"
				/>
				<div class="token-title">Bridge {{ amount }} {{ safeToken.symbol }}</div>
			</div>

			<div class="steps-container">
				<!-- STEP 1 -->
				<div v-if="!isHistoryMode" class="step-card">
					<div class="step-content">
						<div class="step-left">
							<img class="step-icon" src="@/assets/l1.svg" alt="l1-network-icon"/>
							<div class="step-text">
								<div class="step-title">Approve {{ safeToken.symbol }}</div>
								<div v-if="steps[1] !== STATUS.SUCCESS" class="step-gas">
									<div v-if="!gasLoaded" class="gas-placeholder"></div>
									<div v-else class="gas-value">
										<svg class="gas-icon" viewBox="0 0 64 64" fill="currentColor">
											<path fill-rule="evenodd" clip-rule="evenodd"
														d="M54.8643 24.5435C54.8643 23.1708 54.3371 21.864 53.3927 20.8757L41.4888 8.43368C40.3358 7.2367 40.4566 5.282 41.7963 4.23876C42.9603 3.32729 44.6735 3.5579 45.6947 4.63409L57.6206 17.0651C58.4003 17.746 59.0482 18.5586 59.5424 19.4701C60.1134 20.4584 60.5417 21.6334 60.5417 22.9951V43.5744C60.5417 47.923 57.1923 51.7116 52.8546 51.8434C48.517 51.9752 44.6735 48.3733 44.6735 43.9148V37.3918C44.6735 35.8215 41.7414 34.5586 40.171 34.5586H38.6776V54.6766C38.6776 54.8743 38.6776 55.061 38.6446 55.2587C38.5348 56.3239 38.1285 57.3012 37.5245 58.1029C36.4923 59.4646 34.856 60.3431 33.0111 60.3431H10.3234C8.36872 60.3431 6.64463 59.3547 5.62335 57.8393C5.00839 56.9388 4.65698 55.8407 4.65698 54.6657V12.1564C4.65698 7.45633 8.46755 3.65674 13.1566 3.65674H30.156C34.856 3.65674 38.6556 7.46731 38.6556 12.1564V28.8812H40.1491C44.8492 28.8812 50.3179 32.6917 50.3179 37.3808V43.772C50.3179 44.958 51.1745 46.0342 52.3605 46.155C53.7222 46.2868 54.8533 45.2326 54.8533 43.9038V24.5435H54.8643ZM13.7387 8.77441C11.2679 8.77441 9.26929 10.9487 9.26929 13.6392V27.0805C9.26929 29.771 11.2679 31.9453 13.7387 31.9453H28.8712C31.342 31.9453 33.3407 29.771 33.3407 27.0805V13.6392C33.3407 10.9487 31.342 8.77441 28.8712 8.77441H13.7387Z"></path>
										</svg>
										<span>{{ gas1ETH }} ETH</span>
									</div>
								</div>
							</div>
						</div>
						<div class="step-right">
							<el-button
									v-if="steps[1] === STATUS.IDLE"
									class="right-btn"
									@click="runStep1"
							>
								Approve
							</el-button>
							<div v-else-if="steps[1] === STATUS.LOADING" class="status-loading" />
							<div v-else-if="steps[1] === STATUS.SUCCESS" class="status-success">
								✓
							</div>
						</div>
					</div>
				</div>

				<!-- Step 2 -->
				<div class="step-card">
					<div class="step-content">
						<div class="step-left">
							<img class="step-icon" src="@/assets/l1.svg" alt="l1-network-icon" />
							<div class="step-text">
								<div class="step-title">Start on {{ safeFromNetwork.name }}</div>
								<div v-if="steps[2] !== STATUS.SUCCESS" class="step-gas">
									<div v-if="!gasLoaded" class="gas-placeholder"></div>
									<div v-else class="gas-value">
										<svg class="gas-icon" viewBox="0 0 64 64" fill="currentColor">
											<path fill-rule="evenodd" clip-rule="evenodd"
														d="M54.8643 24.5435C54.8643 23.1708 54.3371 21.864 53.3927 20.8757L41.4888 8.43368C40.3358 7.2367 40.4566 5.282 41.7963 4.23876C42.9603 3.32729 44.6735 3.5579 45.6947 4.63409L57.6206 17.0651C58.4003 17.746 59.0482 18.5586 59.5424 19.4701C60.1134 20.4584 60.5417 21.6334 60.5417 22.9951V43.5744C60.5417 47.923 57.1923 51.7116 52.8546 51.8434C48.517 51.9752 44.6735 48.3733 44.6735 43.9148V37.3918C44.6735 35.8215 41.7414 34.5586 40.171 34.5586H38.6776V54.6766C38.6776 54.8743 38.6776 55.061 38.6446 55.2587C38.5348 56.3239 38.1285 57.3012 37.5245 58.1029C36.4923 59.4646 34.856 60.3431 33.0111 60.3431H10.3234C8.36872 60.3431 6.64463 59.3547 5.62335 57.8393C5.00839 56.9388 4.65698 55.8407 4.65698 54.6657V12.1564C4.65698 7.45633 8.46755 3.65674 13.1566 3.65674H30.156C34.856 3.65674 38.6556 7.46731 38.6556 12.1564V28.8812H40.1491C44.8492 28.8812 50.3179 32.6917 50.3179 37.3808V43.772C50.3179 44.958 51.1745 46.0342 52.3605 46.155C53.7222 46.2868 54.8533 45.2326 54.8533 43.9038V24.5435H54.8643ZM13.7387 8.77441C11.2679 8.77441 9.26929 10.9487 9.26929 13.6392V27.0805C9.26929 29.771 11.2679 31.9453 13.7387 31.9453H28.8712C31.342 31.9453 33.3407 29.771 33.3407 27.0805V13.6392C33.3407 10.9487 31.342 8.77441 28.8712 8.77441H13.7387Z"></path>
										</svg>
										<span>{{ gas2ETH }} ETH</span>
									</div>
								</div>
							</div>
						</div>
						<div class="step-right">
							<el-button
									v-if="steps[2] === STATUS.IDLE || steps[2] === STATUS.DISABLED"
									class="right-btn"
									:disabled="steps[2] === STATUS.DISABLED"
									@click="runStep2"
							>
								Start
							</el-button>
							<div v-else-if="steps[2] === STATUS.LOADING" class="status-loading" />
							<div v-else-if="steps[2] === STATUS.SUCCESS" class="status-success">
								✓
							</div>
						</div>
					</div>
				</div>

				<!-- Step 3 -->
				<div class="step-card">
					<div class="step-content">
						<div class="step-left">
							<img class="step-icon" src="@/assets/time.svg" alt="l1-network-icon" />
							<div class="step-text">
								<div class="step-title">Wait ~3 mins</div>
							</div>
						</div>
						<div class="step-right">
							<div v-if="steps[3] === STATUS.LOADING"
									 class="status-loading" />

							<div v-else-if="steps[3] === STATUS.SUCCESS"
									 class="status-success">
								✓
							</div>
						</div>
					</div>
				</div>

				<!-- Step 4 -->
				<div class="step-card">
					<div class="step-content">
						<div class="step-left">
							<img class="step-icon" src="@/assets/logo.png" alt="Layer2 icon" />
							<div class="step-text">
								<div class="step-title">Get {{ amount }} {{ safeToken.symbol }} on {{ safeToNetwork.name }}</div>
							</div>
						</div>
						<div class="step-right">
							<!-- no button -->
							<div v-if="steps[4] === STATUS.LOADING"
									 class="status-loading" />

							<div v-else-if="steps[4] === STATUS.SUCCESS"
									 class="status-success">
								✓
							</div>
							<div v-else-if="steps[4] === STATUS.FAILED"
									 class="status-failed">
								x
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</el-dialog>
</template>

<script setup>
import { ethers } from 'ethers';
import { computed, watch, ref, reactive } from 'vue';
import { useStore } from "vuex";
import { Timer, Coin } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import BridgeItemCard from '@/ui/components/BridgeItemCard.vue';
import { usePolling } from "@/ui/composables/usePolling.js";
import {
	getTokenAllowance,
	getGasPrice,
	approveErc20,
	bridgeToken,
	waitForL2ERC20Bridge
} from "@/services/bridge/l1ToL2.js";
import { BRIDGE_DIRECTION, BRIDGE_STATUS } from "@/config/constant.js";
import { saveTransactions } from "@/services/history/db.js";

const emit = defineEmits(['finish']);

const store = useStore()
const Bridge = computed(() => store.getters.Bridge);
const L1StandardBridge = computed(() => store.getters.L1StandardBridge);
const L1ChainId = computed(() => store.state.l1ChainId.toLowerCase());
const L2ChainId = computed(() => store.state.l2ChainId.toLowerCase());

// global state
const visible = ref(false);
const currentPage = ref(1);
const mode = ref('new'); // 'new' | 'history'
const isHistoryMode = computed(() => mode.value === 'history');
const hasStateChanged = ref(false);

// props, page 1
const DEFAULT_NETWORK = {name: '', icon: '', explorer: '', chainId: ''};
const DEFAULT_TOKEN = {symbol: '', icon: '', networks: {}};

const fromNetwork = ref(null);
const toNetwork = ref(null);
const token = ref(null);
const amount = ref(0);
const account = ref(null);

const safeFromNetwork = computed(() => fromNetwork.value || DEFAULT_NETWORK);
const safeToNetwork = computed(() => toNetwork.value || DEFAULT_NETWORK);
const safeToken = computed(() => token.value || DEFAULT_TOKEN);

// page 2
const STATUS = {
	IDLE: 'idle',
	LOADING: 'loading',
	SUCCESS: 'success',
	DISABLED: 'disabled',
	FAILED: 'failed',
}
const createInitialSteps = () => ({
	1: STATUS.IDLE,
	2: STATUS.DISABLED,
	3: STATUS.DISABLED,
	4: STATUS.DISABLED
})
const steps = reactive(createInitialSteps())

// deposit status
const approveGasLimit = 80000n;
const depositGasLimit = 1500000n;
const L1Token = ref(null);
const L2Token = ref(null);
const gas1ETH = ref('');
const gas2ETH = ref('');
const gasLoaded = ref(false);
let controller = null;
let historyTxHash = null;

const gasPollingEnabled = computed(() => visible.value && !isHistoryMode.value && steps[2] !== STATUS.SUCCESS);
usePolling(loadGasCost, 60000, gasPollingEnabled);

function abortPending() {
	if (controller) {
		controller.abort();
		controller = null;
	}
}

// methods
function formatAmount(val, unit) {
	return ethers.parseUnits(val.toString(), unit);
}

function show({
	fromNetwork: fn,
	toNetwork: tn,
	token: tk,
	amount: am,
	account: acc,
	mode: md,
	txHash,
	status
}) {
	// if dialog already open, prevent stale requests
	abortPending();

	// reset
	currentPage.value= 1;
	Object.assign(steps, createInitialSteps());
	mode.value = md || 'new';
	historyTxHash = txHash || null;

	// props
	fromNetwork.value = fn;
	toNetwork.value = tn;
	token.value = tk;
	amount.value = Number(am);
	account.value = acc;

	// params
	L1Token.value = token.value.networks[fromNetwork.value.chainId];
	L2Token.value = token.value.networks[toNetwork.value.chainId];

	// status
	visible.value = true;
	if (isHistoryMode.value) {
		// history mode: no approval/start actions; show progress/result only
		currentPage.value = 2;
		steps[1] = STATUS.SUCCESS; // hidden anyway
		steps[2] = STATUS.SUCCESS; // deposit already executed
		const normalizedStatus = String(status || '');
		if (normalizedStatus === BRIDGE_STATUS.COMPLETED) {
			steps[3] = STATUS.SUCCESS;
			steps[4] = STATUS.SUCCESS;
			return;
		}
		if (normalizedStatus === BRIDGE_STATUS.FAILED) {
			steps[3] = STATUS.SUCCESS;
			steps[4] = STATUS.FAILED;
			return;
		}

		steps[3] = STATUS.IDLE;
		if (historyTxHash) {
			l2Mint(historyTxHash);
		}
	} else {
		loadData();
	}
}

async function loadData() {
	const allowance = await getTokenAllowance(L1ChainId.value, L1Token.value.address, account.value, L1StandardBridge.value);
	if (allowance >= formatAmount(amount.value, L1Token.value.decimals)) {
		steps[1] = STATUS.SUCCESS
		steps[2] = STATUS.IDLE
	}
	await loadGasCost();
}

async function loadGasCost() {
	if (!L1Token?.value || !L2Token?.value) {
		return;
	}
	if(steps[2] === STATUS.SUCCESS) {
		return;
	}

	gasLoaded.value = false;
	try {
		const gasPrice = await getGasPrice(L1ChainId.value);
		const totalWei1 = gasPrice * BigInt(approveGasLimit);
		const totalWei2 = gasPrice * BigInt(depositGasLimit);
		const ethString1 = ethers.formatEther(totalWei1);
		const ethString2 = ethers.formatEther(totalWei2);
		const formatEth = (val) => {
			return Number(val).toFixed(8).replace(/\.?0+$/, '');
		};

		gas1ETH.value = formatEth(ethString1);
		gas2ETH.value = formatEth(ethString2);
		gasLoaded.value = true;
	} catch (e) {
		if (gas1ETH.value) {
			gasLoaded.value = true;
		}
	}
}

async function runStep1() {
	if (steps[1] !== STATUS.IDLE) return

	steps[1] = STATUS.LOADING
	try {
		await approveErc20(L1ChainId.value, L1Token.value, L1StandardBridge.value, amount.value);
		const allowance = await getTokenAllowance(L1ChainId.value, L1Token.value.address, account.value, L1StandardBridge.value);
		if (allowance >= formatAmount(amount.value, L1Token.value.decimals)) {
			steps[1] = STATUS.SUCCESS;
			steps[2] = STATUS.IDLE;
			ElMessage.success("Approved successfully.");
		} else {
			steps[1] = STATUS.IDLE;
			ElMessage.error("Approved amount < bridge amount.");
		}
	} catch (e) {
		steps[1] = STATUS.IDLE;
		ElMessage.error("Approve failed.");
	}
}

async function runStep2() {
	if (steps[2] !== STATUS.IDLE) return

	steps[2] = STATUS.LOADING
	try {
		const receipt = await bridgeToken(L1ChainId.value, L1StandardBridge.value, L1Token.value, L2Token.value.address, account.value, amount.value);
		if (receipt?.status === 1) {
			steps[2] = STATUS.SUCCESS
			steps[3] = STATUS.IDLE;
			ElMessage.success("Bridge submitted.");

			const currentTimestamp = Math.floor(Date.now() / 1000);
			const { address, decimals } = L1Token.value;
			const value = formatAmount(amount.value.toString(), decimals);
			await saveTransactions({
				type: 'BRIDGE',
				id: receipt.hash,
				address: account.value,
				direction: BRIDGE_DIRECTION.L1_TO_L2,
				hash: receipt.hash,
				token: address,
				amount: value.toString(),
				timestamp: currentTimestamp,
				blockNumber: receipt.blockNumber,
				status: BRIDGE_STATUS.UNKNOWN,
			});
			hasStateChanged.value = true;

			l2Mint(receipt.hash);
		} else {
			steps[2] = STATUS.IDLE;
			ElMessage.error("Bridge failed.");
		}
	} catch (e) {
		console.log(e);
		steps[2] = STATUS.IDLE;
		ElMessage.error("Bridge failed.");
	}
}

async function l2Mint(txHash) {
	if (steps[3] === STATUS.LOADING) return;

	abortPending();
	controller = new AbortController();

	steps[3] = STATUS.LOADING;
	try {
		const result = await waitForL2ERC20Bridge(L1ChainId.value, L2ChainId.value, Bridge.value, txHash, controller.signal);

		steps[3] = STATUS.SUCCESS;
		if (result.status === 'SUCCESS') {
			steps[4] = STATUS.SUCCESS;
			await saveTransactions({
				id: txHash,
				remaining: 0,
				status: BRIDGE_STATUS.COMPLETED
			});

			ElMessage.success("Bridge completed.");
		} else if (result.status === 'FAILED') {
			steps[4] = STATUS.FAILED;
			await saveTransactions({
				id: txHash,
				remaining: 0,
				status: BRIDGE_STATUS.FAILED
			});

			ElMessage.error("Bridge execution failed on L2.");
		}
		hasStateChanged.value = true;
	} catch (e) {
		const isCancel =
				e?.name === 'AbortError' ||
				e?.message?.toLowerCase().includes('abort') ||
				e?.message?.toLowerCase().includes('canceled') ||
				controller?.signal?.aborted;
		if (isCancel) {
			return;
		}

		steps[3] = STATUS.DISABLED;
		ElMessage.error("Unexpected error occurred.");
	}
}

watch(visible, (val) => {
	if (!val) {
		abortPending();
	}
	if (!val && hasStateChanged.value) {
		hasStateChanged.value = false;
		emit('finish');
	}
});

defineExpose({show})
</script>

<style scoped lang="less">
.dialog-header {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;

	.icon-btn {
		background: #f2f2f2;
		border: none;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		cursor: pointer;
		font-size: 20px;
		color: #09090b;
	}

	.icon-btn:hover {
		color: rgb(23, 34, 162);
		opacity: 0.8;
	}

	.invisible {
		visibility: hidden;
	}

	.step-indicator {
		display: flex;
		gap: 6px;

		.dot {
			width: 18px;
			height: 4px;
			border-radius: 4px;
			background: #ddd;
		}

		.dot.active {
			background: rgb(23, 34, 162);
		}
	}
}


.page-container {
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding: 10px;

	.page-container-title {
		color: #09090b;
		font-size: 30px;
		padding: 20px 0 12px;
		font-weight: 600;
	}

	.review-card {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--el-border-color);
		border-radius: 1rem;
		overflow: hidden;
		font-size: 0.75rem; /* text-xs */

		.review-item {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 0.75rem 0.875rem; /* py-3 px-3.5 */
			border-bottom: 1px solid var(--el-border-color); /* divide-y */

			.item-left {
				display: flex;
				align-items: center;
				gap: 0.375rem; /* gap-1.5 */
			}

			.item-right {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				color: black;
			}
		}

		.review-item:last-child {
			border-bottom: none;
		}
	}

	.review-btn-row {
		margin-top: 12px;
		width: 100%;

		.review-btn {
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
		}
	}

	.token-header {
		text-align: center;
		padding: 20px 0 12px;

		.token-logo {
			width: 48px;
			height: 48px;
			border-radius: 50%;
		}

		.token-title {
			margin-top: 10px;
			font-size: 30px;
			font-weight: 600;
			color: black;
			font-family: CoinbaseDisplay;
		}
	}

	.steps-container {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 8px;

		.step-card {
			padding: 20px 16px;
			border-radius: 16px;
			background: #f5f7fa;
		}

		.step-content {
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.step-left {
			display: flex;
			align-items: center;
			gap: 12px;

			.step-icon {
				width: 32px;
				height: 32px;
				border-radius: 6px;
			}

			.step-text {
				display: flex;
				flex-direction: column;
				align-items: flex-start;

				.step-title {
					font-size: 14px;
					font-weight: 580;
					color: black;
					font-family: CoinbaseDisplay;
				}

				.step-gas {
					margin-top: 4px;
					font-size: 12px;

					.gas-placeholder {
						width: 88px;
						height: 20px;
						background: #212121;
						border-radius: 4px;
						animation: pulse 1.2s infinite;
					}

					.gas-value {
						color: #555;
						display: flex;
						align-items: center;
						gap: 4px;
						min-height: 20px;
					}
					.gas-icon {
						width: 12px;
						height: 12px;
					}
				}
			}
		}


		.step-right {
			display: flex;
			align-items: center;

			.right-btn {
				background: rgb(24, 30, 169);
				border: none;
				font-size: 13px;
				line-height: 13px;
				color: rgb(255, 255, 255);
				border-radius: 4px;
				transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
				letter-spacing: 0.5px;
				font-family: CoinbaseSansBlob;

				&:hover:not(:disabled) {
					background: #12168a;
					transform: translateY(-2px);
					box-shadow: 0 8px 20px rgba(24, 30, 169, 0.25);
				}

				&:active:not(:disabled) {
					transform: translateY(0);
				}

				&:disabled {
					background: #ccc;
					color: #ffffff;
					cursor: not-allowed;
					box-shadow: none;
					transform: none;
				}
			}

			.status-loading {
				width: 22px;
				height: 22px;
				border: 3px solid rgba(24, 30, 169, 0.2);
				border-top: 3px solid rgb(24, 30, 169);
				border-radius: 50%;
				animation: spin 0.8s linear infinite;
			}

			.status-success {
				width: 24px;
				height: 24px;
				border-radius: 50%;
				background: rgb(24, 30, 169);
				color: white;
				display: flex;
				align-items: center;
				justify-content: center;
				font-weight: bold;
				animation: fadeIn 0.3s ease-out;
			}
			.status-failed {
				width: 24px;
				height: 24px;
				border-radius: 50%;
				background: #e53935;
				color: white;
				display: flex;
				align-items: center;
				justify-content: center;
				font-weight: bold;
				box-shadow: 0 0 6px rgba(229, 57, 53, 0.5);
				animation: fadeIn 0.3s ease-out;
			}
		}

		// anim
		@keyframes pulse {
			0%, 100% { opacity: 1; }
			50% { opacity: 0.4; }
		}
		@keyframes spin {
			to { transform: rotate(360deg); }
		}
		@keyframes fadeIn {
			from { opacity: 0; transform: scale(0.8); }
			to { opacity: 1; transform: scale(1); }
		}
	}
}

@media screen and (max-width: 500px) {
	.dialog-header {
		margin-top: -40px;

		.dialog-title {
			font-size: 16px;
		}

		.close-btn {
			font-size: 16px;
			width: 24px;
			height: 24px;
		}
	}

	.step-column {
		margin-top: 25px;
		gap: 15px;
	}

	.step-label-layout {
		.step-icon {
			width: 1.8rem;
			height: 1.8rem;
			border-radius: 10px;
		}

		.step-label {
			font-size: 13px;
		}
	}

	.convert-button {
		width: 25%;
		font-size: 12px;
		line-height: 12px;
		padding-left: 0;
		padding-right: 0;
	}

	.wait-loading {
		font-size: 18px;
	}

	.wait-finish {
		font-size: 18px;
	}
}
</style>

<style>
.bridge-dialog {
	border-radius: 8px !important;
	max-width: 500px !important;
	padding: 10px 25px 30px !important;
}

@media screen and (max-width: 500px) {
	.bridge-dialog {
		width: 95% !important;
	}
}
</style>
