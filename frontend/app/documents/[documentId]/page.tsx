interface DocumentDetailPageProps {
  params: Promise<{ documentId: string }>;
}

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { documentId } = await params;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Document Detail</h1>
      <p className="mt-2 text-slate-600">Document ID: {documentId}</p>
      <p className="mt-2 text-slate-600">Detailed analysis and chat context will be added incrementally.</p>
    </main>
  );
}
