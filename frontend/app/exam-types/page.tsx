"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type FieldPath } from "react-hook-form";
import { z } from "zod";
import AppShell, { useCurrentUser } from "@/components/AppShell";
import { ActionButton, PageHero, Panel } from "@/components/dashboard-ui";
import api from "@/lib/api";
import type { ApiResponse, ExamType } from "@/lib/types";

const examTypeSchema = z.object({
  exam_name: z.string().min(1, "ກະລຸນາປ້ອນຊື່ປະເພດການກວດ"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "ລາຄາຕ້ອງບໍ່ຕິດລົບ"),
});

type ExamTypeValues = z.infer<typeof examTypeSchema>;

export default function ExamTypesPage() {
  const queryClient = useQueryClient();
  const userQuery = useCurrentUser();
  const isAdmin = userQuery.data?.role === "ADMIN";
  const [editing, setEditing] = useState<ExamType | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const examTypesQuery = useQuery({
    queryKey: ["exam-types"],
    queryFn: async () => (await api.get<ApiResponse<ExamType[]>>("/exam-types")).data.data,
    retry: false,
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ExamTypeValues>({
    defaultValues: { exam_name: "", description: "", price: 0 },
  });

  useEffect(() => {
    if (!editing) return;
    reset({
      exam_name: editing.exam_name,
      description: editing.description || "",
      price: Number(editing.price || 0),
    });
  }, [editing, reset]);

  const saveMutation = useMutation({
    mutationFn: async (values: ExamTypeValues) => {
      if (editing) {
        return api.put(`/exam-types/${editing.exam_type_id}`, values);
      }
      return api.post("/exam-types", values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam-types"] });
      setEditing(null);
      reset({ exam_name: "", description: "", price: 0 });
      setFormError(null);
    },
    onError: (error: unknown) => setFormError(getErrorMessage(error) || "ບໍ່ສາມາດບັນທຶກປະເພດການກວດໄດ້"),
  });

  const onSubmit = (values: ExamTypeValues) => {
    const parsed = examTypeSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as FieldPath<ExamTypeValues> | undefined;
        if (field) setError(field, { message: issue.message });
      });
      setFormError(parsed.error.issues[0]?.message || "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ");
      return;
    }
    setFormError(null);
    saveMutation.mutate(parsed.data);
  };

  return (
    <AppShell>
      <PageHero title="ປະເພດການກວດ" subtitle="ຈັດການລາຄາ ແລະ ຂໍ້ມູນປະເພດການກວດ">
        <ActionButton href="/dashboard">ກັບຄືນ</ActionButton>
      </PageHero>

      <div className="grid gap-5 px-4 py-4 sm:px-6 md:px-8 lg:grid-cols-[360px_1fr] lg:px-10">
        <Panel title={editing ? "ແກ້ໄຂປະເພດການກວດ" : "ເພີ່ມປະເພດການກວດ"}>
          {userQuery.isLoading ? (
            <div className="rounded-xl border border-[#d9d9d9] bg-[#f7f8fb] p-4 font-semibold text-[#767285]">
              ກຳລັງກວດສິດຜູ້ໃຊ້...
            </div>
          ) : !isAdmin ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
              ສະເພາະຜູ້ດູແລລະບົບເທົ່ານັ້ນທີ່ຈັດການປະເພດການກວດໄດ້
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)}>
              <Field label="ຊື່ປະເພດການກວດ" required error={errors.exam_name?.message}>
                <input className="field" placeholder="X-Ray Chest" {...register("exam_name")} />
              </Field>
              <Field label="ລາຍລະອຽດ" error={errors.description?.message}>
                <textarea className="field min-h-[88px] resize-none py-2" placeholder="ລາຍລະອຽດ" {...register("description")} />
              </Field>
              <Field label="ລາຄາ" required error={errors.price?.message}>
                <input className="field" type="number" min={0} {...register("price")} />
              </Field>
              {formError && <div className="mt-3 rounded-lg bg-red-50 p-3 text-red-700">{formError}</div>}
              <button
                type="submit"
                disabled={isSubmitting || saveMutation.isPending}
                className="mt-4 h-10 w-full rounded-lg bg-[#99fba6] text-base font-bold shadow-sm"
              >
                {saveMutation.isPending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    reset({ exam_name: "", description: "", price: 0 });
                  }}
                  className="mt-3 h-10 w-full rounded-lg bg-[#f4e3b0] text-base font-bold shadow-sm"
                >
                  ຍົກເລີກການແກ້ໄຂ
                </button>
              )}
            </form>
          )}
        </Panel>

        <Panel title="ລາຍການປະເພດການກວດ">
          <div className="overflow-x-auto rounded-xl border border-[#d9d9d9]">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead className="bg-[#f2f2f2] text-xs font-bold">
                <tr>
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">ຊື່</th>
                  <th className="px-5 py-3">ລາຍລະອຽດ</th>
                  <th className="px-5 py-3">ລາຄາ</th>
                  <th className="px-5 py-3">ຈັດການ</th>
                </tr>
              </thead>
              <tbody className="text-xs text-[#767285]">
                {examTypesQuery.isLoading ? (
                  <tr>
                    <td className="px-5 py-6 text-center" colSpan={5}>
                      ກຳລັງໂຫຼດ...
                    </td>
                  </tr>
                ) : examTypesQuery.isError ? (
                  <tr>
                    <td className="px-5 py-6 text-center text-red-600" colSpan={5}>
                      ບໍ່ສາມາດໂຫຼດລາຍການໄດ້ ກະລຸນາເຂົ້າລະບົບໃໝ່ ຫຼື ກົດໂຫຼດໜ້າອີກຄັ້ງ
                    </td>
                  </tr>
                ) : (examTypesQuery.data ?? []).length === 0 ? (
                  <tr>
                    <td className="px-5 py-6 text-center" colSpan={5}>
                      ບໍ່ມີປະເພດການກວດ
                    </td>
                  </tr>
                ) : (
                  (examTypesQuery.data ?? []).map((exam) => (
                    <tr key={exam.exam_type_id} className="border-t border-[#d7d7d7]">
                      <td className="px-5 py-3">{exam.exam_type_id}</td>
                      <td className="px-5 py-3">{exam.exam_name}</td>
                      <td className="px-5 py-3">{exam.description || "-"}</td>
                      <td className="px-5 py-3">{Number(exam.price || 0).toLocaleString("lo-LA")} ກີບ</td>
                      <td className="px-5 py-3">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => setEditing(exam)}
                            className="rounded-full bg-[#bafbd2] px-4 py-1 text-[11px] font-bold text-[#137547]"
                          >
                            ແກ້ໄຂ
                          </button>
                        ) : (
                          <span>ສະເພາະຜູ້ດູແລ</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <style jsx>{`
        .field {
          width: 100%;
          min-height: 38px;
          border-radius: 8px;
          border: 1px solid #d9d9d9;
          padding: 0 12px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
          outline: none;
          font-size: 14px;
        }
      `}</style>
    </AppShell>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block text-xs font-bold text-black">
      {label} {required && <span className="text-red-600">*</span>}
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message;
  }
  return undefined;
}
