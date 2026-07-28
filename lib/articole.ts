import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Articolele proprii ale publicației — „Articolul Casei”.
 *
 * Sunt un tip de conținut complet separat de fluxul agregat. Regula „agregăm,
 * nu republicăm” din CLAUDE.md se referă la textele ALTORA, unde republicarea
 * integrală e problemă de drepturi de autor. Aici textul e al publicației, deci
 * problema nu există. Nu confunda cele două cazuri.
 *
 * Formatul fișierului: antet JSON între linii de „---”, apoi corpul, cu
 * paragrafele despărțite prin rând gol. Antetul e JSON, nu YAML, iar corpul e
 * text simplu, nu markdown, ca să nu adăugăm două dependințe pentru un text de
 * zece paragrafe. Dacă apar vreodată subtitluri, liste sau link-uri în corp,
 * atunci merită un parser adevărat — până atunci, nu.
 */

const DIR = path.join(process.cwd(), "content", "articole");

export type Sursa = { publicatie: string; titlu: string; url: string };

export type Articol = {
  slug: string;
  titlu: string;
  autor: string;
  data: string;
  rezumat: string;
  imagine?: string;
  imagineAlt?: string;
  surse: Sursa[];
  paragrafe: string[];
};

function citeste(fisier: string): Articol | null {
  const brut = readFileSync(path.join(DIR, fisier), "utf8");
  const m = brut.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) return null;

  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(m[1]);
  } catch {
    // Un antet stricat nu trebuie să dărâme tot site-ul la build; articolul
    // dispare, restul merge mai departe.
    return null;
  }

  const paragrafe = m[2]
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\s*\n\s*/g, " "))
    .filter(Boolean);

  return {
    slug: fisier.replace(/\.md$/, ""),
    titlu: String(meta.titlu ?? ""),
    autor: String(meta.autor ?? "Redacția"),
    data: String(meta.data ?? ""),
    rezumat: String(meta.rezumat ?? ""),
    imagine: meta.imagine ? String(meta.imagine) : undefined,
    imagineAlt: meta.imagineAlt ? String(meta.imagineAlt) : undefined,
    surse: Array.isArray(meta.surse) ? (meta.surse as Sursa[]) : [],
    paragrafe,
  };
}

/** Toate articolele, cel mai recent primul. */
export function loadArticole(): Articol[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".md"))
    .map(citeste)
    .filter((a): a is Articol => a !== null && Boolean(a.titlu) && a.paragrafe.length > 0)
    .sort((a, b) => b.data.localeCompare(a.data));
}

/** Articolul de pe prima pagină. Null când n-a fost publicat încă niciunul. */
export function articolulCasei(): Articol | null {
  return loadArticole()[0] ?? null;
}

export function articolDupaSlug(slug: string): Articol | null {
  return loadArticole().find((a) => a.slug === slug) ?? null;
}

const LUNI = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

export function dataRo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${LUNI[d.getMonth()]} ${d.getFullYear()}`;
}
