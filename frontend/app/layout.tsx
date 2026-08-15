import React from "react";
import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Study Assistant — Smart Document Learning Platform",
  description: "Upload PDFs, generate AI summaries, chat with RAG vector search, take quizzes, and practice flashcards.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 selection:bg-indigo-500 selection:text-white flex flex-col font-sans">
        {/* Subtle background glow mesh */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        </div>
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
