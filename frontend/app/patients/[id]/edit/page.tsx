import PatientFormPage from "../../PatientFormPage";

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientFormPage patientId={Number(id)} />;
}
