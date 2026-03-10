<template>
	<div class="activity-item-container">
		<div class="activity-card" role="button">
			<div class="card-row flex-between">
				<div class="time-badge">
					<span>{{ timeAgo }}</span>
				</div>

				<div class="route-info">
					<div class="network-stack">
						<img :src="fromNetworkIcon" class="net-icon" />
						<img :src="toNetworkIcon" class="net-icon overlap" />
					</div>
				</div>
			</div>

			<div class="card-row asset-info">
				<img :src="tokenIcon" class="token-icon" alt="USDC">
				<span class="amount-text">{{ amount }} {{ tokenSymbol }}</span>
			</div>

			<div class="card-footer">
				<div class="progress-bar">
					<div class="step filled"></div>
					<div class="step filled pulse"></div>
					<div class="step empty"></div>
				</div>

				<div class="action-row">
					<div class="status-indicator">
						<svg viewBox="0 0 66 66" class="mini-spinner">
							<circle cx="33" cy="33" r="28" fill="none" stroke="currentColor" opacity="0.2" stroke-width="12"></circle>
							<circle cx="33" cy="33" r="28" fill="none" stroke="currentColor" stroke-dasharray="1, 174" stroke-dashoffset="306" stroke-linecap="round" stroke-width="12" class="spinner-path"></circle>
						</svg>
						<span class="status-text">Ready to prove</span>
					</div>

					<button class="prove-btn" @click.stop="$emit('prove')">
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
defineProps({
	timeAgo: { type: String, default: '4 days ago' },
	type: { type: String, default: 'Native Bridge' },
	amount: { type: String, default: '0.01' },
	tokenSymbol: { type: String, default: 'USDC' },
	tokenIcon: { type: String, default: 'https://djvebdd83rbuw.cloudfront.net/tokens/usdc.png' },
	fromNetworkIcon: { type: String, default: 'https://s3.us-east-2.amazonaws.com/assets.rollbridge.app/f6e0c152dd3a4ef262f18.svg' },
	toNetworkIcon: { type: String, default: '/img/networks/sepolia.svg' }
});
</script>

<style scoped>
.activity-item-container {
	width: 100%;
	margin-bottom: 16px;
}

.activity-card {
	background: #ffffff;
	border-radius: 32px;
	padding: 24px;
	box-shadow: 0 1px 3px rgba(0,0,0,0.05);
	cursor: pointer;
	transition: transform 0.2s;
}

.activity-card:hover {
	transform: translateY(-2px);
}

.flex-between {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.time-badge {
	background: #f1f5f9;
	padding: 4px 12px;
	border-radius: 999px;
	font-size: 12px;
	color: #64748b;
}

.route-info {
	display: flex;
	gap: 8px;
	align-items: center;
}

.bridge-type {
	display: flex;
	align-items: center;
	gap: 6px;
	background: #f1f5f9;
	padding: 4px 4px 4px 12px;
	border-radius: 999px;
}

.type-text {
	font-size: 12px;
	color: #64748b;
}

.type-icon, .net-icon {
	width: 20px;
	height: 20px;
	border-radius: 50%;
}

.network-stack {
	display: flex;
	align-items: center;
	background: #f1f5f9;
	padding: 4px;
	border-radius: 999px;
}

.overlap {
	margin-left: -6px;
}

.asset-info {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 16px 0;
}

.token-icon {
	width: 44px;
	height: 44px;
	border-radius: 50%;
}

.amount-text {
	font-size: 28px;
	font-weight: 600;
	color: #0f172a;
}

.progress-bar {
	display: flex;
	gap: 4px;
	width: 100%;
	padding: 4px 0 16px 0;
}

.step {
	height: 6px;
	flex: 1;
	border-radius: 999px;
}

.step.filled { background: #181ea9; }
.step.empty { background: #f1f5f9; }

.pulse {
	animation: pulse-bg 2s infinite;
}

.action-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.status-indicator {
	display: flex;
	align-items: center;
	gap: 8px;
	border: 1px solid #f1f5f9;
	padding: 6px 12px;
	border-radius: 999px;
}

.status-text {
	font-size: 13px;
	color: #64748b;
}

.prove-btn {
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

.mini-spinner {
	width: 16px;
	height: 16px;
	color: #64748b;
}

.spinner-path {
	animation: spin 2s linear infinite;
	transform-origin: center;
}

@keyframes spin {
	to { transform: rotate(360deg); }
}

@keyframes pulse-bg {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.5; }
}
</style>
