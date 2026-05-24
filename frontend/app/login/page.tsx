"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import api, { setAuthToken } from "../../lib/api";
import type { AxiosError } from "axios";

const loginSchema = z.object({
  username: z.string().min(1, "ກະລຸນາປ້ອນ USER ID"),
  password: z.string().min(1, "ກະລຸນາປ້ອນລະຫັດຜ່ານ"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Home() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: LoginFormValues) => 
      api.post("/auth/login", values),
    onSuccess: (response) => {
      const token = response?.data?.data?.token;
      if (token) {
        localStorage.setItem("radiology_token", token);
        setAuthToken(token);
        setTimeout(() => {
          router.push("/dashboard");
        }, 300);
      }
      setFormError(null);
    },
    onError: (error: unknown) => {
      const axiosErr = error as unknown as AxiosError;
      const respData = axiosErr?.response?.data;
      let msg: string | undefined;
      if (respData && typeof respData === "object" && "message" in (respData as Record<string, unknown>)) {
        const m = (respData as Record<string, unknown>)["message"];
        if (typeof m === "string") msg = m;
      }
      setFormError(msg || "ບໍ່ສາມາດເຂົ້າລະບົບໄດ້ ລອງອີກຄັ້ງ");
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    const validation = loginSchema.safeParse(values);
    if (!validation.success) {
      setFormError(validation.error.issues?.[0]?.message || "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ");
      return;
    }
    setFormError(null);
    mutation.mutate(validation.data);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
          <h1 className="text-lg font-semibold">ລະບົບຈັດການຄົນເຈັບ ພະແນກລັງສີ - ໂຮງໝໍ 103</h1>
        </div>
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center px-6 py-10">
        <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-10 shadow-lg shadow-slate-200/80">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">ເຂົ້າສຼ່ລະບົບ</h2>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">User ID <span className="text-red-500">*</span></label>
              <input
                type="text"
                placeholder="ກະລຸນາປ້ອນ USER ID"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                {...register("username")}
              />
              {errors.username && (
                <p className="text-sm text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <label className="block text-sm font-medium text-slate-700">ละหัสผ่าน <span className="text-red-500">*</span></label>
                <span className="text-sm text-slate-500">ລືມລະຫັດຜ່ານ?</span>
              </div>
              <input
                type="password"
                placeholder="ກະລຸນາປ້ອນລະຫັດຜ່ານ"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {formError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-300 px-6 py-3 text-base font-semibold text-slate-900 shadow-md transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {mutation.isPending || isSubmitting ? "กำลังบันทึก..." : "ยืนยัน"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
