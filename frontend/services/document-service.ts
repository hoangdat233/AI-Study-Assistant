import { apiDelete, apiGet, apiPost, apiUpload } from "@/lib/api-client";
import { getToken } from "@/services/auth-service";
import { DocumentDetailItem, DocumentItem, SummaryItem } from "@/types";

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

export async function getDocumentSummary(documentId: string): Promise<SummaryItem> {
  const token = getToken();
  if (!token) throw new Error("No authentication token found");

  return apiGet<SummaryItem>(`/api/documents/${documentId}/summary`, { token });
}

export async function generateDocumentSummary(
  documentId: string,
  force: boolean = false
): Promise<SummaryItem> {
  const token = getToken();
  if (!token) throw new Error("No authentication token found");

  const query = force ? "?force=true" : "";
  return apiPost<SummaryItem, undefined>(
    `/api/documents/${documentId}/summary${query}`,
    undefined,
    { token }
  );
}

