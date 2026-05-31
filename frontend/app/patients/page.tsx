"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import { ActionButton, formatDateTime, PageHero, Panel, patientName } from "@/components/dashboard-ui";
import api from "@/lib/api";
import type { ApiResponse, Order, Patient, Result } from "@/lib/types";

export default function PatientsPage() {
  const [resultPatient, setResultPatient] = useState<Patient | null>(null);

  const patientsQuery = useQuery({
    queryKey: ["patients"],
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

  return (
    <AppShell>
      <PageHero title="ຂໍ້ມູນຄົນເຈັບ" subtitle="ລາຍຊື່ຄົນເຈັບ ແລະ ທາງເຂົ້າແກ້ໄຂ/ເບິ່ງປະຫວັດ">
        <ActionButton href="/orders/new" tone="green">
          ສ້າງໃບສັ່ງກວດ
        </ActionButton>
      </PageHero>

      <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-10 lg:py-6">
        <Panel title="ຄົນເຈັບ">
          <div className="overflow-x-auto rounded-xl shadow-sm">
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
                ) : (patientsQuery.data ?? []).length === 0 ? (
                  <tr>
                    <td className="px-5 py-6 text-center" colSpan={10}>
                      ບໍ່ມີຂໍ້ມູນ
                    </td>
                  </tr>
                ) : (
                  (patientsQuery.data ?? []).map((patient) => {
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
                              patientResults.length
                                ? "bg-[#addbf4] text-[#123879]"
                                : "bg-[#eeeeee] text-[#9d98aa]"
                            }`}
                          >
                            ເບິ່ງຜົນກວດ ({patientResults.length})
                          </button>
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            href={`/patients/${patient.patient_id}/history`}
                            className={`inline-flex rounded-full px-4 py-1 text-[11px] font-bold shadow-sm ${
                              patientOrders.length
                                ? "bg-[#f4e3b0] text-black"
                                : "bg-[#eeeeee] text-[#9d98aa]"
                            }`}
                          >
                            ປະຫວັດລະອຽດ ({patientOrders.length})
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            href={`/patients/${patient.patient_id}/edit`}
                            className="inline-flex rounded-full bg-[#99fba6] px-4 py-1 text-[11px] font-bold text-[#123879] shadow-sm"
                          >
                            ແກ້ໄຂ
                          </Link>
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

      {resultPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-4">
          <div className="max-h-[86vh] w-full max-w-[900px] overflow-hidden rounded-2xl bg-white shadow-lg">
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
                        <div>ເລກຜົນກວດ: R{String(result.result_id).padStart(5, "0")}</div>
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
