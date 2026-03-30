// store/txStore.js
import { ref, computed } from "vue";
import { BRIDGE_STATUS } from "@/config/constant.js";

export const txList = ref([]);
export const syncing = ref(false);

export const FINAL_STATUS = [BRIDGE_STATUS.COMPLETED, BRIDGE_STATUS.FAILED];
export const hasAction = computed(() => txList.value.some(tx => !FINAL_STATUS.includes(tx.status)));
