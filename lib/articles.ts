import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export type Article = {
  id: string;
  title: string;
  summary: string;
  link: string;
  source: string;
  /** De unde vine. Vezi „_feeds" în config/sources.json. */
  scope: "local" | "national" | "tara" | "sport";
  /** Ce fel de știre e, după filtrare. Decide cotele postării și plafoanele.
   *  Opțional: articolele colectate înainte de introducerea coșurilor n-au câmpul. */
  bucket?: "buzau" | "tara" | "sport";
  section: string;
  image: string;
  publishedAt: string;
  /** Urcat de regulile din config → editorial.promote. Opțional: articolele
   *  colectate înainte de introducerea regulii nu au câmpul. */
  promoted?: boolean;
};

export type Section = { id: string; name: string; desc: string; keywords?: string[] };

export type SourceReport = { feed: string; ok: boolean; kept: number; error: string | null };

export type SiteMeta = {
  name: string;
  nameEmphasis?: string;
  tagline: string;
  place: string;
  county: string;
  population?: string;
  email?: string;
  url?: string;
};

export type Data = {
  generatedAt: string;
  site: SiteMeta;
  /** Linia editorială declarată, afișată în subsol. */
  editorial?: { disclosure: string };
  /** Câte articole a respins linia editorială la ultima colectare. */
  editorialFiltered?: number;
  sections: Section[];
  counts: Record<string, number>;
  sources: SourceReport[];
  articles: Article[];
  isSample: boolean;
};

const DATA_DIR = path.join(process.cwd(), "data");

/**
 * Live data if the collector has run, otherwise the bundled sample so the site
 * renders on a fresh clone. The sample is flagged and the layout says so.
 */
export function loadData(): Data {
  const live = path.join(DATA_DIR, "articles.json");
  const sample = path.join(DATA_DIR, "articles.sample.json");
  const isSample = !existsSync(live);
  const raw = JSON.parse(readFileSync(isSample ? sample : live, "utf8"));
  return { ...raw, isSample };
}

export function bySection(data: Data, id: string): Article[] {
  return data.articles.filter((a) => a.section === id);
}

export function sectionName(data: Data, id: string): string {
  return data.sections.find((s) => s.id === id)?.name ?? id;
}

/** Publication host, for the "via" credit under a headline. */
export function hostOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "noi", "dec"];

/**
 * Time-of-day for today's items, day+month for older ones. Resolved against
 * the collection timestamp, not the build clock, so a rebuild without a fresh
 * collection does not silently age the labels.
 */
export function stamp(publishedAt: string, generatedAt: string): string {
  const d = new Date(publishedAt);
  const now = new Date(generatedAt);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function longDate(iso: string): string {
  const d = new Date(iso);
  const days = ["duminică", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă"];
  const months = [
    "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
    "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`.toUpperCase();
}

export function clockOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
