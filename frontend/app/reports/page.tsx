"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell, { useCurrentUser } from "@/components/AppShell";
import { ActionButton, formatDateTime, PageHero, SearchBox, StatusPill, patientName } from "@/components/dashboard-ui";
import api from "@/lib/api";
import type { ApiResponse, Order, Patient, Payment, Staff } from "@/lib/types";

export default function ReportsPage() {
  const [tab, setTab] = useState<"patients" | "payments" | "staff">("patients");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const userQuery = useCurrentUser();
  const isAdmin = userQuery.data?.role === "ADMIN";

  const patientsQuery = useQuery({
    queryKey: ["patients", search],
    queryFn: async () => (await api.get<ApiResponse<Patient[]>>("/patients", { params: { q: search, limit: 50 } })).data.data,
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

  const payments = useMemo(() => paymentsQuery.data ?? [], [paymentsQuery.data]);
  const patients = patientsQuery.data ?? [];
  const staff = useMemo(() => staffQuery.data ?? [], [staffQuery.data]);
  const totalIncome = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const paidOrders = payments.length;
  const unpaidOrders = (ordersQuery.data ?? []).filter((order) => order.status !== "DONE" && order.status !== "COMPLETED").length;

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
    return payments.filter((payment) => {
      const paymentDate = payment.payment_date?.slice(0, 10) || "";
      const matchesDateFrom = !dateFrom || paymentDate >= dateFrom;
      const matchesDateTo = !dateTo || paymentDate <= dateTo;
      const matchesSearch =
        !text ||
        `${payment.order_id} ${patientName(payment)} ${payment.exam_name || ""} ${payment.payment_type || ""} ${payment.staff_name || ""}`
          .toLowerCase()
          .includes(text);
      return matchesDateFrom && matchesDateTo && matchesSearch;
    });
  }, [payments, search, dateFrom, dateTo]);

  const reportIncome = filteredPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const handleSearch = () => {
    if (tab === "patients") patientsQuery.refetch();
    if (tab === "payments") paymentsQuery.refetch();
    if (tab === "staff") staffQuery.refetch();
  };

  const handleExport = () => {
    if (tab === "patients") {
      downloadCsv("patients-report.csv", [
        ["ID", "ຊື່", "ນາມສະກຸນ", "ເພດ", "ເບີໂທ"],
        ...patients.map((patient) => [patient.patient_id, patient.first_name, patient.last_name, patient.gender || "", patient.phone || ""]),
      ]);
    }
    if (tab === "staff") {
      downloadCsv("staff-report.csv", [
        ["ID", "ຊື່ພະນັກງານ", "Username", "ຕຳແໜ່ງ", "ພະແນກ", "ເບີໂທ", "Role"],
        ...filteredStaff.map((staffItem) => [
          staffItem.staff_id,
          staffItem.staff_name,
          staffItem.username,
          staffItem.position || "",
          staffItem.department || "",
          staffItem.phone || "",
          staffItem.role,
        ]),
      ]);
    }
    if (tab === "payments") {
      downloadCsv("payments-report.csv", [
        ["Order ID", "ວັນທີຈ່າຍ", "ຄົນເຈັບ", "ປະເພດການກວດ", "ຈຳນວນເງິນ", "ຊ່ອງທາງ", "ຜູ້ຮັບເງິນ"],
        ...filteredPayments.map((payment) => [
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
        <PageHero title="ລາຍງານ" subtitle="ສະເພາະ ADMIN ເທົ່ານັ້ນ">
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
        <SearchBox value={search} onChange={setSearch} placeholder="DETAIL" />
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="ລາຍຮັບລວມ" value={(tab === "payments" ? reportIncome : totalIncome).toLocaleString("lo-LA")} color="#00c800" />
          <Summary label="ຄຳສັ່ງກວດທັງໝົດ" value={String((ordersQuery.data ?? []).length).padStart(3, "0")} color="#a47b00" suffix="ຄຳສັ່ງ" />
          <Summary label="ຄຳສັ່ງຍັງບໍ່ສຳເລັດ" value={unpaidOrders} color="#ff0000" suffix="ຄຳສັ່ງ" />
          <Summary label="ການຊຳລະເງິນ" value={String(paidOrders).padStart(3, "0")} color="#000" suffix="ລາຍການ" />
        </div>

        <section className="mt-5 rounded-2xl border border-[#d9d9d9] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
            <div className="flex gap-3">
            <ActionButton tone="blue" onClick={() => window.print()}>PDF</ActionButton>
            <ActionButton tone="orange" onClick={handleExport}>EXPORT</ActionButton>
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
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#d9d9d9] bg-white p-0 shadow-sm">
            {tab === "patients" && <PatientsReport patients={patients} />}
            {tab === "staff" && <StaffReport staff={filteredStaff} canEdit={isAdmin} />}
            {tab === "payments" && <PaymentsReport payments={filteredPayments} />}
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
    <table className="w-full min-w-[680px] border-collapse text-left">
      <thead className="bg-[#f2f2f2] text-xs font-bold">
        <tr>
          <th className="px-5 py-3">ID</th>
          <th className="px-5 py-3">ຊື່ຜູ້ປ່ວຍ</th>
          <th className="px-5 py-3">ເພດ</th>
          <th className="px-5 py-3">ສະຖານະ</th>
        </tr>
      </thead>
      <tbody className="text-xs text-[#767285]">
        {patients.length === 0 ? (
          <tr>
            <td className="px-5 py-6 text-center" colSpan={4}>
              ບໍ່ມີຂໍ້ມູນ
            </td>
          </tr>
        ) : (
          patients.map((patient) => (
            <tr key={patient.patient_id} className="border-t border-[#d7d7d7]">
              <td className="px-5 py-3">{String(patient.patient_id).padStart(2, "0")}</td>
              <td className="px-5 py-3">{patientName(patient)}</td>
              <td className="px-5 py-3">{patient.gender === "F" ? "ຍິງ" : patient.gender === "M" ? "ຊາຍ" : "ອື່ນໆ"}</td>
              <td className="px-5 py-3">
                <StatusPill status="ACTIVE" />
              </td>
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
          <th className="px-5 py-3">ID</th>
          <th className="px-5 py-3">ຊື່</th>
          <th className="px-5 py-3">Username</th>
          <th className="px-5 py-3">ຕຳແໜ່ງ</th>
          <th className="px-5 py-3">ພະແນກ</th>
          <th className="px-5 py-3">ເບີໂທ</th>
          <th className="px-5 py-3">Role</th>
          <th className="px-5 py-3">Action</th>
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
                    EDIT
                  </Link>
                ) : (
                  <span className="text-[#9d98aa]">ADMIN only</span>
                )}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function PaymentsReport({ payments }: { payments: Payment[] }) {
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
        </tr>
      </thead>
      <tbody className="text-xs text-[#767285]">
        {payments.length === 0 ? (
          <tr>
            <td className="px-5 py-6 text-center" colSpan={8}>
              ຍັງບໍ່ມີລາຍການຊຳລະ
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
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
