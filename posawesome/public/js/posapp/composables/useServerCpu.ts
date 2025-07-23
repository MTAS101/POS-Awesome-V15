import { ref, onUnmounted } from "vue";

const API_URL = "/api/method/posawesome.posawesome.api.utilities.get_server_usage";

export function useServerCpu(pollInterval = 10000, windowSize = 60) {
    const cpu = ref<number | null>(null);
    const memory = ref<number | null>(null);
    const history = ref<{ cpu: number | null; memory: number | null }[]>([]);
    const loading = ref(true);
    const error = ref<string | null>(null);
    let timer: number | null = null;

    async function fetchServerCpu() {
        loading.value = true;
        error.value = null;
        try {
            const res = await fetch(API_URL);
            const data = await res.json();
            if (data && data.message) {
                cpu.value = data.message.cpu_percent;
                memory.value = data.message.memory_percent;
                history.value.push({ cpu: cpu.value, memory: memory.value });
                if (history.value.length > windowSize) history.value.shift();
            } else {
                error.value = "No data from server";
            }
        } catch (e) {
            error.value = (e as Error).message;
        } finally {
            loading.value = false;
        }
    }

    fetchServerCpu();
    timer = window.setInterval(fetchServerCpu, pollInterval);

    onUnmounted(() => {
        if (timer) clearInterval(timer);
    });

    return { cpu, memory, history, loading, error };
} 