"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser } from "@/services/auth-service";
import { deleteDocument, getDocuments } from "@/services/document-service";
import { DocumentItem } from "@/types";

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocuments() {
      try {
        await getCurrentUser();
        const docs = await getDocuments();
        setDocuments(docs);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("No authentication token")) {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load documents.");
      } finally {
        setLoading(false);
      }
    }
    loadDocuments();
  }, [router]);

  async function handleDelete(documentId: string, filename: string) {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
      setDeletingId(documentId);
      await deleteDocument(documentId);
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete document.");
    } finally {
      setDeletingId(null);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
        <p className="text-slate-600">Loading documents...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your Documents</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage your uploaded study PDFs and view extracted text.
          </p>
        </div>
        <Link
          href="/upload"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
        >
          + Upload PDF
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4 text-sm font-medium text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {!loading && documents.length === 0 && !error && (
        <div className="mt-12 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-4 text-base font-semibold text-slate-900">No documents uploaded yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Upload your lecture notes, textbook PDFs, or articles to get started.
          </p>
          <div className="mt-6">
            <Link
              href="/upload"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
            >
              Upload PDF Document
            </Link>
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 font-medium">
              <tr>
                <th className="px-6 py-3">Document Title</th>
                <th className="px-6 py-3">Size</th>
                <th className="px-6 py-3">Pages</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Upload Date</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {doc.title}
                    </Link>
                    <p className="text-xs text-slate-500">{doc.original_filename}</p>
                  </td>
                  <td className="px-6 py-4">{formatFileSize(doc.file_size)}</td>
                  <td className="px-6 py-4">{doc.page_count ?? "N/A"}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        doc.processing_status === "COMPLETED"
                          ? "bg-green-100 text-green-800"
                          : doc.processing_status === "NO_TEXT_FOUND"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {doc.processing_status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{formatDate(doc.created_at)}</td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handleDelete(doc.id, doc.original_filename)}
                      disabled={deletingId === doc.id}
                      className="font-medium text-red-600 hover:text-red-500 disabled:opacity-50"
                    >
                      {deletingId === doc.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

