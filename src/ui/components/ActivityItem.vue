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
				<!-- progress -->
				<div v-if="ui?.showSteps" class="progress-steps">
					<div
							v-for="(s,i) in ui.steps"
							:key="i"
							class="step-bar"
							:class="{
								filled:s==='done',
								pulse:s==='active'
							}"
					/>
				</div>

				<!-- bottom row -->
				<div class="status-action-row">
					<!-- status -->
					<div class="status-chip">
						<svg v-if="ui?.icon === 'spinner'" viewBox="0 0 66 66" class="spinner-svg">
							<circle cx="33" cy="33" r="28" fill="none" stroke="currentColor" opacity="0.2" stroke-width="10"/>
							<circle cx="33" cy="33" r="28" fill="none" stroke="currentColor" stroke-dasharray="90, 174" stroke-linecap="round" stroke-width="10" class="spinner-path"></circle>
						</svg>
						<span v-if="ui?.icon === 'success'" class="status-success">✓</span>
						<span v-if="ui?.icon === 'error'" class="status-failed">x</span>

						<span class="status-label">{{ ui?.label }}</span>
					</div>

					<!-- action -->
					<button v-if="ui?.action" class="item-btn">
						{{ ui.action.text }}
						<svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
							<path d="M6.01256 2.03268C6.22362 2.13067 6.40829 2.28142 6.57789 2.4774L9.55528 5.94474C9.85301 6.30278 10 6.65328 10 6.99624C10 7.33921 9.85301 7.70479 9.55528 8.04775L6.57789 11.5151C6.41206 11.7186 6.22362 11.8731 6.01256 11.9711C5.80528 12.0691 5.58668 12.1181 5.35678 12.1181C5.12688 12.1181 4.90829 12.054 4.70101 11.9259C4.48995 11.7978 4.32412 11.6244 4.19221 11.4058C4.06407 11.1872 4 10.9535 4 10.7048C4 10.3317 4.14322 9.9774 4.43342 9.64197L6.73995 6.99624L4.43342 4.36182C4.14322 4.01886 4 3.66082 4 3.2877C4 3.04273 4.06407 2.81283 4.19221 2.598C4.32035 2.37941 4.48995 2.20981 4.701 2.0779C4.90829 1.94976 5.12688 1.88569 5.35678 1.88569C5.58668 1.88569 5.80528 1.93469 6.01256 2.03268Z"/>
						</svg>
					</button>
					<div v-else-if="ui?.countdown" class="countdown-badge">
						<span>{{formatRemaining(ui.countdown)}}</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed } from 'vue';
import { TOKEN_LIST } from "@/config/tokens.js";
import { BRIDGE_DIRECTION, BRIDGE_STATUS } from "@/config/constant.js";
import { formatTokenAmount, getCeiledTime } from "@/infra/uitls/utils.js";
import ethereumIcon from '@/assets/l1.svg'
import quarkIcon from '@/assets/quarkchain.svg'

const emit = defineEmits(["open"])
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

const ui = computed(() => getBridgeUI(props.tx))


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
	return formatTokenAmount(amt, decimals.value);
};

function formatRemaining(sec) {
	if (!sec || sec <= 0) return "";
	const { val, unit } = getCeiledTime(sec);
	const unitStr = val > 1 ? unit + 's' : unit;
	return `~${val} ${unitStr} to go`;
}

function getBridgeUI(tx) {
	if (!tx) return null

	/*
	L1 -> L2
	*/
	if (tx.direction === BRIDGE_DIRECTION.L1_TO_L2) {
		if (tx.status === BRIDGE_STATUS.COMPLETED) {
			return {
				showSteps: false,
				icon: "success",
				label: "Bridge successful",
			}
		}
		if (tx.status === BRIDGE_STATUS.FAILED) {
			return {
				showSteps: false,
				icon: "error",
				label: "Bridge failed",
			}
		}
		return {
			showSteps: true,
			steps:["done","active"],
			icon: "spinner",
			label: "Waiting for confirmation",
		}
	}

	/*
	L2 -> L1
	*/
	if (tx.direction === BRIDGE_DIRECTION.L2_TO_L1) {
		if (tx.status === BRIDGE_STATUS.COMPLETED) {
			return {
				showSteps: false,
				icon: "success",
				label: "Bridge successful",
			}
		}
		if (tx.status === BRIDGE_STATUS.FAILED) {
			return {
				showSteps: false,
				icon: "error",
				label: "Bridge failed",
			}
		}

		if (tx.status === BRIDGE_STATUS.READY_TO_PROVE) {
			return {
				showSteps: true,
				steps: ["done", "active", "pending"],
				icon: "spinner",
				label: "Ready to prove",
				action: {
					text: "Prove"
				}
			}
		}

		if (tx.status === BRIDGE_STATUS.CHALLENGE_PERIOD) {
			return {
				showSteps: true,
				steps: ["done", "done", "active"],
				icon: "spinner",
				label: "Challenge period",
				countdown: tx.remaining
			}
		}

		if (tx.status === BRIDGE_STATUS.READY_TO_WITHDRAW) {
			return {
				showSteps: true,
				steps: ["done", "done", "active"],
				icon: "spinner",
				label: "Ready to withdraw",
				action: {
					text: "Withdraw"
				}
			}
		}

		// if(tx.status === "waiting-prove-window"){
		return {
			showSteps: true,
			steps: ["done", "active", "pending"],
			icon: "spinner",
			label: "Waiting for prove window",
			countdown: tx.remaining
		}
	}

	return null
}

const handleCardClick = () => {
	const tx = {
		...props.tx,
		tokenObj: tokenInfo.value
	}
	emit("open", tx);
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
		background: #f1f5f9;
	}
	.step-bar.filled {
		background: #181ea9;
	}
	.pulse {
		animation: pulse-bg 3s ease-in-out infinite;
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

			.status-success {
				width: 18px;
				height: 18px;
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
				width: 18px;
				height: 18px;
				border-radius: 50%;
				background: #e53935;
				color: white;
				display: flex;
				align-items: center;
				justify-content: center;
				font-weight: bold;
				animation: fadeIn 0.3s ease-out;
			}

			.status-label {
				font-size: 13px;
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

		.countdown-badge{
			display:flex;
			align-items:center;
			gap:6px;
			padding:6px 12px;
			border-radius:999px;
			background:#f1f5f9;
			color:#64748b;
			font-size:14px;
			font-weight:500;
		}
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	@keyframes pulse-bg {
		0%,100% {
			background-color: #181ea9;
		}
		50% {
			background-color: #f1f5f9;
		}
	}
}

@media screen and (max-width: 500px) {
	.activity-item-container {
		margin-bottom: 14px;
	}

	.activity-card {
		padding: 18px;
		border-radius: 18px;
	}

	.asset-info {
		gap: 12px;
		padding: 14px 0;

		.token-icon {
			width: 30px;
			height: 30px;
		}

		.amount-group {
			.amount-value {
				font-size: 20px;
			}
			.amount-symbol {
				font-size: 16px;
			}
		}
	}

	.card-footer {
		.step-bar {
			height: 5px;
		}

		.status-action-row {
			.status-chip {
				gap: 8px;
				padding: 5px 12px;

				.spinner-svg {
					width: 15px;
					height: 15px;
				}

				.status-success {
					width: 17px;
					height: 17px;
				}
				.status-failed {
					width: 17px;
					height: 17px;
				}
				.status-label {
					font-size: 12px;
				}
			}

			.item-btn {
				padding: 7px 12px;
			}

			.countdown-badge {
				padding: 6px 12px;
				font-size: 12px;
			}
		}
	}
}
</style>
