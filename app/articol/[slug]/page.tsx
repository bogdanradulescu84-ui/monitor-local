import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { articolDupaSlug, dataRo, loadArticole } from "@/lib/articole";
import { loadData } from "@/lib/articles";

export function generateStaticParams() {
  return loadArticole().map((a) => ({ slug: a.slug }));
}

// `params` e promisiune în versiunea asta de Next — la fel ca în app/c/[cat].
// Fără await, slug-ul iese undefined și pagina se generează ca 404, tăcut.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = articolDupaSlug(slug);
  if (!a) return {};
  const site = loadData().site;
  return {
    title: `${a.titlu} — ${site.name}`,
    description: a.rezumat,
    openGraph: {
      title: a.titlu,
      description: a.rezumat,
      type: "article",
      images: a.imagine ? [a.imagine] : undefined,
    },
  };
}

export default async function PaginaArticol({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = articolDupaSlug(slug);
  if (!a) notFound();

  return (
    <div className="wrap">
      <article className="articol">
        <span className="kicker">Articolul Casei</span>
        <h1>{a.titlu}</h1>
        <p className="semnatura">
          {a.autor} · {dataRo(a.data)}
        </p>

        {a.imagine && (
          <figure>
            <img src={a.imagine} alt={a.imagineAlt ?? ""} />
            {/* Spus pe față: e montaj, nu fotografie de la fața locului. */}
            <figcaption>Ilustrație satirică</figcaption>
          </figure>
        )}

        <div className="corp">
          {a.paragrafe.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {a.surse.length > 0 && (
          <section className="surse">
            <h2>Sursele acestui articol</h2>
            <ol>
              {a.surse.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.titlu}
                  </a>
                  <br />
                  <span className="pub">{s.publicatie}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <p style={{ marginTop: 26 }}>
          <Link href="/">← Înapoi la fluxul zilei</Link>
        </p>
      </article>
    </div>
  );
}
