<template>
	<el-dialog
			v-model="isVisible"
			class="history-dialog"
			fullscreen>
		<div class="history-page">
			<ActivityHeader @filter="onOpenFilter"/>

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
	<MigrationDialog ref="migrationDialog" @finish="onFinish" />
	<FilterDialog ref="filterDialog" @apply="onFilterApply" />
</template>

<script setup>
import { useStore } from 'vuex';
import { ref, computed } from 'vue';
import { BRIDGE_DIRECTION, BRIDGE_STATUS } from "@/config/constant.js";
import { NETWORKS } from "@/config/networks.js";
import { txList, syncing } from "@/app/store/txStore.js";
import { refreshLocalList } from "@/services/history/syncManager.js";
import { formatTokenAmount } from "@/infra/uitls/utils.js";

// Components
import ActivityHeader from '@/ui/components/ActivityHeader.vue';
import ActivityItem from '@/ui/components/ActivityItem.vue';
import BridgeDialogL1 from '@/ui/components/BridgeDialogL1.vue';
import BridgeDialogL2 from '@/ui/components/BridgeDialogL2.vue';
import MigrationDialog from '@/ui/components/MigrationDialog.vue';
import FilterDialog from '@/ui/components/FilterDialog.vue';

// Default filter config
const DEFAULT_FILTER = {
	origin: 'Any chain',
	status: 'All'
};

const isVisible = defineModel({ default: false });

const store = useStore();
const L1ChainId = computed(() => store.state.l1ChainId.toLowerCase());
const L2ChainId = computed(() => store.state.l2ChainId.toLowerCase());

const dialogL1 = ref();
const dialogL2 = ref();
const migrationDialog = ref(null);
const filterDialog = ref();

const filterConfig = ref({ ...DEFAULT_FILTER });

const filteredList = computed(() => {
	let list = txList.value;

	// Origin filter
	if (filterConfig.value.origin !== DEFAULT_FILTER.origin) {
		const targetDirection = filterConfig.value.origin === 'Ethereum'
				? BRIDGE_DIRECTION.L1_TO_L2
				: BRIDGE_DIRECTION.L2_TO_L1;
		list = list.filter(tx => tx.direction === targetDirection);
	}

	// Status filter
	if (filterConfig.value.status !== DEFAULT_FILTER.status) {
		const isCompleted = filterConfig.value.status === 'Completed';
		list = list.filter(tx => {
			if (isCompleted) {
				return tx.status === BRIDGE_STATUS.COMPLETED || tx.status === BRIDGE_STATUS.FAILED;
			} else {
				return tx.status !== BRIDGE_STATUS.COMPLETED && tx.status !== BRIDGE_STATUS.FAILED;
			}
		});
	}

	return list;
});

function onOpenFilter() {
	filterDialog.value.open(filterConfig.value);
}

function openTx(tx) {
	const params = {
		mode: 'history',
		account: tx.address,
		txHash: tx.hash,
		status: tx.status,
		remainingSeconds: tx.remaining,
		token: tx.tokenObj.token,
		timestamp: tx.timestamp,
		amount: formatTokenAmount(tx.amount, tx.tokenObj.contract.decimals)
	};

	if (tx.direction === BRIDGE_DIRECTION.L1_TO_L2) {
		params.fromNetwork = NETWORKS[L1ChainId.value];
		params.toNetwork = NETWORKS[L2ChainId.value];
		if (tx.type === 'CONVERT') {
			migrationDialog.value.show(params);
		} else {
			dialogL1.value.show(params);
		}
	} else {
		params.fromNetwork = NETWORKS[L2ChainId.value];
		params.toNetwork = NETWORKS[L1ChainId.value];
		dialogL2.value.show(params);
	}
}

function onFinish() {
	refreshLocalList();
}

function onFilterApply(newConfig) {
	filterConfig.value = {
		origin: newConfig.origin ?? DEFAULT_FILTER.origin,
		status: newConfig.status ?? DEFAULT_FILTER.status
	};
}
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

@media screen and (max-width: 500px) {
	.list-container {
		max-width: 90%;
		margin: 25px auto 0;
		padding: 0;
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
	position: fixed;
	top: 0;
	right: 15px;
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

@media screen and (max-width: 500px) {
	.history-dialog .el-dialog__headerbtn {
		top: 18px !important;
		right: 0 !important;
	}
}
</style>
