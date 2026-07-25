import { notFound } from "next/navigation";
import { ListCard } from "@/components/Cards";
import { bySection, loadData } from "@/lib/articles";

export function generateStaticParams() {
  return loadData().sections.map((s) => ({ cat: s.id }));
}

export default async function CategoryPage({ params }: { params: Promise<{ cat: string }> }) {
  const { cat } = await params;
  const data = loadData();
  const section = data.sections.find((s) => s.id === cat);
  if (!section) notFound();

  const list = bySection(data, cat);

  return (
    <div className="wrap">
      <div className="cat-head">
        <div className="kicker">SECȚIUNE</div>
        <h2>{section.name}</h2>
        <p>{section.desc}</p>
      </div>

      <div className="section-head" style={{ borderTop: 0, marginTop: 22 }}>
        <h2>
          {list.length} {list.length === 1 ? "titlu" : "titluri"}
        </h2>
        <span className="note">cele mai recente primele</span>
      </div>

      {list.length ? (
        <div className="grid-list">
          {list.map((a) => (
            <ListCard key={a.id} a={a} at={data.generatedAt} kicker={a.source} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <p>Nimic în această secțiune la ultima colectare.</p>
          <p>
            Dacă secțiunea rămâne goală, ajustează cuvintele-cheie din <code>config/sources.json</code>.
          </p>
        </div>
      )}
    </div>
  );
}
