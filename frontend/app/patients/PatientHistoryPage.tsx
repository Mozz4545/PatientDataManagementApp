"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import { ActionButton, formatDateTime, PageHero, Panel, patientName, StatusPill } from "@/components/dashboard-ui";
import api from "@/lib/api";
import { getResultImageObjectUrl } from "@/lib/result-images";
import { displayOrderStatus } from "@/lib/status";
import { showToast } from "@/lib/toast";
import type { ApiResponse, Order, Patient, Payment, Result } from "@/lib/types";

export default function PatientHistoryPage({ patientId }: { patientId: number }) {
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const patientQuery = useQuery({
    queryKey: ["patients", patientId],
    queryFn: async () => (await api.get<ApiResponse<Patient>>(`/patients/${patientId}`)).data.data,
    retry: false,
  });

  const ordersQuery = useQuery({
    queryKey: ["orders", "patient-history", patientId],
    queryFn: async () => (await api.get<ApiResponse<Order[]>>("/orders")).data.data,
    retry: false,
  });

  const resultsQuery = useQuery({
    queryKey: ["results", "patient-history", patientId],
    queryFn: async () => (await api.get<ApiResponse<Result[]>>("/results")).data.data,
    retry: false,
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", "patient-history", patientId],
    queryFn: async () => (await api.get<ApiResponse<Payment[]>>("/payments")).data.data,
    retry: false,
  });

  const patientOrders = useMemo(
    () =>
      (ordersQuery.data ?? [])
        .filter((order) => order.patient_id === patientId)
        .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()),
    [ordersQuery.data, patientId]
  );

  const resultByOrder = useMemo(() => {
    const map = new Map<number, Result>();
    (resultsQuery.data ?? []).forEach((result) => {
      map.set(result.order_id, result);
    });
    return map;
  }, [resultsQuery.data]);

  const paymentByOrder = useMemo(() => {
    const map = new Map<number, Payment>();
    (paymentsQuery.data ?? []).forEach((payment) => {
      map.set(payment.order_id, payment);
    });
    return map;
  }, [paymentsQuery.data]);

  const patient = patientQuery.data;

  const openResultImage = async (result: Result) => {
    try {
      const imageUrl = await getResultImageObjectUrl(result.result_id);
      setPreviewImageUrl(imageUrl);
    } catch {
      showToast("error", "ບໍ່ສາມາດເປີດຮູບຜົນກວດໄດ້");
    }
  };

  const closePreviewImage = () => {
    if (previewImageUrl?.startsWith("blob:")) URL.revokeObjectURL(previewImageUrl);
    setPreviewImageUrl(null);
  };

  return (
    <AppShell>
      <PageHero
        title="ປະຫວັດໃບສັ່ງກວດຂອງຄົນເຈັບ"
        subtitle={patient ? `HN-${String(patientId).padStart(6, "0")} ${patientName(patient)}` : "ກຳລັງໂຫຼດຂໍ້ມູນ"}
      >
        <ActionButton href={`/patients/${patientId}/edit`} tone="green">
          ແກ້ໄຂຂໍ້ມູນ
        </ActionButton>
        <ActionButton href="/patients">ກັບຄືນ</ActionButton>
      </PageHero>

      <div className="space-y-5 px-4 py-5 sm:px-6 lg:px-10">
        {patientQuery.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
            ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຄົນເຈັບໄດ້
          </div>
        ) : (
          <Panel title="ຂໍ້ມູນຄົນເຈັບ">
            <div className="grid gap-3 text-sm font-semibold sm:grid-cols-2 lg:grid-cols-4">
              <Info label="ລະຫັດ" value={`HN-${String(patientId).padStart(6, "0")}`} />
              <Info label="ຊື່" value={patient ? patientName(patient) : "-"} />
              <Info label="ເພດ" value={genderLabel(patient?.gender)} />
              <Info label="ອາຍຸ" value={patient?.age ?? "-"} />
              <Info label="ວັນເກີດ" value={formatShortDate(patient?.date_of_birth)} />
              <Info label="ເບີໂທ" value={patient?.phone || "-"} />
              <Info label="ເບີໂທສຸກເສີນ" value={patient?.emergency_phone || "-"} />
              <Info label="ວັນທີລົງທະບຽນ" value={patient?.created_at ? formatDateTime(patient.created_at) : "-"} />
            </div>
            <div className="mt-3 rounded-xl bg-[#f7f8fb] p-3 text-sm font-semibold text-[#120d34]">
              <span className="text-[#767285]">ທີ່ຢູ່: </span>
              {patient?.address || "-"}
            </div>
          </Panel>
        )}

        <Panel title="ປະຫວັດໃບສັ່ງກວດທັງໝົດ">
          {ordersQuery.isLoading || resultsQuery.isLoading || paymentsQuery.isLoading ? (
            <div className="rounded-xl border border-[#d9d9d9] bg-[#f7f8fb] p-5 text-center font-semibold text-[#767285]">
              ກຳລັງໂຫຼດ...
            </div>
          ) : patientOrders.length === 0 ? (
            <div className="rounded-xl border border-[#d9d9d9] bg-[#f7f8fb] p-5 text-center font-semibold text-[#767285]">
              ບໍ່ມີໃບສັ່ງກວດ
            </div>
          ) : (
            <div className="space-y-4">
              {patientOrders.map((order) => {
                const result = resultByOrder.get(order.order_id);
                const payment = paymentByOrder.get(order.order_id);
                return (
                  <article key={order.order_id} className="rounded-xl border border-[#d9d9d9] bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-[#e5e5e5] pb-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-lg font-bold text-[#123879]">ໃບສັ່ງກວດ #{String(order.order_id).padStart(4, "0")}</div>
                        <div className="mt-1 text-sm font-semibold text-[#767285]">{order.exam_name || "-"}</div>
                      </div>
                      <StatusPill status={displayOrderStatus(order)} />
                    </div>

                    <div className="mt-4 grid gap-3 text-sm font-semibold sm:grid-cols-2 lg:grid-cols-4">
                      <Info label="ວັນທີສ້າງ" value={formatDateTime(order.order_date)} />
                      <Info label="ຜູ້ສ້າງ" value={order.staff_name || "-"} />
                      <Info label="ລາຄາ" value={`${Number(order.exam_price || 0).toLocaleString("lo-LA")} ກີບ`} />
                      <Info label="ສະຖານະຊຳລະ" value={paymentLabel(payment)} />
                    </div>

                    <div className="mt-3 rounded-xl bg-[#f7f8fb] p-3 text-sm font-semibold">
                      <span className="text-[#767285]">ໝາຍເຫດໃບສັ່ງກວດ: </span>
                      {order.note || "-"}
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <section className="rounded-xl border border-[#d9d9d9] p-4">
                        <h4 className="mb-3 text-base font-bold text-[#120d34]">ຜົນກວດ</h4>
                        {result ? (
                          <div className="space-y-3 text-sm font-semibold">
                            <Info label="ເລກຜົນກວດ" value={`R${String(result.result_id).padStart(5, "0")}`} />
                            <Info label="ວັນທີບັນທຶກ" value={formatDateTime(result.result_date)} />
                            <Info label="ຜູ້ບັນທຶກ" value={result.staff_name || "-"} />
                            <div className="rounded-lg bg-[#f7f8fb] p-3 leading-7 text-[#120d34]">{result.result_detail || "-"}</div>
                            {result.result_image_url && (
                              <button
                                type="button"
                                onClick={() => openResultImage(result)}
                                className="inline-flex rounded-full bg-[#addbf4] px-4 py-1 text-[11px] font-bold text-[#123879]"
                              >
                                ເປີດຮູບຜົນກວດ
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-lg bg-[#fff7a5] p-3 text-sm font-bold text-[#a77b00]">ຍັງບໍ່ມີຜົນກວດ</div>
                        )}
                      </section>

                      <section className="rounded-xl border border-[#d9d9d9] p-4">
                        <h4 className="mb-3 text-base font-bold text-[#120d34]">ການຊຳລະເງິນ</h4>
                        {payment ? (
                          <div className="space-y-3 text-sm font-semibold">
                            <Info label="ເລກການຊຳລະ" value={`P${String(payment.payment_id).padStart(5, "0")}`} />
                            <Info label="ວັນທີຊຳລະ" value={formatDateTime(payment.payment_date)} />
                            <Info label="ຈຳນວນເງິນ" value={`${Number(payment.amount || 0).toLocaleString("lo-LA")} ກີບ`} />
                            <Info label="ຊ່ອງທາງ" value={payment.payment_type || "-"} />
                            <Info label="ຜູ້ຮັບເງິນ" value={payment.staff_name || "-"} />
                            <Info label="ສະຖານະ" value={paymentLabel(payment)} />
                            {payment.adjustment_reason && (
                              <div className="rounded-lg bg-[#fff2f2] p-3 text-sm font-bold text-red-700">
                                ເຫດຜົນ: {payment.adjustment_reason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-lg bg-[#fff7a5] p-3 text-sm font-bold text-[#a77b00]">ຍັງບໍ່ໄດ້ຊຳລະ</div>
                        )}
                      </section>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {previewImageUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            onClick={closePreviewImage}
            className="absolute right-4 top-4 rounded-lg bg-[#efabab] px-4 py-2 text-sm font-bold text-black shadow-sm"
          >
            ປິດ
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImageUrl}
            alt="ຮູບຜົນກວດ"
            className="max-h-[92vh] max-w-[94vw] rounded-xl bg-white object-contain shadow-lg"
          />
        </div>
      )}
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[#f7f8fb] p-3">
      <div className="text-xs font-bold text-[#767285]">{label}</div>
      <div className="mt-1 text-sm font-bold text-[#120d34]">{value}</div>
    </div>
  );
}

function genderLabel(gender?: string | null) {
  if (gender === "F") return "ຍິງ";
  if (gender === "M") return "ຊາຍ";
  if (gender === "Other") return "ອື່ນໆ";
  return "-";
}

function paymentLabel(payment?: Payment) {
  const status = String(payment?.status || "").toUpperCase();
  if (!payment) return "ຍັງບໍ່ໄດ້ຊຳລະ";
  if (status === "VOID") return "ຍົກເລີກການຊຳລະ";
  if (status === "REFUNDED") return "ຄືນເງິນແລ້ວ";
  return "ຈ່າຍແລ້ວ";
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
