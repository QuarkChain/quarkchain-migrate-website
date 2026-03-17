<template>
	<el-dialog
			v-model="dialogVisible"
			title="Filters"
			class="filter-dialog"
			append-to-body
			center
	>
		<div class="filter-content">
			<div class="filter-row">
				<span class="label">Origin</span>
				<el-select v-model="tempConfig.origin" class="filter-select" placeholder="Any chain">
					<el-option label="Ethereum" value="Ethereum" />
					<el-option label="QuarkChain L2" value="QuarkChain L2" />
				</el-select>
			</div>

			<div class="filter-row">
				<span class="label">Status</span>
				<el-select v-model="tempConfig.status" class="filter-select" placeholder="All">
					<el-option label="Pending" value="Pending" />
					<el-option label="Completed" value="Completed" />
				</el-select>
			</div>
		</div>

		<template #footer>
			<div class="dialog-footer">
				<el-button link @click="onClear">Clear All</el-button>
				<el-button type="primary" color="#000" round @click="handleApply">
					Apply Filters
				</el-button>
			</div>
		</template>
	</el-dialog>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['apply'])

const dialogVisible = ref(false)
const tempConfig = ref()

const open = (initialConfig) => {
	tempConfig.value = { ...initialConfig }
	dialogVisible.value = true
}

const handleApply = () => {
	emit('apply', { ...tempConfig.value })
	dialogVisible.value = false
}

const onClear = () => {
	tempConfig.value = { origin: 'Any chain', status: 'All' }
}

defineExpose({ open })
</script>

<style scoped lang="less">
.filter-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 20px 0;
	border-bottom: 1px solid #f0f0f0;

	.label {
		font-weight: 600;
		font-size: 14px;
		color:#212121;
	}
}

.dialog-footer {
	display: flex;
	justify-content: space-between;
	padding-top: 10px;
}
</style>

<style>
.filter-dialog {
	border-radius: 8px !important;
	max-width: 500px !important;
	padding: 10px 25px 30px !important;
}

.filter-dialog .el-dialog__header {
	text-align: center;
	margin-right: 0 !important;
	padding-bottom: 18px;
	padding-top: 12px;
	border-bottom: 1px solid #f0f0f0;
}
.filter-dialog .el-dialog__title {
	font-weight: 700;
	font-size: 18px;
	color: #1e293b;
	display: block;
}

.filter-dialog .el-dialog__headerbtn {
	top: 8px;
	width: 34px;
	height: 34px;
	background: rgba(255, 255, 255, 0.6);
	backdrop-filter: blur(4px);
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	border-radius: 50%;
	border: 1px solid rgba(0, 0, 0, 0.1);
	display: flex;
	align-items: center;
	justify-content: center;
}
.filter-dialog .el-dialog__headerbtn .el-dialog__close {
	color: #475569 !important;
	font-size: 20px;
	transition: color 0.3s;
}
.filter-dialog .el-dialog__headerbtn:hover {
	border-color: rgba(0, 0, 0, 0.2);
}
.filter-dialog .el-dialog__headerbtn:hover .el-dialog__close {
	color: #1e293b !important;
}
.filter-dialog .el-dialog__headerbtn:focus {
	outline: none;
}

.filter-select {
	--el-color-primary: #181ea9;
	--el-select-input-focus-border-color: #181ea9;
	--el-border-color-hover: #181ea9;
	border-radius: 12px !important;
	width: 180px !important;
}

.el-select__popper .el-select-dropdown__item.is-selected {
	color: #181ea9 !important;
	font-weight: bold;
}
.el-select__popper .el-select-dropdown__item.hover,
.el-select__popper .el-select-dropdown__item:hover {
	background-color: rgba(24, 30, 169, 0.08) !important;
}

@media screen and (max-width: 500px) {
	.filter-dialog {
		width: 95% !important;
	}
}
</style>
