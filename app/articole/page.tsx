import type { Metadata } from "next";
import Link from "next/link";
import { dataRo, loadArticole } from "@/lib/articole";
import { loadData } from "@/lib/articles";

export function generateMetadata(): Metadata {
  const site = loadData().site;
  return {
    title: `Articolele Casei — ${site.name}`,
    description: "Textele scrise de redacție. Comentarii, pamflete și analize despre Buzău și politica românească.",
  };
}

export default function Arhiva() {
  const articole = loadArticole();

  return (
    <div className="wrap">
      <div className="cat-head">
        <div className="kicker">ARTICOLELE CASEI</div>
        <h2>Scrise de noi</h2>
        <p>
          Restul site-ului adună ce scriu alții și trimite la sursă. Aici sunt textele
          redacției — comentarii, pamflete, analize. Cele mai noi întâi.
        </p>
      </div>

      {articole.length === 0 ? (
        <div className="empty">
          <p>Niciun articol publicat încă.</p>
        </div>
      ) : (
        <div className="arhiva">
          {articole.map((a) => (
            <article key={a.slug} className="arh-rand">
              <Link href={`/articol/${a.slug}/`} className="arh-link">
                {a.imagine && (
                  <div className="arh-foto">
                    <img src={a.imagine} alt={a.imagineAlt ?? ""} loading="lazy" />
                  </div>
                )}
                <div className="arh-text">
                  <span className="arh-meta">
                    {a.autor} · {dataRo(a.data)}
                  </span>
                  <h3>{a.titlu}</h3>
                  <p>{a.rezumat}</p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
