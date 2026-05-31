"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type FieldPath } from "react-hook-form";
import { z } from "zod";
import AppShell from "@/components/AppShell";
import { ActionButton, PageHero, patientName } from "@/components/dashboard-ui";
import api from "@/lib/api";
import type { ApiResponse, Patient } from "@/lib/types";

const patientSchema = z.object({
  first_name: z.string().min(1, "ກະລຸນາປ້ອນຊື່"),
  last_name: z.string().min(1, "ກະລຸນາປ້ອນນາມສະກຸນ"),
  age: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
    z.number().min(0, "ອາຍຸຕ້ອງບໍ່ຕິດລົບ").optional()
  ),
  gender: z.enum(["M", "F", "Other"]),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  address: z.string().optional(),
  emergency_phone: z.string().optional(),
});

type PatientValues = z.infer<typeof patientSchema>;

export default function PatientFormPage({ patientId }: { patientId: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const patientQuery = useQuery({
    queryKey: ["patients", patientId],
    queryFn: async () => (await api.get<ApiResponse<Patient>>(`/patients/${patientId}`)).data.data,
    retry: false,
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PatientValues>({
    defaultValues: {
      first_name: "",
      last_name: "",
      age: undefined,
      gender: "Other",
      phone: "",
      date_of_birth: "",
      address: "",
      emergency_phone: "",
    },
  });

  useEffect(() => {
    if (!patientQuery.data) return;
    reset({
      first_name: patientQuery.data.first_name || "",
      last_name: patientQuery.data.last_name || "",
      age: patientQuery.data.age ?? undefined,
      gender: patientQuery.data.gender === "M" || patientQuery.data.gender === "F" || patientQuery.data.gender === "Other" ? patientQuery.data.gender : "Other",
      phone: patientQuery.data.phone || "",
      date_of_birth: toDateInput(patientQuery.data.date_of_birth),
      address: patientQuery.data.address || "",
      emergency_phone: patientQuery.data.emergency_phone || "",
    });
  }, [patientQuery.data, reset]);

  const submitMutation = useMutation({
    mutationFn: async (values: PatientValues) =>
      api.put(`/patients/${patientId}`, {
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        age: values.age ?? null,
        gender: values.gender,
        phone: toNullable(values.phone),
        date_of_birth: toNullable(values.date_of_birth),
        address: toNullable(values.address),
        emergency_phone: toNullable(values.emergency_phone),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["results"] });
      router.push("/patients");
    },
    onError: (error: unknown) => {
      setFormError(getErrorMessage(error) || "ບໍ່ສາມາດແກ້ໄຂຂໍ້ມູນຄົນເຈັບໄດ້");
    },
  });

  const onSubmit = (values: PatientValues) => {
    const parsed = patientSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as FieldPath<PatientValues> | undefined;
        if (field) setError(field, { message: issue.message });
      });
      setFormError(parsed.error.issues[0]?.message || "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ");
      return;
    }

    setFormError(null);
    submitMutation.mutate(parsed.data);
  };

  return (
    <AppShell>
      <PageHero title="ແກ້ໄຂຂໍ້ມູນຄົນເຈັບ" subtitle={patientQuery.data ? `HN-${String(patientId).padStart(6, "0")} ${patientName(patientQuery.data)}` : "ກຳລັງໂຫຼດຂໍ້ມູນ"}>
        <ActionButton href={`/patients/${patientId}/history`} tone="blue">
          ເບິ່ງປະຫວັດໃບສັ່ງກວດ
        </ActionButton>
        <ActionButton href="/patients">ກັບຄືນ</ActionButton>
      </PageHero>

      <div className="px-4 py-5 sm:px-6 lg:px-10">
        {patientQuery.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
            ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຄົນເຈັບໄດ້
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[860px] rounded-2xl border border-[#d9d9d9] bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-5">
              <Field label="ຊື່" required error={errors.first_name?.message}>
                <input className="field" {...register("first_name")} />
              </Field>
              <Field label="ນາມສະກຸນ" required error={errors.last_name?.message}>
                <input className="field" {...register("last_name")} />
              </Field>
              <Field label="ອາຍຸ" error={errors.age?.message}>
                <input className="field" type="number" min={0} {...register("age")} />
              </Field>
              <Field label="ເພດ" required error={errors.gender?.message}>
                <select className="field" {...register("gender")}>
                  <option value="M">ຊາຍ</option>
                  <option value="F">ຍິງ</option>
                  <option value="Other">ອື່ນໆ</option>
                </select>
              </Field>
              <Field label="ວັນເກີດ" error={errors.date_of_birth?.message}>
                <input className="field" type="date" {...register("date_of_birth")} />
              </Field>
              <Field label="ເບີໂທ" error={errors.phone?.message}>
                <input className="field" {...register("phone")} />
              </Field>
              <Field label="ເບີໂທສຸກເສີນ" error={errors.emergency_phone?.message}>
                <input className="field" {...register("emergency_phone")} />
              </Field>
            </div>

            <Field label="ທີ່ຢູ່" error={errors.address?.message}>
              <textarea className="field min-h-[110px] resize-none py-2" {...register("address")} />
            </Field>

            {formError && <div className="mt-3 rounded-lg bg-red-50 p-3 text-red-700">{formError}</div>}

            <button
              type="submit"
              disabled={isSubmitting || submitMutation.isPending || patientQuery.isLoading}
              className="mt-2 h-10 w-full rounded-lg bg-[#99fba6] text-base font-bold shadow-sm"
            >
              {submitMutation.isPending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກຂໍ້ມູນຄົນເຈັບ"}
            </button>
          </form>
        )}
      </div>

      <style jsx>{`
        .field {
          width: 100%;
          min-height: 40px;
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

function toDateInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function toNullable(value?: string) {
  const text = value?.trim();
  return text ? text : null;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message;
  }
  return undefined;
}
