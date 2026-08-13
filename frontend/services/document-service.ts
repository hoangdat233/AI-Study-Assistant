import { apiDelete, apiGet, apiUpload } from "@/lib/api-client";
import { getToken } from "@/services/auth-service";
import { DocumentDetailItem, DocumentItem } from "@/types";

export async function uploadDocument(file: File): Promise<DocumentDetailItem> {
  const token = getToken();
  if (!token) throw new Error("No authentication token found");

  const formData = new FormData();
  formData.append("file", file);

  return apiUpload<DocumentDetailItem>("/api/documents", formData, { token });
}

export async function getDocuments(): Promise<DocumentItem[]> {
  const token = getToken();
  if (!token) throw new Error("No authentication token found");

  return apiGet<DocumentItem[]>("/api/documents", { token });
}

export async function getDocument(documentId: string): Promise<DocumentDetailItem> {
  const token = getToken();
  if (!token) throw new Error("No authentication token found");

  return apiGet<DocumentDetailItem>(`/api/documents/${documentId}`, { token });
}

export async function deleteDocument(documentId: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("No authentication token found");

  return apiDelete(`/api/documents/${documentId}`, { token });
}
