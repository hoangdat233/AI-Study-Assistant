"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser } from "@/services/auth-service";
import {
  deleteDocument,
  generateDocumentSummary,
  getDocument,
  getDocumentSummary,
} from "@/services/document-service";
import { DocumentDetailItem, SummaryItem } from "@/types";


export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.documentId as string;

  const [document, setDocument] = useState<DocumentDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"text" | "summary">("text");
  const [summary, setSummary] = useState<SummaryItem | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [fetchingSummary, setFetchingSummary] = useState(false);

  useEffect(() => {
    async function loadDocument() {
      try {
        await getCurrentUser();
        const doc = await getDocument(documentId);
        setDocument(doc);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("No authentication token")) {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load document details.");
      } finally {
        setLoading(false);
      }
    }
    if (documentId) {
      loadDocument();
    }
  }, [documentId, router]);

  // Check for existing summary when switching to AI Summary tab
  useEffect(() => {
    async function checkExistingSummary() {
      if (activeTab === "summary" && !summary && !summaryLoading && !summaryError) {
        try {
          setFetchingSummary(true);
          const existing = await getDocumentSummary(documentId);
          setSummary(existing);
        } catch {
          // 404 means no summary generated yet — clean expected state
        } finally {
          setFetchingSummary(false);
        }
      }
    }
    checkExistingSummary();
  }, [activeTab, documentId, summary, summaryLoading, summaryError]);

  async function handleGenerateSummary(force: boolean = false) {
    try {
      setSummaryLoading(true);
      setSummaryError(null);
      const result = await generateDocumentSummary(documentId, force);
      setSummary(result);
    } catch (err: unknown) {
      setSummaryError(err instanceof Error ? err.message : "Failed to generate AI summary.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleDelete() {
    if (!document) return;
    if (!confirm(`Are you sure you want to delete "${document.original_filename}"?`)) return;

    try {
      await deleteDocument(document.id);
      router.push("/documents");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete document.");
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
        <p className="text-slate-600">Loading document details...</p>
      </main>
    );
  }

  if (error || !document) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-md bg-red-50 p-4 text-sm font-medium text-red-800 border border-red-200">
          {error ?? "Document not found."}
        </div>
        <div className="mt-4">
          <Link href="/documents" className="text-indigo-600 font-medium hover:text-indigo-500">
            &larr; Back to Documents
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-4">
        <Link href="/documents" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          &larr; Back to Documents
        </Link>
      </div>

      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{document.title}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                document.processing_status === "COMPLETED"
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {document.processing_status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Original file: <span className="font-mono text-slate-700">{document.original_filename}</span> •{" "}
            {formatFileSize(document.file_size)} • {document.page_count ?? "N/A"} page(s)
          </p>
        </div>
        <button
          onClick={handleDelete}
          className="self-start rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 md:self-center"
        >
          Delete Document
        </button>
      </header>

      {/* Feature Tabs */}
      <nav className="mt-6 flex border-b border-slate-200 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("text")}
          className={`pb-3 ${
            activeTab === "text"
              ? "border-b-2 border-indigo-600 font-semibold text-indigo-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Extracted Text
        </button>
        <button
          onClick={() => setActiveTab("summary")}
          className={`pb-3 ${
            activeTab === "summary"
              ? "border-b-2 border-indigo-600 font-semibold text-indigo-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          AI Summary
        </button>
        <button disabled className="pb-3 text-slate-400 cursor-not-allowed" title="Coming in Phase 5">
          AI Chat (Phase 5)
        </button>
        <button disabled className="pb-3 text-slate-400 cursor-not-allowed" title="Coming in Phase 6">
          Quizzes & Flashcards (Phase 6)
        </button>
      </nav>

      {/* Extracted Text Tab */}
      {activeTab === "text" && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Extracted Content Preview</h2>
          <div className="max-h-[600px] overflow-y-auto rounded-lg bg-slate-50 p-4 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed border border-slate-200">
            {document.extracted_text || "No text could be extracted from this document."}
          </div>
        </section>
      )}

      {/* AI Summary Tab */}
      {activeTab === "summary" && (
        <section className="mt-6 space-y-6">
          {fetchingSummary && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
              Checking for existing summary...
            </div>
          )}

          {!fetchingSummary && summaryLoading && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-8 text-center shadow-sm">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mb-3" />
              <h3 className="text-base font-semibold text-indigo-900">Generating AI Summary</h3>
              <p className="mt-1 text-sm text-indigo-700">
                Analyzing document text and synthesizing key study concepts. This may take 5–15 seconds...
              </p>
            </div>
          )}

          {!fetchingSummary && summaryError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-red-900">Summarization Error</h3>
              <p className="mt-1 text-sm text-red-800">{summaryError}</p>
              <button
                onClick={() => handleGenerateSummary(false)}
                className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-500"
              >
                Try Again
              </button>
            </div>
          )}

          {!fetchingSummary && !summaryLoading && !summaryError && !summary && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <svg
                className="mx-auto h-12 w-12 text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <h3 className="mt-3 text-base font-semibold text-slate-900">No AI Summary Generated Yet</h3>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                Generate an executive overview, bulleted key takeaways, and key terminology from your document.
              </p>
              <button
                onClick={() => handleGenerateSummary(false)}
                className="mt-6 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
              >
                ⚡ Generate AI Summary
              </button>
            </div>
          )}

          {!fetchingSummary && !summaryLoading && summary && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">AI Document Study Guide</h2>
                <button
                  onClick={() => handleGenerateSummary(true)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  🔄 Regenerate Summary
                </button>
              </div>

              {/* Overview */}
              <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-600 mb-2">
                  Executive Overview
                </h3>
                <p className="text-sm leading-relaxed text-slate-800">{summary.overview}</p>
              </article>

              {/* Key Points */}
              <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-600 mb-3">
                  Key Takeaways
                </h3>
                <ul className="space-y-2.5 text-sm text-slate-800">
                  {summary.key_points.map((point: string, i: number) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>

              {/* Important Terms */}
              {summary.important_terms && summary.important_terms.length > 0 && (
                <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-600 mb-3">
                    Important Terminology
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {summary.important_terms.map((term: string, i: number) => (
                      <div key={i} className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs text-slate-800">
                        {term}
                      </div>
                    ))}
                  </div>
                </article>
              )}


              {/* Conclusion */}
              {summary.conclusion && (
                <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-600 mb-2">
                    Conclusion & Synthesis
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-800">{summary.conclusion}</p>
                </article>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}


