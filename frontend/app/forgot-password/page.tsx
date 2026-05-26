"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useForm, type FieldPath } from "react-hook-form";
import { z } from "zod";
import api from "@/lib/api";

const requestOtpSchema = z.object({
  username: z.string().min(1, "ກະລຸນາປ້ອນ USER ID"),
  phone: z.string().min(1, "ກະລຸນາປ້ອນເບີໂທທີ່ລົງທະບຽນ"),
});

const confirmOtpSchema = requestOtpSchema
  .extend({
    otp: z.string().length(6, "OTP ຕ້ອງມີ 6 ຕົວເລກ"),
    password: z.string().min(6, "ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ"),
    confirmPassword: z.string().min(1, "ກະລຸນາຢືນຢັນລະຫັດຜ່ານ"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "ລະຫັດຜ່ານບໍ່ກົງກັນ",
  });

type ForgotPasswordValues = z.infer<typeof confirmOtpSchema>;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    defaultValues: {
      username: "",
      phone: "",
      otp: "",
      password: "",
      confirmPassword: "",
    },
  });

  const requestOtpMutation = useMutation({
    mutationFn: (values: Pick<ForgotPasswordValues, "username" | "phone">) =>
      api.post("/auth/password-reset/request-otp", values),
    onSuccess: (response) => {
      setStep("confirm");
      setDevOtp(response.data?.data?.dev_otp || null);
      setFormError(null);
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>;
      setFormError(axiosError.response?.data?.message || "ບໍ່ສາມາດສົ່ງ OTP ໄດ້");
    },
  });

  const confirmOtpMutation = useMutation({
    mutationFn: (values: ForgotPasswordValues) =>
      api.post("/auth/password-reset/confirm", {
        username: values.username,
        phone: values.phone,
        otp: values.otp,
        password: values.password,
      }),
    onSuccess: () => {
      setSuccess(true);
      setFormError(null);
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>;
      setFormError(axiosError.response?.data?.message || "OTP ຫຼື ຂໍ້ມູນບັນຊີບໍ່ຖືກຕ້ອງ");
    },
  });

  const setZodErrors = (issues: z.ZodIssue[]) => {
    issues.forEach((issue) => {
      const field = issue.path[0] as FieldPath<ForgotPasswordValues> | undefined;
      if (field) setError(field, { message: issue.message });
    });
    setFormError(issues[0]?.message || "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ");
  };

  const onSubmit = (values: ForgotPasswordValues) => {
    if (step === "request") {
      const parsed = requestOtpSchema.safeParse(values);
      if (!parsed.success) {
        setZodErrors(parsed.error.issues);
        return;
      }
      setFormError(null);
      requestOtpMutation.mutate(parsed.data);
      return;
    }

    const parsed = confirmOtpSchema.safeParse(values);
    if (!parsed.success) {
      setZodErrors(parsed.error.issues);
      return;
    }
    setFormError(null);
    confirmOtpMutation.mutate(parsed.data);
  };

  const resendOtp = () => {
    const parsed = requestOtpSchema.safeParse(getValues());
    if (!parsed.success) {
      setZodErrors(parsed.error.issues);
      return;
    }
    setFormError(null);
    requestOtpMutation.mutate(parsed.data);
  };

  return (
    <main className="min-h-screen bg-white">
      <header className="flex min-h-14 items-center bg-[#123879] px-4 py-2 text-white shadow-sm sm:min-h-16 sm:px-6 lg:min-h-[72px] lg:px-10">
        <h1 className="text-base font-bold leading-tight sm:text-xl lg:text-[30px]">ລະບົບຈັດການຂໍ້ມູນຄົນເຈັບ ໂຮງໝໍ 103</h1>
      </header>

      <section className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4 py-6 sm:min-h-[calc(100vh-64px)] sm:px-6 lg:min-h-[calc(100vh-72px)]">
        <div className="w-full max-w-[460px]">
          <h2 className="mb-4 text-center text-3xl font-bold leading-none text-black sm:text-4xl">ລືມລະຫັດຜ່ານ</h2>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="rounded-2xl border border-[#d9d9d9] bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8"
          >
            <p className="mb-5 text-sm font-semibold text-[#767285]">
              ຂໍ OTP ດ້ວຍ USER ID ແລະ ເບີໂທທີ່ລົງທະບຽນ ຫຼັງຈາກນັ້ນປ້ອນ OTP ເພື່ອຕັ້ງລະຫັດຜ່ານໃໝ່.
            </p>

            <Field label="User ID" required error={errors.username?.message}>
              <input type="text" placeholder="ປ້ອນ USER ID" className="field" disabled={step === "confirm" || success} {...register("username")} />
            </Field>

            <Field label="ເບີໂທທີ່ລົງທະບຽນ" required error={errors.phone?.message}>
              <input type="tel" placeholder="020 55594595" className="field" disabled={step === "confirm" || success} {...register("phone")} />
            </Field>

            {step === "confirm" && (
              <>
                {devOtp && (
                  <div className="mt-5 rounded-xl bg-[#fff7a5] px-4 py-3 text-sm font-bold text-[#7a5a00]">
                    OTP ສຳລັບທົດສອບ: {devOtp}
                  </div>
                )}
                <Field label="OTP" required error={errors.otp?.message}>
                  <input type="text" inputMode="numeric" maxLength={6} placeholder="ປ້ອນ OTP 6 ຕົວເລກ" className="field" disabled={success} {...register("otp")} />
                </Field>

                <Field label="ລະຫັດຜ່ານໃໝ່" required error={errors.password?.message}>
                  <input type="password" placeholder="ປ້ອນລະຫັດຜ່ານໃໝ່" className="field" disabled={success} {...register("password")} />
                </Field>

                <Field label="ຢືນຢັນລະຫັດຜ່ານ" required error={errors.confirmPassword?.message}>
                  <input type="password" placeholder="ປ້ອນລະຫັດຜ່ານອີກຄັ້ງ" className="field" disabled={success} {...register("confirmPassword")} />
                </Field>
              </>
            )}

            {formError && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-red-700">{formError}</div>}
            {success && <div className="mt-5 rounded-xl bg-[#f2fde9] px-4 py-3 font-semibold text-[#137547]">ປ່ຽນລະຫັດຜ່ານສຳເລັດແລ້ວ</div>}

            <button
              type="submit"
              disabled={isSubmitting || requestOtpMutation.isPending || confirmOtpMutation.isPending || success}
              className="mx-auto mt-6 flex h-10 w-full max-w-[260px] items-center justify-center rounded-lg bg-[#99fba6] text-base font-bold text-black shadow-sm disabled:opacity-70"
            >
              {step === "request"
                ? requestOtpMutation.isPending
                  ? "ກຳລັງສົ່ງ OTP..."
                  : "ສົ່ງ OTP"
                : confirmOtpMutation.isPending
                  ? "ກຳລັງບັນທຶກ..."
                  : "ຢືນຢັນ OTP"}
            </button>

            {step === "confirm" && !success && (
              <button
                type="button"
                onClick={resendOtp}
                disabled={requestOtpMutation.isPending}
                className="mt-3 flex h-10 w-full items-center justify-center rounded-lg bg-[#addbf4] text-sm font-bold text-[#123879] shadow-sm disabled:opacity-70"
              >
                ສົ່ງ OTP ອີກຄັ້ງ
              </button>
            )}

            <Link
              href="/login"
              className="mt-4 flex h-10 w-full items-center justify-center rounded-lg bg-[#f4e3b0] text-sm font-bold text-black shadow-sm"
            >
              ກັບໄປໜ້າເຂົ້າລະບົບ
            </Link>
          </form>
        </div>
      </section>

      <style jsx>{`
        .field {
          margin-top: 8px;
          height: 40px;
          width: 100%;
          border-radius: 8px;
          border: 1px solid #d9d9d9;
          padding: 0 12px;
          font-size: 14px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
          outline: none;
        }

        .field:focus {
          border-color: #123879;
        }

        .field:disabled {
          background: #f5f5f5;
          color: #555;
        }
      `}</style>
    </main>
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
    <label className="mt-4 block text-sm font-semibold text-black">
      {label} {required && <span className="text-red-600">*</span>}
      {children}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </label>
  );
}
