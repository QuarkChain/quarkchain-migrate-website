<template>
	<div class="bridge-container">
		<p class="bridge-message">
			Bridge assets between Ethereum and QuarkChain L2 securely and seamlessly.
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
	{ label: 'USDC', value: 'USDC', icon: usdcIcon }
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
	width: 700px;
	margin: 50px auto 0;
	padding: 30px;
}

.bridge-message {
	font-style: normal;
	font-weight: 500;
	font-size: 18px;
	line-height: 22px;
	color: #181ea9;
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
		gap: 12px;
	}
}

.bridge-card {
	margin-top: 20px;
	padding: 30px 25px;
	border: 1px solid rgba(24, 30, 169, 0.15);
	border-radius: 12px;
	background: #fff;
	box-shadow: 0 4px 16px rgba(24, 30, 169, 0.06);

	.network-row {
		display: flex;
		align-items: center;
		justify-content: space-between;

		.network-box {
			flex: 1;
			border: 1px solid rgba(24, 30, 169, 0.1);
			background: #FAFCFF;
			padding: 18px 20px;
			border-radius: 12px;
			cursor: pointer;
			display: flex;
			flex-direction: row;
			align-items: center;
			transition: all 0.3s ease;

			.network-icon {
				width: 52px;
				height: 52px;
				padding: 4px;
				border-radius: 20%;
				object-fit: cover;
			}

			.text {
				display: flex;
				flex-direction: column;
				line-height: 1.3;

				.label {
					font-size: 14px;
					color: #666666;
					margin-bottom: 2px;
				}
				.value {
					font-size: 17px;
					color: #1a1a1a;
					font-weight: 600;
					transition: color 0.3s ease;
				}
			}
		}
		.network-box:hover {
			box-shadow: 0 2px 6px rgba(24, 30, 169, 0.1);
			.text .value {
				color: #181ea9;
			}
		}
		.left {
			justify-content: flex-start;
		}
		.right {
			justify-content: flex-end;
		}
		.network-box.left .text {
			margin-left: 15px;
			align-items: flex-start;
			text-align: left;
		}
		.network-box.right .text {
			margin-right: 15px;
			align-items: flex-end;
			text-align: right;
		}

		.switch-btn {
			margin: 0 12px;
			background: #181ea9;
			color: #fff;
			border-color: #181ea9;
			transition: all 0.3s ease;
		}
		.switch-btn:hover {
			box-shadow: 0 3px 10px rgba(24, 30, 169, 0.25);
			background: #12168a;
			border-color: #12168a;
			color: #fff;
		}
	}


	.amount-box {
		margin-top: 22px;
		border: 1px solid rgba(24, 30, 169, 0.1);
		background: #FAFCFF;
		padding: 20px;
		border-radius: 12px;

		.token-option {
			display: flex;
			align-items: center;
			gap: 10px;

			.token-icon {
				width: 22px;
				height: 22px;
				border-radius: 50%;
				object-fit: cover;
			}
			.token-text {
				color: #1a1a1a;
				font-weight: 500;
				font-family: CoinbaseDisplay;
			}
		}

		.balance-row {
			display: flex;
			justify-content: space-between;
			margin-top: 18px;
			font-size: 14px;
			color: #666666;

			.max-btn {
				background: #181ea9;
				border: none;
				border-radius: 24px;
				padding: 6px 16px;
				font-size: 13px;
				font-weight: 600;
				color: #fff;
				transition: all 0.3s ease;
			}
			.max-btn:hover {
				box-shadow: 0 3px 10px rgba(24, 30, 169, 0.25);
				background: #12168a;
				color: #fff;
			}
		}
	}

	:deep(.amount-input .el-input__wrapper) {
		box-shadow: none !important;
		background: transparent !important;
		padding: 0 4px;
		border: none;
	}

	:deep(.amount-input input) {
		font-size: 28px;
		font-weight: 600;
		color: #1a1a1a;
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
		border-radius: 20px !important;
		border: 1px solid rgba(24, 30, 169, 0.2) !important;
		box-shadow: none !important;
		padding: 0 14px !important;
		min-height: 40px;
		display: flex;
		align-items: center;
		transition: border-color 0.3s ease;
	}

	:deep(.token-select .el-select__wrapper:hover) {
		border-color: #181ea9 !important;
	}
}
</style>
