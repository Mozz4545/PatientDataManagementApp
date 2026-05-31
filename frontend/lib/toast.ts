export type ToastType = "success" | "error" | "info";

export type ToastPayload = {
  type: ToastType;
  message: string;
};

export function showToast(type: ToastType, message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastPayload>("radiology-toast", { detail: { type, message } }));
}
