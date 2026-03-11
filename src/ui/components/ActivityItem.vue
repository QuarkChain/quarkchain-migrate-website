<template>
	<div class="activity-item-container" @click="handleCardClick">
		<div class="activity-card">
			<div class="card-row flex-between">
				<div class="time-badge">
					<span>{{ formatTime(tx.timestamp) }}</span>
				</div>

				<div class="route-info">
					<img :src="getNetIcon('from')" class="net-icon"/>
					<img :src="getNetIcon('to')" class="net-icon"/>
				</div>
			</div>

			<div class="card-row asset-info">
				<img :src="token?.icon" class="token-icon">
				<div class="amount-group">
					<span class="amount-value">{{ formatAmount(tx?.amount) }}</span>
					<span class="amount-symbol">{{ token?.symbol }}</span>
				</div>
			</div>

			<div class="card-row card-footer">
				<div class="progress-steps">
					<div class="step-bar" :class="{ filled: step >= 1, pulse: step === 1 && tx.status !== 'completed' }"></div>
					<div class="step-bar" :class="{ filled: step >= 2, pulse: step === 2 && tx.status !== 'completed' }"></div>
					<div class="step-bar" :class="{ filled: step >= 3 }"></div>
				</div>

				<div class="status-action-row">
					<div class="status-chip">
						<svg v-if="tx.status !== 'completed'" viewBox="0 0 66 66" class="spinner-svg">
							<circle cx="33" cy="33" r="28" fill="none" stroke="currentColor" opacity="0.2" stroke-width="10"></circle>
							<circle cx="33" cy="33" r="28" fill="none" stroke="currentColor" stroke-dasharray="90, 174" stroke-linecap="round" stroke-width="10" class="spinner-path"></circle>
						</svg>
						<span class="status-label">{{ statusInfo.text }}</span>
					</div>

					<button class="item-btn">
						<span>Prove</span>
						<svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
							<path d="M6.01256 2.03268C6.22362 2.13067 6.40829 2.28142 6.57789 2.4774L9.55528 5.94474C9.85301 6.30278 10 6.65328 10 6.99624C10 7.33921 9.85301 7.70479 9.55528 8.04775L6.57789 11.5151C6.41206 11.7186 6.22362 11.8731 6.01256 11.9711C5.80528 12.0691 5.58668 12.1181 5.35678 12.1181C5.12688 12.1181 4.90829 12.054 4.70101 11.9259C4.48995 11.7978 4.32412 11.6244 4.19221 11.4058C4.06407 11.1872 4 10.9535 4 10.7048C4 10.3317 4.14322 9.9774 4.43342 9.64197L6.73995 6.99624L4.43342 4.36182C4.14322 4.01886 4 3.66082 4 3.2877C4 3.04273 4.06407 2.81283 4.19221 2.598C4.32035 2.37941 4.48995 2.20981 4.701 2.0779C4.90829 1.94976 5.12688 1.88569 5.35678 1.88569C5.58668 1.88569 5.80528 1.93469 6.01256 2.03268Z"></path>
						</svg>
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed } from 'vue';
import { TOKEN_LIST } from "@/config/tokens.js";
import ethereumIcon from '@/assets/l1.svg'
import quarkIcon from '@/assets/quarkchain.svg'
import {ethers} from "ethers";

const props = defineProps({
	tx: {
		type: Object,
		required: true
		/**
		 * { hash, direction, amount, timestamp, status, token, from, to, blockNumber ... }
		 */
	}
});

const tokenInfo = computed(() => {
	const addr = props.tx?.token?.toLowerCase()
	if (!addr) return null

	for (const t of TOKEN_LIST) {
		for (const net of Object.values(t.networks)) {
			if (net.address.toLowerCase() === addr) {
				return {
					token: t,
					contract: net
				}
			}
		}
	}
	return null
})
const token = computed(() => tokenInfo.value?.token || null)
const decimals = computed(() => tokenInfo.value?.contract?.decimals || 18)

const statusConfig = {
	'initiated':        { text: 'Waiting for state', step: 1 },
	'ready-to-prove':   { text: 'Ready to Prove',    step: 1 },
	'challenging':      { text: 'Challenge Period',  step: 2 },
	'ready-to-withdraw':{ text: 'Ready to Withdraw', step: 2 },
	'completed':        { text: 'Bridge successful', step: 3 },
	'failed':        		{ text: 'Bridge failed', step: 3 }
};

const statusInfo = computed(() => statusConfig[props.tx.status] || { text: props.tx.status, step: 0 });
const step = computed(() => statusInfo.value.step);

const formatTime = (ts) => {
	if (!ts) return 'Pending';
	const diff = Math.floor(Date.now() / 1000) - ts;

	const minute = 60;
	const hour = 3600;
	const day = 86400;
	if (diff >= day) {
		return `${Math.floor(diff / day)} days ago`;
	}
	if (diff >= hour) {
		return `${Math.floor(diff / hour)} hours ago`;
	}
	return `${Math.max(1, Math.floor(diff / minute))} minutes ago`;
};

const getNetIcon = (type) => {
	const isL1 = props.tx.direction.includes('L1→L2');
	if (type === 'from') return isL1 ? ethereumIcon : quarkIcon;
	return isL1 ? quarkIcon : ethereumIcon;
};

const formatAmount = (amt) => {
	if (!amt || !decimals) return 0;
	return parseFloat(ethers.formatUnits(amt, decimals.value)).toFixed(2);
};

const handleCardClick = () => {
	const isL2ToL1 = props.tx.direction.includes('L2');
	const explorerUrl = isL2ToL1
			? `https://optimistic.etherscan.io/tx/${props.tx.hash}`
			: `https://etherscan.io/tx/${props.tx.hash}`;

	window.open(explorerUrl, '_blank');
};

</script>

<style scoped lang="less">
.activity-item-container {
	width: 100%;
	margin-bottom: 20px;
}

.activity-card {
	background: #ffffff;
	border-radius: 32px;
	padding: 24px;
	box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.05),
			0 10px 20px -5px rgba(0, 0, 0, 0.03);
	border: 1px solid #f1f5f9;
	cursor: pointer;
	transition: all 0.25s ease;
}
.activity-card:hover {
	transform: translateY(-4px);
	box-shadow:
			0 20px 25px -5px rgba(0, 0, 0, 0.07),
			0 10px 10px -6px rgba(0, 0, 0, 0.04);
	border-color: #e2e8f0;
}

.type-icon, .net-icon {
	width: 22px;
	height: 22px;
	border-radius: 50%;
}

.flex-between {
	display: flex;
	justify-content: space-between;
	align-items: center;

	.time-badge {
		background: #f1f5f9;
		padding: 5px 12px;
		border-radius: 999px;
		font-size: 12px;
		color: #64748b;
		font-weight: 700;
	}

	.route-info {
		display: flex;
		align-items: center;
		background: #f1f5f9;
		border-radius: 90px;
		padding: 5px 8px;
	}
}

.asset-info {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 20px 0;

	.token-icon {
		width: 44px;
		height: 44px;
	}

	.amount-group {
		display: flex;
		align-items: baseline;
		gap: 4px;

		.amount-value {
			font-size: 26px;
			font-weight: 700;
			color: #0f172a;
		}
		.amount-symbol {
			font-size: 16px;
			font-weight: 600;
			color: #64748b;
		}
	}
}

.card-footer {
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	align-items: center;

	.progress-steps {
		display: flex;
		gap: 4px;
		width: 100%;
		padding: 4px 0 18px 0;
	}

	.step-bar {
		height: 6px;
		flex: 1;
		border-radius: 999px;
	}
	.step-bar.filled {
		background: #181ea9;
	}
	.step-bar.empty {
		background: #f1f5f9;
	}
	.pulse {
		animation: pulse-bg 2s infinite;
	}

	.status-action-row {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;

		.status-chip {
			display: flex;
			align-items: center;
			gap: 8px;
			border: 1px solid #e1e1e1;
			padding: 6px 12px;
			border-radius: 999px;

			.spinner-svg {
				width: 16px;
				height: 16px;
				color: #64748b;

				.spinner-path {
					animation: spin 2s linear infinite;
					transform-origin: center;
				}
			}

			.status-label {
				font-size: 14px;
				color: #64748b;
				font-weight: 600;
			}
		}

		.item-btn {
			display: flex;
			align-items: center;
			gap: 6px;
			background: #181ea9;
			color: #ffffff;
			padding: 8px 16px;
			border-radius: 999px;
			border: none;
			font-weight: 500;
			cursor: pointer;
		}
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	@keyframes pulse-bg {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}
}
</style>
