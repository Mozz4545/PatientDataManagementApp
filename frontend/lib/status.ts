const STATUS_LABELS: Record<string, string> = {
  PENDING: "ສ້າງແລ້ວ",
  PENDING_RESULT: "ລໍຖ້າກວດ",
  WAITING: "ກຳລັງລໍຖ້າ",
  WAITING_PAYMENT: "ລໍຖ້າຊຳລະ",
  CALLING: "ກຳລັງເອີ້ນ",
  IN_PROGRESS: "ກຳລັງກວດ",
  COMPLETED: "ກວດສຳເລັດ",
  DONE: "ຈ່າຍແລ້ວ",
  CANCELLED: "ຍົກເລີກແລ້ວ",
  ACTIVE: "ກຳລັງໃຊ້ງານ",
  ADMIN: "ຜູ້ດູແລລະບົບ",
  STAFF: "ພະນັກງານ",
  "ສ້າງແລ້ວ": "ສ້າງແລ້ວ",
  "ລໍຖ້າກວດ": "ລໍຖ້າກວດ",
  "ກຳລັງລໍຖ້າ": "ກຳລັງລໍຖ້າ",
  "ລໍຖ້າຊຳລະ": "ລໍຖ້າຊຳລະ",
  "ກຳລັງເອີ້ນ": "ກຳລັງເອີ້ນ",
  "ກຳລັງກວດ": "ກຳລັງກວດ",
  "ສຳເລັດ": "ສຳເລັດ",
  "ສຳເລັດແລ້ວ": "ກວດສຳເລັດ",
  "ກວດສຳເລັດ": "ກວດສຳເລັດ",
  "ຈ່າຍແລ້ວ": "ຈ່າຍແລ້ວ",
  "ຍັງບໍ່ໄດ້ຈ່າຍ": "ຍັງບໍ່ໄດ້ຈ່າຍ",
  "ບັນທຶກແລ້ວ": "ບັນທຶກແລ້ວ",
  "ລໍຖ້າບັນທຶກ": "ລໍຖ້າບັນທຶກ",
  "ຍົກເລີກແລ້ວ": "ຍົກເລີກແລ້ວ",
};

export function statusKey(status?: string) {
  return String(status || "PENDING").trim().toUpperCase();
}

export function statusLabel(status?: string) {
  const raw = String(status || "PENDING").trim();
  return STATUS_LABELS[raw.toUpperCase()] || STATUS_LABELS[raw] || raw;
}

export function isCancelledStatus(status?: string) {
  const key = statusKey(status);
  return key === "CANCELLED" || status === "ຍົກເລີກແລ້ວ";
}

export function isWaitingQueueStatus(status?: string) {
  const key = statusKey(status);
  return key === "WAITING" || status === "ກຳລັງລໍຖ້າ";
}

export function isCallingQueueStatus(status?: string) {
  return statusKey(status) === "CALLING" || status === "ກຳລັງເອີ້ນ";
}

export function isInProgressStatus(status?: string) {
  return statusKey(status) === "IN_PROGRESS" || status === "ກຳລັງກວດ";
}

export function isCompletedStatus(status?: string) {
  const key = statusKey(status);
  return key === "COMPLETED" || key === "DONE" || status === "ສຳເລັດແລ້ວ" || status === "ກວດສຳເລັດ" || status === "ຈ່າຍແລ້ວ";
}

export function isOpenStatus(status?: string) {
  return !isCancelledStatus(status);
}

export function displayOrderStatus(order: { status?: string; workflow_status?: string | null }) {
  return order.workflow_status || order.status;
}

export function isReadyToPayStatus(status?: string) {
  const key = statusKey(status);
  return key === "WAITING_PAYMENT" || key === "COMPLETED" || status === "ລໍຖ້າຊຳລະ" || status === "ກວດສຳເລັດ";
}
