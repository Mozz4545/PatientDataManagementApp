"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDateTime, patientName } from "@/components/dashboard-ui";
import api from "@/lib/api";
import type { ApiResponse, QueueDisplay } from "@/lib/types";

export default function QueueDisplayPage() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const displayQuery = useQuery({
    queryKey: ["queue-display"],
    queryFn: async () => (await api.get<ApiResponse<QueueDisplay>>("/queues/display/current")).data.data,
    refetchInterval: 2000,
    retry: false,
  });

  const current = displayQuery.data?.current ?? null;
  const recent = useMemo(() => (displayQuery.data?.recent ?? []).filter((queue) => queue.queue_id !== current?.queue_id), [current?.queue_id, displayQuery.data?.recent]);

  return (
    <main className="min-h-screen bg-[#071a3f] text-white">
      <section className="flex min-h-screen flex-col">
        <header className="flex flex-col gap-3 border-b border-white/15 px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">ຈໍສະແດງຄິວພະແນກລັງສີ</h1>
            <p className="mt-1 text-sm font-semibold text-white/70">ໂຮງໝໍ 103</p>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-xl font-bold">{now.toLocaleTimeString("lo-LA", { hour12: false })}</div>
            <div className="text-sm font-semibold text-white/70">{now.toLocaleDateString("lo-LA")}</div>
          </div>
        </header>

        <div className="grid flex-1 gap-5 p-5 lg:grid-cols-[1fr_360px] lg:p-8 xl:grid-cols-[1fr_420px]">
          <section className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-white/15 bg-white px-5 py-8 text-center text-[#120d34] shadow-2xl">
            <div className="text-xl font-black text-[#767285] sm:text-2xl">ກຳລັງເອີ້ນຄິວ</div>
            {current ? (
              <>
                <div className="mt-6 text-[132px] font-black leading-none text-[#123879] sm:text-[180px] lg:text-[220px]">
                  {String(current.queue_no).padStart(2, "0")}
                </div>
                <div className="mt-4 text-3xl font-black sm:text-5xl">{patientName(current)}</div>
                <div className="mt-4 rounded-full bg-[#addbf4] px-6 py-3 text-xl font-bold text-[#123879]">
                  {current.exam_name || "-"}
                </div>
                <div className="mt-5 text-base font-semibold text-[#767285]">
                  ເວລາເອີ້ນ: {formatDateTime(current.called_at || current.queue_date)}
                </div>
              </>
            ) : (
              <>
                <div className="mt-10 text-[96px] font-black leading-none text-[#d9d9d9] sm:text-[150px]">--</div>
                <div className="mt-6 text-2xl font-bold text-[#767285]">ຍັງບໍ່ມີການເອີ້ນຄິວ</div>
              </>
            )}
          </section>

          <aside className="rounded-2xl border border-white/15 bg-white/10 p-5 shadow-2xl">
            <h2 className="text-xl font-black">ຄິວທີ່ເອີ້ນກ່ອນໜ້າ</h2>
            <div className="mt-5 space-y-3">
              {recent.length === 0 ? (
                <div className="rounded-xl bg-white/10 px-4 py-6 text-center text-sm font-semibold text-white/70">
                  ບໍ່ມີຂໍ້ມູນ
                </div>
              ) : (
                recent.map((queue) => (
                  <div key={queue.queue_id} className="grid grid-cols-[72px_1fr] gap-3 rounded-xl bg-white px-4 py-3 text-[#120d34]">
                    <div className="flex h-14 items-center justify-center rounded-xl bg-[#f2fde9] text-2xl font-black text-[#137547]">
                      {String(queue.queue_no).padStart(2, "0")}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-base font-black">{patientName(queue)}</div>
                      <div className="truncate text-sm font-semibold text-[#767285]">{queue.exam_name || "-"}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
