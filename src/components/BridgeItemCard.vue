<template>
	<div class="bridge-wrapper">
		<div class="card-header">
			<div class="left">
				<img
						class="network-icon"
						:src="networkIcon"
						:alt="title"
				/>
				<span class="title">{{ title }}</span>
			</div>

			<el-link
					type="info"
					:underline="false"
					target="_blank"
					:href="addressUrl"
					class="address"
			>
				{{ shortAddress }}
			</el-link>
		</div>

		<div class="amount-row">
			<img
					class="token-icon"
					:src="tokenIcon"
					:alt="symbol"
			/>
			<span class="amount">
          {{ amount }} {{ symbol }}
			</span>
		</div>
	</div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
	title: String,
	networkIcon: String,
	addressUrl: String,
	address: String,
	amount: Number,
	tokenIcon: String,
	symbol: String
})

const shortAddress = computed(() => {
	if (!props.address) return ''
	return props.address.slice(0, 4) + '...' + props.address.slice(-4)
})
</script>


<style scoped>
.bridge-wrapper {
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	gap: 12px;
	padding: 20px 16px;
	border-radius: 16px;
	background: #f5f7fa;
}

.card-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 16px;
}

.left {
	display: flex;
	align-items: center;
	gap: 8px;
}

.network-icon {
	width: 20px;
	height: 20px;
	border-radius: 4px;
}

.title {
	font-size: 14px;
	font-weight: 600;
}

.address {
	font-size: 10px;
	background: #ffffff;
	padding: 4px 8px;
	border-radius: 999px;
}

.amount-row {
	display: flex;
	align-items: center;
	gap: 8px;
}

.token-icon {
	width: 32px;
	height: 32px;
	border-radius: 50%;
}

.amount {
	font-size: 24px;
	font-weight: 600;
	color: black;
}
</style>
