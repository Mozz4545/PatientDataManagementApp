import axios from "axios";
import { showToast } from "@/lib/toast";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.message;
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url || "");
    const isLoginPage = typeof window !== "undefined" && window.location.pathname === "/login";
    const isAuthProbe = requestUrl.includes("/auth/me");
    if (typeof window !== "undefined" && message && !(status === 401 && (isLoginPage || isAuthProbe))) {
      showToast("error", message);
    }
    return Promise.reject(error);
  }
);

export default api;
