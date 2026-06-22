export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export type User = {
  staff_id?: number;
  id?: number;
  username: string;
  staff_name?: string;
  name?: string;
  role: "ADMIN" | "STAFF" | string;
  position?: string;
};

export type Staff = {
  staff_id: number;
  staff_name: string;
  position?: string | null;
  department?: string | null;
  phone?: string | null;
  username: string;
  role: "ADMIN" | "STAFF" | string;
  is_active?: number | boolean;
  deleted_at?: string | null;
  created_at?: string;
};

export type Patient = {
  patient_id: number;
  first_name: string;
  last_name: string;
  age?: number | null;
  gender?: "M" | "F" | "Other" | string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  emergency_phone?: string | null;
  is_active?: number | boolean;
  deleted_at?: string | null;
  created_at?: string;
};

export type Order = {
  order_id: number;
  document_no?: string | null;
  billing_no?: string | null;
  patient_id: number;
  exam_type_id: number;
  staff_id: number;
  order_date: string;
  note?: string | null;
  status: string;
  workflow_status?: string | null;
  result_id?: number | null;
  payment_id?: number | null;
  first_name?: string;
  last_name?: string;
  exam_name?: string;
  exam_price?: number | string | null;
  staff_name?: string;
};

export type ExamType = {
  exam_type_id: number;
  exam_name: string;
  description?: string | null;
  price: number | string;
  is_active?: number | boolean;
  deleted_at?: string | null;
};

export type Queue = {
  queue_id: number;
  order_id: number;
  queue_no: number;
  queue_date: string;
  status: string;
  called_at?: string | null;
  first_name?: string;
  last_name?: string;
  exam_name?: string;
};

export type QueueDisplay = {
  current: Queue | null;
  recent: Queue[];
};

export type Payment = {
  payment_id: number;
  order_id: number;
  staff_id: number;
  amount: number | string;
  payment_date: string;
  payment_type?: string;
  receipt_no?: string | null;
  status?: "PAID" | "VOID" | "REFUNDED" | string;
  adjustment_reason?: string | null;
  adjusted_by?: number | null;
  adjusted_at?: string | null;
  first_name?: string;
  last_name?: string;
  staff_name?: string;
  exam_name?: string;
  exam_price?: number | string | null;
  order_status?: string;
};

export type Result = {
  result_id: number;
  report_no?: string | null;
  order_id: number;
  patient_id?: number;
  staff_id: number;
  result_detail: string;
  result_image_url?: string | null;
  result_date: string;
  staff_name?: string;
  first_name?: string;
  last_name?: string;
  patient_phone?: string | null;
  exam_name?: string;
  order_date?: string;
  order_status?: string;
};

export type AuditLog = {
  audit_log_id: number;
  staff_id?: number | null;
  actor_name?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  description: string;
  metadata?: Record<string, unknown> | string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
};

export type AuditLogResponse = {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  summary: {
    total: number;
    today: number;
    last_7_days: number;
    actors: number;
  };
};
