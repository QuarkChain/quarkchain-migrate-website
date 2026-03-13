import { watch, onScopeDispose } from "vue";

export function usePolling(task, intervalMs, enabledRef, opts = {}) {
	const { immediate = true } = opts;
	let timer = null;
	let running = false;

	async function tick() {
		if (running) return;
		running = true;
		try {
			await task();
		} finally {
			running = false;
		}
	}

	function start() {
		stop();
		if (immediate) tick();
		timer = setInterval(tick, intervalMs);
	}

	function stop() {
		if (timer) clearInterval(timer);
		timer = null;
	}

	watch(
			enabledRef,
			(on) => {
				if (on) start();
				else stop();
			},
			{ immediate: true }
	);

	onScopeDispose(stop);

	return { start, stop, tick };
}
