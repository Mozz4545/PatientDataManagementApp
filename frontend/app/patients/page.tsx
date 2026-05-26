"use client";

import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import { ActionButton, PageHero, Panel, patientName } from "@/components/dashboard-ui";
import api from "@/lib/api";
import type { ApiResponse, Patient } from "@/lib/types";

export default function PatientsPage() {
  const patientsQuery = useQuery({
    queryKey: ["patients"],
    queryFn: async () => (await api.get<ApiResponse<Patient[]>>("/patients", { params: { limit: 50 } })).data.data,
    retry: false,
  });

  return (
    <AppShell>
      <PageHero title="ຂໍ້ມູນຄົນເຈັບ" subtitle="ລາຍຊື່ຄົນເຈັບໃນລະບົບ">
        <ActionButton href="/orders/new" tone="green">
          ສ້າງໃບສັ່ງກວດ
        </ActionButton>
      </PageHero>

      <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-10 lg:py-6">
        <Panel title="ຄົນເຈັບ">
          <div className="overflow-x-auto rounded-xl shadow-sm">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead className="bg-[#f2f2f2] text-xs font-bold">
                <tr>
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">ຊື່ ແລະ ນາມສະກຸນ</th>
                  <th className="px-5 py-3">ເພດ</th>
                  <th className="px-5 py-3">ອາຍຸ</th>
                  <th className="px-5 py-3">ເບີໂທ</th>
                </tr>
              </thead>
              <tbody className="text-xs text-[#767285]">
                {(patientsQuery.data ?? []).map((patient) => (
                  <tr key={patient.patient_id} className="border-t border-[#d7d7d7]">
                    <td className="px-5 py-3">{String(patient.patient_id).padStart(2, "0")}</td>
                    <td className="px-5 py-3">{patientName(patient)}</td>
                    <td className="px-5 py-3">{patient.gender || "-"}</td>
                    <td className="px-5 py-3">{patient.age ?? "-"}</td>
                    <td className="px-5 py-3">{patient.phone || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
