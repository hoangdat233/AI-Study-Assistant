"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser } from "@/services/auth-service";
import {
  deleteDocument,
  generateDocumentSummary,
  getChatHistory,
  getDocument,
  getDocumentSummary,
  indexDocument,
  sendChatMessage,
} from "@/services/document-service";
import { ChatMessage, DocumentDetailItem, SourceMetadata, SummaryItem } from "@/types";

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.documentId as string;

  const [document, setDocument] = useState<DocumentDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<"text" | "summary" | "chat">("chat");

  // AI Summary State
  const [summary, setSummary] = useState<SummaryItem | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [fetchingSummary, setFetchingSummary] = useState(false);

  // RAG Chat State
  const [isIndexed, setIsIndexed] = useState(false);
  const [indexLoading, setIndexLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [questionInput, setQuestionInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [activeSourcePreview, setActiveSourcePreview] = useState<SourceMetadata | null>(null);

  useEffect(() => {
    async function loadDocument() {
      try {
        await getCurrentUser();
        const doc = await getDocument(documentId);
        setDocument(doc);
        setIsIndexed(doc.processing_status === "INDEXED");
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
          // 404 means no summary generated yet
        } finally {
          setFetchingSummary(false);
        }
      }
    }
    checkExistingSummary();
  }, [activeTab, documentId, summary, summaryLoading, summaryError]);

  // Load chat history when switching to AI Chat tab
  useEffect(() => {
    async function loadHistory() {
      if (activeTab === "chat" && documentId) {
        try {
          const history = await getChatHistory(documentId);
          setChatMessages(history);
        } catch {
          // Clean fallback if no history exists yet
        }
      }
    }
    loadHistory();
  }, [activeTab, documentId]);

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

  async function handleIndexDocument(force: boolean = false) {
    try {
      setIndexLoading(true);
      setChatError(null);
      const res = await indexDocument(documentId, force);
      setIsIndexed(res.indexed);
      if (document) {
        setDocument({ ...document, processing_status: "INDEXED" });
      }
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : "Failed to index document.");
    } finally {
      setIndexLoading(false);
    }
  }

  async function handleSendQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!questionInput.trim() || chatLoading) return;

    const userQuestion = questionInput.trim();
    setQuestionInput("");
    setChatError(null);

    // Optimistically append user message to UI thread
    const tempUserMsg: ChatMessage = { role: "user", content: userQuestion };
    setChatMessages((prev) => [...prev, tempUserMsg]);

    try {
      setChatLoading(true);
      const res = await sendChatMessage(documentId, userQuestion);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: res.answer,
        sources: res.sources,
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setChatLoading(false);
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

  // Auto-unwrap JSON strings like {"answer": "..."} to plain text for clean display
  function formatCleanAnswer(content: string): string {
    if (!content) return "";
    const trimmed = content.trim();
    if (trimmed.startsWith("{") && trimmed.includes('"answer"')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && "answer" in parsed) {
          return String(parsed.answer);
        }
      } catch {
        // Fallback to original string if not valid JSON
      }
    }
    return content;
  }


  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-300">Loading document details...</p>
        </div>
      </main>
    );
  }

  if (error || !document) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-xl bg-red-950/80 p-5 text-sm font-medium text-red-200 border border-red-800 shadow-md">
          {error ?? "Document not found."}
        </div>
        <div className="mt-4">
          <Link href="/documents" className="text-indigo-400 font-medium hover:text-indigo-300">
            &larr; Back to Documents
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-4">
        <Link href="/documents" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
          &larr; Back to Documents
        </Link>
      </div>

      <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">{document.title}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                isIndexed || document.processing_status === "INDEXED"
                  ? "bg-purple-900/60 text-purple-300 border-purple-700/50"
                  : document.processing_status === "COMPLETED"
                  ? "bg-emerald-900/60 text-emerald-300 border-emerald-700/50"
                  : "bg-amber-900/60 text-amber-300 border-amber-700/50"
              }`}
            >
              {isIndexed ? "INDEXED" : document.processing_status}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-400">
            Original file: <span className="font-mono text-slate-200">{document.original_filename}</span> •{" "}
            {formatFileSize(document.file_size)} • {document.page_count ?? "N/A"} page(s)
          </p>
        </div>
        <button
          onClick={handleDelete}
          className="self-start rounded-lg border border-red-800/80 bg-red-950/40 px-3.5 py-1.5 text-sm font-medium text-red-300 hover:bg-red-900/60 md:self-center transition-colors"
        >
          Delete Document
        </button>
      </header>

      {/* Feature Tabs */}
      <nav className="mt-6 flex border-b border-slate-800 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("text")}
          className={`pb-3 transition-colors ${
            activeTab === "text"
              ? "border-b-2 border-indigo-500 font-bold text-indigo-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Extracted Text
        </button>
        <button
          onClick={() => setActiveTab("summary")}
          className={`pb-3 transition-colors ${
            activeTab === "summary"
              ? "border-b-2 border-indigo-500 font-bold text-indigo-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          AI Summary
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`pb-3 transition-colors ${
            activeTab === "chat"
              ? "border-b-2 border-indigo-500 font-bold text-indigo-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          ✨ AI Chat (Gemini RAG)
        </button>
        <button disabled className="pb-3 text-slate-600 cursor-not-allowed" title="Coming in Phase 6">
          Quizzes & Flashcards (Phase 6)
        </button>
      </nav>

      {/* Extracted Text Tab */}
      {activeTab === "text" && (
        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-3">Extracted Content Preview</h2>
          <div className="max-h-[600px] overflow-y-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed border border-slate-800">
            {document.extracted_text || "No text could be extracted from this document."}
          </div>
        </section>
      )}

      {/* AI Summary Tab */}
      {activeTab === "summary" && (
        <section className="mt-6 space-y-6">
          {fetchingSummary && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-8 text-center text-slate-300 shadow-xl">
              Checking for existing summary...
            </div>
          )}

          {!fetchingSummary && summaryLoading && (
            <div className="rounded-xl border border-indigo-800/80 bg-indigo-950/40 p-8 text-center shadow-xl">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-3" />
              <h3 className="text-base font-semibold text-white">Generating AI Summary</h3>
              <p className="mt-1 text-sm text-indigo-300">
                Analyzing document text and synthesizing key study concepts. This may take 5–15 seconds...
              </p>
            </div>
          )}

          {!fetchingSummary && summaryError && (
            <div className="rounded-xl border border-red-800 bg-red-950/60 p-6 shadow-xl">
              <h3 className="text-base font-semibold text-red-200">Summarization Error</h3>
              <p className="mt-1 text-sm text-red-300">{summaryError}</p>
              <button
                onClick={() => handleGenerateSummary(false)}
                className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-red-500"
              >
                Try Again
              </button>
            </div>
          )}

          {!fetchingSummary && !summaryLoading && !summaryError && !summary && (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/90 p-10 text-center shadow-xl">
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
              <h3 className="mt-3 text-base font-semibold text-white">No AI Summary Generated Yet</h3>
              <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
                Generate an executive overview, bulleted key takeaways, and key terminology from your document.
              </p>
              <button
                onClick={() => handleGenerateSummary(false)}
                className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-md hover:bg-indigo-500 transition-all hover:scale-105"
              >
                ⚡ Generate AI Summary
              </button>
            </div>
          )}

          {!fetchingSummary && !summaryLoading && summary && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">AI Document Study Guide</h2>
                <button
                  onClick={() => handleGenerateSummary(true)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  🔄 Regenerate Summary
                </button>
              </div>

              {/* Overview */}
              <article className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 mb-2">
                  Executive Overview
                </h3>
                <p className="text-sm leading-relaxed text-slate-200">{summary.overview}</p>
              </article>

              {/* Key Points */}
              <article className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 mb-3">
                  Key Takeaways
                </h3>
                <ul className="space-y-2.5 text-sm text-slate-200">
                  {summary.key_points.map((point: string, i: number) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-1.5 flex h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              </article>

              {/* Important Terms */}
              {summary.important_terms && summary.important_terms.length > 0 && (
                <article className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 mb-3">
                    Important Terminology
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {summary.important_terms.map((term: string, i: number) => (
                      <div key={i} className="rounded-lg bg-slate-950 p-3 border border-slate-800 text-xs text-slate-200 leading-relaxed">
                        {term}
                      </div>
                    ))}
                  </div>
                </article>
              )}

              {/* Conclusion */}
              {summary.conclusion && (
                <article className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 mb-2">
                    Conclusion & Synthesis
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-200">{summary.conclusion}</p>
                </article>
              )}
            </div>
          )}
        </section>
      )}

      {/* AI Chat Tab (Phase 5 RAG Gemini Studio) */}
      {activeTab === "chat" && (
        <section className="mt-6 space-y-6">
          {/* Indexing Call-to-Action if document not yet indexed */}
          {!isIndexed && (
            <div className="rounded-xl border border-purple-800/80 bg-purple-950/40 p-8 text-center shadow-xl">
              <svg
                className="mx-auto h-12 w-12 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
              <h3 className="mt-3 text-base font-bold text-white">
                Prepare Document for AI Chat
              </h3>
              <p className="mt-1 text-sm text-purple-200 max-w-lg mx-auto">
                Index and embed this document into PostgreSQL vector database using 3072-dimensional embeddings for semantic search and grounded Q&A.
              </p>
              <button
                onClick={() => handleIndexDocument(false)}
                disabled={indexLoading}
                className="mt-5 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-purple-500 disabled:opacity-50 transition-all hover:scale-105"
              >
                {indexLoading ? "Indexing Vector Embeddings..." : "⚡ Index Document for AI Chat"}
              </button>
            </div>
          )}

          {/* Chat Interface once Document is Indexed */}
          {isIndexed && (
            <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl h-[650px] overflow-hidden">
              {/* Top Header */}
              <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    ✨ Gemini Document Q&A
                  </h3>
                  <span className="rounded-full bg-purple-900/70 border border-purple-700/60 px-2.5 py-0.5 text-xs font-semibold text-purple-300">
                    Vector Indexed
                  </span>
                </div>
                <button
                  onClick={() => handleIndexDocument(true)}
                  disabled={indexLoading}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                >
                  {indexLoading ? "Re-indexing..." : "🔄 Re-index Vector Chunks"}
                </button>
              </div>

              {/* Conversation Thread */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <p className="text-base font-semibold text-slate-200">Ask any question about this document</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm text-center">
                      Gemini provides grounded answers strictly based on document excerpts, complete with page number citations.
                    </p>
                  </div>
                )}

                {chatMessages.map((msg, i) => {
                  const cleanedText = formatCleanAnswer(msg.content);
                  return (
                    <div
                      key={i}
                      className={`flex flex-col ${
                        msg.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm shadow-md ${
                          msg.role === "user"
                            ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-br-xs font-medium"
                            : "bg-slate-950/90 text-slate-100 border border-slate-800 rounded-bl-xs leading-relaxed"
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{cleanedText}</p>

                        {/* Source Page Citations for Assistant */}
                        {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3.5 border-t border-slate-800/80 pt-2.5 text-xs">
                            <span className="font-semibold text-slate-400 block mb-1.5">Sources:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.sources.map((src: SourceMetadata, sIdx: number) => (
                                <button
                                  key={sIdx}
                                  onClick={() => setActiveSourcePreview(src)}
                                  className="rounded-md bg-purple-950/70 px-2.5 py-1 text-xs font-semibold text-purple-300 border border-purple-800/60 hover:bg-purple-900/80 transition-colors"
                                >
                                  📄 Page {src.page}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {chatLoading && (
                  <div className="flex items-start">
                    <div className="rounded-2xl bg-slate-950/90 px-5 py-3.5 border border-slate-800 text-sm text-slate-300 shadow-md">
                      <div className="flex items-center gap-2.5">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                        <span>Searching pgvector & generating answer...</span>
                      </div>
                    </div>
                  </div>
                )}

                {chatError && (
                  <div className="rounded-xl bg-red-950/80 p-3.5 text-xs text-red-200 border border-red-800 shadow-md">
                    {chatError}
                  </div>
                )}
              </div>

              {/* Source Snippet Preview Modal */}
              {activeSourcePreview && (
                <div className="border-t border-indigo-900/80 bg-indigo-950/70 p-4 text-xs">
                  <div className="flex items-center justify-between font-bold text-indigo-300 mb-1.5">
                    <span>Source Excerpt (Page {activeSourcePreview.page})</span>
                    <button
                      onClick={() => setActiveSourcePreview(null)}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <p className="font-mono text-slate-200 max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {activeSourcePreview.preview}
                  </p>
                </div>
              )}

              {/* Bottom Question Input Form */}
              <form onSubmit={handleSendQuestion} className="border-t border-slate-800 p-4 flex gap-3 bg-slate-950/80">
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="Ask a question about this document..."
                  disabled={chatLoading}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !questionInput.trim()}
                  className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50 transition-all hover:scale-105"
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
