"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import { ActionButton, DataState, PageHero, Panel, QueuesTable, SmallStat, StatusPill } from "@/components/dashboard-ui";
import api from "@/lib/api";
import {
  displayQueueStatus,
  isCallingQueueStatus,
  isInProgressStatus,
  isWaitingQueueStatus,
} from "@/lib/status";
import { showToast } from "@/lib/toast";
import type { ApiResponse, Queue } from "@/lib/types";
import { useModalAccessibility } from "@/lib/useModalAccessibility";

export default function QueuesPage() {
  const queryClient = useQueryClient();
  const [calledQueue, setCalledQueue] = useState<Queue | null>(null);
  const [dialogMessage, setDialogMessage] = useState("");
  const modalRef = useModalAccessibility(Boolean(calledQueue || dialogMessage), () => {
    setCalledQueue(null);
    setDialogMessage("");
  });
  const queuesQuery = useQuery({
    queryKey: ["queues"],
    queryFn: async () => (await api.get<ApiResponse<Queue[]>>("/queues")).data.data,
    retry: false,
    refetchInterval: 5000,
  });

  const nextMutation = useMutation({
    mutationFn: async () => {
      const queueDate = resolveNextCallDate(queuesQuery.data ?? []);
      const response = await api.post<ApiResponse<Queue | null>>("/queues/call-next", null, {
        params: queueDate ? { date: queueDate } : undefined,
      });
      return response.data;
    },
    onSuccess: (response) => {
      const queue = response.data;
      if (queue) {
        setDialogMessage("");
        setCalledQueue(queue);
        queryClient.setQueryData<Queue[]>(["queues"], (current = []) =>
          current.map((item) => {
            if (item.queue_id === queue.queue_id) return queue;
            if (item.status === "ກຳລັງເອີ້ນ" && item.queue_date === queue.queue_date) {
              return { ...item, status: "ກຳລັງກວດ" };
            }
            return item;
          })
        );
      }
      if (!queue) {
        setCalledQueue(null);
        const message = response.message || "ຍັງບໍ່ມີຄິວຕໍ່ໄປ";
        setDialogMessage(message);
        showToast("info", message);
      }
      queryClient.invalidateQueries({ queryKey: ["queues"] });
      queryClient.invalidateQueries({ queryKey: ["queue-display"] });
    },
    onError: () => {
      setCalledQueue(null);
      setDialogMessage("ບໍ່ສາມາດເອີ້ນຄິວໄດ້ ກະລຸນາລອງໃໝ່");
    },
  });

  const queues = queuesQuery.data ?? [];
  const waitingQueues = queues
    .filter((queue) => isWaitingQueue(queue.status))
    .sort((a, b) => dateOnly(a.queue_date).localeCompare(dateOnly(b.queue_date)) || Number(a.queue_no) - Number(b.queue_no));
  const waiting = waitingQueues.length;
  const calling = queues.filter((queue) => isCallingQueueStatus(queue.status)).length;
  const inProgress = queues.filter((queue) => isInProgressStatus(queue.status)).length;

  return (
    <AppShell>
      <PageHero title="ຈັດການຄິວ" subtitle="ຈັດການຄິວຄົນເຈັບໃນລະບົບ">
        <ActionButton
          tone={waiting > 0 ? "blue" : "red"}
          onClick={() => nextMutation.mutate()}
          disabled={nextMutation.isPending || queuesQuery.isLoading}
        >
          {nextMutation.isPending ? "ກຳລັງເອີ້ນ..." : waiting > 0 ? "ເອີ້ນຄິວຖັດໄປ" : "ບໍ່ມີຄິວລໍຖ້າ"}
        </ActionButton>
        <ActionButton tone="violet" onClick={() => window.open("/queues/display", "queue-display", "width=1200,height=760")}>
          ເປີດຈໍສະແດງ
        </ActionButton>
        <ActionButton onClick={() => queuesQuery.refetch()}>ໂຫຼດໃໝ່</ActionButton>
      </PageHero>

      <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-10">
        <div className="grid gap-4 sm:grid-cols-3 lg:max-w-5xl">
          <SmallStat label="ຄິວລໍຖ້າ" value={waiting} color="#1e66ff" />
          <SmallStat label="ກຳລັງເອີ້ນ" value={calling} color="#17a9d1" />
          <SmallStat label="ກຳລັງກວດ" value={inProgress} color="#f45108" />
        </div>

        <div className="mt-5 lg:mt-6">
          <Panel title="ຄິວລໍຖ້າກວດ" dot="#f45108">
            <QueuesTable queues={waitingQueues} />
          </Panel>
        </div>

        <div className="mt-5 lg:mt-6">
          <Panel title="ສະຖານະຄິວລວມ" dot="#f8df00">
            {queuesQuery.isLoading ? (
              <DataState type="loading" compact />
            ) : queuesQuery.isError ? (
              <DataState type="error" message="ບໍ່ສາມາດໂຫຼດສະຖານະຄິວໄດ້" onRetry={() => queuesQuery.refetch()} compact />
            ) : queues.length === 0 ? (
              <DataState type="empty" message="ຍັງບໍ່ມີຄິວ" compact />
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {queues.map((queue) => (
                    <article key={queue.queue_id} className="rounded-xl border border-[#d9d9d9] bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div><div className="text-xs font-bold text-[#1e66ff]">ຄິວ {String(queue.queue_no).padStart(2, "0")}</div><div className="mt-1 font-bold">{[queue.first_name, queue.last_name].filter(Boolean).join(" ") || "-"}</div></div>
                        <span className="shrink-0"><StatusPill status={displayQueueStatus(queue.status)} /></span>
                      </div>
                      <div className="mt-3 space-y-1 text-xs font-semibold text-[#767285]"><div>{queue.exam_name || "-"}</div><div>{dateOnly(queue.queue_date)}</div></div>
                    </article>
                  ))}
                </div>
                <div className="hidden md:block"><QueuesTable queues={queues} accent="light" /></div>
              </>
            )}
          </Panel>
        </div>
      </div>

      {calledQueue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div ref={modalRef} role="dialog" aria-modal="true" className="w-full max-w-[560px] rounded-2xl bg-white p-6 text-center shadow-lg sm:p-8">
            <div className="text-sm font-bold text-[#767285]">ກຳລັງເອີ້ນຄິວ</div>
            <div className="mt-3 text-[72px] font-black leading-none text-[#123879] sm:text-[96px]">
              {String(calledQueue.queue_no).padStart(2, "0")}
            </div>
            <div className="mt-4 text-xl font-bold text-[#120d34]">{calledQueue.first_name} {calledQueue.last_name}</div>
            <div className="mt-1 text-sm font-semibold text-[#767285]">{calledQueue.exam_name || "-"}</div>
            <div className="mt-4 rounded-xl bg-[#eef7ff] px-4 py-3 text-sm font-bold text-[#123879]">
              ເອີ້ນຄິວສຳເລັດ ແລະ ນຳອອກຈາກລາຍການຄິວລໍຖ້າແລ້ວ
            </div>
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

      {dialogMessage && !calledQueue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="queue-message-title" className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#eef7ff] text-2xl text-[#123879]">i</div>
            <h3 id="queue-message-title" className="mt-4 text-xl font-bold text-[#120d34]">ແຈ້ງເຕືອນຄິວ</h3>
            <p className="mt-2 text-sm font-semibold text-[#767285]">{dialogMessage}</p>
            <div className="mt-6">
              <ActionButton tone="blue" onClick={() => setDialogMessage("")}>
                ຕົກລົງ
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

function resolveNextCallDate(queues: Queue[]) {
  const firstWaiting = queues
    .filter((queue) => isWaitingQueue(queue.status))
    .sort((a, b) => dateOnly(a.queue_date).localeCompare(dateOnly(b.queue_date)) || Number(a.queue_no) - Number(b.queue_no))[0];
  if (firstWaiting?.queue_date) return dateOnly(firstWaiting.queue_date);

  return "";
}

function dateOnly(value: string) {
  return String(value).slice(0, 10);
}
