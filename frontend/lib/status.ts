const STATUS_KEYS: Record<string, string> = {
  PENDING: "PENDING",
  WAITING: "PENDING",
  PENDING_RESULT: "PENDING_RESULT",
  CALLING: "CALLING",
  IN_PROGRESS: "PENDING_RESULT",
  COMPLETED: "WAITING_PAYMENT",
  WAITING_PAYMENT: "WAITING_PAYMENT",
  DONE: "DONE",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
  VOID: "VOID",
  REFUNDED: "REFUNDED",
  ACTIVE: "ACTIVE",
  ADMIN: "ADMIN",
  STAFF: "STAFF",
  "ສ້າງແລ້ວ": "PENDING",
  "ລໍຖ້າກວດ": "PENDING",
  "ກຳລັງລໍຖ້າ": "PENDING",
  "ກຳລັງເອີ້ນ": "CALLING",
  "ເອີ້ນຄິວ": "CALLING",
  "ກຳລັງກວດ": "PENDING_RESULT",
  "ລໍຖ້າບັນທຶກ": "PENDING_RESULT",
  "ລໍຖ້າບັນທຶກຜົນກວດ": "PENDING_RESULT",
  "ບັນທຶກແລ້ວ": "WAITING_PAYMENT",
  "ກວດສຳເລັດ": "WAITING_PAYMENT",
  "ສຳເລັດແລ້ວ": "WAITING_PAYMENT",
  "ລໍຖ້າຊຳລະ": "WAITING_PAYMENT",
  "ຄ້າງຊຳລະ": "WAITING_PAYMENT",
  "ຈ່າຍແລ້ວ": "PAID",
  "ສຳເລັດ": "DONE",
  "ຍັງບໍ່ໄດ້ຈ່າຍ": "UNPAID",
  "ຍົກເລີກແລ້ວ": "CANCELLED",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "ລໍຖ້າກວດ",
  PENDING_RESULT: "ລໍຖ້າບັນທຶກຜົນກວດ",
  CALLING: "ເອີ້ນຄິວ",
  WAITING_PAYMENT: "ຄ້າງຊຳລະ",
  DONE: "ສຳເລັດ",
  PAID: "ຈ່າຍແລ້ວ",
  UNPAID: "ຍັງບໍ່ໄດ້ຈ່າຍ",
  CANCELLED: "ຍົກເລີກແລ້ວ",
  VOID: "Void",
  REFUNDED: "Refund",
  ACTIVE: "ກຳລັງໃຊ້ງານ",
  ADMIN: "ຜູ້ດູແລລະບົບ",
  STAFF: "ພະນັກງານ",
};

export function statusKey(status?: string) {
  const raw = String(status || "PENDING").trim();
  return STATUS_KEYS[raw.toUpperCase()] || STATUS_KEYS[raw] || raw.toUpperCase();
}

export function statusLabel(status?: string) {
  const key = statusKey(status);
  return STATUS_LABELS[key] || String(status || "");
}

export function isCancelledStatus(status?: string) {
  return statusKey(status) === "CANCELLED";
}

export function isWaitingQueueStatus(status?: string) {
  return statusKey(status) === "PENDING";
}

export function isCallingQueueStatus(status?: string) {
  return statusKey(status) === "CALLING";
}

export function isInProgressStatus(status?: string) {
  return statusKey(status) === "PENDING_RESULT";
}

export function isCompletedStatus(status?: string) {
  const key = statusKey(status);
  return key === "DONE" || key === "PAID";
}

export function isOpenStatus(status?: string) {
  return !isCancelledStatus(status);
}

export function displayOrderStatus(order: { status?: string; workflow_status?: string | null }) {
  return order.workflow_status || order.status;
}

export function isReadyToPayStatus(status?: string) {
  return statusKey(status) === "WAITING_PAYMENT";
}
