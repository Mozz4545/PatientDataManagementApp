"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell, { useCurrentUser } from "@/components/AppShell";
import { ActionButton, DataState, formatDateTime, PageHero, Pagination, SearchBox } from "@/components/dashboard-ui";
import api from "@/lib/api";
import type { ApiResponse, AuditLogResponse } from "@/lib/types";

const PAGE_SIZE = 20;

export default function AuditLogsPage() {
  const userQuery = useCurrentUser();
  const isAdmin = userQuery.data?.role === "ADMIN";
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const logsQuery = useQuery({
    queryKey: ["audit-logs", search, action, entityType, from, to, page],
    queryFn: async () => {
      const response = await api.get<ApiResponse<AuditLogResponse>>("/audit-logs", {
        params: { q: search || undefined, action: action || undefined, entity_type: entityType || undefined, from: from || undefined, to: to || undefined, page, limit: PAGE_SIZE },
      });
      return response.data.data;
    },
    enabled: isAdmin,
    retry: false,
  });

  const data = logsQuery.data;
  const logs = data?.items ?? [];

  return (
    <AppShell>
      <PageHero title="ປະຫວັດການໃຊ້ງານ" subtitle="ກວດສອບການເພີ່ມ, ແກ້ໄຂ ແລະ ປ່ຽນແປງຂໍ້ມູນໃນລະບົບ">
        <ActionButton onClick={() => logsQuery.refetch()}>ໂຫຼດໃໝ່</ActionButton>
      </PageHero>

      <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-10">
        {!isAdmin && userQuery.isSuccess ? (
          <DataState type="error" message="ສະເພາະຜູ້ດູແລລະບົບເທົ່ານັ້ນທີ່ເບິ່ງປະຫວັດໄດ້" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="ລາຍການທັງໝົດ" value={data?.summary.total ?? 0} color="#123879" />
              <SummaryCard label="ມື້ນີ້" value={data?.summary.today ?? 0} color="#18a957" />
              <SummaryCard label="7 ມື້ຜ່ານມາ" value={data?.summary.last_7_days ?? 0} color="#8c4dff" />
              <SummaryCard label="ຜູ້ໃຊ້ທີ່ມີກິດຈະກຳ" value={data?.summary.actors ?? 0} color="#e98a00" />
            </div>

            <section className="mt-5 rounded-2xl border border-[#d9d9d9] bg-white p-4 shadow-sm sm:p-5">
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
                <SearchBox value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="ຄົ້ນຫາຊື່, ລາຍລະອຽດ, IP" />
                <FilterSelect value={action} onChange={(value) => { setAction(value); setPage(1); }} label="ທຸກການກະທຳ" options={ACTION_OPTIONS} />
                <FilterSelect value={entityType} onChange={(value) => { setEntityType(value); setPage(1); }} label="ທຸກປະເພດຂໍ້ມູນ" options={ENTITY_OPTIONS} />
                <DateInput label="ຈາກວັນທີ" value={from} onChange={(value) => { setFrom(value); setPage(1); }} />
                <DateInput label="ເຖິງວັນທີ" value={to} onChange={(value) => { setTo(value); setPage(1); }} />
              </div>

              <div className="mt-5">
                {logsQuery.isLoading ? <DataState type="loading" /> : logsQuery.isError ? (
                  <DataState type="error" message="ບໍ່ສາມາດໂຫຼດປະຫວັດການໃຊ້ງານໄດ້" onRetry={() => logsQuery.refetch()} />
                ) : logs.length === 0 ? <DataState type="empty" message="ບໍ່ພົບປະຫວັດຕາມຕົວກອງ" /> : (
                  <>
                    <div className="space-y-3 md:hidden">
                      {logs.map((log) => (
                        <article key={log.audit_log_id} className="rounded-xl border border-[#d9d9d9] p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div><h3 className="font-bold">{log.actor_name || "ລະບົບ"}</h3><p className="mt-1 text-xs font-semibold text-[#767285]">{formatDateTime(log.created_at)}</p></div>
                            <ActionPill action={log.action} />
                          </div>
                          <p className="mt-3 text-sm font-semibold">{log.description}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-[#767285]">
                            <span className="rounded-full bg-[#f2f2f2] px-3 py-1">{entityLabel(log.entity_type)} {log.entity_id || ""}</span>
                            {log.ip_address && <span className="rounded-full bg-[#f2f2f2] px-3 py-1">IP: {log.ip_address}</span>}
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto rounded-xl border border-[#d9d9d9] md:block">
                      <table className="w-full min-w-[980px] border-collapse text-left">
                        <thead className="bg-[#f2f2f2] text-xs font-bold"><tr><th className="px-4 py-3">ວັນທີ ແລະ ເວລາ</th><th className="px-4 py-3">ຜູ້ໃຊ້</th><th className="px-4 py-3">ການກະທຳ</th><th className="px-4 py-3">ຂໍ້ມູນ</th><th className="px-4 py-3">ລາຍລະອຽດ</th><th className="px-4 py-3">IP</th></tr></thead>
                        <tbody className="text-xs text-[#5f5b70]">
                          {logs.map((log) => (
                            <tr key={log.audit_log_id} className="border-t border-[#d9d9d9]">
                              <td className="whitespace-nowrap px-4 py-3">{formatDateTime(log.created_at)}</td>
                              <td className="px-4 py-3"><div className="font-bold text-[#120d34]">{log.actor_name || "ລະບົບ"}</div><div>{log.actor_role || "-"}</div></td>
                              <td className="px-4 py-3"><ActionPill action={log.action} /></td>
                              <td className="px-4 py-3">{entityLabel(log.entity_type)}{log.entity_id ? ` #${log.entity_id}` : ""}</td>
                              <td className="max-w-[360px] px-4 py-3 font-semibold text-[#120d34]">{log.description}</td>
                              <td className="px-4 py-3">{log.ip_address || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={page} totalItems={data?.total ?? 0} pageSize={PAGE_SIZE} onPageChange={setPage} />
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

const ACTION_OPTIONS = [
  ["LOGIN", "ເຂົ້າລະບົບ"], ["LOGOUT", "ອອກຈາກລະບົບ"], ["CREATE", "ເພີ່ມ"], ["UPDATE", "ແກ້ໄຂ"],
  ["DEACTIVATE", "ປິດການໃຊ້ງານ"], ["CANCEL", "ຍົກເລີກ"], ["CALL", "ເອີ້ນຄິວ"], ["PAYMENT", "ຊຳລະເງິນ"],
  ["VOID", "Void"], ["REFUND", "ຄືນເງິນ"], ["RESET_PASSWORD", "ປ່ຽນລະຫັດ"], ["STATUS_CHANGE", "ປ່ຽນສະຖານະ"],
];
const ENTITY_OPTIONS = [
  ["AUTH", "ການເຂົ້າລະບົບ"], ["PATIENT", "ຄົນເຈັບ"], ["STAFF", "ພະນັກງານ"], ["ORDER", "ໃບສັ່ງກວດ"],
  ["QUEUE", "ຄິວ"], ["RESULT", "ຜົນກວດ"], ["PAYMENT", "ການຊຳລະ"], ["EXAM_TYPE", "ປະເພດການກວດ"],
];

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: string[][] }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-[#d9d9d9] bg-white px-3 text-sm font-semibold outline-none focus:border-[#123879]"><option value="">{label}</option>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>;
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="flex h-10 items-center gap-2 rounded-xl border border-[#d9d9d9] px-3 text-xs font-bold text-[#767285]"><span>{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[#120d34] outline-none" /></label>;
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="rounded-xl border border-[#d9d9d9] bg-white px-5 py-4 text-center shadow-sm"><div className="text-sm font-bold text-[#767285]">{label}</div><div className="mt-1 text-3xl font-bold" style={{ color }}>{value.toLocaleString("lo-LA")}</div></div>;
}

function ActionPill({ action }: { action: string }) {
  const label = ACTION_OPTIONS.find(([key]) => key === action)?.[1] || action;
  const tone = action === "CREATE" || action === "LOGIN" || action === "PAYMENT" ? "bg-green-100 text-green-700" : action === "CANCEL" || action === "DEACTIVATE" || action === "VOID" ? "bg-red-100 text-red-700" : action === "UPDATE" || action === "STATUS_CHANGE" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold ${tone}`}>{label}</span>;
}

function entityLabel(entity: string) {
  return ENTITY_OPTIONS.find(([key]) => key === entity)?.[1] || entity;
}
