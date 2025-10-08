import { notFound } from "next/navigation";

import { loadIdeaWithFeatures } from "../actions";
import { IdeaDetail } from "../components/IdeaDetail";

export default async function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadIdeaWithFeatures(id).catch(() => null);

  if (!data) {
    notFound();
  }

  return (
    <section className="space-y-8">
      <IdeaDetail idea={data.idea} features={data.features} />
    </section>
  );
}
