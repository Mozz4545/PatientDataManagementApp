"use client";

import Link from "next/link";
import { displayOrderStatus, isCancelledStatus, statusKey, statusLabel } from "@/lib/status";
import type { Order, Queue } from "@/lib/types";

export const examOptions = [
  { id: 1, name: "X-Ray Chest" },
  { id: 2, name: "CT Abdomen" },
  { id: 3, name: "MRI Brain" },
  { id: 4, name: "Ultrasound" },
];

export function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatDate(value)}, ${date.toLocaleTimeString("en-GB", { hour12: false })}`;
}

export function patientName(item: { first_name?: string; last_name?: string }) {
  return [item.first_name, item.last_name].filter(Boolean).join(" ") || "-";
}

export function statusTone(status?: string) {
  const normalized = statusKey(status);
  if (normalized === "DONE" || normalized === "PAID") {
    return "bg-[#bafbd2] text-[#137547]";
  }
  if (normalized === "WAITING_PAYMENT") return "bg-[#fff7a5] text-[#a77b00]";
  if (normalized === "PENDING") return "bg-[#fff7a5] text-[#a77b00]";
  if (normalized === "PENDING_RESULT") return "bg-[#c7a0ff] text-[#0345aa]";
  if (normalized === "UNPAID") return "bg-[#fff7a5] text-[#a77b00]";
  if (normalized === "CALLING") return "bg-[#addbf4] text-[#123879]";
  if (normalized === "CANCELLED") return "bg-[#ff9fa6] text-[#b00000]";
  return "bg-[#ffeaa3] text-[#a16a00]";
}

export function PageHero({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b border-[#dedede] px-4 py-5 shadow-sm sm:px-6 sm:py-6 md:px-8 lg:px-10 lg:py-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold leading-tight text-[#120d34] sm:text-[28px] lg:text-[32px]">{title}</h2>
          <p className="mt-2 text-sm font-semibold text-[#7d798e] sm:text-base lg:text-lg">{subtitle}</p>
        </div>
        {children && <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-3 xl:justify-end">{children}</div>}
      </div>
    </section>
  );
}

export function ActionButton({
  children,
  tone = "cream",
  onClick,
  href,
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  tone?: "green" | "cream" | "blue" | "red" | "violet" | "orange";
  onClick?: () => void;
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const tones = {
    green: "bg-[#99fba6] hover:bg-[#86f596]",
    cream: "bg-[#f4e3b0] hover:bg-[#ecd38d]",
    blue: "bg-[#addbf4] hover:bg-[#99d1ee]",
    red: "bg-[#efabab] hover:bg-[#e79595]",
    violet: "bg-[#8c7cff] text-white hover:bg-[#7867f0]",
    orange: "bg-[#ff6b00] text-white hover:bg-[#ee6300]",
  };
  const className = `inline-flex min-h-10 w-full items-center justify-center rounded-lg px-4 text-center text-sm font-semibold text-black shadow-sm transition sm:min-h-11 sm:w-auto sm:px-5 sm:text-base ${tones[tone]} ${
    disabled ? "cursor-not-allowed opacity-50" : ""
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

export function DataState({
  type,
  message,
  onRetry,
  compact = false,
}: {
  type: "loading" | "empty" | "error";
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const content = message || (type === "loading"
    ? "ກຳລັງໂຫຼດຂໍ້ມູນ..."
    : type === "empty"
      ? "ບໍ່ມີຂໍ້ມູນ"
      : "ບໍ່ສາມາດໂຫຼດຂໍ້ມູນໄດ້");

  return (
    <div className={`rounded-xl border text-center font-semibold ${compact ? "p-4 text-sm" : "p-6 text-sm sm:p-8"} ${
      type === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-[#f7f8fb] text-[#767285]"
    }`}>
      {type === "loading" && <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-[#123879]" />}
      <div>{content}</div>
      {type === "error" && onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-[#123879] px-5 py-2 text-sm font-bold text-white shadow-sm">
          ລອງໃໝ່
        </button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  if (totalItems <= pageSize) return null;

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl bg-[#f7f8fb] px-4 py-3 sm:flex-row">
      <div className="text-xs font-bold text-[#767285]">
        ໜ້າ {currentPage.toLocaleString("lo-LA")} ຈາກ {totalPages.toLocaleString("lo-LA")} · {totalItems.toLocaleString("lo-LA")} ລາຍການ
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className="rounded-lg bg-white px-4 py-2 text-sm font-bold shadow-sm disabled:opacity-40">
          ກ່ອນໜ້າ
        </button>
        <button type="button" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} className="rounded-lg bg-[#123879] px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-40">
          ຖັດໄປ
        </button>
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="min-h-[112px] rounded-2xl bg-[#f3f3f3] px-4 py-4 sm:min-h-[128px] sm:px-5">
      <div className="flex items-center gap-2.5 text-sm font-bold sm:text-base">
        <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="min-w-0 break-words">{label}</span>
      </div>
      <div className="mt-3 h-0.5 sm:mt-4" style={{ backgroundColor: color }} />
      <div
        className="mt-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#dedede] text-3xl font-bold sm:mt-4 sm:h-16 sm:w-16 sm:text-[34px]"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status?: string }) {
  return (
    <span className={`inline-flex min-w-[72px] justify-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusTone(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

export function Panel({
  title,
  dot = "#17e72f",
  children,
}: {
  title: string;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-[#d9d9d9] bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-4 flex min-w-0 items-center gap-2.5 text-lg font-bold sm:mb-5 sm:text-xl">
        <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
        <span className="min-w-0 break-words">{title}</span>
      </h3>
      {children}
    </section>
  );
}

export function OrdersTable({
  orders,
  onCancel,
  highlightFirst,
}: {
  orders: Order[];
  onCancel?: (order: Order) => void;
  highlightFirst?: boolean;
}) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {orders.length === 0 ? (
          <div className="rounded-xl bg-[#f7f8fb] p-5 text-center text-sm font-bold text-[#767285]">ບໍ່ມີຂໍ້ມູນ</div>
        ) : (
          orders.map((order) => (
            <article key={order.order_id} className="rounded-xl border border-[#d9d9d9] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-[#123879]">ໃບສັ່ງ #{String(order.order_id).padStart(4, "0")}</div>
                  <div className="mt-1 text-sm font-bold">{patientName(order)}</div>
                </div>
                <StatusPill status={displayOrderStatus(order)} />
              </div>
              <div className="mt-3 grid gap-2 text-xs font-semibold text-[#767285]">
                <div><span className="text-[#120d34]">ປະເພດກວດ:</span> {order.exam_name || examOptions.find((item) => item.id === order.exam_type_id)?.name || "-"}</div>
                <div><span className="text-[#120d34]">ວັນທີ:</span> {formatDateTime(order.order_date)}</div>
              </div>
              {onCancel && canCancelOrder(order) && (
                <button type="button" onClick={() => onCancel(order)} className="mt-3 w-full rounded-lg bg-[#efabab] px-4 py-2 text-sm font-bold">
                  ຍົກເລີກໃບສັ່ງກວດ
                </button>
              )}
            </article>
          ))
        )}
      </div>
      <div className="hidden overflow-x-auto rounded-xl shadow-sm md:block">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead className="bg-[#f2f2f2] text-xs font-bold">
          <tr>
            <th className="px-5 py-3">ເລກທີ</th>
            <th className="px-5 py-3">ຊື່ ແລະ ນາມສະກຸນ</th>
            <th className="px-5 py-3">ປະເພດກວດ</th>
            <th className="px-5 py-3">ວັນທີ ແລະ ເວລາ</th>
            <th className="px-5 py-3">ສະຖານະ</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="text-xs text-[#767285]">
          {orders.length === 0 ? (
            <tr>
              <td className="px-5 py-6 text-center" colSpan={6}>
                ບໍ່ມີຂໍ້ມູນ
              </td>
            </tr>
          ) : (
            orders.map((order, index) => (
              <tr
                key={order.order_id}
                className={`border-t border-[#d7d7d7] ${
                  highlightFirst && index === 0 ? "bg-[#d5ffd8]" : isCancelledStatus(order.status) ? "bg-[#ffd4d6]" : ""
                }`}
              >
                <td className="px-5 py-3">
                  <span className="rounded-lg bg-[#f0ecff] px-2.5 py-1 font-bold">{String(order.order_id).padStart(2, "0")}</span>
                </td>
                <td className="px-5 py-3">{patientName(order)}</td>
                <td className="px-5 py-3">{order.exam_name || examOptions.find((item) => item.id === order.exam_type_id)?.name || "-"}</td>
                <td className="px-5 py-3">{formatDateTime(order.order_date)}</td>
                <td className="px-5 py-3">
                  <StatusPill status={displayOrderStatus(order)} />
                </td>
                <td className="px-5 py-3 text-right">
                  {onCancel && canCancelOrder(order) && (
                    <button
                      type="button"
                      onClick={() => onCancel(order)}
                      className="text-xl leading-none text-[#234154]"
                      aria-label="ຍົກເລີກໃບສັ່ງກວດ"
                    >
                      x
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </>
  );
}

function canCancelOrder(order: Order) {
  const workflowStatus = displayOrderStatus(order);
  const workflowKey = statusKey(workflowStatus);
  return !isCancelledStatus(workflowStatus) && (workflowKey === "PENDING" || workflowKey === "PENDING_RESULT");
}

export function QueuesTable({
  queues,
  accent = "cyan",
  onCall,
}: {
  queues: Queue[];
  accent?: "cyan" | "light";
  onCall?: (queue: Queue) => void;
}) {
  return (
    <>
    <div className="space-y-3 md:hidden">
      {queues.length === 0 ? (
        <DataState type="empty" compact />
      ) : queues.map((queue) => (
        <article key={queue.queue_id} className="rounded-xl border border-[#d9d9d9] bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div><div className="text-xs font-bold text-[#1e66ff]">ຄິວ {String(queue.queue_no).padStart(2, "0")}</div><div className="mt-1 font-bold">{patientName(queue)}</div></div>
            <StatusPill status={queue.status} />
          </div>
          <div className="mt-3 space-y-1 text-xs font-semibold text-[#767285]"><div>{queue.exam_name || "-"}</div><div>{formatDateTime(queue.queue_date)}</div></div>
          {onCall && <button type="button" onClick={() => onCall(queue)} className="mt-3 w-full rounded-lg bg-[#addbf4] px-4 py-2 text-sm font-bold text-[#123879]">ເອີ້ນ</button>}
        </article>
      ))}
    </div>
    <div className="hidden overflow-x-auto rounded-xl shadow-sm md:block">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead className={`${accent === "cyan" ? "bg-[#18bdce] text-white" : "bg-[#f2f2f2] text-black"} text-xs font-bold`}>
          <tr>
            <th className="px-5 py-3">ຄິວ #</th>
            <th className="px-5 py-3">ຊື່ ແລະ ນາມສະກຸນ</th>
            <th className="px-5 py-3">ປະເພດການກວດ</th>
            <th className="px-5 py-3">ວັນທີ ແລະ ເວລາ</th>
            <th className="px-5 py-3">ສະຖານະ</th>
            {onCall && <th className="px-5 py-3">ເອີ້ນ</th>}
          </tr>
        </thead>
        <tbody className="text-xs text-[#767285]">
          {queues.length === 0 ? (
            <tr className={accent === "cyan" ? "bg-[#fff5dc]" : ""}>
              <td className="px-5 py-6 text-center" colSpan={onCall ? 6 : 5}>
                ບໍ່ມີຂໍ້ມູນ
              </td>
            </tr>
          ) : (
            queues.map((queue, index) => (
              <tr key={queue.queue_id} className={`border-t border-[#d7d7d7] ${index === 0 ? "bg-[#fff5dc]" : ""}`}>
                <td className="px-5 py-3 text-[#1b6bff]">{String(queue.queue_no).padStart(2, "0")}</td>
                <td className="px-5 py-3">{patientName(queue)}</td>
                <td className="px-5 py-3">{queue.exam_name || "-"}</td>
                <td className="px-5 py-3">{formatDateTime(queue.queue_date)}</td>
                <td className="px-5 py-3">
                  <StatusPill status={queue.status} />
                </td>
                {onCall && (
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => onCall(queue)}
                      className="rounded-full bg-[#addbf4] px-4 py-1 text-[11px] font-bold text-[#123879] shadow-sm"
                    >
                      ເອີ້ນ
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    </>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder = "ລະຫັດ ຫຼື ຊື່",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex h-10 w-full min-w-0 items-center gap-3 rounded-full bg-[#f3f3f3] px-4 shadow-sm sm:min-w-[260px]">
      <span className="h-4 w-4 rounded-full border-2 border-[#767285]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#767285]"
      />
    </label>
  );
}

export function SmallStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl bg-[#f3f3f3] px-4 sm:min-h-[72px]">
      <div className="flex min-w-0 items-center gap-2.5 text-sm font-bold sm:text-base">
        <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="min-w-0 break-words">{label}</span>
      </div>
      <div className="hidden h-10 w-0.5 shrink-0 sm:block" style={{ backgroundColor: color }} />
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#dedede] text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
