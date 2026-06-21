import StaffFormPage from "../../StaffFormPage";

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StaffFormPage staffId={Number(id)} />;
}
