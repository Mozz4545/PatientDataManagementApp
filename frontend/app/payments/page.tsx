"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { z } from "zod";
import AppShell, { useCurrentUser } from "@/components/AppShell";
import { ActionButton, DataState, formatDateTime, PageHero, SearchBox, StatusPill, patientName } from "@/components/dashboard-ui";
import api from "@/lib/api";
import { escapeHtml, printDocument, printLogoHtml } from "@/lib/print";
import { displayOrderStatus, isCancelledStatus, isReadyToPayStatus } from "@/lib/status";
import type { ApiResponse, Order, Payment, Staff } from "@/lib/types";
import { useModalAccessibility } from "@/lib/useModalAccessibility";

const paymentSchema = z.object({
  staff_id: z.coerce.number().min(1, "ກະລຸນາເລືອກຜູ້ຮັບເງິນ"),
  payment_type: z.string().min(1, "ກະລຸນາເລືອກຊ່ອງທາງການຊຳລະ"),
  cash_received: z.coerce.number().min(0, "ຈຳນວນເງິນທີ່ຮັບຕ້ອງບໍ່ຕິດລົບ").optional(),
});

type PaymentValues = z.infer<typeof paymentSchema>;
const adjustmentSchema = z.object({
  reason: z.string().min(3, "ກະລຸນາລະບຸເຫດຜົນ"),
});
type AdjustmentValues = z.infer<typeof adjustmentSchema>;

const CASH_PAYMENT = "ເງິນສົດ";
const TRANSFER_PAYMENT = "ເງິນໂອນ";
const paymentTypes = [CASH_PAYMENT, TRANSFER_PAYMENT];

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const userQuery = useCurrentUser();
  const [tab, setTab] = useState<"unpaid" | "paid">("unpaid");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null);
  const [selectedAdjustment, setSelectedAdjustment] = useState<{ payment: Payment; action: "void" | "refund" } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const isAdmin = userQuery.data?.role === "ADMIN";
  const formModalRef = useModalAccessibility<HTMLFormElement>(Boolean(selectedOrder || selectedAdjustment), () => {
    setSelectedOrder(null);
    setSelectedAdjustment(null);
  });
  const receiptModalRef = useModalAccessibility(Boolean(selectedReceipt), () => setSelectedReceipt(null));

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

  const staffOptionsQuery = useQuery({
    queryKey: ["staff-options", "payments"],
    queryFn: async () => (await api.get<ApiResponse<Staff[]>>("/staff/options")).data.data,
    retry: false,
  });

  const payments = useMemo(() => paymentsQuery.data ?? [], [paymentsQuery.data]);
  const activePayments = useMemo(() => payments.filter((payment) => paymentStatus(payment) === "PAID"), [payments]);
  const paidOrderIds = useMemo(() => new Set(activePayments.map((payment) => payment.order_id)), [activePayments]);
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const staffOptions = useMemo(() => staffOptionsQuery.data ?? [], [staffOptionsQuery.data]);

  const unpaidOrders = useMemo(
    () => orders.filter((order) => !paidOrderIds.has(order.order_id) && !isCancelledStatus(order.status)),
    [orders, paidOrderIds]
  );

  const filteredUnpaid = useMemo(() => filterOrders(unpaidOrders, search), [unpaidOrders, search]);
  const filteredPayments = useMemo(() => filterPayments(activePayments, search), [activePayments, search]);
  const totalIncome = activePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    clearErrors,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentValues>({
    defaultValues: {
      staff_id: 0,
      payment_type: paymentTypes[0],
      cash_received: 0,
    },
  });
  const selectedStaffId = Number(useWatch({ control, name: "staff_id" }) || 0);
  const selectedPaymentType = useWatch({ control, name: "payment_type" });
  const cashReceived = Number(useWatch({ control, name: "cash_received" }) || 0);
  const selectedOrderAmount = Number(selectedOrder?.exam_price || 0);
  const cashChange = Math.max(cashReceived - selectedOrderAmount, 0);
  const selectedStaff = useMemo(
    () => staffOptions.find((staff) => staff.staff_id === selectedStaffId) || null,
    [selectedStaffId, staffOptions]
  );
  const adjustmentForm = useForm<AdjustmentValues>({
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    if (!staffOptions.length) return;
    if (selectedStaffId > 0) return;
    const currentUserStaffId = Number(userQuery.data?.staff_id || userQuery.data?.id || 0);
    const defaultStaff = staffOptions.find((staff) => staff.staff_id === currentUserStaffId) || staffOptions[0];
    setValue("staff_id", defaultStaff.staff_id, { shouldValidate: true });
  }, [selectedStaffId, setValue, staffOptions, userQuery.data?.id, userQuery.data?.staff_id]);

  const createPaymentMutation = useMutation({
    mutationFn: async (values: PaymentValues) => {
      if (!selectedOrder) throw new Error("missing-data");
      return api.post("/payments", {
        order_id: selectedOrder.order_id,
        staff_id: values.staff_id,
        payment_type: values.payment_type,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSelectedOrder(null);
      setFormError(null);
      reset({ staff_id: selectedStaffId, payment_type: paymentTypes[0], cash_received: 0 });
      setTab("paid");
    },
    onError: (error: unknown) => {
      setFormError(getErrorMessage(error) || "ບໍ່ສາມາດບັນທຶກການຊຳລະໄດ້");
    },
  });

  const adjustPaymentMutation = useMutation({
    mutationFn: async (values: AdjustmentValues) => {
      if (!selectedAdjustment) throw new Error("missing-payment");
      return api.patch(`/payments/${selectedAdjustment.payment.payment_id}/${selectedAdjustment.action}`, {
        reason: values.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSelectedAdjustment(null);
      adjustmentForm.reset({ reason: "" });
      setFormError(null);
    },
    onError: (error: unknown) => {
      setFormError(getErrorMessage(error) || "ບໍ່ສາມາດປັບສະຖານະການຊຳລະໄດ້");
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
    const amount = Number(selectedOrder?.exam_price || 0);
    if (parsed.data.payment_type === CASH_PAYMENT && Number(parsed.data.cash_received || 0) < amount) {
      const message = "ຈຳນວນເງິນທີ່ຮັບຕ້ອງບໍ່ນ້ອຍກວ່າຍອດຊຳລະ";
      setError("cash_received", { message });
      setFormError(message);
      return;
    }
    clearErrors("cash_received");
    setFormError(null);
    createPaymentMutation.mutate(parsed.data);
  };

  return (
    <AppShell>
      <PageHero title="ການຊຳລະເງິນ" subtitle="ຈັດການການຈ່າຍເງິນຂອງໃບສັ່ງກວດ">
        <SearchBox value={search} onChange={setSearch} placeholder="ID ຫຼື ຊື່" />
        <ActionButton onClick={() => (tab === "unpaid" ? ordersQuery.refetch() : paymentsQuery.refetch())}>ໂຫຼດໃໝ່</ActionButton>
      </PageHero>

      <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-10">
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="ຍັງບໍ່ໄດ້ຈ່າຍ" value={unpaidOrders.length} color="#f59f00" />
          <SummaryCard label="ຈ່າຍແລ້ວ" value={activePayments.length} color="#12c746" />
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
            {tab === "unpaid" && ordersQuery.isLoading ? (
              <div className="p-4"><DataState type="loading" /></div>
            ) : tab === "unpaid" && ordersQuery.isError ? (
              <div className="p-4"><DataState type="error" message="ບໍ່ສາມາດໂຫຼດລາຍການຄ້າງຊຳລະໄດ້" onRetry={() => ordersQuery.refetch()} /></div>
            ) : tab === "paid" && paymentsQuery.isLoading ? (
              <div className="p-4"><DataState type="loading" /></div>
            ) : tab === "paid" && paymentsQuery.isError ? (
              <div className="p-4"><DataState type="error" message="ບໍ່ສາມາດໂຫຼດປະຫວັດການຊຳລະໄດ້" onRetry={() => paymentsQuery.refetch()} /></div>
            ) : tab === "unpaid" ? (
              <UnpaidOrdersTable
                orders={filteredUnpaid}
                onNotice={printPaymentNotice}
                onPay={(order) => {
                  if (!isReadyToPayStatus(displayOrderStatus(order))) return;
                  setSelectedOrder(order);
                  setValue("cash_received", Number(order.exam_price || 0), { shouldValidate: false });
                }}
              />
            ) : (
              <PaidPaymentsTable
                payments={filteredPayments}
                isAdmin={isAdmin}
                onReceipt={setSelectedReceipt}
                onAdjust={(payment, action) => {
                  setSelectedAdjustment({ payment, action });
                  adjustmentForm.reset({ reason: "" });
                  setFormError(null);
                }}
              />
            )}
          </div>
        </section>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <form ref={formModalRef} role="dialog" aria-modal="true" onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[520px] rounded-2xl bg-white p-5 shadow-lg">
            <h3 className="text-xl font-bold text-[#120d34]">ຈ່າຍເງິນ</h3>
            <div className="mt-3 rounded-xl bg-[#f6f6f6] p-3 text-sm font-semibold">
              <div>ໃບສັ່ງກວດ: #{String(selectedOrder.order_id).padStart(4, "0")}</div>
              <div>ຄົນເຈັບ: {patientName(selectedOrder)}</div>
              <div>ປະເພດການກວດ: {selectedOrder.exam_name || "-"}</div>
              <div>ລາຄາຕາມປະເພດການກວດ: {Number(selectedOrder.exam_price || 0).toLocaleString("lo-LA")} ກີບ</div>
              <div>ຜູ້ຮັບເງິນ: {selectedStaff?.staff_name || "-"}</div>
            </div>

            <Field label="ຈຳນວນເງິນ" required>
              <div className="field flex items-center bg-[#f6f6f6] font-bold text-[#123879]">
                {Number(selectedOrder.exam_price || 0).toLocaleString("lo-LA")} ກີບ
              </div>
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

            {selectedPaymentType === CASH_PAYMENT && (
              <>
                <Field label="ເງິນທີ່ຮັບ" required error={errors.cash_received?.message}>
                  <input className="field" type="number" min={0} step={1} {...register("cash_received")} />
                </Field>
                <div className="mt-3 rounded-xl bg-[#f2fde9] p-3 text-sm font-bold text-[#120d34]">
                  <div className="flex justify-between gap-4">
                    <span>ຍອດຕ້ອງຊຳລະ</span>
                    <span>{selectedOrderAmount.toLocaleString("lo-LA")} ກີບ</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-4 text-[#137547]">
                    <span>ເງິນທອນ</span>
                    <span>{cashChange.toLocaleString("lo-LA")} ກີບ</span>
                  </div>
                </div>
              </>
            )}

            <Field label="ຜູ້ຮັບເງິນ" required error={errors.staff_id?.message}>
              <select className="field" {...register("staff_id")}>
                <option value={0}>ເລືອກຜູ້ຮັບເງິນ</option>
                {staffOptions.map((staff) => (
                  <option key={staff.staff_id} value={staff.staff_id}>
                    {formatStaffOption(staff)}
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
          <div ref={receiptModalRef} role="dialog" aria-modal="true" className="w-full max-w-[560px] rounded-2xl bg-white p-5 shadow-lg print:shadow-none">
            <div className="border-b border-[#d9d9d9] pb-4 text-center">
              <h3 className="text-2xl font-bold text-[#123879]">ໃບຮັບເງິນ</h3>
              <p className="mt-1 text-sm font-semibold">ພະແນກລັງສີ - ໂຮງໝໍ 103</p>
            </div>
            <div className="mt-4 grid gap-2 text-sm font-semibold">
              <div className="flex justify-between"><span>ເລກທີ:</span><span>{receiptNumber(selectedReceipt)}</span></div>
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
                onClick={() => printReceipt(selectedReceipt)}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#addbf4] px-5 text-base font-bold text-black shadow-sm"
              >
                ພິມໃບຮັບເງິນ
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <form
            ref={formModalRef}
            role="dialog"
            aria-modal="true"
            onSubmit={adjustmentForm.handleSubmit((values) => {
              const parsed = adjustmentSchema.safeParse(values);
              if (!parsed.success) {
                parsed.error.issues.forEach((issue) => {
                  const field = issue.path[0] as FieldPath<AdjustmentValues> | undefined;
                  if (field) adjustmentForm.setError(field, { message: issue.message });
                });
                setFormError(parsed.error.issues[0]?.message || "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ");
                return;
              }
              setFormError(null);
              adjustPaymentMutation.mutate(parsed.data);
            })}
            className="w-full max-w-[520px] rounded-2xl bg-white p-5 shadow-lg"
          >
            <h3 className="text-xl font-bold text-[#120d34]">
              {selectedAdjustment.action === "void" ? "Void ການຊຳລະ" : "Refund ການຊຳລະ"}
            </h3>
            <div className="mt-3 rounded-xl bg-[#f6f6f6] p-3 text-sm font-semibold">
              <div>ໃບສັ່ງກວດ: #{String(selectedAdjustment.payment.order_id).padStart(4, "0")}</div>
              <div>ຄົນເຈັບ: {patientName(selectedAdjustment.payment)}</div>
              <div>ຈຳນວນເງິນ: {Number(selectedAdjustment.payment.amount || 0).toLocaleString("lo-LA")} ກີບ</div>
            </div>
            <Field label="ເຫດຜົນ" required error={adjustmentForm.formState.errors.reason?.message}>
              <textarea className="field min-h-[96px] resize-none py-2" {...adjustmentForm.register("reason")} />
            </Field>
            {formError && <div className="mt-3 rounded-lg bg-red-50 p-3 text-red-700">{formError}</div>}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <ActionButton tone="cream" onClick={() => setSelectedAdjustment(null)}>
                ຍົກເລີກ
              </ActionButton>
              <button
                type="submit"
                disabled={adjustPaymentMutation.isPending}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#efabab] px-5 text-base font-bold text-black shadow-sm"
              >
                {adjustPaymentMutation.isPending ? "ກຳລັງບັນທຶກ..." : "ຢືນຢັນ"}
              </button>
            </div>
          </form>
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
    <>
    <div className="space-y-3 p-3 md:hidden">
      {orders.length === 0 ? (
        <div className="rounded-xl bg-[#f7f8fb] p-5 text-center text-sm font-bold text-[#767285]">ບໍ່ມີໃບສັ່ງກວດທີ່ຄ້າງຈ່າຍ</div>
      ) : orders.map((order) => (
        <article key={order.order_id} className="rounded-xl border border-[#d9d9d9] p-4 shadow-sm">
          <div className="flex justify-between gap-3">
            <div><div className="text-xs font-bold text-[#1e66ff]">#{String(order.order_id).padStart(4, "0")}</div><div className="mt-1 font-bold">{patientName(order)}</div></div>
            <StatusPill status="UNPAID" />
          </div>
          <div className="mt-3 space-y-1 text-xs font-semibold text-[#767285]">
            <div>{order.exam_name || "-"}</div>
            <div>{formatDateTime(order.order_date)}</div>
            <div className="text-base font-bold text-[#123879]">{Number(order.exam_price || 0).toLocaleString("lo-LA")} ກີບ</div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onNotice(order)} className="rounded-lg bg-[#addbf4] px-3 py-2 text-xs font-bold text-[#123879]">ໃບແຈ້ງຊຳລະ</button>
            <button type="button" onClick={() => onPay(order)} disabled={!isReadyToPayStatus(displayOrderStatus(order))} className="rounded-lg bg-[#99fba6] px-3 py-2 text-xs font-bold text-[#123879] disabled:bg-[#eee] disabled:text-[#9d98aa]">
              {isReadyToPayStatus(displayOrderStatus(order)) ? "ຈ່າຍເງິນ" : "ລໍຖ້າຜົນກວດ"}
            </button>
          </div>
        </article>
      ))}
    </div>
    <div className="hidden overflow-x-auto md:block">
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
                <StatusPill status="UNPAID" />
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
                  disabled={!isReadyToPayStatus(displayOrderStatus(order))}
                  className={`rounded-full px-4 py-1 text-[11px] font-bold shadow-sm ${
                    isReadyToPayStatus(displayOrderStatus(order))
                      ? "bg-[#99fba6] text-[#123879]"
                      : "bg-[#eeeeee] text-[#9d98aa]"
                  }`}
                >
                  {isReadyToPayStatus(displayOrderStatus(order)) ? "ຈ່າຍເງິນ" : "ລໍຖ້າຜົນກວດ"}
                </button>
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

function PaidPaymentsTable({
  payments,
  isAdmin,
  onReceipt,
  onAdjust,
}: {
  payments: Payment[];
  isAdmin: boolean;
  onReceipt: (payment: Payment) => void;
  onAdjust: (payment: Payment, action: "void" | "refund") => void;
}) {
  return (
    <>
    <div className="space-y-3 p-3 md:hidden">
      {payments.length === 0 ? (
        <div className="rounded-xl bg-[#f7f8fb] p-5 text-center text-sm font-bold text-[#767285]">ຍັງບໍ່ມີການຊຳລະເງິນ</div>
      ) : payments.map((payment) => (
        <article key={payment.payment_id} className="rounded-xl border border-[#d9d9d9] p-4 shadow-sm">
          <div className="flex justify-between gap-3"><div><div className="text-xs font-bold text-[#1e66ff]">{receiptNumber(payment)}</div><div className="mt-1 font-bold">{patientName(payment)}</div></div><StatusPill status="PAID" /></div>
          <div className="mt-3 space-y-1 text-xs font-semibold text-[#767285]">
            <div>{payment.exam_name || "-"}</div><div>{formatDateTime(payment.payment_date)}</div>
            <div>{payment.payment_type || "-"} · {payment.staff_name || "-"}</div>
            <div className="text-base font-bold text-[#137547]">{Number(payment.amount || 0).toLocaleString("lo-LA")} ກີບ</div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onReceipt(payment)} className="rounded-lg bg-[#addbf4] px-3 py-2 text-xs font-bold text-[#123879]">ໃບຮັບເງິນ</button>
            {isAdmin && paymentStatus(payment) === "PAID" && <>
              <button type="button" onClick={() => onAdjust(payment, "void")} className="rounded-lg bg-[#f4e3b0] px-3 py-2 text-xs font-bold">ຍົກເລີກລາຍການ</button>
              <button type="button" onClick={() => onAdjust(payment, "refund")} className="rounded-lg bg-[#efabab] px-3 py-2 text-xs font-bold">ຄືນເງິນ</button>
            </>}
          </div>
        </article>
      ))}
    </div>
    <div className="hidden overflow-x-auto md:block">
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
          <th className="px-5 py-3">ຈັດການ</th>
        </tr>
      </thead>
      <tbody className="text-xs text-[#767285]">
        {payments.length === 0 ? (
          <tr>
            <td className="px-5 py-6 text-center" colSpan={10}>
              ຍັງບໍ່ມີການຊຳລະເງິນ
            </td>
          </tr>
        ) : (
          payments.map((payment) => (
            <tr key={payment.payment_id} className="border-t border-[#d7d7d7]">
              <td className="px-5 py-3">{receiptNumber(payment)}</td>
              <td className="px-5 py-3">{formatDateTime(payment.payment_date)}</td>
              <td className="px-5 py-3">{patientName(payment)}</td>
              <td className="px-5 py-3">{payment.exam_name || "-"}</td>
              <td className="px-5 py-3">{Number(payment.amount || 0).toLocaleString("lo-LA")} ກີບ</td>
              <td className="px-5 py-3">{payment.payment_type || "-"}</td>
              <td className="px-5 py-3">{payment.staff_name || "-"}</td>
              <td className="px-5 py-3">
                <StatusPill status="PAID" />
              </td>
              <td className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => onReceipt(payment)}
                  disabled={paymentStatus(payment) !== "PAID"}
                  className="rounded-full bg-[#addbf4] px-4 py-1 text-[11px] font-bold text-[#123879]"
                >
                  ໃບຮັບເງິນ
                </button>
              </td>
              <td className="px-5 py-3">
                {isAdmin && paymentStatus(payment) === "PAID" ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onAdjust(payment, "void")}
                      className="rounded-full bg-[#f4e3b0] px-3 py-1 text-[11px] font-bold text-black"
                    >
                      ຍົກເລີກລາຍການ
                    </button>
                    <button
                      type="button"
                      onClick={() => onAdjust(payment, "refund")}
                      className="rounded-full bg-[#efabab] px-3 py-1 text-[11px] font-bold text-black"
                    >
                      ຄືນເງິນ
                    </button>
                  </div>
                ) : (
                  <span>{payment.adjustment_reason || "-"}</span>
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

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="mt-4 block text-xs font-bold text-black">
      {label} {required && <span className="text-red-600">*</span>}
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}

function paymentStatus(payment: Payment) {
  return String(payment.status || "PAID").toUpperCase();
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
    `${payment.receipt_no || ""} ${payment.order_id} ${patientName(payment)} ${payment.exam_name || ""} ${payment.payment_type || ""} ${payment.staff_name || ""}`
      .toLowerCase()
      .includes(text)
  );
}

function formatStaffOption(staff: Staff) {
  const id = `STF-${String(staff.staff_id).padStart(4, "0")}`;
  return `${id} ${staff.staff_name}${staff.position ? ` - ${staff.position}` : ""}`;
}

function printPaymentNotice(order: Order) {
  const amount = Number(order.exam_price || 0);
  const orderNo = `#${String(order.order_id).padStart(4, "0")}`;
  const noticeNo = `BILL-${new Date(order.order_date).getFullYear() || new Date().getFullYear()}-${String(order.order_id).padStart(5, "0")}`;
  const patientId = `HN-${String(order.patient_id).padStart(6, "0")}`;
  const issuedAt = new Date().toLocaleString("lo-LA");

  printDocument(
    `ໃບບິນແຈ້ງຊຳລະ ${orderNo}`,
    `<main class="document">
      <section class="header">
        <div class="brand">
          ${printLogoHtml()}
          <div>
            <p class="hospital">ພະແນກລັງສີ - ໂຮງໝໍ 103</p>
            <div class="muted">Radiology Patient Management System</div>
          </div>
        </div>
        <div class="muted">ອອກເອກະສານ: ${escapeHtml(issuedAt)}</div>
      </section>

      <h1 class="title">ໃບບິນແຈ້ງຊຳລະ</h1>
      <section class="doc-meta">
        <span class="doc-no">ເລກເອກະສານ: ${escapeHtml(noticeNo)}</span>
        <span>ສະຖານະ: ລໍຖ້າຊຳລະ</span>
      </section>

      <section class="grid">
        <div class="row"><span class="label">ເລກໃບສັ່ງກວດ</span><span class="value">${escapeHtml(orderNo)}</span></div>
        <div class="row"><span class="label">ວັນທີສັ່ງກວດ</span><span class="value">${escapeHtml(formatDateTime(order.order_date))}</span></div>
        <div class="row"><span class="label">ລະຫັດຄົນເຈັບ</span><span class="value">${escapeHtml(patientId)}</span></div>
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
              <td style="text-align:right">${escapeHtml(amount.toLocaleString("lo-LA"))} ກີບ</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div class="amount">ຍອດຕ້ອງຊຳລະ: ${escapeHtml(amount.toLocaleString("lo-LA"))} ກີບ</div>
      <div class="notice">ໝາຍເຫດ: ເອກະສານນີ້ເປັນໃບແຈ້ງຊຳລະ ບໍ່ແມ່ນໃບຮັບເງິນ. ໃບຮັບເງິນຈະອອກໃຫ້ຫຼັງຈາກຊຳລະເງິນສຳເລັດ.</div>

      <section class="signatures">
        <div class="signature-line">ຜູ້ອອກໃບບິນ</div>
        <div class="signature-line">ຜູ້ຊຳລະເງິນ</div>
      </section>
      <div class="footer">ພະແນກລັງສີ - ໂຮງໝໍ 103 | ກະລຸນານຳໃບແຈ້ງຊຳລະນີ້ມາສະແດງເມື່ອຊຳລະເງິນ</div>
    </main>`
  );
}

function printReceipt(payment: Payment) {
  const amount = Number(payment.amount || 0);
  const receiptNo = receiptNumber(payment);
  const orderNo = `#${String(payment.order_id).padStart(4, "0")}`;
  const issuedAt = new Date().toLocaleString("lo-LA");

  printDocument(
    `ໃບຮັບເງິນ ${receiptNo}`,
    `<main class="document">
      <section class="header">
        <div class="brand">
          ${printLogoHtml()}
          <div>
            <p class="hospital">ພະແນກລັງສີ - ໂຮງໝໍ 103</p>
            <div class="muted">Radiology Patient Management System</div>
          </div>
        </div>
        <div class="muted">ອອກເອກະສານ: ${escapeHtml(issuedAt)}</div>
      </section>

      <h1 class="title">ໃບຮັບເງິນ</h1>
      <section class="doc-meta">
        <span class="doc-no">ເລກໃບຮັບເງິນ: ${escapeHtml(receiptNo)}</span>
        <span>ສະຖານະ: ຈ່າຍແລ້ວ</span>
      </section>

      <section class="grid">
        <div class="row"><span class="label">ໃບສັ່ງກວດ</span><span class="value">${escapeHtml(orderNo)}</span></div>
        <div class="row"><span class="label">ວັນທີຈ່າຍ</span><span class="value">${escapeHtml(formatDateTime(payment.payment_date))}</span></div>
        <div class="row"><span class="label">ຄົນເຈັບ</span><span class="value">${escapeHtml(patientName(payment))}</span></div>
        <div class="row"><span class="label">ປະເພດການກວດ</span><span class="value">${escapeHtml(payment.exam_name || "-")}</span></div>
        <div class="row"><span class="label">ຊ່ອງທາງຊຳລະ</span><span class="value">${escapeHtml(payment.payment_type || "-")}</span></div>
        <div class="row"><span class="label">ຜູ້ຮັບເງິນ</span><span class="value">${escapeHtml(payment.staff_name || "-")}</span></div>
      </section>

      <section class="section">
        <div class="section-title">ລາຍການຮັບເງິນ</div>
        <table>
          <thead>
            <tr>
              <th>ລາຍການ</th>
              <th>ຈຳນວນເງິນ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml(payment.exam_name || "ຄ່າກວດລັງສີ")}</td>
              <td style="text-align:right">${escapeHtml(amount.toLocaleString("lo-LA"))} ກີບ</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div class="amount">ລວມຮັບເງິນ: ${escapeHtml(amount.toLocaleString("lo-LA"))} ກີບ</div>

      <section class="signatures">
        <div class="signature-line">ຜູ້ຮັບເງິນ</div>
        <div class="signature-line">ຜູ້ຊຳລະເງິນ</div>
      </section>
      <div class="footer">ໃບຮັບເງິນນີ້ອອກຈາກລະບົບຈັດການຂໍ້ມູນພະແນກລັງສີ ໂຮງໝໍ 103</div>
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

function receiptNumber(payment: Payment) {
  return payment.receipt_no || `RCPT-${new Date(payment.payment_date).getFullYear() || new Date().getFullYear()}-${String(payment.payment_id).padStart(5, "0")}`;
}
