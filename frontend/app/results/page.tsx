"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type FieldPath } from "react-hook-form";
import { z } from "zod";
import AppShell, { useCurrentUser } from "@/components/AppShell";
import { ActionButton, PageHero, Panel, SearchBox, StatusPill, formatDate, patientName } from "@/components/dashboard-ui";
import api from "@/lib/api";
import { escapeHtml, lineBreaks, printDocument } from "@/lib/print";
import type { ApiResponse, Order, Result } from "@/lib/types";

const resultSchema = z.object({
  result_detail: z.string().min(1, "ກະລຸນາປ້ອນຜົນກວດ"),
});

type ResultValues = z.infer<typeof resultSchema>;

export default function ResultsPage() {
  const queryClient = useQueryClient();
  const userQuery = useCurrentUser();
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["orders", "results"],
    queryFn: async () => (await api.get<ApiResponse<Order[]>>("/orders")).data.data,
    retry: false,
  });

  const resultsQuery = useQuery({
    queryKey: ["results"],
    queryFn: async () => (await api.get<ApiResponse<Result[]>>("/results")).data.data,
    retry: false,
  });

  const results = useMemo(() => resultsQuery.data ?? [], [resultsQuery.data]);
  const resultByOrder = useMemo(() => new Map(results.map((result) => [result.order_id, result])), [results]);
  const rows = useMemo(() => {
    const text = search.trim().toLowerCase();
    return (ordersQuery.data ?? [])
      .filter((order) => order.status !== "ຍົກເລີກແລ້ວ" && order.status !== "CANCELLED")
      .filter((order) => {
        const result = resultByOrder.get(order.order_id);
        if (!text) return true;
        return `${order.order_id} ${order.patient_id} ${patientName(order)} ${order.exam_name || ""} ${result?.result_detail || ""}`
          .toLowerCase()
          .includes(text);
      });
  }, [ordersQuery.data, resultByOrder, search]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResultValues>({ defaultValues: { result_detail: "" } });

  const saveMutation = useMutation({
    mutationFn: async (values: ResultValues) => {
      const staffId = userQuery.data?.staff_id || userQuery.data?.id;
      if (!staffId) throw new Error("missing-staff");

      if (selectedResult) {
        return api.put(`/results/${selectedResult.result_id}`, { result_detail: values.result_detail });
      }

      if (!selectedOrder) throw new Error("missing-order");
      return api.post("/results", {
        order_id: selectedOrder.order_id,
        staff_id: staffId,
        result_detail: values.result_detail,
        result_date: new Date().toISOString().slice(0, 19).replace("T", " "),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["results"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      closeForm();
    },
    onError: (error: unknown) => setFormError(getErrorMessage(error) || "ບໍ່ສາມາດບັນທຶກຜົນກວດໄດ້"),
  });

  const openForm = (order: Order, result?: Result) => {
    setSelectedOrder(order);
    setSelectedResult(result || null);
    reset({ result_detail: result?.result_detail || "" });
    setFormError(null);
  };

  const closeForm = () => {
    setSelectedOrder(null);
    setSelectedResult(null);
    reset({ result_detail: "" });
    setFormError(null);
  };

  const onSubmit = (values: ResultValues) => {
    const parsed = resultSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as FieldPath<ResultValues> | undefined;
        if (field) setError(field, { message: issue.message });
      });
      setFormError(parsed.error.issues[0]?.message || "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ");
      return;
    }
    setFormError(null);
    saveMutation.mutate(parsed.data);
  };

  return (
    <AppShell>
      <PageHero title="ຜົນກວດ" subtitle="ບັນທຶກ ແລະ ຈັດການຜົນກວດລັງສີ">
        <SearchBox value={search} onChange={setSearch} placeholder="Patient ID ຫຼື ຊື່" />
        <ActionButton onClick={() => resultsQuery.refetch()}>Refresh</ActionButton>
        <ActionButton href="/dashboard">ກັບຄືນ</ActionButton>
      </PageHero>

      <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-10 lg:py-6">
        <Panel title="ຜົນກວດ">
          <div className="overflow-x-auto rounded-xl shadow-sm">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="bg-[#f2f2f2] text-xs font-bold">
                <tr>
                  <th className="px-5 py-3">ເລກທີ</th>
                  <th className="px-5 py-3">Patient ID</th>
                  <th className="px-5 py-3">ຊື່ຄົນເຈັບ</th>
                  <th className="px-5 py-3">ປະເພດການກວດ</th>
                  <th className="px-5 py-3">ວັນທີ</th>
                  <th className="px-5 py-3">ຜົນກວດ</th>
                  <th className="px-5 py-3">ສະຖານະ</th>
                  <th className="px-5 py-3">ຈັດການ</th>
                </tr>
              </thead>
              <tbody className="text-xs text-[#767285]">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-5 py-6 text-center" colSpan={8}>
                      ບໍ່ມີຂໍ້ມູນ
                    </td>
                  </tr>
                ) : (
                  rows.map((order) => {
                    const result = resultByOrder.get(order.order_id);
                    return (
                      <tr key={order.order_id} className="border-t border-[#d7d7d7]">
                        <td className="px-5 py-3">R{String(order.order_id).padStart(4, "0")}</td>
                        <td className="px-5 py-3">HN-{String(order.patient_id).padStart(6, "0")}</td>
                        <td className="px-5 py-3">{patientName(order)}</td>
                        <td className="px-5 py-3">{order.exam_name || "-"}</td>
                        <td className="px-5 py-3">{formatDate(result?.result_date || order.order_date)}</td>
                        <td className="max-w-[300px] truncate px-5 py-3">{result?.result_detail || "-"}</td>
                        <td className="px-5 py-3">
                          <StatusPill status={result ? "ບັນທຶກແລ້ວ" : "ລໍຖ້າບັນທຶກ"} />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-2">
                            {result && (
                              <button
                                type="button"
                                onClick={() => printResultDocument(order, result)}
                                className="rounded-full bg-[#addbf4] px-4 py-1 text-[11px] font-bold text-[#123879]"
                              >
                                PDF
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={() => openForm(order, result)}
                            className="rounded-full bg-[#99fba6] px-4 py-1 text-[11px] font-bold text-[#123879]"
                          >
                            {result ? "ແກ້ໄຂ" : "ບັນທຶກຜົນ"}
                          </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[620px] rounded-2xl bg-white p-5 shadow-lg">
            <h3 className="text-xl font-bold text-[#120d34]">{selectedResult ? "ແກ້ໄຂຜົນກວດ" : "ບັນທຶກຜົນກວດ"}</h3>
            <div className="mt-3 rounded-xl bg-[#f6f6f6] p-3 text-sm font-semibold">
              <div>ໃບສັ່ງກວດ: #{String(selectedOrder.order_id).padStart(4, "0")}</div>
              <div>Patient ID: HN-{String(selectedOrder.patient_id).padStart(6, "0")}</div>
              <div>ຄົນເຈັບ: {patientName(selectedOrder)}</div>
              <div>ປະເພດການກວດ: {selectedOrder.exam_name || "-"}</div>
              <div>ຜູ້ບັນທຶກ: {userQuery.data?.staff_name || userQuery.data?.name || "-"}</div>
            </div>

            <label className="mt-4 block text-xs font-bold text-black">
              ລາຍລະອຽດຜົນກວດ <span className="text-red-600">*</span>
              <textarea
                className="mt-2 min-h-[160px] w-full resize-none rounded-lg border border-[#d9d9d9] p-3 text-sm shadow-sm outline-none"
                {...register("result_detail")}
              />
              {errors.result_detail && <p className="mt-1 text-xs text-red-600">{errors.result_detail.message}</p>}
            </label>

            {formError && <div className="mt-3 rounded-lg bg-red-50 p-3 text-red-700">{formError}</div>}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <ActionButton tone="cream" onClick={closeForm}>
                ຍົກເລີກ
              </ActionButton>
              <button
                type="submit"
                disabled={isSubmitting || saveMutation.isPending}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#99fba6] px-5 text-base font-bold text-black shadow-sm"
              >
                {saveMutation.isPending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function printResultDocument(order: Order, result: Result) {
  const orderNo = `#${String(order.order_id).padStart(4, "0")}`;
  const resultNo = `R${String(result.result_id).padStart(5, "0")}`;
  const patientId = `HN-${String(order.patient_id).padStart(6, "0")}`;

  printDocument(
    `ຜົນກວດ ${resultNo}`,
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

      <h1 class="title">ລາຍງານຜົນກວດ</h1>

      <section class="grid">
        <div class="row"><span class="label">ເລກຜົນກວດ</span><span class="value">${escapeHtml(resultNo)}</span></div>
        <div class="row"><span class="label">ເລກໃບສັ່ງກວດ</span><span class="value">${escapeHtml(orderNo)}</span></div>
        <div class="row"><span class="label">Patient ID</span><span class="value">${escapeHtml(patientId)}</span></div>
        <div class="row"><span class="label">ຊື່ຄົນເຈັບ</span><span class="value">${escapeHtml(patientName(order))}</span></div>
        <div class="row"><span class="label">ປະເພດການກວດ</span><span class="value">${escapeHtml(order.exam_name || result.exam_name || "-")}</span></div>
        <div class="row"><span class="label">ວັນທີກວດ</span><span class="value">${escapeHtml(formatDate(order.order_date))}</span></div>
        <div class="row"><span class="label">ວັນທີບັນທຶກຜົນ</span><span class="value">${escapeHtml(formatDate(result.result_date))}</span></div>
        <div class="row"><span class="label">ຜູ້ບັນທຶກ</span><span class="value">${escapeHtml(result.staff_name || "-")}</span></div>
      </section>

      <section class="section">
        <div class="section-title">ລາຍລະອຽດຜົນກວດ</div>
        <div class="box">${lineBreaks(result.result_detail || "-")}</div>
      </section>

      <section class="signatures">
        <div class="signature-line">ຜູ້ບັນທຶກຜົນ</div>
        <div class="signature-line">ແພດ/ເຈົ້າໜ້າທີ່ຢືນຢັນ</div>
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
