import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

// The Axios instance is created once and shared across all API modules.
// Two interceptors handle cross-cutting concerns:
//   1. Request: attach Authorization header from localStorage
//   2. Response: catch 401s globally and redirect to login
//
// Why localStorage for the token?
// Redux store is in-memory — it resets on page refresh.
// localStorage persists across refreshes. On app init, we hydrate
// the Redux store from localStorage (see auth.slice.ts).
// The interceptor reads from localStorage directly so it always
// gets the current token even during Redux hydration.

const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    timeout: 30000,
    headers: {
        "Content-Type": "application/json",
    },
});

// ─── Request interceptor — attach token ───────────────────────────────────────

apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // Read token from localStorage — always current, even during Redux hydration
        const token =
            typeof window !== "undefined"
                ? localStorage.getItem("neurova_token")
                : null;

        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// ─── Response interceptor — handle 401 globally ───────────────────────────────

apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            // Clear auth state and redirect to login.
            // We import the store lazily to avoid circular dependency
            // (store imports slices, slices don't import apiClient).
            if (typeof window !== "undefined") {
                localStorage.removeItem("neurova_token");
                localStorage.removeItem("neurova_user");
                // Hard redirect — clears all in-memory state cleanly
                window.location.href = "/login";
            }
        }

        return Promise.reject(error);
    }
);

export default apiClient;

// ─── Error helper ─────────────────────────────────────────────────────────────

export function extractErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        return error.response?.data?.message ?? error.message ?? "Request failed";
    }
    if (error instanceof Error) return error.message;
    return "An unknown error occurred";
}