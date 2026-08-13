import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4">
        <h1 className="text-xl font-semibold">AI Study Assistant</h1>
        <nav className="flex items-center gap-3 text-sm">
          <Link className="hover:text-indigo-600" href="/login">
            Login
          </Link>
          <Link
            className="rounded-md bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-500"
            href="/register"
          >
            Get Started
          </Link>
        </nav>
      </header>

      <section className="grid flex-1 items-center gap-8 py-16 md:grid-cols-2">
        <div className="space-y-5">
          <p className="text-sm font-medium uppercase tracking-wider text-indigo-600">
            Portfolio-ready full-stack starter
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-slate-900">
            Study smarter with document-focused AI workflows.
          </h2>
          <p className="text-lg text-slate-600">
            Upload your PDF materials, organize notes, and prepare your backend for robust
            Retrieval-Augmented Generation features.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open Dashboard
            </Link>
            <Link
              href="http://localhost:8000/docs"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
            >
              API Docs
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Planned Study Capabilities</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            <li>• PDF upload and document management</li>
            <li>• AI summaries with source references</li>
            <li>• Document-grounded chat and QA</li>
            <li>• Quiz and flashcard generation</li>
            <li>• Progress and history tracking</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
