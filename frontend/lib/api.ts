import axios from "axios";
import { showToast } from "@/lib/toast";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window === "undefined") return config;

  const token = localStorage.getItem("radiology_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
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

if (typeof window !== "undefined") {
  const token = localStorage.getItem("radiology_token");
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
}

export const setAuthToken = (token?: string) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export default api;
