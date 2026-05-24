"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import api, { setAuthToken } from "../../lib/api";

type Patient = {
  patient_id: number;
  first_name: string;
  last_name: string;
  gender?: string;
  age?: number;
  phone?: string;
};

export default function PatientsPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem("radiology_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setAuthToken(token);
  }, [mounted, router]);

  const { data, isLoading: queryLoading, error } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const response = await api.get("/patients");
      return response.data;
    },
    enabled: mounted,
    retry: false,
  });

  const patients = (data?.data ?? []) as Patient[];

  const handleLogout = () => {
    localStorage.removeItem("radiology_token");
    router.replace("/login");
  };

  if (!mounted || queryLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="mb-4 inline-block">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900"></div>
          </div>
          <p className="text-slate-600">ກຳລັງໂຫຼດ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">ລະບົບຈັດການຂໍ້ມູນຄົນໄຂ້ - ສ່ວນລັງສີ</h1>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-700 transition"
          >
            ອອກຈາກລະບົບ
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">ລາຍຊື່ຄົນໄຂ້</h2>
          <button className="rounded-lg bg-emerald-500 px-4 py-2 text-white font-medium hover:bg-emerald-600 transition">
            + ເພີ່ມຄົນໄຂ້
          </button>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຄົນໄຂ້ໄດ້
          </div>
        ) : patients.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">ຊື່-ນາມສະກຸນ</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">ເພດ</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">ອາຍຸ</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">ເບີໂທ</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">ການດໍາເນີນ</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.patient_id} className="border-b border-slate-200 hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-sm text-slate-900">{p.patient_id}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{p.first_name} {p.last_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{p.gender === 'M' ? 'ຊາຍ' : p.gender === 'F' ? 'ຍິງ' : 'ອື່ນ'}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{p.age ?? '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{p.phone ?? '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-blue-600 hover:text-blue-800 font-medium mr-3">ແກ້ໄຂ</button>
                      <button className="text-red-600 hover:text-red-800 font-medium">ລົບ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-600">ບໍ່ມີຂໍ້ມູນຄົນໄຂ້</p>
          </div>
        )}
      </div>
    </div>
  );
}
