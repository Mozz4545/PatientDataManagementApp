"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { z } from "zod";
import AppShell, { useCurrentUser } from "@/components/AppShell";
import { ActionButton, examOptions, PageHero, patientName, SearchBox } from "@/components/dashboard-ui";
import api from "@/lib/api";
import type { ApiResponse, ExamType, Patient, Staff } from "@/lib/types";

const orderFormSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  age: z.coerce.number().optional(),
  gender: z.enum(["M", "F", "Other"]),
  address: z.string().optional(),
  phone: z.string().optional(),
  emergency_phone: z.string().optional(),
  exam_type_id: z.coerce.number().min(1, "ກະລຸນາເລືອກປະເພດການກວດ"),
  staff_id: z.coerce.number().min(1, "ກະລຸນາເລືອກພະນັກງານຜູ້ສ້າງໃບສັ່ງກວດ"),
  note: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

export default function NewOrderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userQuery = useCurrentUser();
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffPickerOpen, setStaffPickerOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const examTypesQuery = useQuery({
    queryKey: ["exam-types"],
    queryFn: async () => (await api.get<ApiResponse<ExamType[]>>("/exam-types")).data.data,
    retry: false,
  });

  const patientsQuery = useQuery({
    queryKey: ["patients", "order-search", patientSearch],
    queryFn: async () =>
      (await api.get<ApiResponse<Patient[]>>("/patients", { params: { q: patientSearch, limit: 8 } })).data.data,
    enabled: patientSearch.trim().length > 0,
    retry: false,
  });

  const staffOptionsQuery = useQuery({
    queryKey: ["staff-options"],
    queryFn: async () => (await api.get<ApiResponse<Staff[]>>("/staff/options")).data.data,
    retry: false,
  });

  const mergedExamOptions = useMemo(() => {
    const fromApi = (examTypesQuery.data ?? []).map((exam) => ({ id: exam.exam_type_id, name: exam.exam_name }));
    const map = new Map([...examOptions, ...fromApi].map((item) => [item.id, item]));
    return Array.from(map.values());
  }, [examTypesQuery.data]);
  const staffOptions = useMemo(() => staffOptionsQuery.data ?? [], [staffOptionsQuery.data]);

  const {
    register,
    handleSubmit,
    reset,
    control,
    getValues,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormValues>({
    defaultValues: {
      first_name: "",
      last_name: "",
      age: 1,
      gender: "F",
      address: "",
      phone: "",
      emergency_phone: "",
      exam_type_id: 1,
      staff_id: 0,
      note: "",
    },
  });
  const selectedStaffId = Number(useWatch({ control, name: "staff_id" }) || 0);
  const selectedStaff = useMemo(
    () => staffOptions.find((staff) => staff.staff_id === selectedStaffId) || null,
    [selectedStaffId, staffOptions]
  );
  const filteredStaffOptions = useMemo(() => filterStaffOptions(staffOptions, staffSearch), [staffOptions, staffSearch]);

  useEffect(() => {
    if (!staffOptions.length) return;
    if (Number(getValues("staff_id")) > 0) return;
    const currentStaffId = Number(userQuery.data?.staff_id || userQuery.data?.id || 0);
    const defaultStaff =
      staffOptions.find((staff) => staff.staff_id === currentStaffId) ||
      staffOptions[0];
    setValue("staff_id", defaultStaff.staff_id);
  }, [getValues, setValue, staffOptions, userQuery.data?.id, userQuery.data?.staff_id]);

  const selectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    reset({
      ...getValues(),
      first_name: patient.first_name || "",
      last_name: patient.last_name || "",
      age: patient.age || 1,
      gender: patient.gender === "M" || patient.gender === "Other" ? patient.gender : "F",
      address: patient.address || "",
      phone: patient.phone || "",
      emergency_phone: patient.emergency_phone || "",
    });
  };

  const clearSelectedPatient = () => {
    setSelectedPatient(null);
    reset({
      ...getValues(),
      first_name: "",
      last_name: "",
      age: 1,
      gender: "F",
      address: "",
      phone: "",
      emergency_phone: "",
    });
  };

  const createMutation = useMutation({
    mutationFn: async (values: OrderFormValues) => {
      let patientId = selectedPatient?.patient_id;

      if (!patientId) {
        const patientResponse = await api.post<ApiResponse<{ patient_id: number }>>("/patients", {
          first_name: values.first_name,
          last_name: values.last_name,
          age: values.age,
          gender: values.gender,
          phone: values.phone,
          date_of_birth: null,
          address: values.address,
          emergency_phone: values.emergency_phone,
        });
        patientId = patientResponse.data.data.patient_id;
      }

      const orderResponse = await api.post<ApiResponse<{ order_id: number }>>("/orders", {
        patient_id: patientId,
        exam_type_id: values.exam_type_id,
        staff_id: values.staff_id,
        order_date: new Date().toISOString().slice(0, 19).replace("T", " "),
        note: values.note || null,
      });

      try {
        await api.post("/queues", {
          order_id: orderResponse.data.data.order_id,
          queue_date: new Date().toISOString().slice(0, 10),
        });
      } catch {
        // Queue creation can fail if queue data is not ready yet.
      }

      return orderResponse.data.data;
    },
    onSuccess: () => {
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["queues"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      window.setTimeout(() => router.push("/orders"), 1400);
    },
    onError: () => setFormError("ບໍ່ສາມາດສ້າງໃບສັ່ງກວດໄດ້"),
  });

  const requireField = (name: FieldPath<OrderFormValues>, value: unknown, message: string) => {
    if (value === undefined || value === null || value === "" || value === 0) {
      setError(name, { message });
      return false;
    }
    return true;
  };

  const onSubmit = (values: OrderFormValues) => {
    const parsed = orderFormSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as FieldPath<OrderFormValues> | undefined;
        if (field) setError(field, { message: issue.message });
      });
      setFormError(parsed.error.issues[0]?.message || "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ");
      return;
    }

    if (!selectedPatient) {
      const valid =
        requireField("first_name", parsed.data.first_name, "ກະລຸນາປ້ອນຊື່") &&
        requireField("last_name", parsed.data.last_name, "ກະລຸນາປ້ອນນາມສະກຸນ") &&
        requireField("age", parsed.data.age, "ກະລຸນາປ້ອນອາຍຸ") &&
        requireField("address", parsed.data.address, "ກະລຸນາປ້ອນທີ່ຢູ່") &&
        requireField("phone", parsed.data.phone, "ກະລຸນາປ້ອນເບີໂທ") &&
        requireField("emergency_phone", parsed.data.emergency_phone, "ກະລຸນາປ້ອນເບີສຸກເສີນ");

      if (!valid) {
        setFormError("ກະລຸນາປ້ອນຂໍ້ມູນຄົນເຈັບໃຫ້ຄົບ ຫຼື ເລືອກຄົນເຈັບເກົ່າຈາກການຄົ້ນຫາ");
        return;
      }
    }

    setFormError(null);
    createMutation.mutate(parsed.data);
  };

  return (
    <AppShell>
      <PageHero title="ຟອມສ້າງໃບສັ່ງກວດ" subtitle="ຄົ້ນຫາຄົນເຈັບເກົ່າດ້ວຍ ID ຫຼື ຊື່ ແລ້ວສ້າງໃບສັ່ງກວດໄດ້ທັນທີ">
        <ActionButton href="/orders">ກັບຄືນ</ActionButton>
      </PageHero>

      <div className="flex justify-center px-4 py-4 sm:px-6 lg:px-10">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="w-full max-w-[820px] rounded-2xl border border-[#d9d9d9] bg-white p-4 shadow-sm sm:p-5"
        >
          <section className="mb-5 rounded-xl border border-[#d9d9d9] bg-[#f7f8fb] p-4">
            <div className="mb-3 text-sm font-bold text-[#120d34]">ຄົ້ນຫາຄົນເຈັບເກົ່າ</div>
            <p className="mb-3 text-xs font-semibold text-[#767285]">
              ຖ້າເປັນຄົນເຈັບໃໝ່ ລະບົບຈະສ້າງ Patient ID ໃຫ້ອັດຕະໂນມັດ ແລະ ບໍ່ຊ້ຳກັບຄົນອື່ນໃນຖານຂໍ້ມູນ
            </p>
            <SearchBox value={patientSearch} onChange={setPatientSearch} placeholder="Patient ID ຫຼື ຊື່ຄົນເຈັບ" />
            {selectedPatient && (
              <div className="mt-3 flex flex-col gap-2 rounded-lg bg-[#eaffef] p-3 text-sm font-semibold text-[#137547] sm:flex-row sm:items-center sm:justify-between">
                <span>
                  ເລືອກແລ້ວ: HN-{String(selectedPatient.patient_id).padStart(6, "0")} {patientName(selectedPatient)}
                </span>
                <button type="button" onClick={clearSelectedPatient} className="rounded-lg bg-white px-3 py-1 text-[#123879] shadow-sm">
                  ໃຊ້ຄົນເຈັບໃໝ່
                </button>
              </div>
            )}
            {!selectedPatient && patientSearch.trim() && (
              <div className="mt-3 overflow-hidden rounded-lg border border-[#d9d9d9] bg-white">
                {(patientsQuery.data ?? []).length === 0 ? (
                  <div className="px-4 py-3 text-sm font-semibold text-[#767285]">ບໍ່ພົບຄົນເຈັບເກົ່າ ສາມາດກອກຂໍ້ມູນໃໝ່ໄດ້</div>
                ) : (
                  (patientsQuery.data ?? []).map((patient) => (
                    <button
                      type="button"
                      key={patient.patient_id}
                      onClick={() => selectPatient(patient)}
                      className="flex w-full items-center justify-between border-t border-[#eeeeee] px-4 py-3 text-left text-sm first:border-t-0 hover:bg-[#f5f3ff]"
                    >
                      <span className="font-semibold">
                        HN-{String(patient.patient_id).padStart(6, "0")} {patientName(patient)}
                      </span>
                      <span className="text-xs text-[#767285]">{patient.phone || "-"}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </section>

          <Field label="ຊື່ ແລະ ນາມສະກຸນ" required={!selectedPatient} error={errors.first_name?.message || errors.last_name?.message}>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="field" readOnly={!!selectedPatient} placeholder="ປ້ອນຊື່ຄົນເຈັບ" {...register("first_name")} />
              <input className="field" readOnly={!!selectedPatient} placeholder="ປ້ອນນາມສະກຸນ" {...register("last_name")} />
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-5">
            <Field label="ອາຍຸ" required={!selectedPatient} error={errors.age?.message}>
              <input className="field" readOnly={!!selectedPatient} type="number" {...register("age")} />
            </Field>
            <Field label="ເພດ" required={!selectedPatient}>
              <select className="field" disabled={!!selectedPatient} {...register("gender")}>
                <option value="F">ຍິງ</option>
                <option value="M">ຊາຍ</option>
                <option value="Other">ອື່ນໆ</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-5">
            <Field label="ທີ່ຢູ່ປັດຈຸບັນ" required={!selectedPatient} error={errors.address?.message}>
              <input className="field" readOnly={!!selectedPatient} placeholder="ບ້ານ, ເມືອງ, ແຂວງ" {...register("address")} />
            </Field>

            <Field label="ເບີໂທ" required={!selectedPatient} error={errors.phone?.message}>
              <input className="field" readOnly={!!selectedPatient} placeholder="020 55594595" {...register("phone")} />
            </Field>

            <Field label="ປະເພດການກວດ" required error={errors.exam_type_id?.message}>
              <select className="field" {...register("exam_type_id")}>
                {mergedExamOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="ພະນັກງານຜູ້ສ້າງໃບສັ່ງກວດ" required error={errors.staff_id?.message}>
              <div className="relative">
                <input type="hidden" {...register("staff_id")} />
                <input
                  className="field pr-10"
                  value={staffPickerOpen ? staffSearch : formatStaffOption(selectedStaff)}
                  placeholder="ຄົ້ນຫາ Staff ID ຫຼື ຊື່ພະນັກງານ"
                  onBlur={() => {
                    window.setTimeout(() => {
                      setStaffPickerOpen(false);
                    }, 120);
                  }}
                  onChange={(event) => {
                    setStaffSearch(event.target.value);
                    setStaffPickerOpen(true);
                    setValue("staff_id", 0, { shouldValidate: true });
                  }}
                  onFocus={() => {
                    setStaffPickerOpen(true);
                    setStaffSearch("");
                  }}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#767285]">⌄</span>
                {staffPickerOpen && (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[#d9d9d9] bg-white shadow-lg">
                    {filteredStaffOptions.length === 0 ? (
                      <div className="px-4 py-3 text-sm font-semibold text-[#767285]">ບໍ່ພົບຂໍ້ມູນພະນັກງານ</div>
                    ) : (
                      filteredStaffOptions.map((staff) => (
                        <button
                          type="button"
                          key={staff.staff_id}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setValue("staff_id", staff.staff_id, { shouldValidate: true });
                            setStaffSearch(formatStaffOption(staff));
                            setStaffPickerOpen(false);
                          }}
                          className="flex w-full items-center justify-between gap-3 border-t border-[#eeeeee] px-4 py-3 text-left text-sm first:border-t-0 hover:bg-[#f5f3ff]"
                        >
                          <span className="font-semibold">{formatStaffOption(staff)}</span>
                          <span className="shrink-0 text-xs text-[#767285]">{staff.department || staff.role || "-"}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </Field>

            <Field label="ເບີຕິດຕໍ່ສຸກເສີນ" required={!selectedPatient} error={errors.emergency_phone?.message}>
              <input className="field" readOnly={!!selectedPatient} placeholder="020 55594595" {...register("emergency_phone")} />
            </Field>
          </div>

          <Field label="ໝາຍເຫດ">
            <textarea className="field min-h-[112px] resize-none py-2" placeholder="ປ້ອນໝາຍເຫດເພີ່ມເຕີມ" {...register("note")} />
          </Field>

          {formError && <div className="mt-3 rounded-lg bg-red-50 p-3 text-red-700">{formError}</div>}

          <button
            type="submit"
            disabled={isSubmitting || createMutation.isPending}
            className="mt-2 h-10 w-full rounded-lg bg-[#99fba6] text-base font-bold shadow-sm"
          >
            {createMutation.isPending ? "ກຳລັງສ້າງ..." : "ສ້າງໃບສັ່ງກວດ"}
          </button>
        </form>
      </div>

      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[520px] rounded-2xl bg-[#f2fde9] p-6 text-center shadow-lg sm:p-8">
            <h3 className="text-xl font-bold sm:text-2xl">ສ້າງໃບສັ່ງກວດສຳເລັດແລ້ວ</h3>
            <div className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-3xl border-[8px] border-[#27f108] text-6xl text-[#27f108]">
              ✓
            </div>
          </div>
        </div>
      )}

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

        input[readonly],
        select:disabled {
          background: #f5f5f5;
          color: #555;
        }
      `}</style>
    </AppShell>
  );
}

function formatStaffOption(staff?: Staff | null) {
  if (!staff) return "";
  const id = `STF-${String(staff.staff_id).padStart(4, "0")}`;
  return `${id} ${staff.staff_name}${staff.position ? ` - ${staff.position}` : ""}`;
}

function filterStaffOptions(staffOptions: Staff[], search: string) {
  const text = search.trim().toLowerCase();
  if (!text) return staffOptions;
  return staffOptions.filter((staff) =>
    `${staff.staff_id} STF-${String(staff.staff_id).padStart(4, "0")} ${staff.staff_name} ${staff.position || ""} ${staff.department || ""}`
      .toLowerCase()
      .includes(text)
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
