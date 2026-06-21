import { redirect } from "next/navigation";

export default async function LegacyEditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/staff/${id}/edit`);
}
