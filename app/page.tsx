import Link from "next/link";
import { FluxRow, LeadCard, StackCard } from "@/components/Cards";
import { clockOf, loadData, sectionName } from "@/lib/articles";

export default function Home() {
  const data = loadData();
  const { articles, sections, counts, sources, generatedAt } = data;
  const at = generatedAt;

  if (!articles.length) {
    return (
      <div className="wrap">
        <div className="empty">
          <p>Niciun articol colectat încă.</p>
          <p>
            Adaugă feed-uri în <code>config/sources.json</code>, apoi rulează <code>npm run collect</code>.
          </p>
        </div>
      </div>
    );
  }

  const lead = articles[0];
  const secondary = articles.slice(1, 4);
  const flux = articles.slice(1, 25);
  const latest = articles.slice(0, 5);

  return (
    <div className="wrap">
      <section className="top">
        <LeadCard a={lead} at={at} kicker={sectionName(data, lead.section)} />
        <div className="stack">
          {secondary.map((a) => (
            <StackCard key={a.id} a={a} at={at} kicker={sectionName(data, a.section)} />
          ))}
        </div>
      </section>

      <div className="cols">
        <section>
          <div className="section-head">
            <h2>Fluxul zilei</h2>
            <span className="note">
              {articles.length} titluri · actualizat {clockOf(at)}
            </span>
          </div>
          <div className="flux">
            {flux.map((a) => (
              <FluxRow key={a.id} a={a} at={at} kicker={sectionName(data, a.section)} />
            ))}
          </div>
        </section>

        <aside className="side">
          <div className="box">
            <h2>Surse urmărite</h2>
            <p className="sub">Stare la ultima colectare</p>
            <div className="register">
              <div className="doc">
                <span>REGISTRU FEED-URI</span>
                <span>{sources.filter((s) => s.ok).length}/{sources.length} OK</span>
              </div>
              <ul>
                {sources.map((s) => (
                  <li key={s.feed}>
                    <span>{s.feed}</span>
                    <span className={`n ${s.ok ? "ok" : "down"}`} title={s.error ?? ""}>
                      {s.ok ? `${s.kept}` : "EROARE"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="box">
            <h2>Pe secțiuni</h2>
            <p className="sub">Titluri în ultimele zile</p>
            <div className="counts">
              {sections.map((s) => (
                <Link key={s.id} className="count" href={`/c/${s.id}/`}>
                  <div className="v">{counts[s.id] ?? 0}</div>
                  <div className="l">{s.name}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="box">
            <h2>Cele mai recente</h2>
            <p className="sub">Direct la sursă</p>
            <ul className="readlist">
              {latest.map((a, i) => (
                <li key={a.id}>
                  <a href={a.link} target="_blank" rel="noopener noreferrer">
                    <span className="n">{i + 1}</span>
                    <h3>{a.title}</h3>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
