import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { clockOf, loadData, longDate } from "@/lib/articles";
import "./globals.css";

const data = loadData();

export const metadata: Metadata = {
  title: `${data.site.name} — presă locală și politică`,
  description: `${data.site.tagline}. Titluri din presa din ${data.site.place} și ${data.site.county}, cu link către sursă.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { site, sources, generatedAt } = data;
  const liveSources = sources.filter((s) => s.ok).length;
  const emphasis = site.nameEmphasis && site.name.endsWith(site.nameEmphasis) ? site.nameEmphasis : "";
  const namePrefix = emphasis ? site.name.slice(0, site.name.length - emphasis.length).trim() : site.name;

  return (
    <html lang="ro">
      <body>
        <header className="masthead">
          <div className="civic">
            <div className="wrap civic-in">
              <span>{longDate(generatedAt)}</span>
              <span className="sep">·</span>
              <span className="civic-live">
                <span className="dot-live" />
                ACTUALIZAT {clockOf(generatedAt)} · {liveSources}/{sources.length} SURSE
              </span>
              <ThemeToggle />
            </div>
          </div>

          <div className="wrap nameplate-in">
            <div className="nameplate">
              <h1>
                {namePrefix} {emphasis && <span className="of">{emphasis}</span>}
              </h1>
              <div className="tagline">{site.tagline}</div>
            </div>
            <div className="founded">
              <b>
                {site.place} · {site.county}
              </b>
              {site.population && <>{site.population} locuitori</>}
              <br />
              Titluri agregate, actualizate automat
            </div>
          </div>
        </header>

        <SiteNav sections={data.sections} />

        {data.isSample && (
          <div className="demo">
            <div className="wrap">
              <b>DATE DEMONSTRATIVE.</b> Nu e configurat niciun feed în <code>config/sources.json</code>, așa că
              pagina afișează un set fictiv de exemplu. Adaugă surse și rulează <code>npm run collect</code>.
            </div>
          </div>
        )}

        <main>{children}</main>

        <footer>
          <div className="wrap">
            <div className="foot-in">
              <div>
                <div className="foot-name">{site.name}</div>
                <p>
                  {site.email}
                  <br />
                  Agregator: publicăm titlul, un rezumat scurt din feed și link către articolul original. Textul
                  integral rămâne la publicația care l-a scris.
                </p>
              </div>
              <div>
                <p>
                  <b>Secțiuni</b>
                  <br />
                  {data.sections.map((s) => s.name).join(" · ")}
                </p>
              </div>
            </div>
            {data.editorial?.disclosure && (
              <div className="notice policy">
                <b>Politică editorială.</b> {data.editorial.disclosure}
              </div>
            )}

            <div className="notice">
              Conținutul aparține publicațiilor-sursă. Dacă ești editor și vrei ca feed-ul tău să nu mai fie
              preluat, scrie la {site.email} și îl scoatem din <code>config/sources.json</code>.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
