"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type FieldPath } from "react-hook-form";
import { z } from "zod";
import AppShell, { useCurrentUser } from "@/components/AppShell";
import { ActionButton, formatDateTime, PageHero, SearchBox, StatusPill, patientName } from "@/components/dashboard-ui";
import api from "@/lib/api";
import { escapeHtml, printDocument } from "@/lib/print";
import type { ApiResponse, Order, Payment } from "@/lib/types";

const paymentSchema = z.object({
  amount: z.coerce.number().min(1, "ກະລຸນາປ້ອນຈຳນວນເງິນ"),
  payment_type: z.string().min(1, "ກະລຸນາເລືອກຊ່ອງທາງການຊຳລະ"),
});

type PaymentValues = z.infer<typeof paymentSchema>;

const paymentTypes = ["ເງິນສົດ", "ໂອນເງິນ", "ບັດ"];

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const userQuery = useCurrentUser();
  const [tab, setTab] = useState<"unpaid" | "paid">("unpaid");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["orders", "payments"],
    queryFn: async () => (await api.get<ApiResponse<Order[]>>("/orders")).data.data,
    retry: false,
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await api.get<ApiResponse<Payment[]>>("/payments")).data.data,
    retry: false,
  });

  const payments = useMemo(() => paymentsQuery.data ?? [], [paymentsQuery.data]);
  const paidOrderIds = useMemo(() => new Set(payments.map((payment) => payment.order_id)), [payments]);
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);

  const unpaidOrders = useMemo(
    () => orders.filter((order) => !paidOrderIds.has(order.order_id) && order.status !== "ຍົກເລີກແລ້ວ" && order.status !== "CANCELLED"),
    [orders, paidOrderIds]
  );

  const filteredUnpaid = useMemo(() => filterOrders(unpaidOrders, search), [unpaidOrders, search]);
  const filteredPayments = useMemo(() => filterPayments(payments, search), [payments, search]);
  const totalIncome = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentValues>({
    defaultValues: {
      amount: 0,
      payment_type: paymentTypes[0],
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (values: PaymentValues) => {
      const staffId = userQuery.data?.staff_id || userQuery.data?.id;
      if (!selectedOrder || !staffId) throw new Error("missing-data");
      return api.post("/payments", {
        order_id: selectedOrder.order_id,
        staff_id: staffId,
        amount: values.amount,
        payment_date: new Date().toISOString().slice(0, 19).replace("T", " "),
        payment_type: values.payment_type,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSelectedOrder(null);
      setFormError(null);
      reset({ amount: 0, payment_type: paymentTypes[0] });
      setTab("paid");
    },
    onError: (error: unknown) => {
      setFormError(getErrorMessage(error) || "ບໍ່ສາມາດບັນທຶກການຊຳລະໄດ້");
    },
  });

  const onSubmit = (values: PaymentValues) => {
    const parsed = paymentSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as FieldPath<PaymentValues> | undefined;
        if (field) setError(field, { message: issue.message });
      });
      setFormError(parsed.error.issues[0]?.message || "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ");
      return;
    }
    setFormError(null);
    createPaymentMutation.mutate(parsed.data);
  };

  return (
    <AppShell>
      <PageHero title="ການຊຳລະເງິນ" subtitle="ຈັດການການຈ່າຍເງິນຂອງໃບສັ່ງກວດ">
        <SearchBox value={search} onChange={setSearch} placeholder="ID ຫຼື ຊື່" />
        <ActionButton onClick={() => (tab === "unpaid" ? ordersQuery.refetch() : paymentsQuery.refetch())}>Refresh</ActionButton>
        <ActionButton href="/dashboard">ກັບຄືນ</ActionButton>
      </PageHero>

      <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-10">
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="ຍັງບໍ່ໄດ້ຈ່າຍ" value={unpaidOrders.length} color="#f59f00" />
          <SummaryCard label="ຈ່າຍແລ້ວ" value={payments.length} color="#12c746" />
          <SummaryCard label="ລາຍຮັບລວມ" value={totalIncome.toLocaleString("lo-LA")} color="#123879" suffix="ກີບ" />
        </div>

        <section className="mt-5 rounded-2xl border border-[#d9d9d9] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-end gap-2 overflow-x-auto sm:gap-5">
            <TabButton active={tab === "unpaid"} onClick={() => setTab("unpaid")}>
              ຍັງບໍ່ໄດ້ຈ່າຍ
            </TabButton>
            <TabButton active={tab === "paid"} onClick={() => setTab("paid")}>
              ຈ່າຍແລ້ວ
            </TabButton>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#d9d9d9] bg-white shadow-sm">
            {tab === "unpaid" ? (
              <UnpaidOrdersTable
                orders={filteredUnpaid}
                onNotice={printPaymentNotice}
                onPay={(order) => {
                  setSelectedOrder(order);
                  setValue("amount", Number(order.exam_price || 0));
                }}
              />
            ) : (
              <PaidPaymentsTable payments={filteredPayments} onReceipt={setSelectedReceipt} />
            )}
          </div>
        </section>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[520px] rounded-2xl bg-white p-5 shadow-lg">
            <h3 className="text-xl font-bold text-[#120d34]">ຈ່າຍເງິນ</h3>
            <div className="mt-3 rounded-xl bg-[#f6f6f6] p-3 text-sm font-semibold">
              <div>ໃບສັ່ງກວດ: #{String(selectedOrder.order_id).padStart(4, "0")}</div>
              <div>ຄົນເຈັບ: {patientName(selectedOrder)}</div>
              <div>ປະເພດການກວດ: {selectedOrder.exam_name || "-"}</div>
              <div>ລາຄາຕາມປະເພດການກວດ: {Number(selectedOrder.exam_price || 0).toLocaleString("lo-LA")} ກີບ</div>
              <div>ຜູ້ຮັບເງິນ: {userQuery.data?.staff_name || userQuery.data?.name || "-"}</div>
            </div>

            <Field label="ຈຳນວນເງິນ" required error={errors.amount?.message}>
              <input className="field" type="number" min={1} placeholder="0" {...register("amount")} />
            </Field>

            <Field label="ຊ່ອງທາງການຊຳລະ" required error={errors.payment_type?.message}>
              <select className="field" {...register("payment_type")}>
                {paymentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>

            {formError && <div className="mt-3 rounded-lg bg-red-50 p-3 text-red-700">{formError}</div>}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <ActionButton tone="cream" onClick={() => setSelectedOrder(null)}>
                ຍົກເລີກ
              </ActionButton>
              <button
                type="submit"
                disabled={isSubmitting || createPaymentMutation.isPending}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#99fba6] px-5 text-base font-bold text-black shadow-sm"
              >
                {createPaymentMutation.isPending ? "ກຳລັງບັນທຶກ..." : "ຢືນຢັນການຈ່າຍ"}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[560px] rounded-2xl bg-white p-5 shadow-lg print:shadow-none">
            <div className="border-b border-[#d9d9d9] pb-4 text-center">
              <h3 className="text-2xl font-bold text-[#123879]">ໃບຮັບເງິນ</h3>
              <p className="mt-1 text-sm font-semibold">ພະແນກລັງສີ - ໂຮງໝໍ 103</p>
            </div>
            <div className="mt-4 grid gap-2 text-sm font-semibold">
              <div className="flex justify-between"><span>ເລກທີ:</span><span>#{String(selectedReceipt.payment_id).padStart(5, "0")}</span></div>
              <div className="flex justify-between"><span>ໃບສັ່ງກວດ:</span><span>#{String(selectedReceipt.order_id).padStart(4, "0")}</span></div>
              <div className="flex justify-between"><span>ວັນທີ:</span><span>{formatDateTime(selectedReceipt.payment_date)}</span></div>
              <div className="flex justify-between"><span>ຄົນເຈັບ:</span><span>{patientName(selectedReceipt)}</span></div>
              <div className="flex justify-between"><span>ປະເພດການກວດ:</span><span>{selectedReceipt.exam_name || "-"}</span></div>
              <div className="flex justify-between"><span>ຊ່ອງທາງ:</span><span>{selectedReceipt.payment_type || "-"}</span></div>
              <div className="flex justify-between"><span>ຜູ້ຮັບເງິນ:</span><span>{selectedReceipt.staff_name || "-"}</span></div>
            </div>
            <div className="mt-5 rounded-xl bg-[#f2fde9] p-4 text-center">
              <div className="text-sm font-bold">ລວມເງິນ</div>
              <div className="text-3xl font-bold text-[#137547]">{Number(selectedReceipt.amount || 0).toLocaleString("lo-LA")} ກີບ</div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end print:hidden">
              <ActionButton tone="cream" onClick={() => setSelectedReceipt(null)}>
                ປິດ
              </ActionButton>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#addbf4] px-5 text-base font-bold text-black shadow-sm"
              >
                ພິມໃບຮັບເງິນ
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .field {
          width: 100%;
          min-height: 38px;
          border-radius: 8px;
          border: 1px solid #d9d9d9;
          padding: 0 12px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
          outline: none;
          font-size: 14px;
        }
      `}</style>
    </AppShell>
  );
}

function SummaryCard({ label, value, color, suffix }: { label: string; value: string | number; color: string; suffix?: string }) {
  return (
    <div className="rounded-xl border border-[#d9d9d9] bg-white px-4 py-3 text-center shadow-sm">
      <div className="text-sm font-bold">{label}</div>
      <div className="mt-1 text-2xl font-semibold" style={{ color }}>
        {value} {suffix && <span className="text-sm text-black">{suffix}</span>}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-t-xl border px-4 py-2 text-base font-bold sm:px-5 ${active ? "bg-[#dedede]" : "bg-white"}`}
    >
      {children}
    </button>
  );
}

function UnpaidOrdersTable({
  orders,
  onNotice,
  onPay,
}: {
  orders: Order[];
  onNotice: (order: Order) => void;
  onPay: (order: Order) => void;
}) {
  return (
    <table className="w-full min-w-[980px] border-collapse text-left">
      <thead className="bg-[#f2f2f2] text-xs font-bold">
        <tr>
          <th className="px-5 py-3">ເລກທີ</th>
          <th className="px-5 py-3">ຊື່ຄົນເຈັບ</th>
          <th className="px-5 py-3">ປະເພດການກວດ</th>
          <th className="px-5 py-3">ວັນທີ</th>
          <th className="px-5 py-3">ລາຄາ</th>
          <th className="px-5 py-3">ສະຖານະ</th>
          <th className="px-5 py-3">ໃບບິນ</th>
          <th className="px-5 py-3">ຈ່າຍເງິນ</th>
        </tr>
      </thead>
      <tbody className="text-xs text-[#767285]">
        {orders.length === 0 ? (
          <tr>
            <td className="px-5 py-6 text-center" colSpan={8}>
              ບໍ່ມີໃບສັ່ງກວດທີ່ຄ້າງຈ່າຍ
            </td>
          </tr>
        ) : (
          orders.map((order) => (
            <tr key={order.order_id} className="border-t border-[#d7d7d7]">
              <td className="px-5 py-3">#{String(order.order_id).padStart(4, "0")}</td>
              <td className="px-5 py-3">{patientName(order)}</td>
              <td className="px-5 py-3">{order.exam_name || "-"}</td>
              <td className="px-5 py-3">{formatDateTime(order.order_date)}</td>
              <td className="px-5 py-3">{Number(order.exam_price || 0).toLocaleString("lo-LA")} ກີບ</td>
              <td className="px-5 py-3">
                <StatusPill status="ຍັງບໍ່ໄດ້ຈ່າຍ" />
              </td>
              <td className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => onNotice(order)}
                  className="rounded-full bg-[#addbf4] px-4 py-1 text-[11px] font-bold text-[#123879] shadow-sm"
                >
                  ໃບແຈ້ງຊຳລະ
                </button>
              </td>
              <td className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => onPay(order)}
                  className="rounded-full bg-[#99fba6] px-4 py-1 text-[11px] font-bold text-[#123879] shadow-sm"
                >
                  ຈ່າຍເງິນ
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function PaidPaymentsTable({ payments, onReceipt }: { payments: Payment[]; onReceipt: (payment: Payment) => void }) {
  return (
    <table className="w-full min-w-[900px] border-collapse text-left">
      <thead className="bg-[#f2f2f2] text-xs font-bold">
        <tr>
          <th className="px-5 py-3">ເລກທີ</th>
          <th className="px-5 py-3">ວັນທີຈ່າຍ</th>
          <th className="px-5 py-3">ຊື່ຄົນເຈັບ</th>
          <th className="px-5 py-3">ປະເພດການກວດ</th>
          <th className="px-5 py-3">ຈຳນວນເງິນ</th>
          <th className="px-5 py-3">ຊ່ອງທາງ</th>
          <th className="px-5 py-3">ຜູ້ຮັບເງິນ</th>
          <th className="px-5 py-3">ສະຖານະ</th>
          <th className="px-5 py-3">ໃບຮັບເງິນ</th>
        </tr>
      </thead>
      <tbody className="text-xs text-[#767285]">
        {payments.length === 0 ? (
          <tr>
            <td className="px-5 py-6 text-center" colSpan={9}>
              ຍັງບໍ່ມີການຊຳລະເງິນ
            </td>
          </tr>
        ) : (
          payments.map((payment) => (
            <tr key={payment.payment_id} className="border-t border-[#d7d7d7]">
              <td className="px-5 py-3">#{String(payment.order_id).padStart(4, "0")}</td>
              <td className="px-5 py-3">{formatDateTime(payment.payment_date)}</td>
              <td className="px-5 py-3">{patientName(payment)}</td>
              <td className="px-5 py-3">{payment.exam_name || "-"}</td>
              <td className="px-5 py-3">{Number(payment.amount || 0).toLocaleString("lo-LA")} ກີບ</td>
              <td className="px-5 py-3">{payment.payment_type || "-"}</td>
              <td className="px-5 py-3">{payment.staff_name || "-"}</td>
              <td className="px-5 py-3">
                <StatusPill status="ຈ່າຍແລ້ວ" />
              </td>
              <td className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => onReceipt(payment)}
                  className="rounded-full bg-[#addbf4] px-4 py-1 text-[11px] font-bold text-[#123879]"
                >
                  ໃບຮັບເງິນ
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="mt-4 block text-xs font-bold text-black">
      {label} {required && <span className="text-red-600">*</span>}
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}

function filterOrders(orders: Order[], search: string) {
  const text = search.trim().toLowerCase();
  if (!text) return orders;
  return orders.filter((order) => `${order.order_id} ${patientName(order)} ${order.exam_name || ""}`.toLowerCase().includes(text));
}

function filterPayments(payments: Payment[], search: string) {
  const text = search.trim().toLowerCase();
  if (!text) return payments;
  return payments.filter((payment) =>
    `${payment.order_id} ${patientName(payment)} ${payment.exam_name || ""} ${payment.payment_type || ""} ${payment.staff_name || ""}`
      .toLowerCase()
      .includes(text)
  );
}

function printPaymentNotice(order: Order) {
  const amount = Number(order.exam_price || 0);
  const orderNo = `#${String(order.order_id).padStart(4, "0")}`;
  const patientId = `HN-${String(order.patient_id).padStart(6, "0")}`;

  printDocument(
    `ໃບບິນແຈ້ງຊຳລະ ${orderNo}`,
    `<main class="document">
      <section class="header">
        <div class="brand">
          <div class="logo">XR</div>
          <div>
            <p class="hospital">ພະແນກລັງສີ - ໂຮງໝໍ 103</p>
            <div class="muted">Radiology Patient Management System</div>
          </div>
        </div>
        <div class="muted">ອອກເອກະສານ: ${escapeHtml(new Date().toLocaleString("lo-LA"))}</div>
      </section>

      <h1 class="title">ໃບບິນແຈ້ງຊຳລະ</h1>

      <section class="grid">
        <div class="row"><span class="label">ເລກໃບສັ່ງກວດ</span><span class="value">${escapeHtml(orderNo)}</span></div>
        <div class="row"><span class="label">ວັນທີສັ່ງກວດ</span><span class="value">${escapeHtml(formatDateTime(order.order_date))}</span></div>
        <div class="row"><span class="label">Patient ID</span><span class="value">${escapeHtml(patientId)}</span></div>
        <div class="row"><span class="label">ຊື່ຄົນເຈັບ</span><span class="value">${escapeHtml(patientName(order))}</span></div>
        <div class="row"><span class="label">ປະເພດການກວດ</span><span class="value">${escapeHtml(order.exam_name || "-")}</span></div>
        <div class="row"><span class="label">ສະຖານະ</span><span class="value">ຍັງບໍ່ໄດ້ຈ່າຍ</span></div>
      </section>

      <section class="section">
        <div class="section-title">ລາຍການຄ່າບໍລິການ</div>
        <table>
          <thead>
            <tr>
              <th>ລາຍການ</th>
              <th>ຈຳນວນ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml(order.exam_name || "ຄ່າກວດລັງສີ")}</td>
              <td>${escapeHtml(amount.toLocaleString("lo-LA"))} ກີບ</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div class="amount">ຍອດຕ້ອງຊຳລະ: ${escapeHtml(amount.toLocaleString("lo-LA"))} ກີບ</div>

      <section class="signatures">
        <div class="signature-line">ຜູ້ອອກໃບບິນ</div>
        <div class="signature-line">ຜູ້ຊຳລະເງິນ</div>
      </section>
    </main>`
  );
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message;
  }
  return undefined;
}
