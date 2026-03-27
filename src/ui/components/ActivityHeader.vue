<template>
	<div class="activity-header">
		<div class="header-capsule">
			<h1 class="header-title">Activity</h1>
			<div v-if="account" class="address-badge">
				<span class="address-text">{{ shortAddress }}</span>
			</div>
		</div>

		<button class="filter-btn" @click="$emit('filter')">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="filter-icon">
				<path fill-rule="evenodd" clip-rule="evenodd" d="M15 13.8858C13.8323 13.8858 12.8858 14.8323 12.8858 16C12.8858 17.1677 13.8323 18.1142 15 18.1142C16.1677 18.1142 17.1142 17.1677 17.1142 16C17.1142 14.8323 16.1677 13.8858 15 13.8858ZM11 16C11 13.7909 12.7909 12 15 12C17.2091 12 19 13.7909 19 16C19 18.2091 17.2091 20 15 20C12.7909 20 11 18.2091 11 16Z"></path>
				<path d="M2 16C2 15.4477 2.44772 15 3 15L11.5 15V17H3C2.44772 17 2 16.5523 2 16V16Z"></path>
				<path d="M22 16C22 15.4477 21.5523 15 21 15L18 15V17H21C21.5523 17 22 16.5523 22 16V16Z"></path>
				<path fill-rule="evenodd" clip-rule="evenodd" d="M9 5.88576C10.1677 5.88576 11.1142 6.83234 11.1142 8C11.1142 9.16766 10.1677 10.1142 9 10.1142C7.83234 10.1142 6.88576 9.16766 6.88576 8C6.88576 6.83234 7.83234 5.88576 9 5.88576ZM13 8C13 5.79086 11.2091 4 9 4C6.79086 4 5 5.79086 5 8C5 10.2091 6.79086 12 9 12C11.2091 12 13 10.2091 13 8Z"></path>
				<path d="M22 8C22 7.44772 21.5523 7 21 7L12.5 7V9H21C21.5523 9 22 8.55228 22 8V8Z"></path>
				<path d="M2 8C2 7.44772 2.44772 7 3 7L6 7V9H3C2.44772 9 2 8.55228 2 8V8Z" fill="currentColor"></path>
			</svg>
		</button>
	</div>
</template>

<script setup>
import { useStore } from 'vuex';
import { computed } from "vue";

const store = useStore();
const account = computed(() => store.state.account);
const shortAddress = computed(() => {
	if (!account.value) return ''
	return account.value.slice(0, 4) + '...' + account.value.slice(-4)
})
</script>

<style scoped>
.activity-header {
	width: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 12px;
}

.header-capsule {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 12px;
	background: #ffffff;
	padding: 8px 14px 8px 24px;
	border-radius: 999px;
	box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.header-title {
	font-size: 24px;
	font-weight: 700;
	color: #1e293b;
}

.address-badge {
	background: #f1f5f9;
	border-radius: 999px;
	padding: 4px 12px;
	height: 24px;
	display: flex;
	align-items: center;
}
.address-text {
	font-size: 12px;
	color: #64748b;
	font-family: monospace;
}

.filter-btn {
	width: 48px;
	height: 48px;
	background: #ffffff;
	border: none;
	border-radius: 999px;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	box-shadow: 0 1px 3px rgba(0,0,0,0.05);
	transition: all 0.2s;
	color: #1e293b;
}
.filter-btn:hover {
	transform: scale(1.03);
	background: #f8fafc;
}
.filter-icon {
	width: 20px;
	height: 20px;
	fill: currentColor;
}

@media screen and (max-width: 500px) {
	.activity-header {
		gap: 12px;
	}

	.header-capsule {
		gap: 12px;
		padding: 8px 12px 8px 18px;
	}
	.header-title {
		font-size: 18px;
	}

	.filter-btn {
		width: 44px;
		height: 44px;
	}
}
</style>
