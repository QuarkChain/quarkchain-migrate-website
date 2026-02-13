<template>
	<div class="bridge-container">
		<p class="bridge-message">
			Bridge tokens between Ethereum and QuarkChain L2
		</p>

		<div class="bridge-header">
			<div></div>
			<div class="header-actions">
				<el-badge :value="pendingCount">
					<el-button >
						<el-icon><Refresh /></el-icon>
					</el-button>
				</el-badge>
			</div>
		</div>

		<el-card class="bridge-card">
			<!-- Network Select -->
			<div class="network-row">
				<div class="network-box left" @click="switchNetwork">
					<img class="network-icon" :src="getIcon(fromNetwork)" />
					<div class="text">
						<span class="label">From</span>
						<span class="value">{{ fromNetwork }}</span>
					</div>
				</div>

				<el-button class="switch-btn" circle @click="switchNetwork">
					<el-icon><Switch/></el-icon>
				</el-button>

				<div class="network-box right" @click="switchNetwork">
					<div class="text">
						<span class="label">To</span>
						<span class="value">{{ toNetwork }}</span>
					</div>
					<img class="network-icon" :src="getIcon(toNetwork)" />
				</div>
			</div>

			<!-- Amount -->
			<div class="amount-box">
				<el-input
						v-model="amount"
						placeholder="0"
						size="large"
						type="number"
						class="amount-input"
				>
					<template #append>
						<el-select v-model="token" class="token-select">
							<template #prefix>
								<div class="token-option">
									<img :src="tokens.find(t => t.value === token).icon" class="token-icon" />
									<span class="token-text">{{ token }}</span>
								</div>
							</template>

							<el-option
									v-for="item in tokens"
									:key="item.value"
									:label="item.label"
									:value="item.value"
							>
								<div style="display:flex; align-items: center; gap: 8px;">
									<img :src="item.icon" style="width:20px; height:20px; border-radius:50%; object-fit: cover;" />
									<span style="color: #000; font-family: CoinbaseSans;">{{ item.label }}</span>
								</div>
							</el-option>
						</el-select>
					</template>
				</el-input>

				<div class="balance-row">
					<span>Balance: {{ balance }} {{ token }}</span>
					<el-button class="max-btn" @click="setMax">MAX</el-button>
				</div>
			</div>
		</el-card>
	</div>
</template>

<script setup>
import { ref } from "vue"
import { Refresh, Switch } from '@element-plus/icons-vue'
import ethereumIcon from '@/assets/l1.svg'
import quarkIcon from '@/assets/quarkchain.svg'
import usdcIcon from '@/assets/usdc.png'

const tokens = [
	{ label: 'USDC', value: 'USDC', icon: usdcIcon },
	{ label: 'USDT', value: 'USDT', icon: usdcIcon }
]

const pendingCount = ref(1)

const fromNetwork = ref('Ethereum')
const toNetwork = ref('QuarkChain L2')

const token = ref('USDC')
const amount = ref('')
const balance = ref(19.89)

function switchNetwork() {
	const temp = fromNetwork.value
	fromNetwork.value = toNetwork.value
	toNetwork.value = temp
}

function getIcon(name) {
	const map = {
		'Ethereum': ethereumIcon,
		'QuarkChain L2': quarkIcon
	}
	return map[name]
}

function setMax() {
	amount.value = balance.value.toString()
}
</script>


<style scoped lang="less">
.bridge-container {
	width: 650px;
	margin: 45px auto 0;
	padding: 25px;
}

.bridge-message {
	font-style: normal;
	font-weight: 300;
	font-size: 17px;
	line-height: 19px;
	color: #1722b2;
	opacity: 0.7;
	text-align: left;
	font-family: CoinbaseSans;
}

.bridge-header {
	margin-top: 45px;
	display: flex;
	justify-content: space-between;
	align-items: center;

	.header-actions {
		display: flex;
		gap: 8px;
	}
}

.bridge-card {
	margin-top: 16px;
	padding: 25px 20px;
	border: 1px solid rgba(24, 30, 169, 0.3);
	border-radius: 8px;

	.network-row {
		display: flex;
		align-items: center;
		justify-content: space-between;

		.network-box {
			flex: 1;
			border: 1px solid rgba(24, 30, 169, 0.1);
			background: #FAFCFF;
			padding: 16px;
			border-radius: 12px;
			cursor: pointer;
			display: flex;
			flex-direction: row;
			align-items: center;
			transition: box-shadow 0.2s ease;

			.network-icon {
				width: 48px;
				height: 48px;
				padding: 3px;
				border-radius: 18%;
				object-fit: cover;
			}

			.text {
				display: flex;
				flex-direction: column;
				line-height: 1.2;

				.label {
					font-size: 14px;
					color: #909399;
				}
				.value {
					font-size: 16px;
					color: rgb(24, 30, 169);
					font-weight: 600;
				}
			}
		}
		.network-box:hover {
			box-shadow: 0 2px 6px rgba(24,30,169,0.15);
		}
		.left {
			justify-content: flex-start;
		}
		.right {
			justify-content: flex-end;
		}
		.network-box.left .text {
			margin-left: 12px;
			align-items: flex-start;
			text-align: left;
		}
		.network-box.right .text {
			margin-right: 12px;
			align-items: flex-end;
			text-align: right;
		}

		.switch-btn {
			margin: 0 10px;
			transition: box-shadow 0.2s ease;
		}
		.switch-btn:hover {
			box-shadow: 0 2px 6px rgba(24,30,169,0.15);
			background-color: inherit !important;
			border-color: inherit !important;
			color: rgba(24,30,169,0.5) !important;
		}
	}


	.amount-box {
		margin-top: 12px;
		border: 1px solid rgba(24, 30, 169, 0.1);
		background: #FAFCFF;
		padding: 16px;
		border-radius: 12px;

		.token-option {
			display: flex;
			align-items: center;
			gap: 8px;

			.token-icon {
				width: 20px;
				height: 20px;
				border-radius: 50%;
				object-fit: cover;
			}
			.token-text {
				color: #000;
				font-family: CoinbaseDisplay;
			}
		}

		.balance-row {
			display: flex;
			justify-content: space-between;
			margin-top: 16px;
			font-size: 13px;
			color: #71717a;

			.max-btn {
				background: #fff;
				border: 1px solid rgba(24, 30, 169, 0.1);
				border-radius: 20px;
				padding: 4px 12px;
				font-size: 12px;
				font-weight: 600;
				color: #181EA9;
				transition: box-shadow 0.2s ease;
			}
			.max-btn:hover {
				box-shadow: 0 2px 6px rgba(24,30,169,0.15);
			}
		}
	}
	:deep(.amount-input .el-input__wrapper) {
		box-shadow: none !important;
		background: transparent !important;
		padding: 0;
	}
	:deep(.amount-input input) {
		font-size: 26px;
		font-weight: 600;
		color: #000;
		font-family: CoinbaseSansBlob;
	}
	:deep(input[type="number"]::-webkit-outer-spin-button),
	:deep(input[type="number"]::-webkit-inner-spin-button) {
		-webkit-appearance: none;
		margin: 0;
	}

	:deep(.amount-input .el-input-group__append) {
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
	}
	:deep(.token-select .el-select__wrapper) {
		background: #fff !important;
		border-radius: 18px !important;
		border: 1px solid rgba(24, 30, 169, 0.3) !important;
		box-shadow: none !important;
		padding: 0 12px !important;
		min-height: 36px;
		display: flex;
		align-items: center;
	}
}
</style>
