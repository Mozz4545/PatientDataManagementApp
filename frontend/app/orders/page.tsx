"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import {
  ActionButton,
  OrdersTable,
  Pagination,
  PageHero,
  Panel,
  SmallStat,
} from "@/components/dashboard-ui";
import api from "@/lib/api";
import { displayOrderStatus, isCancelledStatus, statusKey } from "@/lib/status";
import type { ApiResponse, Order } from "@/lib/types";
import { useModalAccessibility } from "@/lib/useModalAccessibility";

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "cancelled">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

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
      queryClient.invalidateQueries({ queryKey: ["queues"] });
      queryClient.invalidateQueries({ queryKey: ["queue-display"] });
      window.setTimeout(() => setSuccessMessage(null), 1600);
    },
  });

  const orders = ordersQuery.data ?? [];
  const pending = orders.filter((order) => statusKey(displayOrderStatus(order)) === "PENDING").length;
  const cancelled = orders.filter((order) => isCancelledStatus(displayOrderStatus(order))).length;
  const filteredOrders = orders.filter((order) => {
    if (filter === "pending") return statusKey(displayOrderStatus(order)) === "PENDING";
    if (filter === "cancelled") return isCancelledStatus(displayOrderStatus(order));
    return true;
  });
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filteredOrders.length / pageSize)));
  const pagedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const modalRef = useModalAccessibility(Boolean(confirmOrder || successMessage), () => {
    setConfirmOrder(null);
    setSuccessMessage(null);
  });

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
          <div className="grid gap-4 sm:grid-cols-3 lg:max-w-5xl">
            <button type="button" onClick={() => { setFilter("all"); setPage(1); }} className={`rounded-2xl text-left ring-offset-2 ${filter === "all" ? "ring-2 ring-[#1e66ff]" : ""}`}>
              <SmallStat label="ໃບສັ່ງກວດທັງໝົດ" value={orders.length} color="#1e66ff" />
            </button>
            <button type="button" onClick={() => { setFilter("pending"); setPage(1); }} className={`rounded-2xl text-left ring-offset-2 ${filter === "pending" ? "ring-2 ring-[#f59f00]" : ""}`}>
              <SmallStat label="ລໍຖ້າກວດ" value={pending} color="#f59f00" />
            </button>
            <button type="button" onClick={() => { setFilter("cancelled"); setPage(1); }} className={`rounded-2xl text-left ring-offset-2 ${filter === "cancelled" ? "ring-2 ring-[#ef4444]" : ""}`}>
              <SmallStat label="ໃບສັ່ງກວດຍົກເລີກ" value={cancelled} color="#ef4444" />
            </button>
          </div>
        </div>

        <div className="mt-5 lg:mt-6">
          <Panel title="ໃບສັ່ງກວດ">
            <p className="mb-4 text-sm font-semibold text-[#767285]">
              ສະແດງ {filteredOrders.length.toLocaleString("lo-LA")} ຈາກ {orders.length.toLocaleString("lo-LA")} ໃບສັ່ງກວດ
            </p>
            <OrdersTable orders={pagedOrders} onCancel={setConfirmOrder} highlightFirst={filter === "all"} />
            <Pagination page={currentPage} totalItems={filteredOrders.length} pageSize={pageSize} onPageChange={setPage} />
          </Panel>
        </div>
      </div>

      {(confirmOrder || successMessage) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          {successMessage ? (
            <div ref={modalRef} role="dialog" aria-modal="true" className="w-full max-w-[520px] rounded-2xl bg-[#fdeaea] p-6 text-center shadow-lg sm:p-8">
              <h3 className="text-xl font-bold sm:text-2xl">{successMessage}</h3>
              <div className="mx-auto mt-6 flex h-20 w-20 items-center justify-center rounded-full border-[7px] border-red-500 text-5xl text-red-500">
                /
              </div>
            </div>
          ) : (
            <div ref={modalRef} role="dialog" aria-modal="true" className="w-full max-w-[520px] rounded-2xl bg-[#fdeaea] p-6 text-center shadow-lg sm:p-8">
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
