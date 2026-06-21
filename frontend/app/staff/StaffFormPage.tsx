"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type FieldPath } from "react-hook-form";
import { z } from "zod";
import AppShell, { useCurrentUser } from "@/components/AppShell";
import { ActionButton, PageHero } from "@/components/dashboard-ui";
import api from "@/lib/api";
import type { ApiResponse, Staff } from "@/lib/types";

const staffFormSchema = z
  .object({
    staff_name: z.string().min(1, "ກະລຸນາປ້ອນຊື່ພນັກງານ"),
    username: z.string().min(1, "ກະລຸນາປ້ອນ username"),
    password: z.string().optional(),
    position: z.string().optional(),
    department: z.string().optional(),
    phone: z.string().optional(),
    role: z.enum(["ADMIN", "STAFF"]),
  })
  .superRefine((value, context) => {
    if (value.password !== undefined && value.password.length > 0 && value.password.length < 6) {
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "ລະຫັດຜ່ານຕ້ອງມີຢ່າງນ້ອຍ 6 ຕົວອັກສອນ",
      });
    }
  });

type StaffFormValues = z.infer<typeof staffFormSchema>;

export default function StaffFormPage({ staffId }: { staffId?: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userQuery = useCurrentUser();
  const isEdit = typeof staffId === "number";
  const isAdmin = userQuery.data?.role === "ADMIN";
  const [formError, setFormError] = useState<string | null>(null);

  const staffQuery = useQuery({
    queryKey: ["staff", staffId],
    queryFn: async () => (await api.get<ApiResponse<Staff>>(`/staff/${staffId}`)).data.data,
    enabled: isEdit && isAdmin,
    retry: false,
  });

  const title = isEdit ? "ແກ້ໄຂຂໍ້ມູນພະນັກງານ" : "ເພີ່ມພະນັກງານໃໝ່";
  const subtitle = isEdit ? "ສະເພາະຜູ້ດູແລລະບົບເທົ່ານັ້ນທີ່ສາມາດແກ້ໄຂຂໍ້ມູນພະນັກງານໄດ້" : "ບັນທຶກຂໍ້ມູນພະນັກງານໃໝ່ລົງຖານຂໍ້ມູນ";

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormValues>({
    defaultValues: {
      staff_name: "",
      username: "",
      password: "",
      position: "",
      department: "",
      phone: "",
      role: "STAFF",
    },
  });

  useEffect(() => {
    if (!staffQuery.data) return;
    reset({
      staff_name: staffQuery.data.staff_name || "",
      username: staffQuery.data.username || "",
      password: "",
      position: staffQuery.data.position || "",
      department: staffQuery.data.department || "",
      phone: staffQuery.data.phone || "",
      role: staffQuery.data.role === "ADMIN" ? "ADMIN" : "STAFF",
    });
  }, [reset, staffQuery.data]);

  const submitMutation = useMutation({
    mutationFn: async (values: StaffFormValues) => {
      const payload = {
        staff_name: values.staff_name,
        username: values.username,
        position: values.position || null,
        department: values.department || null,
        phone: values.phone || null,
        role: values.role,
      };

      if (isEdit) {
        await api.put(`/staff/${staffId}`, payload);
        if (values.password) {
          await api.patch(`/staff/${staffId}/password`, { password: values.password });
        }
        return;
      }

      await api.post("/staff", {
        ...payload,
        password: values.password,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["staff-options"] });
      router.push("/staff");
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error) || "ບໍ່ສາມາດບັນທຶກຂໍ້ມູນໄດ້";
      setFormError(message);
    },
  });

  const createSchema = useMemo(
    () =>
      staffFormSchema.superRefine((value, context) => {
        if (!isEdit && !value.password) {
          context.addIssue({
            code: "custom",
            path: ["password"],
            message: "ກະລຸນາປ້ອນລະຫັດຜ່ານ",
          });
        }
      }),
    [isEdit]
  );

  const onSubmit = (values: StaffFormValues) => {
    const parsed = createSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as FieldPath<StaffFormValues> | undefined;
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
      <PageHero title={title} subtitle={subtitle}>
        <ActionButton href="/staff">ກັບຄືນ</ActionButton>
      </PageHero>

      <div className="px-4 py-5 sm:px-6 lg:px-10">
        {!isAdmin && userQuery.isAuthReady && !userQuery.isLoading ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
            ສະເພາະຜູ້ດູແລລະບົບເທົ່ານັ້ນທີ່ສາມາດເພີ່ມ ຫຼື ແກ້ໄຂຂໍ້ມູນພະນັກງານໄດ້
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[760px] rounded-2xl border border-[#d9d9d9] bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-5">
              <Field label="ຊື່ ແລະ ນາມສະກຸນ" required error={errors.staff_name?.message}>
                <input className="field" placeholder="ກະລຸນາປ້ອນຊື່ ແລະ ນາມສະກຸນ" {...register("staff_name")} />
              </Field>

              <Field label="ຊື່ເຂົ້າລະບົບ" required error={errors.username?.message}>
                <input className="field" placeholder="ກະລຸນາປ້ອນຊື່ເຂົ້າລະບົບ" {...register("username")} />
              </Field>

              <Field label="ລະຫັດຜ່ານ" required={!isEdit} error={errors.password?.message}>
                <input className="field" type="password" placeholder={isEdit ? "ກະລຸນາປ້ອນລະຫັດຜ່ານ" : "ຢ່າງນ້ອຍ 6 ຕົວອັກສອນ"} {...register("password")} />
              </Field>

              <Field label="ສິດນຳໃຊ້" required error={errors.role?.message}>
                <select className="field" {...register("role")}>
                  <option value="STAFF">ພະນັກງານ</option>
                  <option value="ADMIN">ຜູ້ດູແລລະບົບ</option>
                </select>
              </Field>

              <Field label="ຕຳແໜ່ງ" error={errors.position?.message}>
                <input className="field" placeholder="ໝໍ, ພະຍາບານ, ບັນຊີ" {...register("position")} />
              </Field>

              <Field label="ພະແນກ " error={errors.department?.message}>
                <input className="field" placeholder="Radiology" {...register("department")} />
              </Field>

              <Field label="ເບີໂທ" error={errors.phone?.message}>
                <input className="field" placeholder="020..." {...register("phone")} />
              </Field>
            </div>

            {formError && <div className="mt-3 rounded-lg bg-red-50 p-3 text-red-700">{formError}</div>}

            <button
              type="submit"
              disabled={isSubmitting || submitMutation.isPending || staffQuery.isLoading}
              className="mt-2 h-10 w-full rounded-lg bg-[#99fba6] text-base font-bold shadow-sm"
            >
              {submitMutation.isPending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກຂໍ້ມູນພະນັກງານ"}
            </button>
          </form>
        )}
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

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
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
