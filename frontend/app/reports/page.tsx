"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell, { useCurrentUser } from "@/components/AppShell";
import { ActionButton, formatDateTime, PageHero, SearchBox, StatusPill, patientName } from "@/components/dashboard-ui";
import api from "@/lib/api";
import { escapeHtml, printDocument, printLogoHtml } from "@/lib/print";
import { displayOrderStatus, isReadyToPayStatus, statusLabel } from "@/lib/status";
import type { ApiResponse, Order, Patient, Payment, Result, Staff } from "@/lib/types";

export default function ReportsPage() {
  const [tab, setTab] = useState<"patients" | "payments" | "staff" | "results">("patients");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [incomePeriod, setIncomePeriod] = useState<"all" | "day" | "month">("all");
  const [incomeDate, setIncomeDate] = useState(today);
  const [incomeMonth, setIncomeMonth] = useState(today.slice(0, 7));
  const userQuery = useCurrentUser();
  const isAdmin = userQuery.data?.role === "ADMIN";

  const patientsQuery = useQuery({
    queryKey: ["patients", search],
    queryFn: async () => (await api.get<ApiResponse<Patient[]>>("/patients", { params: { q: search, limit: 1000 } })).data.data,
    enabled: isAdmin,
    retry: false,
  });

  const ordersQuery = useQuery({
    queryKey: ["orders", "report"],
    queryFn: async () => (await api.get<ApiResponse<Order[]>>("/orders")).data.data,
    enabled: isAdmin,
    retry: false,
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await api.get<ApiResponse<Payment[]>>("/payments")).data.data,
    enabled: isAdmin,
    retry: false,
  });

  const staffQuery = useQuery({
    queryKey: ["staff"],
    queryFn: async () => (await api.get<ApiResponse<Staff[]>>("/staff")).data.data,
    enabled: isAdmin,
    retry: false,
  });

  const resultsQuery = useQuery({
    queryKey: ["results", "report"],
    queryFn: async () => (await api.get<ApiResponse<Result[]>>("/results")).data.data,
    enabled: isAdmin,
    retry: false,
  });

  const payments = useMemo(() => (paymentsQuery.data ?? []).filter((payment) => paymentStatus(payment) === "PAID"), [paymentsQuery.data]);
  const patients = patientsQuery.data ?? [];
  const staff = useMemo(() => staffQuery.data ?? [], [staffQuery.data]);
  const results = useMemo(() => resultsQuery.data ?? [], [resultsQuery.data]);
  const totalIncome = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const paidOrders = payments.length;
  const unpaidOrders = (ordersQuery.data ?? []).filter((order) => isReadyToPayStatus(displayOrderStatus(order))).length;

  const filteredStaff = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return staff;
    return staff.filter((item) =>
      `${item.staff_id} ${item.staff_name} ${item.username} ${item.position || ""} ${item.department || ""} ${item.phone || ""} ${item.role}`
        .toLowerCase()
        .includes(text)
    );
  }, [staff, search]);

  const filteredPayments = useMemo(() => {
    const text = search.trim().toLowerCase();
    const range = getIncomeDateRange(incomePeriod, incomeDate, incomeMonth);
    return payments.filter((payment) => {
      const paymentDate = payment.payment_date?.slice(0, 10) || "";
      const matchesDateFrom = !range.from || paymentDate >= range.from;
      const matchesDateTo = !range.to || paymentDate <= range.to;
      const matchesSearch =
        !text ||
        `${payment.receipt_no || ""} ${payment.order_id} ${patientName(payment)} ${payment.exam_name || ""} ${payment.payment_type || ""} ${payment.staff_name || ""}`
          .toLowerCase()
          .includes(text);
      return matchesDateFrom && matchesDateTo && matchesSearch;
    });
  }, [payments, search, incomePeriod, incomeDate, incomeMonth]);

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
  const incomeByMethod = useMemo(() => groupPaymentsByMethod(filteredPayments), [filteredPayments]);
  const groupedPayments = useMemo(
    () => groupPaymentsByPeriod(filteredPayments, incomePeriod === "month" ? "month" : "day"),
    [filteredPayments, incomePeriod]
  );
  const incomePeriodLabel =
    incomePeriod === "all"
      ? "ລາຍຮັບທັງໝົດ"
      : incomePeriod === "day"
      ? `ລາຍວັນ ${incomeDate || "-"}`
      : `ລາຍເດືອນ ${incomeMonth || "-"}`;

  const handleSearch = () => {
    if (tab === "patients") patientsQuery.refetch();
    if (tab === "payments") paymentsQuery.refetch();
    if (tab === "staff") staffQuery.refetch();
    if (tab === "results") resultsQuery.refetch();
  };

  const handlePrint = () => {
    const period = tab === "payments" ? incomePeriodLabel : formatPeriod(dateFrom, dateTo);

    if (tab === "patients") {
      printTableReport({
        title: "ລາຍງານຂໍ້ມູນຄົນເຈັບ",
        period,
        summary: [
          ["ຈຳນວນຄົນເຈັບ", patients.length.toLocaleString("lo-LA")],
          ["ຄຳສັ່ງກວດທັງໝົດ", (ordersQuery.data ?? []).length.toLocaleString("lo-LA")],
          ["ລາຍຮັບລວມ", `${totalIncome.toLocaleString("lo-LA")} ກີບ`],
          ["ຜູ້ອອກລາຍງານ", userQuery.data?.staff_name || userQuery.data?.name || "-"],
        ],
        columns: ["ລະຫັດຄົນເຈັບ", "ຊື່", "ນາມສະກຸນ", "ອາຍຸ", "ເພດ", "ວັນເກີດ", "ເບີໂທ", "ເບີສຸກເສີນ", "ທີ່ຢູ່", "ວັນທີລົງທະບຽນ"],
        rows: patients.map((patient) => [
          `HN-${String(patient.patient_id).padStart(6, "0")}`,
          patient.first_name || "-",
          patient.last_name || "-",
          patient.age ?? "-",
          patient.gender === "F" ? "ຍິງ" : patient.gender === "M" ? "ຊາຍ" : "ອື່ນໆ",
          patient.date_of_birth || "-",
          patient.phone || "-",
          patient.emergency_phone || "-",
          patient.address || "-",
          patient.created_at ? formatDateTime(patient.created_at) : "-",
        ]),
      });
    }

    if (tab === "staff") {
      printTableReport({
        title: "ລາຍງານຂໍ້ມູນພະນັກງານ",
        period,
        summary: [
          ["ຈຳນວນພະນັກງານ", filteredStaff.length.toLocaleString("lo-LA")],
          ["ຜູ້ດູແລ", filteredStaff.filter((item) => item.role === "ADMIN").length.toLocaleString("lo-LA")],
          ["ພະນັກງານ", filteredStaff.filter((item) => item.role !== "ADMIN").length.toLocaleString("lo-LA")],
          ["ຜູ້ອອກລາຍງານ", userQuery.data?.staff_name || userQuery.data?.name || "-"],
        ],
        columns: ["ລະຫັດ", "ຊື່ພະນັກງານ", "ຊື່ເຂົ້າລະບົບ", "ຕຳແໜ່ງ", "ພະແນກ", "ເບີໂທ", "ສິດນຳໃຊ້"],
        rows: filteredStaff.map((item) => [
          `STF-${String(item.staff_id).padStart(4, "0")}`,
          item.staff_name,
          item.username,
          item.position || "-",
          item.department || "-",
          item.phone || "-",
          statusLabel(item.role),
        ]),
      });
    }

    if (tab === "payments") {
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

    if (tab === "results") {
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
    if (tab === "patients") {
      downloadCsv("patients-report.csv", [
        ["ID", "ຊື່", "ນາມສະກຸນ", "ອາຍຸ", "ເພດ", "ວັນເກີດ", "ເບີໂທ", "ເບີສຸກເສີນ", "ທີ່ຢູ່", "ວັນທີລົງທະບຽນ"],
        ...patients.map((patient) => [
          patient.patient_id,
          patient.first_name,
          patient.last_name,
          patient.age ?? "",
          patient.gender || "",
          patient.date_of_birth || "",
          patient.phone || "",
          patient.emergency_phone || "",
          patient.address || "",
          patient.created_at || "",
        ]),
      ]);
    }
    if (tab === "staff") {
      downloadCsv("staff-report.csv", [
        ["ລະຫັດ", "ຊື່ພະນັກງານ", "ຊື່ເຂົ້າລະບົບ", "ຕຳແໜ່ງ", "ພະແນກ", "ເບີໂທ", "ສິດນຳໃຊ້"],
        ...filteredStaff.map((staffItem) => [
          staffItem.staff_id,
          staffItem.staff_name,
          staffItem.username,
          staffItem.position || "",
          staffItem.department || "",
          staffItem.phone || "",
          statusLabel(staffItem.role),
        ]),
      ]);
    }
    if (tab === "payments") {
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
    if (tab === "results") {
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

  if (userQuery.isLoading) {
    return (
      <AppShell>
        <div className="px-4 py-8 text-center font-semibold text-[#767285]">ກຳລັງໂຫຼດ...</div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <PageHero title="ລາຍງານ" subtitle="ສະເພາະຜູ້ດູແລລະບົບເທົ່ານັ້ນ">
          <ActionButton href="/dashboard">ກັບຄືນ</ActionButton>
        </PageHero>
        <div className="px-4 py-5 sm:px-6 lg:px-10">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
            ທ່ານບໍ່ມີສິດເບິ່ງລາຍງານ ຫຼື ຈັດການຂໍ້ມູນພະນັກງານ
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHero title="ລາຍງານ" subtitle="ລາຍລະອຽດການບັນທຶກຂໍ້ມູນ">
        <SearchBox value={search} onChange={setSearch} placeholder="ຄົ້ນຫາລາຍລະອຽດ" />
        <ActionButton tone="violet" onClick={handleSearch}>
          ຄົ້ນຫາ
        </ActionButton>
        {isAdmin && tab === "staff" && (
          <ActionButton href="/reports/staff/new" tone="green">
            ເພີ່ມພະນັກງານ
          </ActionButton>
        )}
        <ActionButton href="/dashboard">ກັບຄືນ</ActionButton>
      </PageHero>

      <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-10">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Summary label="ຄົນເຈັບທັງໝົດ" value={patients.length.toLocaleString("lo-LA")} color="#123879" />
          <Summary label="ພະນັກງານທັງໝົດ" value={staff.length.toLocaleString("lo-LA")} color="#18bdce" />
          <Summary
            label={
              tab === "payments"
                ? incomePeriod === "all"
                  ? "ລາຍຮັບທັງໝົດ"
                  : incomePeriod === "day"
                    ? "ລາຍຮັບລາຍວັນ"
                    : "ລາຍຮັບລາຍເດືອນ"
                : "ລາຍຮັບລວມ"
            }
            value={(tab === "payments" ? reportIncome : totalIncome).toLocaleString("lo-LA")}
            color="#00c800"
          />
          <Summary label="ຄຳສັ່ງກວດທັງໝົດ" value={String((ordersQuery.data ?? []).length).padStart(3, "0")} color="#a47b00" suffix="ຄຳສັ່ງ" />
          <Summary label="ຄຳສັ່ງຍັງບໍ່ສຳເລັດ" value={unpaidOrders} color="#ff0000" suffix="ຄຳສັ່ງ" />
          <Summary label="ການຊຳລະເງິນ" value={String(paidOrders).padStart(3, "0")} color="#000" suffix="ລາຍການ" />
        </div>

        <section className="mt-5 rounded-2xl border border-[#d9d9d9] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {tab === "payments" ? (
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
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="text-xs font-bold text-[#767285]">
                  ຈາກວັນທີ
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="mt-1 h-10 rounded-lg border border-[#d9d9d9] px-3 text-sm text-[#120d34] shadow-sm"
                  />
                </label>
                <label className="text-xs font-bold text-[#767285]">
                  ຫາວັນທີ
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="mt-1 h-10 rounded-lg border border-[#d9d9d9] px-3 text-sm text-[#120d34] shadow-sm"
                  />
                </label>
              </div>
            )}
            <div className="flex gap-3">
            <ActionButton tone="blue" onClick={handlePrint}>ພິມເອກະສານ</ActionButton>
            <ActionButton tone="orange" onClick={handleExport}>ສົ່ງອອກ</ActionButton>
            </div>
          </div>

          <div className="flex items-end gap-2 overflow-x-auto sm:gap-5">
            <button
              type="button"
              onClick={() => setTab("patients")}
              className={`shrink-0 rounded-t-xl border px-4 py-2 text-base font-bold sm:px-5 ${tab === "patients" ? "bg-[#dedede]" : "bg-white"}`}
            >
              ຂໍ້ມູນຄົນເຈັບ
            </button>
            <button
              type="button"
              onClick={() => setTab("staff")}
              className={`shrink-0 rounded-t-xl border px-4 py-2 text-base font-bold sm:px-5 ${tab === "staff" ? "bg-[#dedede]" : "bg-white"}`}
            >
              ຂໍ້ມູນພະນັກງານ
            </button>
            <button
              type="button"
              onClick={() => setTab("payments")}
              className={`shrink-0 rounded-t-xl border px-4 py-2 text-base font-bold sm:px-5 ${tab === "payments" ? "bg-[#dedede]" : "bg-white"}`}
            >
              ລາຍງານການຊຳລະ
            </button>
            <button
              type="button"
              onClick={() => setTab("results")}
              className={`shrink-0 rounded-t-xl border px-4 py-2 text-base font-bold sm:px-5 ${tab === "results" ? "bg-[#dedede]" : "bg-white"}`}
            >
              ລາຍງານຜົນກວດ
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#d9d9d9] bg-white p-0 shadow-sm">
            {tab === "patients" && <PatientsReport patients={patients} />}
            {tab === "staff" && <StaffReport staff={filteredStaff} canEdit={isAdmin} />}
            {tab === "payments" && (
              <PaymentsReport
                payments={filteredPayments}
                groupedPayments={groupedPayments}
                incomeByMethod={incomeByMethod}
                groupMode={incomePeriod === "month" ? "month" : "day"}
              />
            )}
            {tab === "results" && <ResultsReport results={filteredResults} />}
          </div>
        </section>
      </div>
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

function PatientsReport({ patients }: { patients: Patient[] }) {
  return (
    <table className="w-full min-w-[1100px] border-collapse text-left">
      <thead className="bg-[#f2f2f2] text-xs font-bold">
        <tr>
          <th className="px-5 py-3">ລະຫັດ</th>
          <th className="px-5 py-3">ຊື່</th>
          <th className="px-5 py-3">ນາມສະກຸນ</th>
          <th className="px-5 py-3">ອາຍຸ</th>
          <th className="px-5 py-3">ເພດ</th>
          <th className="px-5 py-3">ວັນເກີດ</th>
          <th className="px-5 py-3">ເບີໂທ</th>
          <th className="px-5 py-3">ເບີສຸກເສີນ</th>
          <th className="px-5 py-3">ທີ່ຢູ່</th>
          <th className="px-5 py-3">ວັນທີລົງທະບຽນ</th>
        </tr>
      </thead>
      <tbody className="text-xs text-[#767285]">
        {patients.length === 0 ? (
          <tr>
            <td className="px-5 py-6 text-center" colSpan={10}>
              ບໍ່ມີຂໍ້ມູນ
            </td>
          </tr>
        ) : (
          patients.map((patient) => (
            <tr key={patient.patient_id} className="border-t border-[#d7d7d7]">
              <td className="px-5 py-3">HN-{String(patient.patient_id).padStart(6, "0")}</td>
              <td className="px-5 py-3">{patient.first_name || "-"}</td>
              <td className="px-5 py-3">{patient.last_name || "-"}</td>
              <td className="px-5 py-3">{patient.age ?? "-"}</td>
              <td className="px-5 py-3">{patient.gender === "F" ? "ຍິງ" : patient.gender === "M" ? "ຊາຍ" : "ອື່ນໆ"}</td>
              <td className="px-5 py-3">{patient.date_of_birth || "-"}</td>
              <td className="px-5 py-3">{patient.phone || "-"}</td>
              <td className="px-5 py-3">{patient.emergency_phone || "-"}</td>
              <td className="max-w-[240px] px-5 py-3">{patient.address || "-"}</td>
              <td className="px-5 py-3">{patient.created_at ? formatDateTime(patient.created_at) : "-"}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function StaffReport({ staff, canEdit }: { staff: Staff[]; canEdit: boolean }) {
  return (
    <table className="w-full min-w-[900px] border-collapse text-left">
      <thead className="bg-[#f2f2f2] text-xs font-bold">
        <tr>
          <th className="px-5 py-3">ລະຫັດ</th>
          <th className="px-5 py-3">ຊື່</th>
          <th className="px-5 py-3">ຊື່ເຂົ້າລະບົບ</th>
          <th className="px-5 py-3">ຕຳແໜ່ງ</th>
          <th className="px-5 py-3">ພະແນກ</th>
          <th className="px-5 py-3">ເບີໂທ</th>
          <th className="px-5 py-3">ສິດນຳໃຊ້</th>
          <th className="px-5 py-3">ຈັດການ</th>
        </tr>
      </thead>
      <tbody className="text-xs text-[#767285]">
        {staff.length === 0 ? (
          <tr>
            <td className="px-5 py-6 text-center" colSpan={8}>
              ไม่มีข้อมูลพนักงาน
            </td>
          </tr>
        ) : (
          staff.map((item) => (
            <tr key={item.staff_id} className="border-t border-[#d7d7d7]">
              <td className="px-5 py-3">{String(item.staff_id).padStart(2, "0")}</td>
              <td className="px-5 py-3">{item.staff_name}</td>
              <td className="px-5 py-3">{item.username}</td>
              <td className="px-5 py-3">{item.position || "-"}</td>
              <td className="px-5 py-3">{item.department || "-"}</td>
              <td className="px-5 py-3">{item.phone || "-"}</td>
              <td className="px-5 py-3">
                <StatusPill status={item.role} />
              </td>
              <td className="px-5 py-3">
                {canEdit ? (
                  <Link
                    href={`/reports/staff/${item.staff_id}/edit`}
                    className="inline-flex min-w-[72px] justify-center rounded-full bg-[#bafbd2] px-3 py-1 text-[11px] font-bold text-[#137547]"
                  >
                    ແກ້ໄຂ
                  </Link>
                ) : (
                  <span className="text-[#9d98aa]">ສະເພາະຜູ້ດູແລ</span>
                )}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
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
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold text-[#120d34]">ລາຍການຊຳລະລະອຽດ</h3>
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
      </section>
    </div>
  );
}

function ResultsReport({ results }: { results: Result[] }) {
  return (
    <table className="w-full min-w-[1100px] border-collapse text-left">
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
        </tr>
      </thead>
      <tbody className="text-xs text-[#767285]">
        {results.length === 0 ? (
          <tr>
            <td className="px-5 py-6 text-center" colSpan={9}>
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
              <td className="px-5 py-3">{result.result_image_url ? "ມີຮູບ" : "-"}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

type PaymentMethodGroup = {
  payment_type: string;
  count: number;
  total: number;
};

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
    const key = payment.payment_type || "-";
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
