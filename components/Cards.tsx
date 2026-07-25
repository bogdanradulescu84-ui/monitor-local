import { Shot } from "@/components/Figure";
import { type Article, hostOf, stamp } from "@/lib/articles";

/**
 * Every card leaves the site. We show the headline, the feed's own summary and
 * a credit — the article itself stays with the publication that wrote it.
 */
const OUT = { target: "_blank", rel: "noopener noreferrer" } as const;

function Credit({ a, at }: { a: Article; at: string }) {
  const host = hostOf(a.link);
  return (
    <div className="src">
      <span>{a.source}</span>
      {host && host.toLowerCase() !== a.source.toLowerCase() && <span>· {host}</span>}
      <span>· {stamp(a.publishedAt, at)}</span>
      <span className="out" aria-hidden="true">
        ↗
      </span>
    </div>
  );
}

export function LeadCard({ a, at, kicker }: { a: Article; at: string; kicker: string }) {
  return (
    <a className="card lead" href={a.link} {...OUT}>
      <div className="frame">
        <Shot src={a.image} section={a.section} seed={a.id} />
      </div>
      <div className="kicker">{kicker}</div>
      <h2 className="hl">{a.title}</h2>
      {a.summary && <p className="deck">{a.summary}</p>}
      <Credit a={a} at={at} />
    </a>
  );
}

export function StackCard({ a, at, kicker }: { a: Article; at: string; kicker: string }) {
  return (
    <a className="card" href={a.link} {...OUT}>
      <div className="kicker">{kicker}</div>
      <h3 className="hl">{a.title}</h3>
      {a.summary && <p className="deck">{a.summary}</p>}
      <Credit a={a} at={at} />
    </a>
  );
}

export function FluxRow({ a, at, kicker }: { a: Article; at: string; kicker: string }) {
  return (
    <div className="row">
      <div className="t">{stamp(a.publishedAt, at)}</div>
      <div className="rail" />
      <a className="card item" href={a.link} {...OUT}>
        <div className="kicker muted">{kicker}</div>
        <h3 className="hl">{a.title}</h3>
        {a.summary && <p className="deck">{a.summary}</p>}
        <Credit a={a} at={at} />
      </a>
    </div>
  );
}

export function ListCard({ a, at, kicker }: { a: Article; at: string; kicker: string }) {
  return (
    <a className="card" href={a.link} {...OUT}>
      <div className="thumb">
        <Shot src={a.image} section={a.section} seed={a.id} />
      </div>
      <div>
        <div className="kicker">{kicker}</div>
        <h3 className="hl">{a.title}</h3>
        {a.summary && <p className="deck">{a.summary}</p>}
        <Credit a={a} at={at} />
      </div>
    </a>
  );
}
