"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import { ActionButton, PageHero, Panel, QueuesTable, SmallStat } from "@/components/dashboard-ui";
import api from "@/lib/api";
import { isCallingQueueStatus, isInProgressStatus, isWaitingQueueStatus } from "@/lib/status";
import type { ApiResponse, Queue } from "@/lib/types";

const COMPLETED_STATUS = "ສຳເລັດ";

export default function QueuesPage() {
  const queryClient = useQueryClient();
  const [calledQueue, setCalledQueue] = useState<Queue | null>(null);
  const queuesQuery = useQuery({
    queryKey: ["queues"],
    queryFn: async () => (await api.get<ApiResponse<Queue[]>>("/queues")).data.data,
    retry: false,
    refetchInterval: 5000,
  });

  const nextMutation = useMutation({
    mutationFn: async () => (await api.post<ApiResponse<Queue | null>>("/queues/call-next")).data.data,
    onSuccess: (queue) => {
      if (queue) setCalledQueue(queue);
      queryClient.invalidateQueries({ queryKey: ["queues"] });
      queryClient.invalidateQueries({ queryKey: ["queue-display"] });
    },
  });

  const callMutation = useMutation({
    mutationFn: async (queueId: number) => (await api.patch<ApiResponse<Queue>>(`/queues/${queueId}/call`)).data.data,
    onSuccess: (queue) => {
      setCalledQueue(queue);
      queryClient.invalidateQueries({ queryKey: ["queues"] });
      queryClient.invalidateQueries({ queryKey: ["queue-display"] });
    },
  });

  const queues = queuesQuery.data ?? [];
  const waiting = queues.filter((queue) => isWaitingQueue(queue.status)).length;
  const completed = queues.filter((queue) => queue.status === COMPLETED_STATUS).length;

  return (
    <AppShell>
      <PageHero title="ຈັດການຄິວ" subtitle="ຈັດການຄິວຄົນເຈັບໃນລະບົບ">
        <ActionButton tone={waiting > 0 ? "blue" : "red"} onClick={() => nextMutation.mutate()}>
          ເອີ້ນຄິວ
        </ActionButton>
        <ActionButton tone="violet" onClick={() => window.open("/queues/display", "queue-display", "width=1200,height=760")}>
          ເປີດຈໍສະແດງ
        </ActionButton>
        <ActionButton onClick={() => queuesQuery.refetch()}>ໂຫຼດໃໝ່</ActionButton>
      </PageHero>

      <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
          <SmallStat label="ຈຳນວນຄິວລໍຖ້າກວດ" value={waiting} color="#1e66ff" />
          <SmallStat label="ລວມທັງໝົດ" value={queues.length || completed} color="#13d936" />
        </div>

        <div className="mt-5 lg:mt-6">
          <Panel title="ຄິວລໍຖ້າກວດ" dot="#f45108">
            <QueuesTable
              queues={queues.filter((queue) => isActiveQueue(queue.status))}
              onCall={(queue) => callMutation.mutate(queue.queue_id)}
            />
          </Panel>
        </div>

        <div className="mt-5 lg:mt-6">
          <Panel title="ສະຖານະຄິວລວມ" dot="#f8df00">
            {queuesQuery.isLoading ? (
              <div className="rounded-xl bg-[#f6f6f6] px-5 py-6 text-center text-sm font-bold text-[#767285]">
                ກຳລັງໂຫຼດ...
              </div>
            ) : queuesQuery.isError ? (
              <div className="rounded-xl bg-red-50 px-5 py-6 text-center text-sm font-bold text-red-700">
                ບໍ່ສາມາດໂຫຼດສະຖານະຄິວໄດ້
              </div>
            ) : (
              <QueuesTable queues={queues} accent="light" />
            )}
          </Panel>
        </div>
      </div>

      {calledQueue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-[560px] rounded-2xl bg-white p-6 text-center shadow-lg sm:p-8">
            <div className="text-sm font-bold text-[#767285]">ກຳລັງເອີ້ນຄິວ</div>
            <div className="mt-3 text-[72px] font-black leading-none text-[#123879] sm:text-[96px]">
              {String(calledQueue.queue_no).padStart(2, "0")}
            </div>
            <div className="mt-4 text-xl font-bold text-[#120d34]">{calledQueue.first_name} {calledQueue.last_name}</div>
            <div className="mt-1 text-sm font-semibold text-[#767285]">{calledQueue.exam_name || "-"}</div>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <ActionButton tone="blue" onClick={() => window.open("/queues/display", "queue-display", "width=1200,height=760")}>
                ເປີດຈໍສະແດງ
              </ActionButton>
              <ActionButton tone="cream" onClick={() => setCalledQueue(null)}>
                ປິດ
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function isWaitingQueue(status?: string) {
  return isWaitingQueueStatus(status);
}

function isActiveQueue(status?: string) {
  return isWaitingQueue(status) || isCallingQueueStatus(status) || isInProgressStatus(status);
}
