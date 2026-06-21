"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppShell, { useCurrentUser } from "@/components/AppShell";
import { ActionButton, DataState, PageHero, SearchBox, StatusPill } from "@/components/dashboard-ui";
import api from "@/lib/api";
import { escapeHtml, printDocument, printLogoHtml } from "@/lib/print";
import { statusLabel } from "@/lib/status";
import { showToast } from "@/lib/toast";
import type { ApiResponse, Staff } from "@/lib/types";
import { useModalAccessibility } from "@/lib/useModalAccessibility";

export default function StaffPage() {
  const queryClient = useQueryClient();
  const userQuery = useCurrentUser();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const modalRef = useModalAccessibility(Boolean(deleteTarget), () => setDeleteTarget(null));
  const isAdmin = userQuery.data?.role === "ADMIN";
  const currentStaffId = Number(userQuery.data?.staff_id || userQuery.data?.id || 0);

  const staffQuery = useQuery({
    queryKey: ["staff"],
    queryFn: async () => (await api.get<ApiResponse<Staff[]>>("/staff")).data.data,
    enabled: isAdmin,
    retry: false,
  });

  const staff = useMemo(() => staffQuery.data ?? [], [staffQuery.data]);
  const filteredStaff = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return staff;
    return staff.filter((item) =>
      `${item.staff_id} STF-${String(item.staff_id).padStart(4, "0")} ${item.staff_name} ${item.username} ${item.position || ""} ${item.department || ""} ${item.phone || ""} ${item.role}`
        .toLowerCase()
        .includes(text)
    );
  }, [search, staff]);

  const adminCount = staff.filter((item) => item.role === "ADMIN").length;
  const regularStaffCount = staff.length - adminCount;

  const deleteMutation = useMutation({
    mutationFn: async (staffId: number) => (await api.delete<ApiResponse<unknown>>(`/staff/${staffId}`)).data,
    onSuccess: () => {
      showToast("success", "ປິດການນຳໃຊ້ພະນັກງານສຳເລັດ");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["staff-options"] });
    },
    onError: (error: unknown) => {
      showToast("error", getErrorMessage(error) || "ບໍ່ສາມາດປິດການນຳໃຊ້ພະນັກງານໄດ້");
    },
  });

  const handlePrint = () => {
    const issuedAt = new Date().toLocaleString("lo-LA");
    const rows = filteredStaff
      .map(
        (item, index) => `<tr>
          <td class="text-center">${index + 1}</td>
          <td>STF-${String(item.staff_id).padStart(4, "0")}</td>
          <td>${escapeHtml(item.staff_name)}</td>
          <td>${escapeHtml(item.username)}</td>
          <td>${escapeHtml(item.position || "-")}</td>
          <td>${escapeHtml(item.department || "-")}</td>
          <td>${escapeHtml(item.phone || "-")}</td>
          <td>${escapeHtml(statusLabel(item.role))}</td>
        </tr>`
      )
      .join("");

    printDocument(
      "ລາຍຊື່ພະນັກງານ",
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
        <h1 class="title">ລາຍຊື່ພະນັກງານ</h1>
        <section class="report-summary">
          <div class="report-card"><div class="report-card-label">ທັງໝົດ</div><div class="report-card-value">${filteredStaff.length}</div></div>
          <div class="report-card"><div class="report-card-label">ຜູ້ດູແລ</div><div class="report-card-value">${filteredStaff.filter((item) => item.role === "ADMIN").length}</div></div>
          <div class="report-card"><div class="report-card-label">ພະນັກງານ</div><div class="report-card-value">${filteredStaff.filter((item) => item.role !== "ADMIN").length}</div></div>
          <div class="report-card"><div class="report-card-label">ຜູ້ອອກເອກະສານ</div><div class="report-card-value">${escapeHtml(userQuery.data?.staff_name || userQuery.data?.name || "-")}</div></div>
        </section>
        <section class="section">
          <table>
            <thead><tr><th>#</th><th>ລະຫັດ</th><th>ຊື່</th><th>ຊື່ເຂົ້າລະບົບ</th><th>ຕຳແໜ່ງ</th><th>ພະແນກ</th><th>ເບີໂທ</th><th>ສິດ</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="8" class="text-center">ບໍ່ມີຂໍ້ມູນ</td></tr>'}</tbody>
          </table>
          <p class="report-note">ຈຳນວນລາຍການ: ${filteredStaff.length.toLocaleString("lo-LA")}</p>
        </section>
        <div class="footer">ພະແນກລັງສີ - ໂຮງໝໍ 103</div>
      </main>`
    );
  };

  const handleExport = () => {
    downloadCsv("staff-list.csv", [
      ["ລະຫັດ", "ຊື່ພະນັກງານ", "ຊື່ເຂົ້າລະບົບ", "ຕຳແໜ່ງ", "ພະແນກ", "ເບີໂທ", "ສິດນຳໃຊ້"],
      ...filteredStaff.map((item) => [
        `STF-${String(item.staff_id).padStart(4, "0")}`,
        item.staff_name,
        item.username,
        item.position || "",
        item.department || "",
        item.phone || "",
        statusLabel(item.role),
      ]),
    ]);
  };

  if (!userQuery.isAuthReady || userQuery.isLoading) {
    return (
      <AppShell>
        <div className="px-4 py-8 sm:px-6 lg:px-10"><DataState type="loading" /></div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <PageHero title="ຂໍ້ມູນພະນັກງານ" subtitle="ສະເພາະຜູ້ດູແລລະບົບເທົ່ານັ້ນ" />
        <div className="px-4 py-5 sm:px-6 lg:px-10">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
            ທ່ານບໍ່ມີສິດຈັດການຂໍ້ມູນພະນັກງານ
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHero title="ຂໍ້ມູນພະນັກງານ" subtitle="ຈັດການບັນຊີ ແລະ ສິດນຳໃຊ້ຂອງພະນັກງານ">
        <SearchBox value={search} onChange={setSearch} placeholder="ຄົ້ນຫາລະຫັດ, ຊື່, username ຫຼື ພະແນກ" />
        <ActionButton onClick={() => staffQuery.refetch()}>ໂຫຼດໃໝ່</ActionButton>
        <ActionButton href="/staff/new" tone="green">ເພີ່ມພະນັກງານ</ActionButton>
      </PageHero>

      <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-10">
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="ພະນັກງານທັງໝົດ" value={staff.length} color="#123879" />
          <SummaryCard label="ຜູ້ດູແລລະບົບ" value={adminCount} color="#8c4dff" />
          <SummaryCard label="ພະນັກງານ" value={regularStaffCount} color="#18a957" />
        </div>

        <section className="mt-5 rounded-2xl border border-[#d9d9d9] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-bold">ລາຍຊື່ພະນັກງານ</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <ActionButton tone="blue" onClick={handlePrint}>ພິມລາຍຊື່</ActionButton>
              <ActionButton tone="orange" onClick={handleExport}>ສົ່ງອອກ CSV</ActionButton>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {staffQuery.isLoading ? <DataState type="loading" compact /> : staffQuery.isError ? (
              <DataState type="error" message="ບໍ່ສາມາດໂຫຼດຂໍ້ມູນພະນັກງານໄດ້" onRetry={() => staffQuery.refetch()} compact />
            ) : filteredStaff.length === 0 ? <DataState type="empty" message="ບໍ່ພົບຂໍ້ມູນ" compact /> : filteredStaff.map((item) => (
              <article key={item.staff_id} className="rounded-xl border border-[#d9d9d9] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold text-[#1e66ff]">STF-{String(item.staff_id).padStart(4, "0")}</div><h4 className="mt-1 font-bold">{item.staff_name}</h4><div className="text-xs font-semibold text-[#767285]">{item.username}</div></div><StatusPill status={item.role} /></div>
                <div className="mt-3 space-y-1 text-xs font-semibold text-[#767285]"><div>{item.position || "-"} · {item.department || "-"}</div><div>{item.phone || "-"}</div></div>
                <div className="mt-4 flex flex-wrap gap-2"><Link href={`/staff/${item.staff_id}/edit`} className="rounded-lg bg-[#bafbd2] px-4 py-2 text-xs font-bold text-[#137547]">ແກ້ໄຂ</Link>{item.staff_id === currentStaffId ? <span className="rounded-lg bg-[#eeeafe] px-3 py-2 text-xs font-bold text-[#123879]">ບັນຊີທີ່ໃຊ້ງານ</span> : <button type="button" onClick={() => setDeleteTarget(item)} className="rounded-lg bg-[#ef4444] px-3 py-2 text-xs font-bold text-white">ປິດການນຳໃຊ້</button>}</div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-[#d9d9d9] md:block">
            <table className="w-full min-w-[920px] border-collapse text-left">
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
                {staffQuery.isLoading ? (
                  <tr><td className="px-5 py-6" colSpan={8}><DataState type="loading" compact /></td></tr>
                ) : staffQuery.isError ? (
                  <tr><td className="px-5 py-6" colSpan={8}><DataState type="error" message="ບໍ່ສາມາດໂຫຼດຂໍ້ມູນພະນັກງານໄດ້" onRetry={() => staffQuery.refetch()} compact /></td></tr>
                ) : filteredStaff.length === 0 ? (
                  <tr><td className="px-5 py-6" colSpan={8}><DataState type="empty" message="ບໍ່ພົບຂໍ້ມູນ" compact /></td></tr>
                ) : (
                  filteredStaff.map((item) => (
                    <tr key={item.staff_id} className="border-t border-[#d7d7d7]">
                      <td className="px-5 py-3">STF-{String(item.staff_id).padStart(4, "0")}</td>
                      <td className="px-5 py-3">{item.staff_name}</td>
                      <td className="px-5 py-3">{item.username}</td>
                      <td className="px-5 py-3">{item.position || "-"}</td>
                      <td className="px-5 py-3">{item.department || "-"}</td>
                      <td className="px-5 py-3">{item.phone || "-"}</td>
                      <td className="px-5 py-3"><StatusPill status={item.role} /></td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/staff/${item.staff_id}/edit`} className="inline-flex min-w-[76px] justify-center rounded-full bg-[#bafbd2] px-3 py-1 text-[11px] font-bold text-[#137547]">
                            ແກ້ໄຂ
                          </Link>
                          {item.staff_id === currentStaffId ? (
                            <span className="inline-flex min-w-[128px] justify-center rounded-full bg-[#eeeafe] px-3 py-1 text-[11px] font-bold text-[#123879]">
                              ບັນຊີທີ່ກຳລັງໃຊ້ງານ
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="inline-flex min-w-[92px] justify-center rounded-full bg-[#ef4444] px-3 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-[#dc2626]"
                            >
                              ປິດການນຳໃຊ້
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div ref={modalRef} role="dialog" aria-modal="true" className="w-full max-w-[520px] rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-2xl font-bold">ຢືນຢັນປິດການນຳໃຊ້</h3>
            <div className="mt-4 rounded-xl bg-[#f7f8fb] p-4 text-sm font-bold leading-7">
              <div>ລະຫັດ: STF-{String(deleteTarget.staff_id).padStart(4, "0")}</div>
              <div>ຊື່: {deleteTarget.staff_name}</div>
              <div>ສິດ: {statusLabel(deleteTarget.role)}</div>
            </div>
            <p className="mt-4 text-sm font-semibold leading-7 text-[#767285]">
              ພະນັກງານຈະຖືກຊ່ອນຈາກລາຍຊື່ ແລະ ບໍ່ສາມາດເຂົ້າລະບົບໄດ້.
              ປະຫວັດໃບສັ່ງກວດ, ການຊຳລະ ແລະ ຜົນກວດຈະຍັງຢູ່.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl bg-[#f4e3b0] px-6 py-3 text-sm font-bold shadow-sm">
                ຍົກເລີກ
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteTarget.staff_id)}
                disabled={deleteMutation.isPending}
                className="rounded-xl bg-[#ef4444] px-6 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60"
              >
                {deleteMutation.isPending ? "ກຳລັງດຳເນີນການ..." : "ປິດການນຳໃຊ້"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-[#d9d9d9] bg-white px-5 py-4 text-center shadow-sm">
      <div className="text-sm font-bold text-[#767285]">{label}</div>
      <div className="mt-1 text-3xl font-bold" style={{ color }}>{value.toLocaleString("lo-LA")}</div>
    </div>
  );
}

function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message;
  }
  return undefined;
}
