import { ref, onUnmounted } from "vue";

const API_URL = "/api/method/posawesome.posawesome.api.utilities.get_server_usage";

export function useServerCpu(pollInterval = 10000, windowSize = 60) {
    const cpu = ref(null);
    const memory = ref(null);
    const history = ref([]);
    const loading = ref(true);
    const error = ref(null);
    let timer = null;

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
            error.value = e.message;
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