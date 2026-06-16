import api from "@/lib/api";

export async function getResultImageObjectUrl(resultId: number) {
  const response = await api.get<Blob>(`/results/${resultId}/image`, { responseType: "blob" });
  return URL.createObjectURL(response.data);
}

export async function getResultImageDataUrl(resultId: number) {
  const response = await api.get<Blob>(`/results/${resultId}/image`, { responseType: "blob" });
  return blobToDataUrl(response.data);
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
