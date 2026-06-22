"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell, { useCurrentUser } from "@/components/AppShell";
import { ActionButton, DataState, formatDateTime, PageHero, Pagination, SearchBox, StatusPill, patientName } from "@/components/dashboard-ui";
import api from "@/lib/api";
import { escapeHtml, printDocument, printLogoHtml } from "@/lib/print";
import { getResultImageObjectUrl } from "@/lib/result-images";
import { displayOrderStatus, isReadyToPayStatus } from "@/lib/status";
import { showToast } from "@/lib/toast";
import type { ApiResponse, Order, Payment, Result } from "@/lib/types";
import { useModalAccessibility } from "@/lib/useModalAccessibility";

export default function ReportsPage() {
  const [tab, setTab] = useState<"payments" | "results">("payments");
  const [search, setSearch] = useState("");
  const [paymentPage, setPaymentPage] = useState(1);
  const [resultPage, setResultPage] = useState(1);
  const pageSize = 10;
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [incomePeriod, setIncomePeriod] = useState<"all" | "day" | "month">("all");
  const [incomeMethod, setIncomeMethod] = useState<IncomeMethod>("all");
  const [incomeDate, setIncomeDate] = useState(today);
  const [incomeMonth, setIncomeMonth] = useState(today.slice(0, 7));
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageOwned, setPreviewImageOwned] = useState(false);
  const [selectedResultDetail, setSelectedResultDetail] = useState<Result | null>(null);
  const detailModalRef = useModalAccessibility(Boolean(selectedResultDetail), () => setSelectedResultDetail(null));
  const imageModalRef = useModalAccessibility(Boolean(previewImageUrl), () => setPreviewImageUrl(null));
  const userQuery = useCurrentUser();
  const isAdmin = userQuery.data?.role === "ADMIN";
  const activeTab = isAdmin ? tab : "results";

  const ordersQuery = useQuery({
    queryKey: ["orders", "report"],
    queryFn: async () => (await api.get<ApiResponse<Order[]>>("/orders")).data.data,
    enabled: isAdmin,
    retry: false,
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await api.get<ApiResponse<Payment[]>>("/reports/payments")).data.data,
    enabled: isAdmin,
    retry: false,
  });

  const resultsQuery = useQuery({
    queryKey: ["results", "report"],
    queryFn: async () => (await api.get<ApiResponse<Result[]>>("/reports/results")).data.data,
    enabled: Boolean(userQuery.data),
    retry: false,
  });

  const payments = useMemo(() => (paymentsQuery.data ?? []).filter((payment) => paymentStatus(payment) === "PAID"), [paymentsQuery.data]);
  const results = useMemo(() => resultsQuery.data ?? [], [resultsQuery.data]);
  const unpaidOrders = (ordersQuery.data ?? []).filter(
    (order) => !order.payment_id && isReadyToPayStatus(displayOrderStatus(order))
  ).length;

  const filteredPayments = useMemo(() => {
    const text = search.trim().toLowerCase();
    const range = getIncomeDateRange(incomePeriod, incomeDate, incomeMonth);
    return payments.filter((payment) => {
      const paymentDate = payment.payment_date?.slice(0, 10) || "";
      const matchesDateFrom = !range.from || paymentDate >= range.from;
      const matchesDateTo = !range.to || paymentDate <= range.to;
      const matchesMethod = incomeMethod === "all" || normalizePaymentMethod(payment.payment_type) === incomeMethod;
      const matchesSearch =
        !text ||
        `${payment.receipt_no || ""} ${payment.order_id} ${patientName(payment)} ${payment.exam_name || ""} ${payment.payment_type || ""} ${payment.staff_name || ""}`
          .toLowerCase()
          .includes(text);
      return matchesDateFrom && matchesDateTo && matchesMethod && matchesSearch;
    });
  }, [payments, search, incomePeriod, incomeDate, incomeMonth, incomeMethod]);

  const filteredResults = useMemo(() => {
    const text = search.trim().toLowerCase();
    return results.filter((result) => {
      const resultDate = result.result_date?.slice(0, 10) || "";
      const matchesDateFrom = !dateFrom || resultDate >= dateFrom;
      const matchesDateTo = !dateTo || resultDate <= dateTo;
      const matchesSearch =
        !text ||
        `${result.result_id} ${result.order_id} ${result.patient_id || ""} ${patientName(result)} ${result.exam_name || ""} ${result.staff_name || ""} ${result.result_detail || ""}`
          .toLowerCase()
          .includes(text);
      return matchesDateFrom && matchesDateTo && matchesSearch;
    });
  }, [results, search, dateFrom, dateTo]);

  const reportIncome = filteredPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const cashIncome = filteredPayments
    .filter((payment) => normalizePaymentMethod(payment.payment_type) === "cash")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const transferIncome = filteredPayments
    .filter((payment) => normalizePaymentMethod(payment.payment_type) === "transfer")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const resultPatientCount = new Set(filteredResults.map((result) => result.patient_id).filter(Boolean)).size;
  const resultsWithImage = filteredResults.filter((result) => result.result_image_url).length;
  const resultsWithoutImage = filteredResults.length - resultsWithImage;
  const currentPaymentPage = Math.min(paymentPage, Math.max(1, Math.ceil(filteredPayments.length / pageSize)));
  const currentResultPage = Math.min(resultPage, Math.max(1, Math.ceil(filteredResults.length / pageSize)));
  const pagedPayments = filteredPayments.slice((currentPaymentPage - 1) * pageSize, currentPaymentPage * pageSize);
  const pagedResults = filteredResults.slice((currentResultPage - 1) * pageSize, currentResultPage * pageSize);
  const incomeByMethod = useMemo(() => groupPaymentsByMethod(filteredPayments), [filteredPayments]);
  const groupedPayments = useMemo(
    () => groupPaymentsByPeriod(filteredPayments, incomePeriod === "month" ? "month" : "day"),
    [filteredPayments, incomePeriod]
  );
  const baseIncomePeriodLabel =
    incomePeriod === "all"
      ? "ລາຍຮັບທັງໝົດ"
      : incomePeriod === "day"
      ? `ລາຍວັນ ${incomeDate || "-"}`
      : `ລາຍເດືອນ ${incomeMonth || "-"}`;
  const incomePeriodLabel = `${baseIncomePeriodLabel} / ${incomeMethodLabel(incomeMethod)}`;
  const resultDateRangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const handleRefresh = () => {
    if (activeTab === "payments") paymentsQuery.refetch();
    if (activeTab === "results") resultsQuery.refetch();
  };

  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setIncomePeriod("all");
    setIncomeMethod("all");
    setIncomeDate(today);
    setIncomeMonth(today.slice(0, 7));
  };

  const openResultImage = async (result: Result) => {
    try {
      const imageUrl = await getResultImageObjectUrl(result.result_id);
      setPreviewImageUrl(imageUrl);
      setPreviewImageOwned(true);
    } catch {
      showToast("error", "ບໍ່ສາມາດເປີດຮູບຜົນກວດໄດ້");
    }
  };

  const closePreviewImage = () => {
    if (previewImageOwned && previewImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewImageUrl);
    }
    setPreviewImageUrl(null);
    setPreviewImageOwned(false);
  };

  const handlePrint = () => {
    const period = activeTab === "payments" ? incomePeriodLabel : formatPeriod(dateFrom, dateTo);

    if (activeTab === "payments") {
      printTableReport({
        title: "ລາຍງານການຊຳລະເງິນ",
        period,
        summary: [
          [
            incomePeriod === "all" ? "ລາຍຮັບທັງໝົດ" : incomePeriod === "day" ? "ລາຍຮັບລາຍວັນ" : "ລາຍຮັບລາຍເດືອນ",
            `${reportIncome.toLocaleString("lo-LA")} ກີບ`,
          ],
          ["ຈຳນວນລາຍການ", filteredPayments.length.toLocaleString("lo-LA")],
          ["ຄຳສັ່ງລໍຖ້າຊຳລະ", unpaidOrders.toLocaleString("lo-LA")],
          ["ຜູ້ອອກລາຍງານ", userQuery.data?.staff_name || userQuery.data?.name || "-"],
        ],
        columns: [incomePeriod === "month" ? "ເດືອນ" : "ວັນທີ", "ຈຳນວນລາຍການ", "ລາຍຮັບລວມ", "ຊ່ອງທາງຊຳລະ"],
        rows: groupedPayments.map((group) => [
          group.period,
          group.count.toLocaleString("lo-LA"),
          `${group.total.toLocaleString("lo-LA")} ກີບ`,
          group.methods.map((item) => `${item.payment_type}: ${item.total.toLocaleString("lo-LA")} ກີບ`).join(" / "),
        ]),
        numericColumns: [1, 2],
      });
    }

    if (activeTab === "results") {
      printTableReport({
        title: "ລາຍງານຜົນກວດ",
        period,
        summary: [
          ["ຈຳນວນຜົນກວດ", filteredResults.length.toLocaleString("lo-LA")],
          ["ຄົນເຈັບທີ່ມີຜົນກວດ", new Set(filteredResults.map((result) => result.patient_id)).size.toLocaleString("lo-LA")],
          ["ມີຮູບຜົນກວດ", filteredResults.filter((result) => result.result_image_url).length.toLocaleString("lo-LA")],
          ["ຜູ້ອອກລາຍງານ", userQuery.data?.staff_name || userQuery.data?.name || "-"],
        ],
        columns: ["ເລກຜົນກວດ", "ເລກໃບສັ່ງກວດ", "ລະຫັດຄົນເຈັບ", "ຄົນເຈັບ", "ປະເພດການກວດ", "ວັນທີບັນທຶກ", "ຜູ້ບັນທຶກ", "ລາຍລະອຽດ", "ຮູບ"],
        rows: filteredResults.map((result) => [
          `R${String(result.result_id).padStart(5, "0")}`,
          `#${String(result.order_id).padStart(4, "0")}`,
          result.patient_id ? `HN-${String(result.patient_id).padStart(6, "0")}` : "-",
          patientName(result),
          result.exam_name || "-",
          formatDateTime(result.result_date),
          result.staff_name || "-",
          result.result_detail || "-",
          result.result_image_url ? "ມີຮູບ" : "-",
        ]),
      });
    }
  };

  const handleExport = () => {
    if (activeTab === "payments") {
      downloadCsv("payments-report.csv", [
        ["ເລກໃບຮັບເງິນ", "Order ID", "ວັນທີຈ່າຍ", "ຄົນເຈັບ", "ປະເພດການກວດ", "ຈຳນວນເງິນ", "ຊ່ອງທາງ", "ຜູ້ຮັບເງິນ"],
        ...filteredPayments.map((payment) => [
          receiptNumber(payment),
          payment.order_id,
          payment.payment_date,
          patientName(payment),
          payment.exam_name || "",
          payment.amount,
          payment.payment_type || "",
          payment.staff_name || "",
        ]),
      ]);
    }
    if (activeTab === "results") {
      downloadCsv("results-report.csv", [
        ["Result ID", "Order ID", "Patient ID", "ຄົນເຈັບ", "ປະເພດການກວດ", "ວັນທີບັນທຶກ", "ຜູ້ບັນທຶກ", "ລາຍລະອຽດ", "ຮູບ"],
        ...filteredResults.map((result) => [
          result.result_id,
          result.order_id,
          result.patient_id || "",
          patientName(result),
          result.exam_name || "",
          result.result_date,
          result.staff_name || "",
          result.result_detail || "",
          result.result_image_url || "",
        ]),
      ]);
    }
  };

  if (!userQuery.isAuthReady || userQuery.isLoading) {
    return (
      <AppShell>
        <div className="px-4 py-8 text-center font-semibold text-[#767285]">ກຳລັງໂຫຼດ...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHero title="ລາຍງານ" subtitle={isAdmin ? "ລາຍງານການຊຳລະ ແລະ ຜົນກວດ" : "ລາຍງານຜົນກວດ"}>
        <SearchBox value={search} onChange={(value) => { setSearch(value); setPaymentPage(1); setResultPage(1); }} placeholder="ຄົ້ນຫາລາຍລະອຽດ" />
        <ActionButton tone="violet" onClick={handleRefresh}>
          ໂຫຼດໃໝ່
        </ActionButton>
        <ActionButton onClick={clearFilters}>ລ້າງຕົວກອງ</ActionButton>
      </PageHero>

      <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-10">
        <div className="mb-4 flex items-end gap-2 overflow-x-auto border-b border-[#d9d9d9] sm:gap-3">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setTab("payments")}
              className={`shrink-0 rounded-t-xl border border-b-0 px-4 py-2.5 text-base font-bold sm:px-5 ${
                activeTab === "payments" ? "bg-[#123879] text-white" : "bg-white text-[#120d34]"
              }`}
            >
              ລາຍງານການຊຳລະ
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab("results")}
            className={`shrink-0 rounded-t-xl border border-b-0 px-4 py-2.5 text-base font-bold sm:px-5 ${
              activeTab === "results" ? "bg-[#123879] text-white" : "bg-white text-[#120d34]"
            }`}
          >
            ລາຍງານຜົນກວດ
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {activeTab === "payments" ? (
            <>
              <Summary
                label={incomePeriod === "all" ? "ລາຍຮັບທັງໝົດ" : incomePeriod === "day" ? "ລາຍຮັບລາຍວັນ" : "ລາຍຮັບລາຍເດືອນ"}
                value={reportIncome.toLocaleString("lo-LA")}
                color="#00a83e"
                suffix="ກີບ"
              />
              <Summary label="ຈຳນວນລາຍການ" value={filteredPayments.length} color="#123879" suffix="ລາຍການ" />
              <Summary label="ເງິນສົດ" value={cashIncome.toLocaleString("lo-LA")} color="#8c4dff" suffix="ກີບ" />
              <Summary label="ເງິນໂອນ" value={transferIncome.toLocaleString("lo-LA")} color="#168bd2" suffix="ກີບ" />
              <Summary label="ຄ້າງຊຳລະ" value={unpaidOrders} color="#e44343" suffix="ຄຳສັ່ງ" />
            </>
          ) : (
            <>
              <Summary label="ຜົນກວດທັງໝົດ" value={filteredResults.length} color="#123879" suffix="ລາຍການ" />
              <Summary label="ຄົນເຈັບ" value={resultPatientCount} color="#8c4dff" suffix="ຄົນ" />
              <Summary label="ມີຮູບຜົນກວດ" value={resultsWithImage} color="#00a83e" suffix="ລາຍການ" />
              <Summary label="ບໍ່ມີຮູບ" value={resultsWithoutImage} color="#e28400" suffix="ລາຍການ" />
            </>
          )}
        </div>

        <section className="mt-5 rounded-2xl border border-[#d9d9d9] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {activeTab === "payments" ? (
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
                <div className="flex rounded-lg border border-[#d9d9d9] bg-[#f7f8fb] p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setIncomePeriod("all")}
                    className={`h-9 rounded-md px-4 text-sm font-bold ${incomePeriod === "all" ? "bg-[#123879] text-white" : "text-[#767285]"}`}
                  >
                    ທັງໝົດ
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomePeriod("day")}
                    className={`h-9 rounded-md px-4 text-sm font-bold ${incomePeriod === "day" ? "bg-[#123879] text-white" : "text-[#767285]"}`}
                  >
                    ລາຍວັນ
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomePeriod("month")}
                    className={`h-9 rounded-md px-4 text-sm font-bold ${incomePeriod === "month" ? "bg-[#123879] text-white" : "text-[#767285]"}`}
                  >
                    ລາຍເດືອນ
                  </button>
                </div>
                <div className="flex rounded-lg border border-[#d9d9d9] bg-[#f7f8fb] p-1 shadow-sm">
                  {([
                    ["all", "ທັງໝົດ"],
                    ["cash", "ເງິນສົດ"],
                    ["transfer", "ເງິນໂອນ"],
                  ] as const).map(([method, label]) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setIncomeMethod(method)}
                      className={`h-9 rounded-md px-4 text-sm font-bold ${incomeMethod === method ? "bg-[#137547] text-white" : "text-[#767285]"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {incomePeriod === "all" ? null : incomePeriod === "day" ? (
                  <label className="text-xs font-bold text-[#767285]">
                    ເລືອກວັນທີ
                    <input
                      type="date"
                      value={incomeDate}
                      onChange={(event) => setIncomeDate(event.target.value)}
                      className="mt-1 h-10 rounded-lg border border-[#d9d9d9] px-3 text-sm text-[#120d34] shadow-sm"
                    />
                  </label>
                ) : (
                  <label className="text-xs font-bold text-[#767285]">
                    ເລືອກເດືອນ
                    <input
                      type="month"
                      value={incomeMonth}
                      onChange={(event) => setIncomeMonth(event.target.value)}
                      className="mt-1 h-10 rounded-lg border border-[#d9d9d9] px-3 text-sm text-[#120d34] shadow-sm"
                    />
                  </label>
                )}
                <div className="rounded-lg bg-[#f2fde9] px-4 py-2 text-sm font-bold text-[#137547] shadow-sm">
                  {incomePeriodLabel}: {reportIncome.toLocaleString("lo-LA")} ກີບ
                </div>
              </div>
            ) : (
              <div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="text-xs font-bold text-[#767285]">
                    ຈາກວັນທີ
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(event) => setDateFrom(event.target.value)}
                      className={`mt-1 h-10 rounded-lg border px-3 text-sm text-[#120d34] shadow-sm ${
                        resultDateRangeInvalid ? "border-red-500 bg-red-50" : "border-[#d9d9d9]"
                      }`}
                    />
                  </label>
                  <label className="text-xs font-bold text-[#767285]">
                    ຫາວັນທີ
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(event) => setDateTo(event.target.value)}
                      className={`mt-1 h-10 rounded-lg border px-3 text-sm text-[#120d34] shadow-sm ${
                        resultDateRangeInvalid ? "border-red-500 bg-red-50" : "border-[#d9d9d9]"
                      }`}
                    />
                  </label>
                </div>
                {resultDateRangeInvalid && (
                  <p className="mt-2 text-sm font-bold text-red-600">
                    ວັນທີເລີ່ມຕ້ອງບໍ່ຫຼາຍກວ່າວັນທີສິ້ນສຸດ
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <ActionButton
                tone="blue"
                onClick={handlePrint}
                disabled={activeTab === "results" && resultDateRangeInvalid}
              >
                ພິມເອກະສານ
              </ActionButton>
              <ActionButton
                tone="orange"
                onClick={handleExport}
                disabled={activeTab === "results" && resultDateRangeInvalid}
              >
                ສົ່ງອອກ
              </ActionButton>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#d9d9d9] bg-white p-0 shadow-sm">
            {activeTab === "payments" && paymentsQuery.isLoading ? (
              <div className="p-4"><DataState type="loading" /></div>
            ) : activeTab === "payments" && paymentsQuery.isError ? (
              <div className="p-4"><DataState type="error" message="ບໍ່ສາມາດໂຫຼດລາຍງານການຊຳລະໄດ້" onRetry={() => paymentsQuery.refetch()} /></div>
            ) : activeTab === "results" && resultsQuery.isLoading ? (
              <div className="p-4"><DataState type="loading" /></div>
            ) : activeTab === "results" && resultsQuery.isError ? (
              <div className="p-4"><DataState type="error" message="ບໍ່ສາມາດໂຫຼດລາຍງານຜົນກວດໄດ້" onRetry={() => resultsQuery.refetch()} /></div>
            ) : activeTab === "payments" ? (
              <PaymentsReport
                payments={pagedPayments}
                groupedPayments={groupedPayments}
                incomeByMethod={incomeByMethod}
                groupMode={incomePeriod === "month" ? "month" : "day"}
              />
            ) : (
              <ResultsReport
                results={pagedResults}
                onViewDetail={setSelectedResultDetail}
                onViewImage={openResultImage}
              />
            )}
            {activeTab === "payments" ? (
              <Pagination page={currentPaymentPage} totalItems={filteredPayments.length} pageSize={pageSize} onPageChange={setPaymentPage} />
            ) : (
              <Pagination page={currentResultPage} totalItems={filteredResults.length} pageSize={pageSize} onPageChange={setResultPage} />
            )}
          </div>
        </section>
      </div>

      {selectedResultDetail && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/45 p-4">
          <div ref={detailModalRef} role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-[760px] overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#d9d9d9] px-5 py-4">
              <div>
                <h3 className="text-xl font-bold text-[#123879]">ລາຍລະອຽດຜົນກວດ</h3>
                <p className="mt-1 text-sm font-semibold text-[#767285]">
                  {selectedResultDetail.report_no || `R${String(selectedResultDetail.result_id).padStart(5, "0")}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResultDetail(null)}
                className="shrink-0 rounded-lg bg-[#f4e3b0] px-4 py-2 text-sm font-bold text-black shadow-sm"
              >
                ປິດ
              </button>
            </div>

            <div className="p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <ResultDetailItem label="ເລກຜົນກວດ" value={selectedResultDetail.report_no || `R${String(selectedResultDetail.result_id).padStart(5, "0")}`} />
                <ResultDetailItem label="ໃບສັ່ງກວດ" value={`#${String(selectedResultDetail.order_id).padStart(4, "0")}`} />
                <ResultDetailItem
                  label="ລະຫັດຄົນເຈັບ"
                  value={selectedResultDetail.patient_id ? `HN-${String(selectedResultDetail.patient_id).padStart(6, "0")}` : "-"}
                />
                <ResultDetailItem label="ຊື່ຄົນເຈັບ" value={patientName(selectedResultDetail)} />
                <ResultDetailItem label="ປະເພດການກວດ" value={selectedResultDetail.exam_name || "-"} />
                <ResultDetailItem label="ວັນທີບັນທຶກ" value={formatDateTime(selectedResultDetail.result_date)} />
                <ResultDetailItem label="ຜູ້ບັນທຶກ" value={selectedResultDetail.staff_name || "-"} />
                <ResultDetailItem label="ເບີໂທຄົນເຈັບ" value={selectedResultDetail.patient_phone || "-"} />
              </div>

              <div className="mt-4">
                <div className="text-xs font-bold text-[#767285]">ລາຍລະອຽດຜົນກວດ</div>
                <div className="mt-2 whitespace-pre-wrap rounded-xl bg-[#f7f8fb] p-4 text-sm font-semibold leading-7 text-[#120d34]">
                  {selectedResultDetail.result_detail || "-"}
                </div>
              </div>

              {selectedResultDetail.result_image_url && (
                <button
                  type="button"
                  onClick={() => openResultImage(selectedResultDetail)}
                  className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#addbf4] px-5 text-sm font-bold text-[#123879] shadow-sm sm:w-auto"
                >
                  ເບິ່ງຮູບຜົນກວດ
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {previewImageUrl && (
        <div ref={imageModalRef} role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            onClick={closePreviewImage}
            className="absolute right-4 top-4 rounded-lg bg-[#efabab] px-4 py-2 text-sm font-bold text-black shadow-sm"
          >
            ປິດ
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImageUrl}
            alt="ຮູບຜົນກວດ"
            className="max-h-[92vh] max-w-[94vw] rounded-xl bg-white object-contain shadow-lg"
          />
        </div>
      )}

    </AppShell>
  );
}

function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatPeriod(dateFrom: string, dateTo: string) {
  if (dateFrom && dateTo) return `${dateFrom} - ${dateTo}`;
  if (dateFrom) return `ຕັ້ງແຕ່ ${dateFrom}`;
  if (dateTo) return `ເຖິງ ${dateTo}`;
  return "ທັງໝົດ";
}

function getIncomeDateRange(period: "all" | "day" | "month", date: string, month: string) {
  if (period === "all") {
    return { from: "", to: "" };
  }

  if (period === "day") {
    return { from: date, to: date };
  }

  if (!month) return { from: "", to: "" };
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return { from: "", to: "" };
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function printTableReport({
  title,
  period,
  summary,
  columns,
  rows,
  numericColumns = [],
}: {
  title: string;
  period: string;
  summary: Array<[string, string]>;
  columns: string[];
  rows: Array<Array<string | number>>;
  numericColumns?: number[];
}) {
  const issuedAt = new Date().toLocaleString("lo-LA");
  const reportNo = `RPT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const bodyRows = rows.length
    ? rows
        .map(
          (row, rowIndex) =>
            `<tr>
              <td class="text-center nowrap">${rowIndex + 1}</td>
              ${row
                .map((cell, cellIndex) => {
                  const align = numericColumns.includes(cellIndex) ? " text-right nowrap" : "";
                  return `<td class="${align.trim()}">${escapeHtml(cell)}</td>`;
                })
                .join("")}
            </tr>`
        )
        .join("")
    : `<tr><td class="text-center" colspan="${columns.length + 1}">ບໍ່ມີຂໍ້ມູນ</td></tr>`;

  printDocument(
    title,
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

      <h1 class="title">${escapeHtml(title)}</h1>
      <section class="doc-meta">
        <span class="doc-no">ເລກລາຍງານ: ${escapeHtml(reportNo)}</span>
        <span>ຊ່ວງຂໍ້ມູນ: ${escapeHtml(period)}</span>
      </section>

      <section class="report-summary">
        ${summary
          .map(
            ([label, value]) =>
              `<div class="report-card">
                <div class="report-card-label">${escapeHtml(label)}</div>
                <div class="report-card-value">${escapeHtml(value)}</div>
              </div>`
          )
          .join("")}
      </section>

      <section class="section">
        <div class="section-title">ຕາຕະລາງລາຍງານ</div>
        <table>
          <thead>
            <tr>
              <th class="text-center nowrap">#</th>
              ${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
        <p class="report-note">ຈຳນວນລາຍການທັງໝົດ: ${rows.length.toLocaleString("lo-LA")}</p>
      </section>

      <section class="signatures">
        <div class="signature-line">ຜູ້ອອກລາຍງານ</div>
        <div class="signature-line">ຜູ້ກວດສອບ</div>
      </section>
      <div class="footer">ພະແນກລັງສີ - ໂຮງໝໍ 103 | ລາຍງານນີ້ອອກຈາກລະບົບຈັດການຂໍ້ມູນຄົນເຈັບ</div>
    </main>`
  );
}

function Summary({ label, value, color, suffix }: { label: string; value: string | number; color: string; suffix?: string }) {
  return (
    <div className="rounded-xl border border-[#d9d9d9] bg-white px-4 py-3 text-center shadow-sm">
      <div className="text-sm font-bold">{label}</div>
      <div className="mt-1 text-2xl font-semibold" style={{ color }}>
        {value} {suffix && <span className="text-sm text-black">{suffix}</span>}
      </div>
    </div>
  );
}

function PaymentsReport({
  payments,
  groupedPayments,
  incomeByMethod,
  groupMode,
}: {
  payments: Payment[];
  groupedPayments: PaymentPeriodGroup[];
  incomeByMethod: PaymentMethodGroup[];
  groupMode: "day" | "month";
}) {
  return (
    <div className="space-y-5 p-4">
      <section>
        <h3 className="mb-3 text-lg font-bold text-[#120d34]">ສະຫຼຸບລາຍຮັບຕາມຊ່ອງທາງຊຳລະ</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {incomeByMethod.length === 0 ? (
            <div className="rounded-xl bg-[#f7f8fb] p-4 text-center text-sm font-bold text-[#767285]">ບໍ່ມີຂໍ້ມູນ</div>
          ) : (
            incomeByMethod.map((item) => (
              <div key={item.payment_type} className="rounded-xl border border-[#d9d9d9] bg-[#f7f8fb] p-4">
                <div className="text-sm font-bold text-[#767285]">{item.payment_type}</div>
                <div className="mt-2 text-2xl font-bold text-[#137547]">{item.total.toLocaleString("lo-LA")} ກີບ</div>
                <div className="mt-1 text-xs font-bold text-[#120d34]">{item.count.toLocaleString("lo-LA")} ລາຍການ</div>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold text-[#120d34]">
          {groupMode === "month" ? "ລາຍງານລາຍເດືອນແບບຈັດກຸ່ມ" : "ລາຍງານລາຍວັນແບບຈັດກຸ່ມ"}
        </h3>
        <div className="space-y-3 md:hidden">
          {groupedPayments.length === 0 ? <div className="rounded-xl bg-[#f7f8fb] p-4 text-center font-bold text-[#767285]">ຍັງບໍ່ມີລາຍການຊຳລະ</div> : groupedPayments.map((group) => (
            <article key={group.period} className="rounded-xl border border-[#d9d9d9] p-4 shadow-sm">
              <div className="font-bold text-[#123879]">{group.period}</div>
              <div className="mt-2 text-2xl font-bold text-[#137547]">{group.total.toLocaleString("lo-LA")} ກີບ</div>
              <div className="mt-1 text-xs font-semibold text-[#767285]">{group.count.toLocaleString("lo-LA")} ລາຍການ</div>
              <div className="mt-3 text-xs font-semibold">{group.methods.map((item) => `${item.payment_type}: ${item.total.toLocaleString("lo-LA")} ກີບ`).join(" / ")}</div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead className="bg-[#f2f2f2] text-xs font-bold">
            <tr>
              <th className="px-5 py-3">{groupMode === "month" ? "ເດືອນ" : "ວັນທີ"}</th>
              <th className="px-5 py-3">ຈຳນວນລາຍການ</th>
              <th className="px-5 py-3">ລາຍຮັບລວມ</th>
              <th className="px-5 py-3">ຊ່ອງທາງຊຳລະ</th>
            </tr>
          </thead>
          <tbody className="text-xs text-[#767285]">
            {groupedPayments.length === 0 ? (
              <tr>
                <td className="px-5 py-6 text-center" colSpan={4}>
                  ຍັງບໍ່ມີລາຍການຊຳລະ
                </td>
              </tr>
            ) : (
              groupedPayments.map((group) => (
                <tr key={group.period} className="border-t border-[#d7d7d7]">
                  <td className="px-5 py-3 font-bold text-[#120d34]">{group.period}</td>
                  <td className="px-5 py-3">{group.count.toLocaleString("lo-LA")}</td>
                  <td className="px-5 py-3 font-bold text-[#137547]">{group.total.toLocaleString("lo-LA")} ກີບ</td>
                  <td className="px-5 py-3">{group.methods.map((item) => `${item.payment_type}: ${item.total.toLocaleString("lo-LA")} ກີບ`).join(" / ")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold text-[#120d34]">ລາຍການຊຳລະລະອຽດ</h3>
        <div className="space-y-3 md:hidden">
          {payments.length === 0 ? <div className="rounded-xl bg-[#f7f8fb] p-4 text-center font-bold text-[#767285]">ຍັງບໍ່ມີລາຍການຊຳລະ</div> : payments.map((payment) => (
            <article key={payment.payment_id} className="rounded-xl border border-[#d9d9d9] p-4 shadow-sm">
              <div className="flex justify-between gap-3"><div><div className="text-xs font-bold text-[#1e66ff]">{receiptNumber(payment)}</div><div className="mt-1 font-bold">{patientName(payment)}</div></div><StatusPill status="ຈ່າຍແລ້ວ" /></div>
              <div className="mt-3 space-y-1 text-xs font-semibold text-[#767285]"><div>{payment.exam_name || "-"}</div><div>{formatDateTime(payment.payment_date)}</div><div>{payment.payment_type || "-"} · {payment.staff_name || "-"}</div></div>
              <div className="mt-3 text-xl font-bold text-[#137547]">{Number(payment.amount || 0).toLocaleString("lo-LA")} ກີບ</div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1040px] border-collapse text-left">
          <thead className="bg-[#f2f2f2] text-xs font-bold">
            <tr>
              <th className="px-5 py-3">ເລກໃບຮັບເງິນ</th>
              <th className="px-5 py-3">ໃບສັ່ງກວດ</th>
              <th className="px-5 py-3">ວັນທີຈ່າຍ</th>
              <th className="px-5 py-3">ຊື່ຄົນເຈັບ</th>
              <th className="px-5 py-3">ປະເພດການກວດ</th>
              <th className="px-5 py-3">ຈຳນວນເງິນ</th>
              <th className="px-5 py-3">ຊ່ອງທາງ</th>
              <th className="px-5 py-3">ຜູ້ຮັບເງິນ</th>
              <th className="px-5 py-3">ສະຖານະ</th>
            </tr>
          </thead>
          <tbody className="text-xs text-[#767285]">
            {payments.length === 0 ? (
              <tr>
                <td className="px-5 py-6 text-center" colSpan={9}>
                  ຍັງບໍ່ມີລາຍການຊຳລະ
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.payment_id} className="border-t border-[#d7d7d7]">
                  <td className="px-5 py-3">{receiptNumber(payment)}</td>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}

function ResultsReport({
  results,
  onViewDetail,
  onViewImage,
}: {
  results: Result[];
  onViewDetail: (result: Result) => void;
  onViewImage: (result: Result) => void;
}) {
  return (
    <>
    <div className="space-y-3 p-3 md:hidden">
      {results.length === 0 ? <div className="rounded-xl bg-[#f7f8fb] p-4 text-center font-bold text-[#767285]">ບໍ່ມີຜົນກວດ</div> : results.map((result) => (
        <article key={result.result_id} className="rounded-xl border border-[#d9d9d9] p-4 shadow-sm">
          <div className="text-xs font-bold text-[#1e66ff]">R{String(result.result_id).padStart(5, "0")} · HN-{String(result.patient_id || 0).padStart(6, "0")}</div>
          <h4 className="mt-1 font-bold">{patientName(result)}</h4>
          <div className="mt-3 space-y-1 text-xs font-semibold text-[#767285]"><div>{result.exam_name || "-"}</div><div>{formatDateTime(result.result_date)}</div><div>ຜູ້ບັນທຶກ: {result.staff_name || "-"}</div><div className="line-clamp-2 text-[#120d34]">{result.result_detail || "-"}</div></div>
          <div className="mt-4 flex flex-wrap gap-2">
            {result.result_image_url && <button type="button" onClick={() => onViewImage(result)} className="rounded-lg bg-[#addbf4] px-3 py-2 text-xs font-bold text-[#123879]">ເບິ່ງຮູບ</button>}
            <button type="button" onClick={() => onViewDetail(result)} className="rounded-lg bg-[#bafbd2] px-3 py-2 text-xs font-bold text-[#137547]">ເບິ່ງລາຍລະອຽດ</button>
          </div>
        </article>
      ))}
    </div>
    <div className="hidden overflow-x-auto md:block">
    <table className="w-full min-w-[1220px] border-collapse text-left">
      <thead className="bg-[#f2f2f2] text-xs font-bold">
        <tr>
          <th className="px-5 py-3">ເລກຜົນກວດ</th>
          <th className="px-5 py-3">ໃບສັ່ງກວດ</th>
          <th className="px-5 py-3">ລະຫັດຄົນເຈັບ</th>
          <th className="px-5 py-3">ຄົນເຈັບ</th>
          <th className="px-5 py-3">ປະເພດການກວດ</th>
          <th className="px-5 py-3">ວັນທີບັນທຶກ</th>
          <th className="px-5 py-3">ຜູ້ບັນທຶກ</th>
          <th className="px-5 py-3">ລາຍລະອຽດ</th>
          <th className="px-5 py-3">ຮູບ</th>
          <th className="px-5 py-3">ຈັດການ</th>
        </tr>
      </thead>
      <tbody className="text-xs text-[#767285]">
        {results.length === 0 ? (
          <tr>
            <td className="px-5 py-6 text-center" colSpan={10}>
              ບໍ່ມີຜົນກວດ
            </td>
          </tr>
        ) : (
          results.map((result) => (
            <tr key={result.result_id} className="border-t border-[#d7d7d7]">
              <td className="px-5 py-3">R{String(result.result_id).padStart(5, "0")}</td>
              <td className="px-5 py-3">#{String(result.order_id).padStart(4, "0")}</td>
              <td className="px-5 py-3">{result.patient_id ? `HN-${String(result.patient_id).padStart(6, "0")}` : "-"}</td>
              <td className="px-5 py-3">{patientName(result)}</td>
              <td className="px-5 py-3">{result.exam_name || "-"}</td>
              <td className="px-5 py-3">{formatDateTime(result.result_date)}</td>
              <td className="px-5 py-3">{result.staff_name || "-"}</td>
              <td className="max-w-[320px] truncate px-5 py-3">{result.result_detail || "-"}</td>
              <td className="px-5 py-3">
                {result.result_image_url ? (
                  <button
                    type="button"
                    onClick={() => onViewImage(result)}
                    className="rounded-full bg-[#addbf4] px-4 py-1 text-[11px] font-bold text-[#123879] shadow-sm"
                  >
                    ເບິ່ງຮູບ
                  </button>
                ) : (
                  "-"
                )}
              </td>
              <td className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => onViewDetail(result)}
                  className="whitespace-nowrap rounded-full bg-[#bafbd2] px-4 py-1 text-[11px] font-bold text-[#137547] shadow-sm"
                >
                  ເບິ່ງລາຍລະອຽດ
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

function ResultDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#d9d9d9] bg-white p-3">
      <div className="text-xs font-bold text-[#767285]">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-[#120d34]">{value}</div>
    </div>
  );
}

type PaymentMethodGroup = {
  payment_type: string;
  count: number;
  total: number;
};

type IncomeMethod = "all" | "cash" | "transfer";

type PaymentPeriodGroup = {
  period: string;
  count: number;
  total: number;
  methods: PaymentMethodGroup[];
};

function receiptNumber(payment: Payment) {
  return payment.receipt_no || `RCPT-${new Date(payment.payment_date).getFullYear() || new Date().getFullYear()}-${String(payment.payment_id).padStart(5, "0")}`;
}

function groupPaymentsByMethod(payments: Payment[]) {
  const map = new Map<string, PaymentMethodGroup>();
  payments.forEach((payment) => {
    const key = paymentMethodReportLabel(normalizePaymentMethod(payment.payment_type));
    const current = map.get(key) || { payment_type: key, count: 0, total: 0 };
    current.count += 1;
    current.total += Number(payment.amount || 0);
    map.set(key, current);
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function groupPaymentsByPeriod(payments: Payment[], mode: "day" | "month") {
  const map = new Map<string, Payment[]>();
  payments.forEach((payment) => {
    const date = payment.payment_date?.slice(0, mode === "month" ? 7 : 10) || "-";
    map.set(date, [...(map.get(date) || []), payment]);
  });

  return Array.from(map.entries())
    .map(([period, items]) => ({
      period,
      count: items.length,
      total: items.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      methods: groupPaymentsByMethod(items),
    }))
    .sort((a, b) => b.period.localeCompare(a.period));
}

function paymentStatus(payment: Payment) {
  return String(payment.status || "PAID").toUpperCase();
}

function normalizePaymentMethod(method?: string | null): "cash" | "transfer" | "other" {
  const value = String(method || "").trim();
  if (value === "ເງິນສົດ" || value.includes("ສົດ")) return "cash";
  if (value === "ເງິນໂອນ" || value === "ໂອນເງິນ" || value.includes("ໂອນ")) return "transfer";
  return "other";
}

function paymentMethodReportLabel(method: "cash" | "transfer" | "other") {
  if (method === "cash") return "ເງິນສົດ";
  if (method === "transfer") return "ເງິນໂອນ";
  return "ອື່ນໆ";
}

function incomeMethodLabel(method: IncomeMethod) {
  if (method === "cash") return "ເງິນສົດ";
  if (method === "transfer") return "ເງິນໂອນ";
  return "ທັງໝົດ";
}
