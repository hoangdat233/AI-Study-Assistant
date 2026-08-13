export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-slate-600">
        Welcome to AI Study Assistant. This layout is ready for authenticated study workflows.
      </p>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          "Documents",
          "AI Chat",
          "Quizzes",
          "Flashcards",
          "Study Progress",
          "History",
          "Settings",
          "Upcoming RAG Insights",
        ].map((item) => (
          <article key={item} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-medium">{item}</h2>
            <p className="mt-2 text-sm text-slate-600">Scaffolded for iterative implementation.</p>
          </article>
        ))}
      </section>
    </main>
  );
}
