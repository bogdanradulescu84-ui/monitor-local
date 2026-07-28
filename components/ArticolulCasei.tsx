import Link from "next/link";
import type { Articol } from "@/lib/articole";
import { dataRo } from "@/lib/articole";

/**
 * Blocul de pe prima pagină pentru articolul propriu al publicației.
 *
 * Se distinge deliberat de restul fluxului: rama de ștampilă și eticheta arată
 * că textul e scris aici, nu preluat. Amestecat cu titlurile agregate ar fi
 * înșelător în ambele sensuri — ar părea că e al altcuiva, sau că avem drepturi
 * asupra celorlalte.
 */
export function ArticolulCasei({ a }: { a: Articol }) {
  const href = `/articol/${a.slug}/`;

  return (
    <section className="casa">
      <div className="casa-head">
        <span className="kicker">Articolul Casei</span>
        <span className="casa-meta">
          {a.autor} · {dataRo(a.data)}
        </span>
      </div>

      <Link className="casa-corp" href={href}>
        {a.imagine && (
          <div className="casa-foto">
            {/* Imaginea e montaj, nu fotografie de presă — de aceea nu poartă
                credit de fotograf, iar textul alternativ o spune explicit. */}
            <img src={a.imagine} alt={a.imagineAlt ?? ""} loading="eager" />
          </div>
        )}
        <div className="casa-text">
          <h2>{a.titlu}</h2>
          <p>{a.rezumat}</p>
          <span className="casa-cta">Citește articolul →</span>
        </div>
      </Link>
    </section>
  );
}
