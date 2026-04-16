export async function fetchWithTimeout(input, init = {}, timeoutMs = getDefaultTimeoutMs()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutMs}ms`);
        }
        throw error;
    }
    finally {
        clearTimeout(timer);
    }
}
function getDefaultTimeoutMs() {
    const raw = process.env.MCPKG_HTTP_TIMEOUT_MS;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10000;
}
