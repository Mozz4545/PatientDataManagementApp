"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { useQuery } from "@tanstack/react-query";
import api, { setAuthToken } from "../../lib/api";

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem("radiology_token");
    if (token) setAuthToken(token);
  }, [mounted]);

  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: async () => (await api.get("/orders")).data,
    enabled: mounted,
  });

  const queuesQuery = useQuery({
    queryKey: ["queues"],
    queryFn: async () => (await api.get("/queues")).data,
    enabled: mounted,
  });

  const orders = ordersQuery.data?.data ?? [];
  const queues = queuesQuery.data?.data ?? [];

  const pendingCount = orders.filter((o: any) => o.status === "PENDING").length;
  const inProgressCount = orders.filter((o: any) => o.status === "IN_PROGRESS").length;
  const completedCount = orders.filter((o: any) => o.status === "COMPLETED").length;

  const totalPatients = ordersQuery.data?.data?.length || 0;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <header className="bg-slate-900 text-white">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">ລະບົບຈັດການຄົນເຈັບ - ພະແນກລັງສີ</h1>
              <div className="flex items-center gap-4">
                <button className="rounded-md bg-emerald-300 px-3 py-1 text-slate-900">ສັ່ງໃບສຳທວດ</button>
                <div className="text-sm text-slate-200">Staff Member • STAFF</div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-10">
          <h2 className="text-3xl font-semibold text-slate-900">ໜ້າທໍາ</h2>
          <p className="text-slate-600">Hospital Radiology Operations Overview (ພາສາລາວ)</p>

          <div className="mt-8 grid grid-cols-4 gap-6">
            <div className="rounded-xl bg-white p-6 shadow">
              <div className="text-sm text-slate-500">ຈຳນວນຄົນເຈັບ</div>
              <div className="mt-4 text-3xl font-bold text-blue-600">{totalPatients}</div>
            </div>
            <div className="rounded-xl bg-white p-6 shadow">
              <div className="text-sm text-slate-500">ຄົນກຳລັງຢູ່</div>
              <div className="mt-4 text-3xl font-bold text-orange-500">{inProgressCount}</div>
            </div>
            <div className="rounded-xl bg-white p-6 shadow">
              <div className="text-sm text-slate-500">ໃບສັ່ງກວດ</div>
              <div className="mt-4 text-3xl font-bold text-violet-500">{orders.length}</div>
            </div>
            <div className="rounded-xl bg-white p-6 shadow">
              <div className="text-sm text-slate-500">ການກວດສຳເລັດ</div>
              <div className="mt-4 text-3xl font-bold text-emerald-600">{completedCount}</div>
            </div>
          </div>

          <div className="mt-10 rounded-xl bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">ໃບສັ່ງກວດ</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => { ordersQuery.refetch(); queuesQuery.refetch(); }} className="rounded-md bg-slate-100 px-3 py-1 text-sm">Refresh</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="text-sm text-slate-600">
                    <th className="p-3 text-left">Order ID</th>
                    <th className="p-3 text-left">Patient</th>
                    <th className="p-3 text-left">Exam Type</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 10).map((o: any) => (
                    <tr key={o.order_id} className="border-t">
                      <td className="p-3 text-sm">{o.order_id}</td>
                      <td className="p-3 text-sm">{o.first_name} {o.last_name}</td>
                      <td className="p-3 text-sm">{o.exam_name}</td>
                      <td className={`p-3 text-sm ${o.status === 'COMPLETED' ? 'text-green-600' : o.status === 'IN_PROGRESS' ? 'text-blue-600' : 'text-yellow-600'}`}>{o.status}</td>
                      <td className="p-3 text-sm">{o.order_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
