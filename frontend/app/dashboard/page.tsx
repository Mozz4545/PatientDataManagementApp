"use client";

import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import { ActionButton, DataState, MetricCard, OrdersTable, PageHero, Panel } from "@/components/dashboard-ui";
import api from "@/lib/api";
import { displayOrderStatus, isOpenStatus, isReadyToPayStatus, isWaitingQueueStatus } from "@/lib/status";
import type { ApiResponse, Order, Payment, Queue, Result } from "@/lib/types";

export default function DashboardPage() {
  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: async () => (await api.get<ApiResponse<Order[]>>("/orders")).data.data,
    retry: false,
  });

  const queuesQuery = useQuery({
    queryKey: ["queues", "dashboard"],
    queryFn: async () => (await api.get<ApiResponse<Queue[]>>("/queues")).data.data,
    retry: false,
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", "dashboard"],
    queryFn: async () => (await api.get<ApiResponse<Payment[]>>("/payments")).data.data,
    retry: false,
  });

  const resultsQuery = useQuery({
    queryKey: ["results", "dashboard"],
    queryFn: async () => (await api.get<ApiResponse<Result[]>>("/results")).data.data,
    retry: false,
  });

  const orders = ordersQuery.data ?? [];
  const queues = queuesQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const results = resultsQuery.data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const paidOrderIds = new Set(payments.map((payment) => payment.order_id));
  const resultOrderIds = new Set(results.map((result) => result.order_id));
  const openOrders = orders.filter((order) => isOpenStatus(order.status));
  const todayOrders = openOrders.filter((order) => order.order_date?.slice(0, 10) === today).length;
  const waitingQueues = queues.filter((queue) => isWaitingQueueStatus(queue.status)).length;
  const pendingResults = openOrders.filter((order) => !resultOrderIds.has(order.order_id)).length;
  const unpaid = openOrders.filter((order) => !paidOrderIds.has(order.order_id) && isReadyToPayStatus(displayOrderStatus(order))).length;

  const handleRefresh = () => {
    ordersQuery.refetch();
    queuesQuery.refetch();
    paymentsQuery.refetch();
    resultsQuery.refetch();
  };

  return (
    <AppShell>
      <PageHero title="ໜ້າຫຼັກ" subtitle="ພາບລວມວຽກປະຈຳວັນຂອງພະແນກລັງສີ">
        <ActionButton href="/orders/new" tone="green">
          ສ້າງໃບສັ່ງກວດ
        </ActionButton>
        <ActionButton onClick={handleRefresh}>ໂຫຼດໃໝ່</ActionButton>
      </PageHero>

      <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-10">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="ຄິວລໍຖ້າ" value={waitingQueues} color="#1e66ff" />
          <MetricCard label="ໃບສັ່ງມື້ນີ້" value={todayOrders} color="#9b18ff" />
          <MetricCard label="ລໍຖ້າບັນທຶກຜົນ" value={pendingResults} color="#f45108" />
          <MetricCard label="ຄ້າງຊຳລະ" value={unpaid} color="#079b49" />
        </div>

        <div className="mt-5 lg:mt-8">
          <Panel title="ໃບສັ່ງກວດຫຼ້າສຸດ">
            {ordersQuery.isLoading ? (
              <DataState type="loading" />
            ) : ordersQuery.isError ? (
              <DataState type="error" message="ບໍ່ສາມາດໂຫຼດໃບສັ່ງກວດໄດ້" onRetry={() => ordersQuery.refetch()} />
            ) : orders.length === 0 ? (
              <DataState type="empty" message="ຍັງບໍ່ມີໃບສັ່ງກວດ" />
            ) : (
              <OrdersTable orders={orders.slice(0, 6)} />
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
