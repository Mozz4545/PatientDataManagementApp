"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppShell, { useCurrentUser } from "@/components/AppShell";
import { ActionButton, DataState, formatDateTime, PageHero, Pagination, Panel, SearchBox, SmallStat, patientName } from "@/components/dashboard-ui";
import api from "@/lib/api";
import { showToast } from "@/lib/toast";
import type { ApiResponse, Order, Patient, Result } from "@/lib/types";
import { useModalAccessibility } from "@/lib/useModalAccessibility";

export default function PatientsPage() {
  const queryClient = useQueryClient();
  const userQuery = useCurrentUser();
  const [resultPatient, setResultPatient] = useState<Patient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const isAdmin = userQuery.data?.role === "ADMIN";
  const modalRef = useModalAccessibility(Boolean(resultPatient || deleteTarget), () => {
    setResultPatient(null);
    setDeleteTarget(null);
  });

  const patientsQuery = useQuery({
    queryKey: ["patients", search],
    queryFn: async () => (await api.get<ApiResponse<Patient[]>>("/patients", { params: { q: search, limit: 1000 } })).data.data,
    retry: false,
  });

  const patientSummaryQuery = useQuery({
    queryKey: ["patients", "summary"],
    queryFn: async () => (await api.get<ApiResponse<Patient[]>>("/patients", { params: { limit: 1000 } })).data.data,
    retry: false,
  });

  const ordersQuery = useQuery({
    queryKey: ["orders", "patients"],
    queryFn: async () => (await api.get<ApiResponse<Order[]>>("/orders")).data.data,
    retry: false,
  });

  const resultsQuery = useQuery({
    queryKey: ["results", "patients"],
    queryFn: async () => (await api.get<ApiResponse<Result[]>>("/results")).data.data,
    retry: false,
  });

  const resultsByPatient = useMemo(() => {
    const map = new Map<number, Result[]>();
    (resultsQuery.data ?? []).forEach((result) => {
      if (!result.patient_id) return;
      map.set(result.patient_id, [...(map.get(result.patient_id) ?? []), result]);
    });
    return map;
  }, [resultsQuery.data]);

  const ordersByPatient = useMemo(() => {
    const map = new Map<number, Order[]>();
    (ordersQuery.data ?? []).forEach((order) => {
      map.set(order.patient_id, [...(map.get(order.patient_id) ?? []), order]);
    });
    return map;
  }, [ordersQuery.data]);

  const selectedResults = resultPatient ? resultsByPatient.get(resultPatient.patient_id) ?? [] : [];
  const allPatients = patientSummaryQuery.data ?? [];
  const patientRows = patientsQuery.data ?? [];
  const currentPage = Math.min(page, Math.max(1, Math.ceil(patientRows.length / pageSize)));
  const pagedPatients = patientRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const today = new Date().toLocaleDateString("en-CA");
  const newPatientsToday = allPatients.filter((patient) => dateOnly(patient.created_at) === today).length;
  const patientsWithHistory = new Set((ordersQuery.data ?? []).map((order) => order.patient_id)).size;

  const deletePatientMutation = useMutation({
    mutationFn: async (patientId: number) => (await api.delete<ApiResponse<unknown>>(`/patients/${patientId}`)).data,
    onSuccess: () => {
      showToast("success", "ລົບຄົນເຈັບອອກຈາກລາຍຊື່ສຳເລັດ");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: () => {
      showToast("error", "ບໍ່ສາມາດລົບຄົນເຈັບໄດ້");
    },
  });

  return (
    <AppShell>
      <PageHero title="ຂໍ້ມູນຄົນເຈັບ" subtitle="ຈັດການຂໍ້ມູນຄົນເຈັບ">
        <ActionButton href="/orders/new" tone="green">
          ສ້າງໃບສັ່ງກວດ
        </ActionButton>
      </PageHero>

      <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-10 lg:py-6">
        <div className="mb-5 grid gap-4 sm:grid-cols-3 lg:max-w-5xl">
          <SmallStat label="ຄົນເຈັບທັງໝົດ" value={allPatients.length} color="#1e66ff" />
          <SmallStat label="ຄົນເຈັບໃໝ່ມື້ນີ້" value={newPatientsToday} color="#13a83b" />
          <SmallStat label="ມີປະຫວັດການກວດ" value={patientsWithHistory} color="#8c7cff" />
        </div>

        <Panel title="ຄົນເຈັບ">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchBox value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="ຄົ້ນຫາ ID, ຊື່ ຫຼື ເບີໂທ" />
            <ActionButton onClick={() => patientsQuery.refetch()}>ໂຫຼດໃໝ່</ActionButton>
          </div>

          <div className="space-y-3 md:hidden">
            {patientsQuery.isLoading ? (
              <DataState type="loading" compact />
            ) : patientsQuery.isError ? (
              <DataState type="error" message="ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຄົນເຈັບໄດ້" onRetry={() => patientsQuery.refetch()} compact />
            ) : patientRows.length === 0 ? (
              <DataState type="empty" compact />
            ) : (
              pagedPatients.map((patient) => {
                const patientResults = resultsByPatient.get(patient.patient_id) ?? [];
                const patientOrders = ordersByPatient.get(patient.patient_id) ?? [];
                return (
                  <article key={patient.patient_id} className="rounded-xl border border-[#d9d9d9] bg-white p-4 shadow-sm">
                    <div className="text-xs font-bold text-[#1e66ff]">HN-{String(patient.patient_id).padStart(6, "0")}</div>
                    <h4 className="mt-1 text-base font-bold">{patientName(patient)}</h4>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-[#767285]">
                      <div>ເພດ: <span className="text-[#120d34]">{genderLabel(patient.gender)}</span></div>
                      <div>ອາຍຸ: <span className="text-[#120d34]">{patient.age ?? "-"}</span></div>
                      <div className="col-span-2">ເບີໂທ: <span className="text-[#120d34]">{patient.phone || "-"}</span></div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setResultPatient(patient)} disabled={!patientResults.length} className="rounded-lg bg-[#addbf4] px-3 py-2 text-xs font-bold text-[#123879] disabled:bg-[#eeeeee] disabled:text-[#9d98aa]">
                        ຜົນກວດ ({patientResults.length})
                      </button>
                      <Link href={`/patients/${patient.patient_id}/history`} className="rounded-lg bg-[#f4e3b0] px-3 py-2 text-center text-xs font-bold">
                        ປະຫວັດ ({patientOrders.length})
                      </Link>
                      <Link href={`/patients/${patient.patient_id}/edit`} className="rounded-lg bg-[#99fba6] px-3 py-2 text-center text-xs font-bold text-[#123879]">
                        ແກ້ໄຂ
                      </Link>
                      {isAdmin && (
                        <button type="button" onClick={() => setDeleteTarget(patient)} className="rounded-lg bg-[#ff4b4b] px-3 py-2 text-xs font-bold text-white">
                          ລົບ
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-xl shadow-sm md:block">
            <table className="w-full min-w-[1180px] border-collapse text-left">
              <thead className="bg-[#f2f2f2] text-xs font-bold">
                <tr>
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">ຊື່ ແລະ ນາມສະກຸນ</th>
                  <th className="px-5 py-3">ເພດ</th>
                  <th className="px-5 py-3">ອາຍຸ</th>
                  <th className="px-5 py-3">ວັນເກີດ</th>
                  <th className="px-5 py-3">ເບີໂທ</th>
                  <th className="px-5 py-3">ເບີສຸກເສີນ</th>
                  <th className="px-5 py-3">ຜົນກວດ</th>
                  <th className="px-5 py-3">ໃບສັ່ງກວດ</th>
                  <th className="px-5 py-3">ຈັດການ</th>
                </tr>
              </thead>
              <tbody className="text-xs text-[#767285]">
                {patientsQuery.isLoading ? (
                  <tr>
                    <td className="px-5 py-6 text-center" colSpan={10}>
                      ກຳລັງໂຫຼດ...
                    </td>
                  </tr>
                ) : patientsQuery.isError ? (
                  <tr>
                    <td className="px-5 py-6 text-center text-red-600" colSpan={10}>
                      ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຄົນເຈັບໄດ້
                    </td>
                  </tr>
                ) : patientRows.length === 0 ? (
                  <tr>
                    <td className="px-5 py-6 text-center" colSpan={10}>
                      ບໍ່ມີຂໍ້ມູນ
                    </td>
                  </tr>
                ) : (
                  pagedPatients.map((patient) => {
                    const patientResults = resultsByPatient.get(patient.patient_id) ?? [];
                    const patientOrders = ordersByPatient.get(patient.patient_id) ?? [];
                    return (
                      <tr key={patient.patient_id} className="border-t border-[#d7d7d7]">
                        <td className="px-5 py-3">HN-{String(patient.patient_id).padStart(6, "0")}</td>
                        <td className="px-5 py-3">{patientName(patient)}</td>
                        <td className="px-5 py-3">{genderLabel(patient.gender)}</td>
                        <td className="px-5 py-3">{patient.age ?? "-"}</td>
                        <td className="px-5 py-3">{formatShortDate(patient.date_of_birth)}</td>
                        <td className="px-5 py-3">{patient.phone || "-"}</td>
                        <td className="px-5 py-3">{patient.emergency_phone || "-"}</td>
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() => setResultPatient(patient)}
                            disabled={patientResults.length === 0}
                            className={`rounded-full px-4 py-1 text-[11px] font-bold shadow-sm ${
                              patientResults.length ? "bg-[#addbf4] text-[#123879]" : "bg-[#eeeeee] text-[#9d98aa]"
                            }`}
                          >
                            ເບິ່ງຜົນກວດ ({patientResults.length})
                          </button>
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            href={`/patients/${patient.patient_id}/history`}
                            className={`inline-flex rounded-full px-4 py-1 text-[11px] font-bold shadow-sm ${
                              patientOrders.length ? "bg-[#f4e3b0] text-black" : "bg-[#eeeeee] text-[#9d98aa]"
                            }`}
                          >
                            ປະຫວັດລະອຽດ ({patientOrders.length})
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/patients/${patient.patient_id}/edit`}
                              className="inline-flex rounded-full bg-[#99fba6] px-4 py-1 text-[11px] font-bold text-[#123879] shadow-sm"
                            >
                              ແກ້ໄຂ
                            </Link>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(patient)}
                                disabled={deletePatientMutation.isPending}
                                className="inline-flex rounded-full bg-[#ff4b4b] px-4 py-1 text-[11px] font-bold text-white shadow-sm disabled:opacity-60"
                              >
                                ລົບ
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={currentPage} totalItems={patientRows.length} pageSize={pageSize} onPageChange={setPage} />
        </Panel>
      </div>

      {resultPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-4">
          <div ref={modalRef} role="dialog" aria-modal="true" className="max-h-[86vh] w-full max-w-[900px] overflow-hidden rounded-2xl bg-white shadow-lg">
            <div className="flex items-start justify-between gap-4 border-b border-[#d9d9d9] p-5">
              <div>
                <h3 className="text-xl font-bold text-[#123879]">ປະຫວັດຜົນກວດ</h3>
                <p className="mt-1 text-sm font-semibold text-[#767285]">
                  HN-{String(resultPatient.patient_id).padStart(6, "0")} {patientName(resultPatient)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResultPatient(null)}
                className="rounded-lg bg-[#f4e3b0] px-4 py-2 text-sm font-bold text-black shadow-sm"
              >
                ປິດ
              </button>
            </div>
            <div className="max-h-[68vh] overflow-auto p-5">
              {selectedResults.length === 0 ? (
                <div className="rounded-xl border border-[#d9d9d9] bg-[#f7f8fb] p-5 text-center font-semibold text-[#767285]">
                  ບໍ່ມີຜົນກວດ
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedResults.map((result) => (
                    <div key={result.result_id} className="rounded-xl border border-[#d9d9d9] bg-white p-4 shadow-sm">
                      <div className="grid gap-2 text-sm font-semibold sm:grid-cols-2">
                        <div>ເລກຜົນກວດ: {result.report_no || `R${String(result.result_id).padStart(5, "0")}`}</div>
                        <div>ໃບສັ່ງກວດ: #{String(result.order_id).padStart(4, "0")}</div>
                        <div>ປະເພດການກວດ: {result.exam_name || "-"}</div>
                        <div>ວັນທີ: {formatDateTime(result.result_date)}</div>
                        <div>ຜູ້ບັນທຶກ: {result.staff_name || "-"}</div>
                        <div>ຮູບ: {result.result_image_url ? "ມີຮູບ" : "-"}</div>
                      </div>
                      <div className="mt-3 rounded-lg bg-[#f7f8fb] p-3 text-sm leading-7 text-[#120d34]">
                        {result.result_detail || "-"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div ref={modalRef} role="dialog" aria-modal="true" className="w-full max-w-[520px] rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-2xl font-bold text-[#120d34]">ຢືນຢັນລົບຄົນເຈັບອອກຈາກລາຍຊື່</h3>
            <div className="mt-4 rounded-xl bg-[#f7f8fb] p-4 text-sm font-bold leading-7 text-[#120d34]">
              <div>ລະຫັດ: HN-{String(deleteTarget.patient_id).padStart(6, "0")}</div>
              <div>ຊື່: {patientName(deleteTarget)}</div>
              <div>ເບີໂທ: {deleteTarget.phone || "-"}</div>
            </div>
            <p className="mt-4 text-sm font-semibold leading-7 text-[#767285]">
              ຄົນເຈັບຈະຖືກຊ່ອນອອກຈາກລາຍຊື່ ແຕ່ປະຫວັດໃບສັ່ງກວດ,
              ຜົນກວດ ແລະ ການຊຳລະເງິນຈະຍັງຖືກເກັບໄວ້.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletePatientMutation.isPending}
                className="rounded-xl bg-[#f4e3b0] px-6 py-3 text-sm font-bold text-black shadow-sm disabled:opacity-60"
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                onClick={() => deletePatientMutation.mutate(deleteTarget.patient_id)}
                disabled={deletePatientMutation.isPending}
                className="rounded-xl bg-[#ef4444] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletePatientMutation.isPending ? "ກຳລັງລົບ..." : "ລົບ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function genderLabel(gender?: string | null) {
  if (gender === "F") return "ຍິງ";
  if (gender === "M") return "ຊາຍ";
  if (gender === "Other") return "ອື່ນໆ";
  return "-";
}

function formatShortDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function dateOnly(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("en-CA");
}
