<template>
	<el-dialog
			:model-value="visible"
			:show-close="false"
			class="my-dialog"
			@close="visible = false"
	>
		<div class="dialog-header">
			<div class="dialog-title">Migrate {{ amount }} QKC</div>
			<el-icon class="close-btn" @click="visible = false">
				<Close />
			</el-icon>
		</div>

		<div class="step-column">
			<div class="step-row" :class="{ success: steps > 1 }">
				<div class="step-label-layout">
					<img class="step-icon" src="@/assets/l1.svg"/>
					<span class="step-label">Step 1: Approve QKC</span>
				</div>
				<el-button
						class="convert-button"
						@click="clickApprove"
						:loading="loading === 1"
						:disabled="steps !== 1"
				>
					Approve
				</el-button>
			</div>

			<div class="step-row" :class="{ success: steps > 2 }">
				<div class="step-label-layout">
					<img class="step-icon" src="@/assets/l1.svg"/>
					<span class="step-label">Step 2: Submit Migration (L1)</span>
				</div>
				<el-button
						class="convert-button"
						@click="clickMigration"
						:loading="loading === 2"
						:disabled="steps !== 2"
				>
					Migration
				</el-button>
			</div>

			<div class="step-row" :class="{ success: steps === 3 && isFinish}">
				<div class="step-label-layout">
					<img class="step-icon" src="@/assets/logo.png"/>
					<span class="step-label">Step 3: Wait ~3 mins for L2 confirmation</span>
				</div>

				<el-icon v-if="steps === 3 && !isFinish" class="wait-loading rotating">
					<Loading />
				</el-icon>
				<font-awesome-icon v-else-if="isFinish" icon="check-circle" class="wait-finish" />
				<div v-else></div>
			</div>
		</div>
	</el-dialog>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { approveErc20, convert, getErc20Allowance, waitForL2Mint } from '@/utils/web3';
import { ethers } from 'ethers';

import { ElIcon } from 'element-plus'
import { Close, Loading } from '@element-plus/icons-vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

const emit = defineEmits(['finish']);

// state
const visible = ref(false);
const steps = ref(1);
const isFinish = ref(false);
const loading = ref(0);

const amount = ref(0n);
const balance = ref(0n);
const account = ref(null);
const oldToken = ref(null);
const conversion = ref(null);
const l2Rpc = ref(null);

// methods
function formatAmount(val) {
	return ethers.parseEther(val.toString());
}

function show({ amount: amt, balance: bal, account: acc, conversion: conv, oldToken: old, l2Rpc: rpc }) {
	amount.value = amt;
	balance.value = bal;
	account.value = acc;
	conversion.value = conv;
	oldToken.value = old;
	l2Rpc.value = rpc;

	visible.value = true;
	loadData();
}

async function loadData() {
	const allowance = await getErc20Allowance(oldToken.value, account.value, conversion.value);
	if (allowance >= formatAmount(amount.value)) steps.value = 2;
}

async function clickApprove() {
	loading.value = 1;
	try {
		await approveErc20(oldToken.value, conversion.value);
		const allowance = await getErc20Allowance(oldToken.value, account.value, conversion.value);
		if (allowance >= formatAmount(amount.value)) {
			steps.value = 2;
			ElMessage.success("Approved successfully.");
		} else {
			ElMessage.error("Approved amount < migration amount.");
		}
	} catch (e) {
		ElMessage.error("Approve failed.");
	}
	loading.value = 0;
}

async function clickMigration() {
	loading.value = 2;
	try {
		await convert(conversion.value, amount.value);
		steps.value = 3;
		ElMessage.success("Migration submitted.");
		l2Mint();
	} catch (e) {
		ElMessage.error("Migration failed.");
	}
	loading.value = 0;
}

async function l2Mint() {
	try {
		await waitForL2Mint(l2Rpc.value, account.value);
		isFinish.value = true;
		ElMessage.success("L2 mint completed.");
		emit('finish');
	} catch (e) {
		ElMessage.error("L2 mint timeout.");
	}
}

defineExpose({ show })
</script>

<style scoped lang="less">
.dialog-header {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: flex-start;

	.dialog-title {
		font-size: 24px;
		color: rgb(23, 34, 162);
		font-weight: 500;
		text-align: left;
		font-family: CoinbaseSansBlob;
	}

	.close-btn {
		font-size: 18px;
		cursor: pointer;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #f0f0f0;
	}
	.close-btn:hover {
		color: rgb(23, 34, 162);
		opacity: 0.8;
	}
}

.step-column {
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	margin-top: 30px;
	gap: 15px;
}

.step-row {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
	width: 100%;
	background-color: #f4f4f5;
	border-radius: 8px;
	padding: 8px 12px;
	backdrop-filter: blur(6px);
	-webkit-backdrop-filter: blur(6px);
}
.success {
	background: rgba(103, 194, 58, 0.1);
	border-radius: 8px;
}

.step-label-layout {
	display: flex;
	flex-direction: row;
	justify-content: left;
	align-items: center;

	.step-icon {
		width: 2rem;
		height: 2rem;
		border-radius: 10px;
	}
	.step-label {
		text-align: left;
		font-size: 14px;
		font-weight: 500;
		color: rgb(24, 30, 169);
		margin-left: 8px;
		font-family: CoinbaseDisplay;
	}
}

.convert-button {
	cursor: pointer;
	width: 25%;
	background: rgb(24, 30, 169);
	border: none;
	font-size: 13px;
	line-height: 13px;
	color: rgb(255, 255, 255);
	border-radius: 4px;
	font-family: CoinbaseSansBlob;
}
.convert-button:enabled:hover {
	background: rgba(24, 30, 169, 0.7);
	color: rgb(255, 255, 255);
	border: 0;
}
.convert-button:disabled {
	background: rgba(24, 30, 169, 0.4) !important;
	color: rgba(255, 255, 255, 0.8) !important;
	cursor: not-allowed;
}

.wait-loading {
	font-size: 20px;
	margin-right: 10px;
	color: rgb(23, 34, 162);
}
.wait-finish {
	font-size: 20px;
	margin-right: 10px;
	color: #67c23a;
	animation: fadeIn 0.4s ease-in;
}

@keyframes fadeIn {
	from { opacity: 0; transform: scale(0.8); }
	to { opacity: 1; transform: scale(1); }
}

.rotating {
	animation: spin 1s linear infinite;
}
@keyframes spin {
	from { transform: rotate(0deg); }
	to   { transform: rotate(360deg); }
}

@media screen and (max-width: 500px) {
	.dialog-header {
		margin-top: -40px;

		.dialog-title { font-size: 16px; }
		.close-btn { font-size: 16px; width: 24px; height: 24px; }
	}

	.step-column { margin-top: 25px; gap: 15px; }

	.step-label-layout {
		.step-icon { width: 1.8rem; height: 1.8rem; border-radius: 10px; }
		.step-label { font-size: 13px; }
	}

	.convert-button { width: 25%; font-size: 12px; line-height: 12px; padding-left: 0; padding-right: 0; }
	.wait-loading { font-size: 18px; }
	.wait-finish { font-size: 18px; }
}
</style>

<style>
.my-dialog {
	border-radius: 8px !important;
	max-width: 500px !important;
	padding: 10px 25px 30px !important;
}


@media screen and (max-width: 500px) {
	.my-dialog {
		width: 95% !important;
	}
}
</style>
