"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser } from "@/services/auth-service";
import { uploadDocument } from "@/services/document-service";

export default function UploadPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        await getCurrentUser();
      } catch {
        router.push("/login");
      } finally {
        setAuthChecking(false);
      }
    }
    checkAuth();
  }, [router]);

  function validateAndSetFile(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      setSelectedFile(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File size exceeds maximum allowed limit of 10MB.");
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select a PDF file to upload.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await uploadDocument(selectedFile);
      router.push("/documents");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  if (authChecking) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-10">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-300">Checking authentication session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-8 animate-slide-up">
      {/* Top Breadcrumbs */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-indigo-400 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/documents" className="hover:text-indigo-400 transition-colors">
            Documents
          </Link>
          <span>/</span>
          <span className="text-slate-200">Upload</span>
        </div>
        <Link
          href="/documents"
          className="rounded-lg bg-slate-900/80 border border-slate-800 px-3 py-1.5 text-slate-300 hover:text-white hover:border-slate-700 transition-all"
        >
          &larr; View All Documents
        </Link>
      </div>

      {/* Header */}
      <header className="border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
          📤 Upload PDF Study Material
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Upload your lecture slides, textbook chapters, or research papers (PDF format up to 10MB).
        </p>
      </header>

      {error && (
        <div className="rounded-xl bg-red-950/80 p-4 text-sm font-medium text-red-200 border border-red-800 shadow-md">
          {error}
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-6">
        {/* Dropzone Card */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`glass-panel flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-12 text-center transition-all cursor-pointer select-none ${
            isDragOver
              ? "border-indigo-500 bg-indigo-950/60 scale-[1.01] shadow-2xl shadow-indigo-500/25"
              : selectedFile
              ? "border-emerald-500/60 bg-emerald-950/20"
              : "border-slate-700/80 hover:border-indigo-500/60 hover:bg-slate-900/70"
          }`}
        >
          <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center w-full">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-950 to-slate-900 text-3xl border border-indigo-700/50 shadow-inner mb-4 animate-float">
              {selectedFile ? "📑" : "📄"}
            </div>

            <span className="text-base font-bold text-white">
              {selectedFile ? selectedFile.name : "Click to select a PDF or drag & drop here"}
            </span>

            <p className="text-xs text-slate-400 mt-1.5">
              Supports standard PDFs up to 10MB with page marker preservation
            </p>

            <input
              id="file-upload"
              name="file-upload"
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>

          {selectedFile && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-950/80 border border-emerald-700/60 px-4 py-2 text-xs font-bold text-emerald-300 shadow-sm animate-select-pop">
              <span>✅ Ready:</span>
              <span className="font-mono">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!selectedFile || loading}
          className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 px-6 py-4 text-base font-bold text-white shadow-xl shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:hover:scale-100 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Extracting text & processing document...</span>
            </>
          ) : (
            <span>🚀 Upload & Process PDF</span>
          )}
        </button>
      </form>
    </main>
  );
}
