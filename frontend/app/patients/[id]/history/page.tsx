import PatientHistoryPage from "../../PatientHistoryPage";

export default async function PatientOrderHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientHistoryPage patientId={Number(id)} />;
}
