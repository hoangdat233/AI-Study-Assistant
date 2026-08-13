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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
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
        <p className="text-slate-600">Checking session...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Upload PDF Document</h1>
          <p className="mt-1 text-sm text-slate-600">
            Upload course materials, lecture notes, or textbooks (PDF format up to 10MB).
          </p>
        </div>
        <Link
          href="/documents"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          View All Documents
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4 text-sm font-medium text-red-800 border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleUpload} className="mt-8 space-y-6">
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center hover:border-indigo-400">
          <svg
            className="mx-auto h-12 w-12 text-slate-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20a4 4 0 004 4h24a4 4 0 004-4V20L28 8z"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M28 8v12h12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="mt-4 flex text-sm text-slate-600">
            <label
              htmlFor="file-upload"
              className="relative cursor-pointer rounded-md bg-white font-medium text-indigo-600 focus-within:outline-none hover:text-indigo-500"
            >
              <span>Select a PDF file</span>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs text-slate-500 mt-1">PDF up to 10MB</p>

          {selectedFile && (
            <div className="mt-4 rounded-md bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-900 border border-indigo-200">
              Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!selectedFile || loading}
          className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Processing and Extracting Text..." : "Upload & Process PDF"}
        </button>
      </form>
    </main>
  );
}

