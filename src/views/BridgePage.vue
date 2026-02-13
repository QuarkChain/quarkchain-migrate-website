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
				<div class="network-box" @click="selectFrom">
					<span class="label">From</span>
					<span class="value">{{ fromNetwork }}</span>
				</div>

				<el-button circle @click="switchNetwork">
					<el-icon>
						<Switch/>
					</el-icon>
				</el-button>

				<div class="network-box" @click="selectTo">
					<span class="label">To</span>
					<span class="value">{{ toNetwork }}</span>
				</div>
			</div>

			<!-- Amount -->
			<div class="amount-box">
				<el-input
						v-model="amount"
						placeholder="0"
						size="large"
						type="number"
				>
					<template #append>
						<el-select v-model="token" style="width: 100px">
							<el-option label="USDC" value="USDC"/>
							<el-option label="ETH" value="ETH"/>
						</el-select>
					</template>
				</el-input>

				<div class="balance-row">
					<span>Balance: {{ balance }} {{ token }}</span>
					<el-button link @click="setMax">MAX</el-button>
				</div>
			</div>
		</el-card>
	</div>
</template>

<script setup>
import { ref } from "vue"
import { Refresh, Switch } from '@element-plus/icons-vue'

const pendingCount = ref(1)

const fromNetwork = ref('Sepolia')
const toNetwork = ref('L2 Testnet')

const amount = ref('')
const token = ref('USDC')
const balance = ref(19.89)

function switchNetwork() {
	const temp = fromNetwork.value
	fromNetwork.value = toNetwork.value
	toNetwork.value = temp
}

function selectFrom() {
	console.log('open from network selector')
}

function selectTo() {
	console.log('open to network selector')
}

function setMax() {
	amount.value = balance.value.toString()
}
</script>


<style scoped lang="less">
.bridge-container {
	width: 750px;
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
	padding: 25px 30px;
	border: 1px solid rgba(24, 30, 169, 0.3);
	border-radius: 8px;

	.network-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20px;
	}

	.network-box {
		flex: 1;
		background: #f5f7fa;
		padding: 16px;
		border-radius: 12px;
		cursor: pointer;
	}

	.network-box .label {
		font-size: 12px;
		color: #909399;
	}

	.network-box .value {
		font-size: 16px;
		font-weight: 600;
	}

	.amount-box {
		margin-top: 10px;
	}

	.balance-row {
		display: flex;
		justify-content: space-between;
		margin-top: 6px;
		font-size: 13px;
		color: #909399;
	}
}
</style>
