// Network-related composable functions for Home.vue

export function setupNetworkListeners() {
    // Listen for network status changes
    window.addEventListener("online", () => {
        this.networkOnline = true;
        console.log("Network: Online");
        // Verify actual connectivity
        this.checkNetworkConnectivity();
    });

    window.addEventListener("offline", () => {
        this.networkOnline = false;
        this.serverOnline = false;
        window.serverOnline = false;
        console.log("Network: Offline");
        this.$forceUpdate();
    });

    // Initial network status
    this.networkOnline = navigator.onLine;
    this.checkNetworkConnectivity();

    // Periodic network check every 15 seconds
    setInterval(() => {
        if (navigator.onLine) {
            this.checkNetworkConnectivity();
        }
    }, 15000);
}

export async function checkNetworkConnectivity() {
    try {
        let isConnected = false;

        // Strategy 1: Try Frappe's desk endpoint (always available)
        try {
            const response = await fetch("/app", {
                method: "HEAD",
                cache: "no-cache",
                signal: AbortSignal.timeout(5000),
            });
            if (response.status < 500) {
                isConnected = true;
            }
        } catch (error) {
            console.log("Desk endpoint check failed:", error.message);
        }

        // Strategy 2: Try a static asset if desk fails
        if (!isConnected) {
            try {
                const response = await fetch("/assets/frappe/images/frappe-logo.svg", {
                    method: "HEAD",
                    cache: "no-cache",
                    signal: AbortSignal.timeout(3000),
                });
                if (response.status < 500) {
                    isConnected = true;
                }
            } catch (error) {
                console.log("Static asset check failed:", error.message);
            }
        }

        // Strategy 3: Try current page origin as last resort
        if (!isConnected) {
            try {
                const response = await fetch(window.location.origin, {
                    method: "HEAD",
                    cache: "no-cache",
                    signal: AbortSignal.timeout(3000),
                });
                if (response.status < 500) {
                    isConnected = true;
                }
            } catch (error) {
                console.log("Origin check failed:", error.message);
            }
        }

        if (isConnected) {
            this.networkOnline = true;
            this.serverOnline = true;
            window.serverOnline = true;
            this.serverConnecting = false;
            console.log("Network: Connected");
        } else {
            this.networkOnline = navigator.onLine;
            this.serverOnline = false;
            window.serverOnline = false;
            this.serverConnecting = false;
            console.log("Network: Disconnected");
        }

        this.$forceUpdate();
    } catch (error) {
        console.warn("Network connectivity check failed:", error);
        this.networkOnline = navigator.onLine;
        this.serverOnline = false;
        window.serverOnline = false;
        this.serverConnecting = false;
        this.$forceUpdate();
    }
}

export function detectHostType(hostname) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::/;
    const localhostVariants = ["localhost", "127.0.0.1", "::1", "0.0.0.0"];
    return (
        ipv4Regex.test(hostname) ||
        ipv6Regex.test(hostname) ||
        localhostVariants.includes(hostname.toLowerCase())
    );
}

export async function performConnectivityChecks(hostname, protocol, port) {
    const checks = [];
    checks.push(this.checkFrappePing());
    checks.push(this.checkCurrentOrigin(protocol, hostname, port));

    if (!this.isIpHost) {
        checks.push(this.checkExternalConnectivity());
    }

    if (frappe.realtime && frappe.realtime.socket) {
        checks.push(this.checkWebSocketConnectivity());
    }

    try {
        const results = await Promise.allSettled(checks);
        return results.some(
            (result) => result.status === "fulfilled" && result.value === true
        );
    } catch (error) {
        console.warn("All connectivity checks failed:", error);
        return false;
    }
}

export async function checkFrappePing() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch("/api/method/ping", {
            method: "HEAD",
            cache: "no-cache",
            signal: controller.signal,
            headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                Pragma: "no-cache",
                Expires: "0",
            },
        });

        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        if (error.name !== "AbortError") {
            console.warn("Frappe ping check failed:", error);
        }
        return false;
    }
}

export async function checkCurrentOrigin(protocol, hostname, port) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const baseUrl = `${protocol}//${hostname}${port ? ":" + port : ""}`;
        const response = await fetch(`${baseUrl}/api/method/frappe.auth.get_logged_user`, {
            method: "HEAD",
            cache: "no-cache",
            signal: controller.signal,
            headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
        });
        clearTimeout(timeoutId);
        return response.status < 500;
    } catch (error) {
        if (error.name !== "AbortError") {
            console.warn("Current origin check failed:", error);
        }
        return false;
    }
}

export async function checkExternalConnectivity() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        await fetch("https://httpbin.org/status/200", {
            method: "HEAD",
            mode: "no-cors",
            cache: "no-cache",
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return true;
    } catch (error) {
        if (error.name !== "AbortError") {
            console.warn("External connectivity check failed:", error);
        }
        return false;
    }
}

export async function checkWebSocketConnectivity() {
    try {
        if (frappe.realtime && frappe.realtime.socket) {
            const socketState = frappe.realtime.socket.readyState;
            return socketState === 1; // WebSocket.OPEN
        }
        return false;
    } catch (error) {
        console.warn("WebSocket connectivity check failed:", error);
        return false;
    }
}

