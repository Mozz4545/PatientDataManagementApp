export const SESSION_IDLE_TIMEOUT_MS = 60 * 60 * 1000;
export const SESSION_ACTIVITY_KEY = "radiology_last_activity";

export function markSessionActivity(timestamp = Date.now()) {
  localStorage.setItem(SESSION_ACTIVITY_KEY, String(timestamp));
  return timestamp;
}

export function getLastSessionActivity() {
  const value = Number(localStorage.getItem(SESSION_ACTIVITY_KEY));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function clearClientSession() {
  localStorage.removeItem("radiology_user");
  localStorage.removeItem(SESSION_ACTIVITY_KEY);
}
