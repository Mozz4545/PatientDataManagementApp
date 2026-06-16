"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import {
  ActionButton,
  OrdersTable,
  PageHero,
  Panel,
  SmallStat,
} from "@/components/dashboard-ui";
import api from "@/lib/api";
import { displayOrderStatus, isCancelledStatus, isCompletedStatus, isInProgressStatus, isReadyToPayStatus, statusKey } from "@/lib/status";
import type { ApiResponse, Order } from "@/lib/types";

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: async () => (await api.get<ApiResponse<Order[]>>("/orders")).data.data,
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: number) => api.patch(`/orders/${orderId}/status`, { status: "CANCELLED" }),
    onSuccess: () => {
      setConfirmOrder(null);
      setSuccessMessage("ໃບສັ່ງກວດ ຖືກຍົກເລີກແລ້ວ!!!");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      window.setTimeout(() => setSuccessMessage(null), 1600);
    },
  });

  const orders = ordersQuery.data ?? [];
  const pending = orders.filter((order) => statusKey(displayOrderStatus(order)) === "PENDING").length;
  const waitingResult = orders.filter((order) => isInProgressStatus(displayOrderStatus(order))).length;
  const waitingPayment = orders.filter((order) => isReadyToPayStatus(displayOrderStatus(order))).length;
  const completed = orders.filter((order) => isCompletedStatus(displayOrderStatus(order))).length;
  const cancelled = orders.filter((order) => isCancelledStatus(displayOrderStatus(order))).length;

  return (
    <AppShell>
      <PageHero title="ຈັດການຄຳສັ່ງກວດ" subtitle="ພາບລວມ ແລະ ການຈັດການສັ່ງກວດໃນລະບົບ">
        <ActionButton href="/orders/new" tone="green">
          ສ້າງໃບສັ່ງກວດ
        </ActionButton>
        <ActionButton onClick={() => ordersQuery.refetch()}>ໂຫຼດໃໝ່</ActionButton>
      </PageHero>

      <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-10">
        <div className="rounded-2xl bg-[#fff9e8] p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <SmallStat label="ໃບສັ່ງກວດທັງໝົດ" value={orders.length} color="#1e66ff" />
            <SmallStat label="ລໍຖ້າກວດ" value={pending} color="#f59f00" />
            <SmallStat label="ລໍຖ້າບັນທຶກຜົນກວດ" value={waitingResult} color="#8e22ff" />
            <SmallStat label="ຄ້າງຊຳລະ" value={waitingPayment} color="#a77b00" />
            <SmallStat label="ສຳເລັດ" value={completed} color="#13d936" />
            <SmallStat label="ຍົກເລີກ" value={cancelled} color="#f00" />
          </div>
        </div>

        <div className="mt-5 lg:mt-6">
          <Panel title="ໃບສັ່ງກວດ">
            <p className="mb-4 text-sm font-semibold">Showing {orders.length} of {orders.length} Orders</p>
            <OrdersTable orders={orders} onCancel={setConfirmOrder} highlightFirst />
          </Panel>
        </div>
      </div>

      {(confirmOrder || successMessage) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          {successMessage ? (
            <div className="w-full max-w-[520px] rounded-2xl bg-[#fdeaea] p-6 text-center shadow-lg sm:p-8">
              <h3 className="text-xl font-bold sm:text-2xl">{successMessage}</h3>
              <div className="mx-auto mt-6 flex h-20 w-20 items-center justify-center rounded-full border-[7px] border-red-500 text-5xl text-red-500">
                /
              </div>
            </div>
          ) : (
            <div className="w-full max-w-[520px] rounded-2xl bg-[#fdeaea] p-6 text-center shadow-lg sm:p-8">
              <h3 className="text-xl font-bold sm:text-2xl">ທ່ານຕ້ອງການ ຍົກເລີກ ໃບສັ່ງກວດແທ້ບໍ!!!</h3>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row sm:gap-6">
                <ActionButton tone="red" onClick={() => confirmOrder && cancelMutation.mutate(confirmOrder.order_id)}>
                  ຍົກເລີກ
                </ActionButton>
                <ActionButton tone="cream" onClick={() => setConfirmOrder(null)}>
                  ກັບຄືນ
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
