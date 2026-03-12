<template>
	<div>
		<el-dialog
				:model-value="modelValue"
				@update:model-value="$emit('update:modelValue', $event)"
				class="history-dialog"
				fullscreen >
			<div class="history-page">
				<ActivityHeader @filter="isFilterOpen = !isFilterOpen"/>

				<div v-if="syncing" class="loading-container">
					<div class="spinner"></div>
				</div>

				<div class="list-container">
					<ActivityItem
							v-for="tx in filteredList"
							:key="`${tx.hash}-${tx.logIndex}`"
							:tx="tx"
							@open="openTx"
					/>

					<div v-if="filteredList.length === 0 && !syncing" class="empty">
						<div class="empty-title">No activity yet</div>
						<div class="empty-desc">Your transactions will appear here</div>
					</div>
				</div>
			</div>
		</el-dialog>

		<BridgeDialogL1 ref="dialogL1" @finish="onFinish" />
		<BridgeDialogL2 ref="dialogL2" @finish="onFinish" />
	</div>
</template>

<script setup>
import { ethers } from "ethers";
import { useStore } from 'vuex';
import { ref, computed } from 'vue';
import { txList, syncing } from "@/app/store/txStore.js";
import { BRIDGE_DIRECTION } from "@/config/constant.js";
import { NETWORKS } from "@/config/networks.js";
import ActivityHeader from '@/ui/components/ActivityHeader.vue';
import ActivityItem from '@/ui/components/ActivityItem.vue';
import BridgeDialogL1 from '@/ui/components/BridgeDialogL1.vue';
import BridgeDialogL2 from '@/ui/components/BridgeDialogL2.vue';

const store = useStore();
const L1ChainId = computed(() => store.state.l1ChainId.toLowerCase());
const L2ChainId = computed(() => store.state.l2ChainId.toLowerCase());

const dialogL1 = ref();
const dialogL2 = ref();

const isFilterOpen = ref(false);
const currentTag = ref('All');

const filteredList = computed(() => {
	if (currentTag.value === 'All') {
		return txList.value;
	}
	return txList.value.filter(tx => tx.type.includes(currentTag.value));
});

function openTx(tx) {
	const params = {
		mode: 'history',
		account: tx.address,
		txHash: tx.hash,
		status: tx.status,
		remainingSeconds: tx.remaining,
	}
	const {token, contract} = tx.tokenObj;
	params.token = token;
	params.amount = parseFloat(ethers.formatUnits(tx.amount, contract.decimals)).toFixed(2);
	if (tx.direction === BRIDGE_DIRECTION.L1_TO_L2) {
		params.fromNetwork = NETWORKS[L1ChainId.value];
		params.toNetwork = NETWORKS[L2ChainId.value];
		dialogL1.value.show(params)
	} else {
		params.fromNetwork = NETWORKS[L2ChainId.value];
		params.toNetwork = NETWORKS[L1ChainId.value];
		dialogL2.value.show(params)
	}
}

function onFinish() {
}

defineProps(['modelValue']);
defineEmits(['update:modelValue']);
</script>

<style scoped lang="less">
.history-page {
	background: #FAFCFF;
	min-height: 100vh;
	padding: 45px 0;
}

.loading-container {
	display:flex;
	flex-direction:column;
	align-items:center;
	padding: 20px 0 0;

	.spinner{
		width:28px;
		height:28px;
		border:3px solid #e5e7eb;
		border-top-color:#4f46e5;
		border-radius:50%;
		animation:spin .8s linear infinite;
	}
}
@keyframes spin{
	to{ transform:rotate(360deg) }
}


.list-container {
	max-width: 600px;
	margin: 30px auto 0;
	padding: 0 20px;
}

.empty{
	display:flex;
	flex-direction:column;
	align-items:center;
	padding:80px 0;

	.empty-title{
		font-size:18px;
		font-weight:600;
		margin-bottom:20px;
	}

	.empty-desc{
		font-size:14px;
		color:#64748b;
	}
}
</style>

<style>
.history-dialog {
	--el-dialog-padding-primary: 0px !important;
}

.history-dialog .el-dialog__body {
	padding: 0;
	height: 100%;
}

.history-dialog .el-dialog__header {
	position: absolute;
	top: 0;
	right: 0;
	z-index: 10;
	padding: 0 !important;
	margin: 0 !important;
	width: 100%;
	pointer-events: none;
}
.history-dialog .el-dialog__headerbtn {
	top: 18px !important;
	right: 18px !important;
	width: 34px;
	height: 34px;
	pointer-events: auto;
	background: rgba(255, 255, 255, 0.6);
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	border-radius: 50%;
	border: 1px solid rgba(0, 0, 0, 0.1);
}
.history-dialog .el-dialog__headerbtn .el-dialog__close {
	color: #475569 !important;
	font-size: 20px;
	transition: color 0.3s;
}
.history-dialog .el-dialog__headerbtn:hover {
	background: rgba(15, 23, 42, 0.1);
	transform: rotate(90deg) scale(1.1);
}
.history-dialog .el-dialog__headerbtn:hover .el-dialog__close {
	color: #1e293b !important;
}
</style>
