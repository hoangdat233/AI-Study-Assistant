"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser } from "@/services/auth-service";
import {
  deleteDocument,
  deleteFlashcard,
  deleteQuiz,
  generateDocumentSummary,
  generateFlashcards,
  generateQuiz,
  getChatHistory,
  getDocument,
  getDocumentFlashcards,
  getDocumentQuizzes,
  getDocumentSummary,
  indexDocument,
  sendChatMessage,
  submitQuizAttempt,
} from "@/services/document-service";

import {
  ChatMessage,
  DocumentDetailItem,
  FlashcardItem,
  QuizItem,
  SourceMetadata,
  SummaryItem,
} from "@/types";

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.documentId as string;

  const [document, setDocument] = useState<DocumentDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<"text" | "summary" | "chat" | "study">("chat");
  const [studySubTab, setStudySubTab] = useState<"quiz" | "flashcard">("quiz");

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

  // Phase 6 Quiz State
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<QuizItem | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(5);
  const [quizDifficulty, setQuizDifficulty] = useState<string>("medium");

  // Active Quiz Player State
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [quizCompleted, setQuizCompleted] = useState<boolean>(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});


  // Phase 6 Flashcard State
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [flashcardLoading, setFlashcardLoading] = useState(false);
  const [flashcardError, setFlashcardError] = useState<string | null>(null);
  const [flashcardCount, setFlashcardCount] = useState<number>(10);
  const [currentCardIdx, setCurrentCardIdx] = useState<number>(0);
  const [isCardFlipped, setIsCardFlipped] = useState<boolean>(false);

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

  // Load Quizzes and Flashcards when switching to Study tab
  useEffect(() => {
    async function loadStudyMaterials() {
      if (activeTab === "study" && documentId) {
        try {
          const [savedQuizzes, savedFlashcards] = await Promise.all([
            getDocumentQuizzes(documentId),
            getDocumentFlashcards(documentId),
          ]);
          setQuizzes(savedQuizzes);
          setFlashcards(savedFlashcards);
        } catch {
          // Clean fallback
        }
      }
    }
    loadStudyMaterials();
  }, [activeTab, documentId]);

  function getCleanErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes("503") || msg.includes("high demand") || msg.includes("temporarily unavailable") || msg.includes("502")) {
        return "AI service is currently busy. Please try again in a few moments.";
      }
      if (msg.includes("429") || msg.includes("rate limit")) {
        return "Rate limit reached. Please wait a moment before trying again.";
      }
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        return "Connection issue. Please check your network connection.";
      }
      return msg;
    }
    return fallback;
  }

  async function handleGenerateSummary(force: boolean = false) {
    try {
      setSummaryLoading(true);
      setSummaryError(null);
      const result = await generateDocumentSummary(documentId, force);
      setSummary(result);
    } catch (err: unknown) {
      setSummaryError(getCleanErrorMessage(err, "Failed to generate AI summary. Please try again."));
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
      setChatError(getCleanErrorMessage(err, "Failed to index document."));
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
      setChatError(getCleanErrorMessage(err, "Failed to send message. Please try again."));
    } finally {
      setChatLoading(false);
    }
  }

  // Quiz Handlers
  async function handleGenerateQuiz() {
    try {
      setQuizLoading(true);
      setQuizError(null);
      const newQuiz = await generateQuiz(documentId, quizQuestionCount, quizDifficulty);
      setQuizzes((prev) => [newQuiz, ...prev]);
      startQuiz(newQuiz);
    } catch (err: unknown) {
      setQuizError(getCleanErrorMessage(err, "Failed to generate quiz. Please try again."));
    } finally {
      setQuizLoading(false);
    }
  }

  function startQuiz(quiz: QuizItem) {

    setActiveQuiz(quiz);
    setCurrentQuestionIdx(0);
    setSelectedOption(null);
    setIsSubmitted(false);
    setScore(0);
    setQuizCompleted(false);
    setQuizAnswers({});
  }

  function handleOptionSelect(opt: string) {
    if (isSubmitted) return;
    setSelectedOption(opt);
  }

  function handleSubmitQuestion() {
    if (!selectedOption || !activeQuiz) return;
    const currentQ = activeQuiz.questions[currentQuestionIdx];
    const newAnswers = { ...quizAnswers, [currentQ.id]: selectedOption };
    setQuizAnswers(newAnswers);

    const isCorrect = selectedOption === currentQ.correct_answer;
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
    setIsSubmitted(true);
  }

  async function handleNextQuestion() {
    if (!activeQuiz) return;
    if (currentQuestionIdx + 1 < activeQuiz.questions.length) {
      setCurrentQuestionIdx((prev) => prev + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
    } else {
      setQuizCompleted(true);
      // Persist completed quiz attempt to backend
      try {
        await submitQuizAttempt(activeQuiz.id, quizAnswers);
      } catch {
        // Fallback
      }
    }
  }


  async function handleDeleteQuiz(quizId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this quiz?")) return;
    try {
      await deleteQuiz(quizId);
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      if (activeQuiz?.id === quizId) {
        setActiveQuiz(null);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete quiz.");
    }
  }

  // Flashcard Handlers
  async function handleGenerateFlashcards() {
    try {
      setFlashcardLoading(true);
      setFlashcardError(null);
      const newCards = await generateFlashcards(documentId, flashcardCount);
      setFlashcards((prev) => [...newCards, ...prev]);
      setCurrentCardIdx(0);
      setIsCardFlipped(false);
    } catch (err: unknown) {
      setFlashcardError(err instanceof Error ? err.message : "Failed to generate flashcards.");
    } finally {
      setFlashcardLoading(false);
    }
  }

  function handleShuffleFlashcards() {
    if (flashcards.length === 0) return;
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setFlashcards(shuffled);
    setCurrentCardIdx(0);
    setIsCardFlipped(false);
  }

  async function handleDeleteFlashcard(cardId: string) {
    try {
      await deleteFlashcard(cardId);
      setFlashcards((prev) => prev.filter((c) => c.id !== cardId));
      if (currentCardIdx >= flashcards.length - 1) {
        setCurrentCardIdx(Math.max(0, flashcards.length - 2));
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete flashcard.");
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
        // Fallback
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
        <button
          onClick={() => setActiveTab("study")}
          className={`pb-3 transition-colors ${
            activeTab === "study"
              ? "border-b-2 border-indigo-500 font-bold text-indigo-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          📝 Quizzes & Flashcards
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

          {isIndexed && (
            <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl h-[650px] overflow-hidden">
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

      {/* Phase 6 Quizzes & Flashcards Tab */}
      {activeTab === "study" && (
        <section className="mt-6 space-y-6">
          {/* Sub Navigation */}
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <button
              onClick={() => setStudySubTab("quiz")}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                studySubTab === "quiz"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              📝 Multiple-Choice Quizzes
            </button>
            <button
              onClick={() => setStudySubTab("flashcard")}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                studySubTab === "flashcard"
                  ? "bg-purple-600 text-white shadow-md"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              🎴 Flashcard Study Cards
            </button>
          </div>

          {/* Quiz Subtab */}
          {studySubTab === "quiz" && (
            <div className="space-y-6">
              {/* Active Quiz Player */}
              {activeQuiz && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl space-y-6">
                  {!quizCompleted && (
                    <div>
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-extrabold text-white">{activeQuiz.title}</h3>
                            <span className="rounded-full bg-indigo-900/60 border border-indigo-700/50 px-2.5 py-0.5 text-xs font-semibold text-indigo-300 uppercase">
                              {activeQuiz.difficulty}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            Question {currentQuestionIdx + 1} of {activeQuiz.questions.length}
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveQuiz(null)}
                          className="text-xs text-slate-400 hover:text-white font-medium"
                        >
                          ✕ Exit Quiz
                        </button>
                      </div>

                      {/* Question Text */}
                      <div className="mt-5">
                        <h4 className="text-base font-bold text-white leading-relaxed">
                          {activeQuiz.questions[currentQuestionIdx].prompt}
                        </h4>
                      </div>

                      {/* Options List */}
                      <div className="mt-5 space-y-3">
                        {(activeQuiz.questions[currentQuestionIdx].options || []).map((opt, oIdx) => {
                          const currentQ = activeQuiz.questions[currentQuestionIdx];
                          const isSelected = selectedOption === opt;
                          const isCorrectOpt = opt === currentQ.correct_answer;

                          let optionStyle = "border-slate-800 bg-slate-950 text-slate-200 hover:border-slate-700";
                          if (isSelected) {
                            optionStyle = "border-indigo-500 bg-indigo-950/60 text-white font-semibold";
                          }
                          if (isSubmitted) {
                            if (isCorrectOpt) {
                              optionStyle = "border-emerald-500 bg-emerald-950/70 text-emerald-100 font-bold";
                            } else if (isSelected && !isCorrectOpt) {
                              optionStyle = "border-red-500 bg-red-950/70 text-red-100 font-bold";
                            }
                          }

                          return (
                            <button
                              key={oIdx}
                              onClick={() => handleOptionSelect(opt)}
                              disabled={isSubmitted}
                              className={`w-full text-left rounded-xl border p-4 text-sm transition-all flex items-center justify-between ${optionStyle}`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-extrabold">
                                  {String.fromCharCode(65 + oIdx)}
                                </span>
                                <span>{opt}</span>
                              </div>
                              {isSubmitted && isCorrectOpt && (
                                <span className="text-emerald-400 font-bold text-xs">✅ Correct</span>
                              )}
                              {isSubmitted && isSelected && !isCorrectOpt && (
                                <span className="text-red-400 font-bold text-xs">❌ Incorrect</span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Action Bar & Feedback */}
                      <div className="mt-6 flex flex-col gap-4">
                        {!isSubmitted && (
                          <button
                            onClick={handleSubmitQuestion}
                            disabled={!selectedOption}
                            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50 transition-all hover:scale-105"
                          >
                            Submit Answer
                          </button>
                        )}

                        {isSubmitted && (
                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm">
                                {selectedOption === activeQuiz.questions[currentQuestionIdx].correct_answer ? (
                                  <span className="text-emerald-400">✅ Correct Answer!</span>
                                ) : (
                                  <span className="text-red-400">❌ Incorrect Answer</span>
                                )}
                              </span>
                              {activeQuiz.questions[currentQuestionIdx].source_page && (
                                <span className="rounded bg-purple-950 border border-purple-800 px-2 py-0.5 text-xs text-purple-300 font-semibold">
                                  📄 Page {activeQuiz.questions[currentQuestionIdx].source_page}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              <strong className="text-slate-100">Explanation:</strong>{" "}
                              {activeQuiz.questions[currentQuestionIdx].explanation}
                            </p>
                            <button
                              onClick={handleNextQuestion}
                              className="mt-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-indigo-500 transition-colors"
                            >
                              {currentQuestionIdx + 1 < activeQuiz.questions.length
                                ? "Next Question &rarr;"
                                : "Finish Quiz & Show Score"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quiz Score Summary Screen */}
                  {quizCompleted && (
                    <div className="py-8 text-center space-y-4">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-indigo-900/60 border-2 border-indigo-500 text-3xl font-black text-indigo-300">
                        {Math.round((score / activeQuiz.questions.length) * 100)}%
                      </div>
                      <h3 className="text-2xl font-extrabold text-white">Quiz Completed!</h3>
                      <p className="text-sm text-slate-300">
                        You scored <strong className="text-indigo-400">{score}</strong> out of{" "}
                        <strong className="text-indigo-400">{activeQuiz.questions.length}</strong> questions correctly.
                      </p>
                      <div className="flex justify-center gap-3 pt-4">
                        <button
                          onClick={() => startQuiz(activeQuiz)}
                          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-indigo-500"
                        >
                          🔄 Retry Quiz
                        </button>
                        <button
                          onClick={() => setActiveQuiz(null)}
                          className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-700"
                        >
                          Back to Quizzes List
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Generator & Saved List when no quiz active */}
              {!activeQuiz && (
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Generator Controls */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-5 md:col-span-1">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      ⚡ Generate AI Quiz
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Create grounded multiple-choice practice tests sampled from your PDF document text.
                    </p>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                        Number of Questions
                      </label>
                      <select
                        value={quizQuestionCount}
                        onChange={(e) => setQuizQuestionCount(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                      >
                        <option value={5}>5 Questions</option>
                        <option value={10}>10 Questions (Max)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                        Difficulty Level
                      </label>
                      <select
                        value={quizDifficulty}
                        onChange={(e) => setQuizDifficulty(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>

                    {quizError && (
                      <div className="rounded-lg bg-red-950 p-3 text-xs text-red-200 border border-red-800">
                        {quizError}
                      </div>
                    )}

                    <button
                      onClick={handleGenerateQuiz}
                      disabled={quizLoading}
                      className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50 transition-all hover:scale-105"
                    >
                      {quizLoading ? "Generating Quiz..." : "⚡ Generate AI Quiz"}
                    </button>
                  </div>

                  {/* Saved Quizzes List */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl md:col-span-2 space-y-4">
                    <h3 className="text-base font-bold text-white">Saved Practice Quizzes</h3>

                    {quizzes.length === 0 && (
                      <div className="py-12 text-center text-slate-400">
                        <p className="text-sm font-medium">No quizzes generated for this document yet.</p>
                        <p className="text-xs text-slate-500 mt-1">Use the generator panel to create your first quiz.</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {quizzes.map((q) => (
                        <div
                          key={q.id}
                          onClick={() => startQuiz(q)}
                          className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-sm hover:border-indigo-500 hover:bg-slate-900 transition-all cursor-pointer"
                        >
                          <div>
                            <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                              {q.title}
                            </h4>
                            <p className="text-xs text-slate-400 mt-1">
                              {q.questions.length} Questions • Difficulty:{" "}
                              <span className="font-semibold text-slate-300 uppercase">{q.difficulty}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => handleDeleteQuiz(q.id, e)}
                              className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1"
                            >
                              Delete
                            </button>
                            <span className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white group-hover:bg-indigo-500">
                              Start Quiz &rarr;
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Flashcard Subtab */}
          {studySubTab === "flashcard" && (
            <div className="space-y-6">
              {/* Generator Header */}
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    ⚡ Generate AI Study Flashcards
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Extract key terminology, formulas, and concepts into interactive flip cards.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={flashcardCount}
                    onChange={(e) => setFlashcardCount(Number(e.target.value))}
                    className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value={5}>5 Cards</option>
                    <option value={10}>10 Cards</option>
                    <option value={20}>20 Cards (Max)</option>
                  </select>
                  <button
                    onClick={handleGenerateFlashcards}
                    disabled={flashcardLoading}
                    className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-purple-500 disabled:opacity-50 transition-all hover:scale-105"
                  >
                    {flashcardLoading ? "Generating..." : "⚡ Generate Cards"}
                  </button>
                </div>
              </div>

              {flashcardError && (
                <div className="rounded-xl bg-red-950 p-4 text-xs text-red-200 border border-red-800">
                  {flashcardError}
                </div>
              )}

              {/* Flashcard Viewer */}
              {flashcards.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/90 p-12 text-center shadow-xl">
                  <p className="text-base font-semibold text-white">No flashcards available</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Generate study flashcards from your PDF document to practice key terms and definitions.
                  </p>
                </div>
              )}

              {flashcards.length > 0 && (
                <div className="space-y-6">
                  {/* Card Container */}
                  <div className="relative mx-auto max-w-xl">
                    <div
                      onClick={() => setIsCardFlipped((prev) => !prev)}
                      className={`relative min-h-[300px] w-full rounded-2xl border p-8 shadow-2xl transition-all duration-500 cursor-pointer flex flex-col justify-between ${
                        isCardFlipped
                          ? "border-indigo-500 bg-indigo-950/90 text-indigo-100"
                          : "border-purple-800/80 bg-purple-950/80 text-purple-100"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs font-bold uppercase tracking-wider opacity-75">
                        <span>{isCardFlipped ? "Back — Answer / Definition" : "Front — Term / Question"}</span>
                        <span>Click to Flip 🔄</span>
                      </div>

                      <div className="my-auto py-6 text-center">
                        <p className="text-lg font-bold leading-relaxed">
                          {isCardFlipped
                            ? flashcards[currentCardIdx].back
                            : flashcards[currentCardIdx].front}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs opacity-75">
                        <span>
                          {flashcards[currentCardIdx].source_page && (
                            <span className="rounded bg-black/30 px-2 py-0.5 font-mono">
                              📄 Page {flashcards[currentCardIdx].source_page}
                            </span>
                          )}
                        </span>
                        <span>Card {currentCardIdx + 1} of {flashcards.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Controls */}
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() => {
                        setIsCardFlipped(false);
                        setCurrentCardIdx((prev) => Math.max(0, prev - 1));
                      }}
                      disabled={currentCardIdx === 0}
                      className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-slate-700 disabled:opacity-50"
                    >
                      &larr; Previous Card
                    </button>
                    <button
                      onClick={handleShuffleFlashcards}
                      className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-bold text-purple-300 shadow-md hover:bg-slate-700"
                    >
                      🔀 Shuffle Cards
                    </button>
                    <button
                      onClick={() => {
                        setIsCardFlipped(false);
                        setCurrentCardIdx((prev) => Math.min(flashcards.length - 1, prev + 1));
                      }}
                      disabled={currentCardIdx === flashcards.length - 1}
                      className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-slate-700 disabled:opacity-50"
                    >
                      Next Card &rarr;
                    </button>
                  </div>

                  <div className="text-center pt-2">
                    <button
                      onClick={() => handleDeleteFlashcard(flashcards[currentCardIdx].id)}
                      className="text-xs text-red-400 hover:text-red-300 font-semibold"
                    >
                      Delete Current Card
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
