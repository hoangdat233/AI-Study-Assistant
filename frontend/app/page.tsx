import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Navbar */}
      <header className="glass-nav sticky top-0 z-50 w-full px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-black text-xl shadow-lg shadow-indigo-500/25">
              AI
            </span>
            <span className="text-lg font-bold tracking-tight text-white">AI Study Assistant</span>
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/login"
              className="text-slate-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800/50"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500 transition-all hover:scale-105"
            >
              Get Started Free →
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/50 px-3.5 py-1 text-xs font-semibold text-indigo-300 shadow-sm animate-pulse-glow">
              <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
              Powered by Google Gemini & pgvector
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
              Master any document with{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-violet-300 bg-clip-text text-transparent">
                intelligent AI study workflows.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
              Upload your lecture PDFs, generate map-reduce summaries, chat with grounded RAG vector search and page citations, and practice with auto-generated quizzes and flashcards.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/register"
                className="rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 px-6 py-3.5 text-base font-bold text-white shadow-xl shadow-indigo-500/25 hover:opacity-95 transition-all hover:scale-105 flex items-center gap-2"
              >
                🚀 Start Studying Now
              </Link>
              <Link
                href="/dashboard"
                className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-6 py-3.5 text-base font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all hover:border-slate-600"
              >
                View Dashboard →
              </Link>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-800/80">
              <div>
                <div className="text-2xl font-bold text-indigo-400">3072-dim</div>
                <div className="text-xs text-slate-400">Gemini Embeddings</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">100%</div>
                <div className="text-xs text-slate-400">Grounded Citations</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-400">&lt; 5ms</div>
                <div className="text-xs text-slate-400">pgvector Search</div>
              </div>
            </div>
          </div>

          {/* Right Column: Feature Interactive Card Grid */}
          <div className="space-y-4 lg:col-span-5">
            <div className="glass-panel rounded-2xl p-6 shadow-2xl interactive-card border border-indigo-500/20">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-950 text-indigo-400 text-xl border border-indigo-800/40">
                  ✨
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">Page-Aware RAG Chat</h3>
                  <p className="text-xs text-slate-400">Ask questions and get answers with exact page citations</p>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 shadow-2xl interactive-card border border-purple-500/20">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-950 text-purple-400 text-xl border border-purple-800/40">
                  ⚡
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">Map-Reduce Summarization</h3>
                  <p className="text-xs text-slate-400">Instant structured takeaways and core concept synthesis</p>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 shadow-2xl interactive-card border border-violet-500/20">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-950 text-violet-400 text-xl border border-violet-800/40">
                  🎯
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">AI Quizzes & 3D Flashcards</h3>
                  <p className="text-xs text-slate-400">Server-graded exams and interactive practice cards</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
