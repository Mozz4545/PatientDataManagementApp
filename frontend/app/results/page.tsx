"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type FieldPath } from "react-hook-form";
import { z } from "zod";
import AppShell, { useCurrentUser } from "@/components/AppShell";
import { ActionButton, DataState, PageHero, Pagination, Panel, SearchBox, StatusPill, formatDate, patientName } from "@/components/dashboard-ui";
import api from "@/lib/api";
import { escapeHtml, lineBreaks, printDocument, printLogoHtml } from "@/lib/print";
import { getResultImageDataUrl, getResultImageObjectUrl } from "@/lib/result-images";
import { isCancelledStatus } from "@/lib/status";
import { showToast } from "@/lib/toast";
import type { ApiResponse, Order, Result } from "@/lib/types";
import { useModalAccessibility } from "@/lib/useModalAccessibility";

const resultSchema = z.object({
  result_detail: z.string().min(1, "ກະລຸນາປ້ອນຜົນກວດ"),
});

const RESULT_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const RESULT_IMAGE_TYPES = ["image/jpeg", "image/png"];
const RESULT_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png"];

type ResultValues = z.infer<typeof resultSchema>;

export default function ResultsPage() {
  const queryClient = useQueryClient();
  const userQuery = useCurrentUser();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [resultImage, setResultImage] = useState<File | null>(null);
  const [removeResultImage, setRemoveResultImage] = useState(false);
  const [fullScreenImageUrl, setFullScreenImageUrl] = useState<string | null>(null);
  const [fullScreenImageOwned, setFullScreenImageOwned] = useState(false);
  const [savedImageObjectUrl, setSavedImageObjectUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const formModalRef = useModalAccessibility<HTMLFormElement>(Boolean(selectedOrder), () => {
    setSelectedOrder(null);
    setSelectedResult(null);
  });
  const imageModalRef = useModalAccessibility(Boolean(fullScreenImageUrl), () => setFullScreenImageUrl(null));

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
      .filter((order) => !isCancelledStatus(order.status))
      .filter((order) => {
        const result = resultByOrder.get(order.order_id);
        if (!text) return true;
        return `${order.document_no || ""} ${order.order_id} ${order.patient_id} ${patientName(order)} ${order.exam_name || ""} ${result?.report_no || ""} ${result?.result_detail || ""}`
          .toLowerCase()
          .includes(text);
      });
  }, [ordersQuery.data, resultByOrder, search]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResultValues>({ defaultValues: { result_detail: "" } });

  const previewImageUrl = useMemo(() => (resultImage ? URL.createObjectURL(resultImage) : ""), [resultImage]);
  const visibleImageUrl = previewImageUrl || (removeResultImage ? "" : savedImageObjectUrl);

  useEffect(() => {
    return () => {
      if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
    };
  }, [previewImageUrl]);

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    if (!selectedResult?.result_image_url) return;

    getResultImageObjectUrl(selectedResult.result_id)
      .then((url) => {
        objectUrl = url;
        if (active) setSavedImageObjectUrl(url);
      })
      .catch(() => {
        if (active) setSavedImageObjectUrl("");
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedResult?.result_id, selectedResult?.result_image_url]);

  const saveMutation = useMutation({
    mutationFn: async (values: ResultValues) => {
      const formData = new FormData();
      formData.append("result_detail", values.result_detail);
      if (resultImage) formData.append("result_image", resultImage);
      if (selectedResult && removeResultImage && !resultImage) {
        formData.append("remove_result_image", "true");
      }

      if (selectedResult) {
        return api.put(`/results/${selectedResult.result_id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      if (!selectedOrder) throw new Error("missing-order");
      formData.append("order_id", String(selectedOrder.order_id));
      return api.post("/results", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["results"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["queues"] });
      queryClient.invalidateQueries({ queryKey: ["queue-display"] });
      showToast("success", selectedResult ? "ອັບເດດຜົນກວດສຳເລັດ" : "ບັນທຶກຜົນກວດສຳເລັດ");
      closeForm();
    },
    onError: (error: unknown) => setFormError(getErrorMessage(error) || "ບໍ່ສາມາດບັນທຶກຜົນກວດໄດ້"),
  });

  const openForm = (order: Order, result?: Result) => {
    setSelectedOrder(order);
    setSelectedResult(result || null);
    setResultImage(null);
    setRemoveResultImage(false);
    setSavedImageObjectUrl("");
    reset({ result_detail: result?.result_detail || "" });
    setFormError(null);
  };

  const closeForm = () => {
    setSelectedOrder(null);
    setSelectedResult(null);
    setResultImage(null);
    setRemoveResultImage(false);
    setSavedImageObjectUrl("");
    reset({ result_detail: "" });
    setFormError(null);
  };

  const handleImageChange = (file?: File) => {
    if (!file) {
      setResultImage(null);
      return;
    }
    const lowerName = file.name.toLowerCase();
    const hasAllowedExtension = RESULT_IMAGE_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
    if (!RESULT_IMAGE_TYPES.includes(file.type) || !hasAllowedExtension) {
      setFormError("ອັບໂຫຼດໄດ້ສະເພາະໄຟລ໌ JPG ຫຼື PNG ເທົ່ານັ້ນ");
      return;
    }
    if (file.size > RESULT_IMAGE_MAX_SIZE) {
      setFormError("ຂະໜາດຮູບຕ້ອງບໍ່ເກີນ 5MB");
      return;
    }
    setFormError(null);
    setRemoveResultImage(false);
    setResultImage(file);
  };

  const openSavedResultImage = async (result?: Result) => {
    if (!result?.result_id || !result.result_image_url) return;
    try {
      const imageUrl = await getResultImageObjectUrl(result.result_id);
      setFullScreenImageUrl(imageUrl);
      setFullScreenImageOwned(true);
    } catch {
      showToast("error", "ບໍ່ສາມາດເປີດຮູບຜົນກວດໄດ້");
    }
  };

  const openLocalImage = (imageUrl: string) => {
    setFullScreenImageUrl(imageUrl);
    setFullScreenImageOwned(false);
  };

  const closeFullScreenImage = () => {
    if (fullScreenImageOwned && fullScreenImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(fullScreenImageUrl);
    }
    setFullScreenImageUrl(null);
    setFullScreenImageOwned(false);
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
        <SearchBox value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="ລະຫັດຄົນເຈັບ ຫຼື ຊື່" />
        <ActionButton
          onClick={() => {
            ordersQuery.refetch();
            resultsQuery.refetch();
          }}
        >
          ໂຫຼດໃໝ່
        </ActionButton>
      </PageHero>

      <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-10 lg:py-6">
        <Panel title="ຜົນກວດ">
          <div className="space-y-3 md:hidden">
            {ordersQuery.isLoading || resultsQuery.isLoading ? (
              <DataState type="loading" compact />
            ) : ordersQuery.isError || resultsQuery.isError ? (
              <DataState type="error" message="ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຜົນກວດໄດ້" onRetry={() => { ordersQuery.refetch(); resultsQuery.refetch(); }} compact />
            ) : rows.length === 0 ? (
              <DataState type="empty" compact />
            ) : (
              pagedRows.map((order) => {
                const result = resultByOrder.get(order.order_id);
                return (
                  <article key={order.order_id} className="rounded-xl border border-[#d9d9d9] bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-[#1e66ff]">HN-{String(order.patient_id).padStart(6, "0")}</div>
                        <h4 className="mt-1 font-bold">{patientName(order)}</h4>
                      </div>
                      <StatusPill status={result ? "ກວດສຳເລັດ" : "ລໍຖ້າບັນທຶກ"} />
                    </div>
                    <div className="mt-3 space-y-1 text-xs font-semibold text-[#767285]">
                      <div>ປະເພດກວດ: <span className="text-[#120d34]">{order.exam_name || "-"}</span></div>
                      <div>ວັນທີ: <span className="text-[#120d34]">{formatDate(result?.result_date || order.order_date)}</span></div>
                      {result && <div className="line-clamp-2">ຜົນກວດ: <span className="text-[#120d34]">{result.result_detail || "-"}</span></div>}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {result && <button type="button" onClick={() => void printResultDocument(order, result)} className="rounded-lg bg-[#addbf4] px-4 py-2 text-xs font-bold text-[#123879]">ເອກະສານ</button>}
                      <button type="button" onClick={() => openForm(order, result)} className="rounded-lg bg-[#99fba6] px-4 py-2 text-xs font-bold text-[#123879]">
                        {result ? "ແກ້ໄຂ" : "ບັນທຶກຜົນ"}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
          <div className="hidden overflow-x-auto rounded-xl shadow-sm md:block">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="bg-[#f2f2f2] text-xs font-bold">
                <tr>
                  <th className="px-5 py-3">ເລກທີ</th>
                  <th className="px-5 py-3">ລະຫັດຄົນເຈັບ</th>
                  <th className="px-5 py-3">ຊື່ຄົນເຈັບ</th>
                  <th className="px-5 py-3">ປະເພດການກວດ</th>
                  <th className="px-5 py-3">ວັນທີ</th>
                  <th className="px-5 py-3">ຜົນກວດ</th>
                  <th className="px-5 py-3">ສະຖານະ</th>
                  <th className="px-5 py-3">ຈັດການ</th>
                </tr>
              </thead>
              <tbody className="text-xs text-[#767285]">
                {ordersQuery.isLoading || resultsQuery.isLoading ? (
                  <tr>
                    <td className="px-5 py-6 text-center" colSpan={8}>
                      ກຳລັງໂຫຼດ...
                    </td>
                  </tr>
                ) : ordersQuery.isError || resultsQuery.isError ? (
                  <tr>
                    <td className="px-5 py-6 text-center text-red-600" colSpan={8}>
                      ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຜົນກວດໄດ້
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-5 py-6 text-center" colSpan={8}>
                      ບໍ່ມີຂໍ້ມູນ
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((order) => {
                    const result = resultByOrder.get(order.order_id);
                    const hasImage = Boolean(result?.result_image_url);
                    return (
                      <tr key={order.order_id} className="border-t border-[#d7d7d7]">
                        <td className="px-5 py-3">{result?.report_no || order.document_no || `#${String(order.order_id).padStart(4, "0")}`}</td>
                        <td className="px-5 py-3">HN-{String(order.patient_id).padStart(6, "0")}</td>
                        <td className="px-5 py-3">{patientName(order)}</td>
                        <td className="px-5 py-3">{order.exam_name || "-"}</td>
                        <td className="px-5 py-3">{formatDate(result?.result_date || order.order_date)}</td>
                        <td className="max-w-[300px] px-5 py-3">
                          <div className="truncate">{result?.result_detail || "-"}</div>
                          {hasImage && (
                            <button
                              type="button"
                              onClick={() => openSavedResultImage(result)}
                              className="mt-1 text-[11px] font-bold text-[#123879] underline"
                            >
                              ເບິ່ງຮູບ
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <StatusPill status={result ? "ກວດສຳເລັດ" : "ລໍຖ້າບັນທຶກ"} />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-2">
                            {result && (
                              <button
                                type="button"
                                onClick={() => void printResultDocument(order, result)}
                                className="rounded-full bg-[#addbf4] px-4 py-1 text-[11px] font-bold text-[#123879]"
                              >
                                ເອກະສານ
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
          <Pagination page={currentPage} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} />
        </Panel>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-4">
          <form ref={formModalRef} role="dialog" aria-modal="true" onSubmit={handleSubmit(onSubmit)} className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
            <div className="border-b border-[#d9d9d9] px-5 py-4">
              <h3 className="text-xl font-bold text-[#120d34]">{selectedResult ? "ແກ້ໄຂຜົນກວດ" : "ບັນທຶກຜົນກວດ"}</h3>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="rounded-xl bg-[#f6f6f6] p-3 text-sm font-semibold">
                <div>ໃບສັ່ງກວດ: {selectedOrder.document_no || `#${String(selectedOrder.order_id).padStart(4, "0")}`}</div>
                <div>ລະຫັດຄົນເຈັບ: HN-{String(selectedOrder.patient_id).padStart(6, "0")}</div>
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

              <div className="mt-4">
                <div className="text-xs font-bold text-black">ຮູບຜົນກວດ</div>
                <label className="group relative mt-2 flex min-h-12 w-full cursor-pointer items-center gap-3 overflow-hidden rounded-lg border border-[#c8c8c8] bg-white pr-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#123879] hover:shadow-md active:translate-y-0 active:scale-[0.99]">
                  <input
                    className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
                    type="file"
                    accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                    aria-label="ເລືອກຮູບຜົນກວດ"
                    onChange={(event) => handleImageChange(event.target.files?.[0])}
                  />
                  <span className="flex min-h-12 shrink-0 items-center gap-2 bg-[#123879] px-4 text-sm font-bold text-white transition-colors duration-200 group-hover:bg-[#1b4d99] peer-focus-visible:bg-[#1b4d99]">
                    <span className="text-lg transition-transform duration-200 group-hover:-translate-y-0.5" aria-hidden="true">
                      ↑
                    </span>
                    {resultImage || (!removeResultImage && selectedResult?.result_image_url)
                      ? "ກົດເພື່ອປ່ຽນຮູບ"
                      : "ເລືອກໄຟລ໌"}
                  </span>
                  <span className="min-w-0 truncate text-sm font-semibold text-[#767285]">
                    {resultImage?.name ||
                      (!removeResultImage && selectedResult?.result_image_url
                        ? "ມີຮູບບັນທຶກແລ້ວ"
                        : "ຍັງບໍ່ໄດ້ເລືອກໄຟລ໌")}
                  </span>
                  <span className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-transparent peer-focus-visible:ring-[#18bdce]" />
                </label>
              </div>

              {removeResultImage && !resultImage && (
                <div className="mt-3 rounded-lg bg-[#fff2f2] p-3 text-sm font-bold text-red-700">
                  ຮູບເກົ່າຈະຖືກລຶບເມື່ອກົດບັນທຶກ
                </div>
              )}

              {visibleImageUrl && (
                <div className="mt-3 rounded-xl border border-[#d9d9d9] bg-[#f6f6f6] p-3">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs font-bold text-[#767285]">
                      {previewImageUrl ? "ຮູບທີ່ເລືອກໃໝ່" : "ຮູບທີ່ບັນທຶກໄວ້"}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {previewImageUrl ? (
                        <button
                          type="button"
                          onClick={() => setResultImage(null)}
                          className="rounded-full bg-[#f4e3b0] px-3 py-1 text-[11px] font-bold text-black"
                        >
                          ຍົກເລີກຮູບໃໝ່
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRemoveResultImage(true)}
                          className="rounded-full bg-[#efabab] px-3 py-1 text-[11px] font-bold text-black"
                        >
                          ລຶບຮູບ
                        </button>
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={() => openLocalImage(visibleImageUrl)} className="w-full rounded-lg border border-[#d9d9d9] bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={visibleImageUrl} alt="ຮູບຜົນກວດ" className="h-56 w-full object-contain" />
                  </button>
                </div>
              )}

              {formError && <div className="mt-3 rounded-lg bg-red-50 p-3 text-red-700">{formError}</div>}
            </div>

            <div className="flex flex-col gap-3 border-t border-[#d9d9d9] bg-white px-5 py-4 sm:flex-row sm:justify-end">
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

      {fullScreenImageUrl && (
        <div ref={imageModalRef} role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            onClick={closeFullScreenImage}
            className="absolute right-4 top-4 rounded-lg bg-[#efabab] px-4 py-2 text-sm font-bold text-black shadow-sm"
          >
            ປິດ
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullScreenImageUrl}
            alt="ຮູບຜົນກວດເຕັມຈໍ"
            className="max-h-[92vh] max-w-[94vw] rounded-xl bg-white object-contain shadow-lg"
          />
        </div>
      )}
    </AppShell>
  );
}

async function printResultDocument(order: Order, result: Result) {
  const orderNo = order.document_no || `#${String(order.order_id).padStart(4, "0")}`;
  const resultNo = result.report_no || `R${String(result.result_id).padStart(5, "0")}`;
  const patientId = `HN-${String(order.patient_id).padStart(6, "0")}`;
  const issuedAt = new Date().toLocaleString("lo-LA");
  const imageUrl = result.result_image_url ? await getResultImageDataUrl(result.result_id) : "";

  printDocument(
    `ລາຍງານຜົນກວດ ${resultNo}`,
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

      <h1 class="title">ລາຍງານຜົນກວດ</h1>
      <section class="doc-meta">
        <span class="doc-no">ເລກລາຍງານ: ${escapeHtml(resultNo)}</span>
        <span>ສະຖານະ: ກວດສຳເລັດ</span>
      </section>

      <section class="grid">
        <div class="row"><span class="label">ເລກໃບສັ່ງກວດ</span><span class="value">${escapeHtml(orderNo)}</span></div>
        <div class="row"><span class="label">ລະຫັດຄົນເຈັບ</span><span class="value">${escapeHtml(patientId)}</span></div>
        <div class="row"><span class="label">ຊື່ຄົນເຈັບ</span><span class="value">${escapeHtml(patientName(order))}</span></div>
        <div class="row"><span class="label">ປະເພດການກວດ</span><span class="value">${escapeHtml(order.exam_name || result.exam_name || "-")}</span></div>
        <div class="row"><span class="label">ວັນທີກວດ</span><span class="value">${escapeHtml(formatDate(order.order_date))}</span></div>
        <div class="row"><span class="label">ວັນທີບັນທຶກ</span><span class="value">${escapeHtml(formatDate(result.result_date))}</span></div>
        <div class="row"><span class="label">ຜູ້ບັນທຶກ</span><span class="value">${escapeHtml(result.staff_name || "-")}</span></div>
      </section>

      <section class="section">
        <div class="section-title">ລາຍລະອຽດຜົນກວດ</div>
        <div class="box">${lineBreaks(result.result_detail || "-")}</div>
      </section>
      ${
        imageUrl
          ? `<section class="section">
              <div class="section-title">ຮູບຜົນກວດ</div>
              <img class="result-image" src="${escapeHtml(imageUrl)}" alt="ຮູບຜົນກວດ" />
            </section>`
          : ""
      }
      <div class="notice">ໝາຍເຫດ: ລາຍງານນີ້ເປັນຂໍ້ມູນຜົນກວດຈາກພະແນກລັງສີ.</div>

      <section class="signatures">
        <div class="signature-line">ຜູ້ບັນທຶກຜົນ</div>
        <div class="signature-line">ແພດ/ເຈົ້າໜ້າທີ່ຢືນຢັນ</div>
      </section>
      <div class="footer">ພະແນກລັງສີ - ໂຮງໝໍ 103 | ເອກະສານນີ້ອອກຈາກລະບົບຈັດການຂໍ້ມູນຄົນເຈັບ</div>
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
