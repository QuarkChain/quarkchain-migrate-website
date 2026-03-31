<template>
	<button
			class="history-btn"
			:class="{ 'has-action': count > 0 }"
			@click="$emit('click', $event)"
	>
		<div class="icon-wrapper">
			<svg
					viewBox="0 0 24 24"
					class="icon-history"
					:class="{ 'auto-wiggle': true }"
			>
				<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
				<path d="M3 3v5h5" />
				<path d="M12 7v5l4 2" />
			</svg>
		</div>

		<Transition name="slide-fade">
			<div v-if="count > 0" class="action-badge">
				<span class="badge-text">{{ count }}</span>
				<div class="spinner-container">
					<svg viewBox="0 0 66 66" class="spinner">
						<circle cx="33" cy="33" r="28" fill="none" stroke="currentColor" opacity="0.25" stroke-width="12"></circle>
						<circle cx="33" cy="33" r="28" fill="none" stroke="currentColor" stroke-dasharray="1, 174" stroke-dashoffset="306" stroke-linecap="round" stroke-width="12" class="spinner-inner"></circle>
					</svg>
				</div>
			</div>
		</Transition>
	</button>
</template>

<script setup>
defineProps({
	count: {
		type: Number,
		default: 0
	}
});
defineEmits(['click']);
</script>

<style scoped>
.history-btn {
	display: inline-flex;
	align-items: center;
	padding: 8px;
	border-radius: 999px;
	border: 1px solid rgba(0, 0, 0, 0.04);
	background: #ffffff;
	cursor: pointer;
	transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
	box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
	outline: none;
	overflow: hidden;
}
.history-btn:hover {
	transform: translateY(-1.5px) scale(1.03);
	box-shadow: 0 8px 20px rgba(0, 0, 0, 0.07);
}
.history-btn:active {
	transform: scale(0.95);
}

.icon-wrapper {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	border-radius: 50%;
	color: #475569;
	transition: color 0.3s, background 0.3s;
}

.history-btn:hover .icon-wrapper {
	color: #1e293b;
	background: rgba(0, 0, 0, 0.02);
}

.icon-history {
	width: 24px;
	height: 24px;
	fill: none;
	stroke: currentColor;
	stroke-width: 2.2;
	stroke-linecap: round;
	stroke-linejoin: round;
}

.has-action {
	padding-right: 12px;
	gap: 6px;
}

.action-badge {
	display: flex;
	align-items: center;
	gap: 8px;
	background: #1e293b;
	color: #ffffff;
	padding: 0 12px;
	border-radius: 999px;
	height: 28px;
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.badge-text {
	font-size: 12px;
	font-weight: 600;
	white-space: nowrap;
}

.spinner {
	width: 12px;
	height: 12px;
}

.spinner-inner {
	animation: spin 2s linear infinite;
	transform-origin: center;
}

/* --- anim --- */
.auto-wiggle {
	animation: idle-wiggle 5s ease-in-out infinite;
}

@keyframes idle-wiggle {
	0%, 88%, 100% { transform: rotate(0); }
	90% { transform: rotate(-12deg); }
	92% { transform: rotate(10deg); }
	94% { transform: rotate(-6deg); }
	96% { transform: rotate(4deg); }
}

.slide-fade-enter-active, .slide-fade-leave-active {
	transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
}
.slide-fade-enter-from, .slide-fade-leave-to {
	opacity: 0;
	width: 0;
	transform: translateX(-15px);
}

@keyframes spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}
</style>
