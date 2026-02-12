<template>
	<div class="bridge-container">
		<p class="page-title">Bridge</p>
		<p class="page-subtitle">
			Bridge tokens between Ethereum and QuarkChain L2
		</p>

		<div class="bridge-card">
			<!-- 方向切换 -->
			<div class="direction-row">
				<span>Ethereum</span>
				<span class="arrow">⇄</span>
				<span>QuarkChain L2</span>
			</div>

			<!-- Token selector -->
			<div class="input-row">
				<p class="label">Select Token</p>
				<el-select placeholder="Select token" class="token-select">
					<el-option label="USDT" value="usdt" />
					<el-option label="USDC" value="usdc" />
				</el-select>
			</div>

			<!-- Amount -->
			<div class="input-row">
				<p class="label">Amount</p>
				<el-input placeholder="0.0">
					<template #append>Token</template>
				</el-input>
			</div>

			<el-button class="bridge-button">
				Bridge
			</el-button>
		</div>
	</div>
</template>

<style scoped lang="less">
.bridge-container {
	width: 750px;
	margin: 45px auto 0;
	padding: 25px;
}
</style>
