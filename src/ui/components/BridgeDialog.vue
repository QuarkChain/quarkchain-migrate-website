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
					:class="{ invisible: currentPage === 1 }"
					@click="currentPage = 1"
			>
				←
			</button>

			<div class="step-indicator">
				<div :class="['dot', currentPage === 1 ? 'active' : '']"></div>
				<div :class="['dot', currentPage === 2 ? 'active' : '']"></div>
			</div>

			<button class="icon-btn" @click="visible = false">✕</button>
		</div>

		<div v-if="currentPage === 1" class="page-container">
			<h2 class="page-container-title">Review</h2>

			<BridgeItemCard
					:title="`Bridge from ${safeFromNetwork.name}`"
					:networkIcon="safeFromNetwork.icon"
					:addressUrl="safeFromNetwork.explorer + account"
					:address="account"
					:amount="amount"
					:tokenIcon="safeToken.icon"
					:symbol="safeToken.symbol"
			/>

			<BridgeItemCard
					:title="`Get on ${safeToNetwork.name}`"
					:networkIcon="safeToNetwork.icon"
					:addressUrl="safeToNetwork.explorer + account"
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
				<div class="step-card">
					<div class="step-content">
						<div class="step-left">
							<img class="step-icon" src="@/assets/l1.svg" alt="l1-network-icon"/>
							<div class="step-text">
								<div class="step-title">Approve {{ safeToken.symbol }}</div>
								<div class="step-gas">
									<div v-if="!gas1Loaded" class="gas-placeholder"></div>
									<div v-else class="gas-value">{{ gas1ETH }} <span class="gas-usd">({{ gas1USD }})</span></div>
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
								<div class="step-gas">
									<div v-if="!gas2Loaded" class="gas-placeholder"></div>
									<div v-else class="gas-value">{{ gas2ETH }} <span class="gas-usd">({{ gas2USD }})</span></div>
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
								<div class="step-title">Wait 3 mins</div>
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
						</div>
					</div>
				</div>
			</div>
		</div>
	</el-dialog>
</template>

<script setup>

import { ethers } from 'ethers';
import { computed, ref, reactive } from 'vue';
import { Timer, Coin } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus';
import BridgeItemCard from '@/ui/components/BridgeItemCard.vue';

// import {approveErc20, convert, getErc20Allowance, waitForL2Mint} from '@/utils/web3';

const emit = defineEmits(['finish']);

// state
const visible = ref(false);
const currentPage = ref(1)

// props, page 1
const DEFAULT_NETWORK = {name: '', icon: '', explorer: '', chainId: ''};
const DEFAULT_TOKEN = {symbol: '', icon: '', networks: {}};

const fromNetwork = ref(null);
const toNetwork = ref(null);
const token = ref(null);
const amount = ref(0);
const account = ref(null);
const l2Rpc = ref(null);

const safeFromNetwork = computed(() => fromNetwork.value || DEFAULT_NETWORK);
const safeToNetwork = computed(() => toNetwork.value || DEFAULT_NETWORK);
const safeToken = computed(() => token.value || DEFAULT_TOKEN);

// page 2
const STATUS = {
	IDLE: 'idle',
	LOADING: 'loading',
	SUCCESS: 'success',
	DISABLED: 'disabled'
}
const createInitialSteps = () => ({
	1: STATUS.IDLE,
	2: STATUS.DISABLED,
	3: STATUS.DISABLED,
	4: STATUS.DISABLED
})

const steps = reactive(createInitialSteps())

// methods
function formatAmount(val) {
	return ethers.parseEther(val.toString());
}

function show({fromNetwork: fn, toNetwork: tn, token: tk, amount: am, account: acc, l2Rpc: rpc}) {
	// reset
	currentPage.value= 1;
	Object.assign(steps, createInitialSteps());

	// props
	fromNetwork.value = fn;
	toNetwork.value = tn;
	token.value = tk;
	amount.value = Number(am);
	account.value = acc;
	l2Rpc.value = rpc;

	// status
	visible.value = true;
	loadData();
}

async function loadData() {
	// const allowance = await getErc20Allowance(oldToken.value, account.value, conversion.value);
	// if (allowance >= formatAmount(amount.value)) steps.value = 2;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function runStep1() {
	if (steps[1] !== STATUS.IDLE) return

	steps[1] = STATUS.LOADING
		try {
// 		await approveErc20(oldToken.value, conversion.value, amount.value);
// 		const allowance = await getErc20Allowance(oldToken.value, account.value, conversion.value);
// 		if (allowance >= formatAmount(amount.value)) {
// 			steps.value = 2;
// 			ElMessage.success("Approved successfully.");
// 		} else {
// 			ElMessage.error("Approved amount < migration amount.");
// 		}
			await sleep(1500)
	} catch (e) {
		ElMessage.error("Approve failed.");
	}

	steps[1] = STATUS.SUCCESS
	steps[2] = STATUS.IDLE
}

async function runStep2() {
	if (steps[2] !== STATUS.IDLE) return

	steps[2] = STATUS.LOADING
	await sleep(2000)
	steps[2] = STATUS.SUCCESS

	// steps[3] = STATUS.LOADING
	// await waitL2()
	//
	// steps[4] = STATUS.LOADING
	// await checkArrival()
	// steps[4] = STATUS.SUCCESS
// 	try {
// 		await convert(conversion.value, amount.value);
// 		steps.value = 3;
// 		ElMessage.success("Migration submitted.");
// 		l2Mint();
// 	} catch (e) {
// 		ElMessage.error("Migration failed.");
// 	}
}

// async function l2Mint() {
// 	try {
// 		await waitForL2Mint(l2Rpc.value, account.value);
// 		isFinish.value = true;
// 		ElMessage.success("L2 mint completed.");
// 		emit('finish');
// 	} catch (e) {
// 		ElMessage.error("L2 mint timeout.");
// 	}
// }

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

				.step-title {
					font-size: 14px;
					font-weight: 550;
					color: black;
					font-family: CoinbaseDisplay;
				}

				.step-gas {
					margin-top: 4px;
					font-size: 12px;

					.gas-placeholder {
						width: 80px;
						height: 16px;
						background: #212121;
						border-radius: 4px;
						animation: pulse 1.2s infinite;
					}

					.gas-value {
						color: #555;
					}

					.gas-usd {
						opacity: 0.6;
						margin-left: 4px;
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
