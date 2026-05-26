"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import api, { setAuthToken } from "@/lib/api";

const loginSchema = z.object({
  username: z.string().min(1, "ກະລຸນາປ້ອນ USER ID"),
  password: z.string().min(1, "ກະລຸນາປ້ອນລະຫັດຜ່ານ"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    defaultValues: { username: "", password: "" },
  });

  const loginMutation = useMutation({
    mutationFn: (values: LoginValues) => api.post("/auth/login", values),
    onSuccess: (response) => {
      const token = response.data?.data?.token;
      const user = response.data?.data?.user;
      if (token) {
        localStorage.setItem("radiology_token", token);
        if (user) localStorage.setItem("radiology_user", JSON.stringify(user));
        setAuthToken(token);
        router.replace("/dashboard");
      }
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>;
      setFormError(axiosError.response?.data?.message || "ບໍ່ສາມາດເຂົ້າລະບົບໄດ້");
    },
  });

  const onSubmit = (values: LoginValues) => {
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ");
      return;
    }
    setFormError(null);
    loginMutation.mutate(parsed.data);
  };

  return (
    <main className="min-h-screen bg-white">
      <header className="flex min-h-14 items-center bg-[#123879] px-4 py-2 text-white shadow-sm sm:min-h-16 sm:px-6 lg:min-h-[72px] lg:px-10">
        <h1 className="text-base font-bold leading-tight sm:text-xl lg:text-[30px]">ລະບົບຈັດການຂໍ້ມູນຄົນເຈັບ ໂຮງໝໍ 103</h1>
      </header>

      <section className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4 py-6 sm:min-h-[calc(100vh-64px)] sm:px-6 lg:min-h-[calc(100vh-72px)]">
        <div className="w-full max-w-[440px]">
          <h2 className="mb-4 text-center text-3xl font-bold leading-none text-black sm:text-4xl">ເຂົ້າສູ່ລະບົບ</h2>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="rounded-2xl border border-[#d9d9d9] bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8"
          >
            <label className="block text-sm font-semibold text-black">
              User ID <span className="text-red-600">*</span>
              <input
                type="text"
                placeholder="ກະລຸນາປ້ອນ USER ID"
                className="mt-2 h-10 w-full rounded-lg border border-[#d9d9d9] px-3 text-sm shadow-sm outline-none placeholder:text-[#d9d9d9] focus:border-[#123879]"
                {...register("username")}
              />
            </label>
            {errors.username && <p className="mt-2 text-sm text-red-600">{errors.username.message}</p>}

            <label className="mt-6 block text-sm font-semibold text-black">
              ລະຫັດຜ່ານ <span className="text-red-600">*</span>
              <input
                type="password"
                placeholder="ກະລຸນາປ້ອນລະຫັດຜ່ານ"
                className="mt-2 h-10 w-full rounded-lg border border-[#d9d9d9] px-3 text-sm shadow-sm outline-none placeholder:text-[#d9d9d9] focus:border-[#123879]"
                {...register("password")}
              />
            </label>
            {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>}

            <div className="mt-3 text-right text-xs font-semibold">
              <Link href="/forgot-password" className="text-[#123879] hover:underline">
                ລືມລະຫັດຜ່ານ
              </Link>
            </div>

            {formError && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-red-700">{formError}</div>}

            <button
              type="submit"
              disabled={isSubmitting || loginMutation.isPending}
              className="mx-auto mt-6 flex h-10 w-full max-w-[240px] items-center justify-center rounded-lg bg-[#99fba6] text-lg font-bold text-black shadow-sm"
            >
              {loginMutation.isPending ? "..." : "ຢືນຢັນ"}
            </button>

            <div className="mt-4 border-t border-[#eeeeee] pt-4 text-center">
              <Link
                href="/queues/display"
                className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#addbf4] px-4 text-sm font-bold text-[#123879] shadow-sm transition hover:bg-[#99d1ee]"
              >
                ເປີດຈໍສະແດງຄິວ
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
