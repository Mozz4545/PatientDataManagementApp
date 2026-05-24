import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// เพิ่ม token จาก localStorage เมื่อมี
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
