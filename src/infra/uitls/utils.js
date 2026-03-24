import { ethers } from "ethers";

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

export function getCeiledTime(sec) {
	if (sec <= 0) return { val: 0, unit: 'min' };

	if (sec >= SECONDS_PER_DAY) {
		return { val: Math.ceil(sec / SECONDS_PER_DAY), unit: 'day' };
	}
	if (sec >= SECONDS_PER_HOUR) {
		return { val: Math.ceil(sec / SECONDS_PER_HOUR), unit: 'hour' };
	}
	return { val: Math.ceil(sec / SECONDS_PER_MINUTE), unit: 'min' };
}

export const formatTokenAmount = (amt, decimals, sigFigs = 4) => {
	if (!amt || !decimals || amt === 0n || amt === "0") return "0";

	const formatted = ethers.formatUnits(amt, decimals);
	const num = parseFloat(formatted);
	if (num === 0) return "0";

	return parseFloat(num.toFixed(sigFigs)).toString();
};
