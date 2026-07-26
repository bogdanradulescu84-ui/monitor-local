#!/usr/bin/env node
/**
 * Colectorul: citește config/sources.json, trage feed-urile RSS/Atom,
 * normalizează articolele și scrie data/articles.json.
 *
 * Nu republică textul integral — păstrează titlul, un rezumat scurt din feed
 * și link către sursă. Site-ul trimite cititorul mai departe la publicația
 * care a scris articolul.
 *
 *   node scripts/collect.mjs           rulare normală
 *   node scripts/collect.mjs --dry     arată ce ar colecta, nu scrie nimic
 */

import { readFile, writeFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";

const ROOT = new URL("..", import.meta.url);
const CONFIG_PATH = new URL("config/sources.json", ROOT);
const OUT_PATH = new URL("data/articles.json", ROOT);

const DRY = process.argv.includes("--dry");
const FETCH_TIMEOUT_MS = 15000;
const UA = "monitor-local/0.1 (agregator RSS; contact în README)";

/* ---------------- text helpers ---------------- */

const DIACRITICS = { ș: "s", ş: "s", Ș: "S", Ş: "S", ț: "t", ţ: "t", Ț: "T", Ţ: "T" };

/** Compară fără diacritice: „licitație" și „licitatie" sunt același cuvânt. */
function fold(s) {
  return String(s ?? "")
    .replace(/[șşȘŞțţȚŢ]/g, (c) => DIACRITICS[c])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const ENTITIES = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
  "&apos;": "'", "&nbsp;": " ", "&hellip;": "…", "&mdash;": "—", "&ndash;": "–",
  "&laquo;": "«", "&raquo;": "»", "&bdquo;": "„", "&ldquo;": "“", "&rdquo;": "”",
};

function stripHtml(s) {
  return String(s ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s, max = 220) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.–—-]+$/, "") + "…";
}

const wordCache = new Map();

/**
 * Potrivire pe cuvânt întreg, nu pe subșir: altfel „adi" se regăsea în
 * „tradiția", iar „psd" ar fi prins orice cuvânt care îl conține.
 */
function hasWord(haystack, needle) {
  let re = wordCache.get(needle);
  if (!re) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`);
    wordCache.set(needle, re);
  }
  return re.test(haystack);
}

const upperCache = new Map();

/**
 * Potrivire pe cuvânt întreg, sensibilă la majuscule, pe textul ORIGINAL.
 * Există pentru „AUR": partidul se scrie cu majuscule, metalul nu. Fără asta,
 * „medalie de aur" sau „furt de bijuterii din aur" ar fi urcate ca atacuri.
 */
function hasUpperWord(raw, needle) {
  let re = upperCache.get(needle);
  if (!re) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?:[^A-Za-z0-9]|$)`);
    upperCache.set(needle, re);
  }
  return re.test(raw);
}

function slugify(s) {
  return fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

/* ---------------- feed fetching ---------------- */

async function fetchFeed(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  processEntities: true,
});

function asArray(x) {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function textOf(node) {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object") return String(node["#text"] ?? "");
  return "";
}

/** RSS 2.0, RDF and Atom all land in the same shape. */
function parseEntries(xml) {
  const doc = parser.parse(xml);

  const rssItems = asArray(doc?.rss?.channel?.item);
  if (rssItems.length) return rssItems.map(fromRss);

  const rdfItems = asArray(doc?.["rdf:RDF"]?.item);
  if (rdfItems.length) return rdfItems.map(fromRss);

  const atomEntries = asArray(doc?.feed?.entry);
  if (atomEntries.length) return atomEntries.map(fromAtom);

  return [];
}

function pickImage(item) {
  for (const enc of asArray(item.enclosure)) {
    const type = String(enc?.["@_type"] ?? "");
    const url = enc?.["@_url"];
    if (url && (type.startsWith("image/") || /\.(jpe?g|png|webp|avif)(\?|$)/i.test(url))) return url;
  }
  for (const key of ["media:content", "media:thumbnail"]) {
    for (const m of asArray(item[key])) {
      const url = m?.["@_url"];
      if (url) return url;
    }
  }
  const html = String(item["content:encoded"] ?? item.description ?? "");
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : "";
}

function fromRss(item) {
  return {
    title: stripHtml(textOf(item.title)),
    link: String(textOf(item.link) || item?.link?.["@_href"] || item.guid?.["#text"] || item.guid || "").trim(),
    summary: stripHtml(item.description ?? item["content:encoded"] ?? ""),
    date: textOf(item.pubDate) || textOf(item["dc:date"]) || textOf(item.date) || "",
    image: pickImage(item),
  };
}

function fromAtom(entry) {
  const links = asArray(entry.link);
  const alt = links.find((l) => (l?.["@_rel"] ?? "alternate") === "alternate") ?? links[0];
  return {
    title: stripHtml(textOf(entry.title)),
    link: String(alt?.["@_href"] ?? "").trim(),
    summary: stripHtml(textOf(entry.summary) || textOf(entry.content)),
    date: textOf(entry.updated) || textOf(entry.published) || "",
    image: pickImage(entry),
  };
}

/* ---------------- classification ---------------- */

function classify(text, sections, fallback) {
  let best = null;
  let bestScore = 0;
  for (const sec of sections) {
    let score = 0;
    for (const kw of sec.keywords ?? []) {
      if (hasWord(text, fold(kw))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = sec.id;
    }
  }
  return best ?? fallback ?? sections[0].id;
}

/* ---------------- coșuri ---------------- */

/**
 * Coșul decide două lucruri: cotele din postarea zilnică și plafoanele de mai
 * jos. Vezi „_feeds" în config pentru ce înseamnă fiecare scope.
 *
 * Feed-urile 'tara' se împart după conținut: un articol din Digi24 care
 * menționează Buzăul e știre buzoiană, nu națională, și se clasifică normal.
 */
function bucketOf(feed, haystack, requireAny) {
  if (feed.scope === "sport") return "sport";
  if (feed.scope === "tara") {
    const despreBuzau = requireAny.length && requireAny.some((w) => hasWord(haystack, w));
    return despreBuzau ? "buzau" : "tara";
  }
  return "buzau";
}

/**
 * Plafon pe coș, aplicat înaintea lui maxTotal. Fără el, cele 9 feed-uri
 * naționale și sportive (peste 500 de articole pe rulare) ar împinge afară
 * presa locală, care aduce vreo 90.
 */
function capPerBucket(list, caps) {
  if (!caps) return list;
  const used = new Map();
  return list.filter((a) => {
    const cap = caps[a.bucket];
    if (cap == null) return true;
    const n = used.get(a.bucket) ?? 0;
    if (n >= cap) return false;
    used.set(a.bucket, n + 1);
    return true;
  });
}

/* ---------------- ordering ---------------- */

const PROMOTE_WINDOW_MS = 24 * 3600_000;

/** Prioritarele proaspete urcă; restul rămâne strict cronologic. */
function orderWithPromoted(list, now) {
  const fresh = (a) => a.promoted && now - Date.parse(a.publishedAt) <= PROMOTE_WINDOW_MS;
  return [...list].sort((x, y) => {
    const rank = (fresh(x) ? 0 : 1) - (fresh(y) ? 0 : 1);
    return rank !== 0 ? rank : y.publishedAt.localeCompare(x.publishedAt);
  });
}

/* ---------------- main ---------------- */

/**
 * Linia editorială declarată în config: respinge articolele care leagă un
 * subiect protejat de un semnal negativ. Se face pe cuvinte, deci greșește în
 * ambele sensuri — vezi nota din config/sources.json.
 */
function makeEditorialFilter(editorial) {
  const subjects = (editorial?.protect?.subjects ?? []).map(fold).filter(Boolean);
  const cues = (editorial?.protect?.negativeCues ?? []).map(fold).filter(Boolean);
  if (!subjects.length || !cues.length) return () => false;

  return (haystack) => subjects.some((s) => hasWord(haystack, s)) && cues.some((c) => hasWord(haystack, c));
}

/**
 * Prioritizarea declarată în config: urcă articolele care leagă un subiect vizat
 * de un semnal negativ ('against'), sau un subiect susținut de unul pozitiv ('for').
 *
 * Rulează DUPĂ filtrul de mai sus. Consecința e utilă: un articol despre PSD care
 * conține și un cuvânt pozitiv, și unul negativ, e deja aruncat de 'protect' și nu
 * poate ajunge urcat din greșeală.
 */
function makePromoteFilter(editorial) {
  const list = (xs) => (xs ?? []).map(fold).filter(Boolean);

  const against = editorial?.promote?.against ?? {};
  const againstSubjects = list(against.subjects);
  const againstUpper = (against.subjectsUpper ?? []).filter(Boolean);
  const againstCues = list(against.negativeCues ?? editorial?.protect?.negativeCues);

  const boost = editorial?.promote?.for ?? {};
  const forSubjects = list(boost.subjects?.length ? boost.subjects : editorial?.protect?.subjects);
  const forCues = list(boost.positiveCues);

  return (haystack, raw) => {
    // Un titlu scris integral cu majuscule face inutilă distincția AUR/aur.
    const upperUsable = raw !== raw.toUpperCase();
    const hitsSubject =
      againstSubjects.some((s) => hasWord(haystack, s)) ||
      (upperUsable && againstUpper.some((s) => hasUpperWord(raw, s)));

    if (hitsSubject && againstCues.some((c) => hasWord(haystack, c))) return true;

    return forSubjects.some((s) => hasWord(haystack, s)) && forCues.some((c) => hasWord(haystack, c));
  };
}

async function main() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const { sections, feeds, filters, limits, editorial } = config;

  if (!feeds.length) {
    console.error(
      "Nu e configurat niciun feed.\n" +
        "Adaugă surse în config/sources.json → \"feeds\", de forma:\n" +
        '  { "name": "Gazeta de X", "url": "https://…/rss", "scope": "local" }\n' +
        "Nu am modificat data/articles.json."
    );
    process.exit(2);
  }

  const requireAny = (filters?.requireAny ?? []).map(fold).filter(Boolean);
  const excludeAny = (filters?.excludeAny ?? []).map(fold).filter(Boolean);
  const maxAgeMs = (limits?.maxAgeDays ?? 7) * 86400000;
  const blockedByPolicy = makeEditorialFilter(editorial);
  const promotedByPolicy = makePromoteFilter(editorial);
  const now = Date.now();
  let editorialFiltered = 0;
  let editorialPromoted = 0;

  const results = await Promise.allSettled(
    feeds.map(async (feed) => ({ feed, entries: parseEntries(await fetchFeed(feed.url)) }))
  );

  const articles = [];
  const report = [];
  let okFeeds = 0;

  results.forEach((res, i) => {
    const feed = feeds[i];

    if (res.status === "rejected") {
      report.push({ feed: feed.name, ok: false, kept: 0, error: String(res.reason?.message ?? res.reason) });
      return;
    }
    okFeeds++;

    const { entries } = res.value;
    let kept = 0;

    for (const e of entries.slice(0, limits?.maxPerFeed ?? 25)) {
      if (!e.title || !e.link) continue;

      const when = e.date ? new Date(e.date) : null;
      const ts = when && !Number.isNaN(when.getTime()) ? when.getTime() : now;
      if (now - ts > maxAgeMs) continue;

      const haystack = fold(`${e.title} ${e.summary}`);
      if (excludeAny.some((w) => hasWord(haystack, w))) continue;
      // Doar 'national' cere relevanță buzoiană. 'tara' și 'sport' intră întregi
      // și se separă prin coș, mai jos.
      if (feed.scope === "national" && requireAny.length && !requireAny.some((w) => hasWord(haystack, w))) continue;
      if (blockedByPolicy(haystack)) {
        editorialFiltered++;
        continue;
      }

      const bucket = bucketOf(feed, haystack, requireAny);
      // Secțiunile impuse: fără ele, un articol de fotbal ar cădea în
      // „Comunitate", care are „sport" și „echipa" printre cuvintele-cheie.
      const section =
        bucket === "sport" ? "sport"
        : bucket === "tara" ? "national"
        : classify(haystack, sections, feed.section ?? config.fallbackSection);

      const promoted = promotedByPolicy(haystack, `${e.title} ${e.summary}`);
      if (promoted) editorialPromoted++;

      articles.push({
        id: slugify(`${e.title}-${feed.name}`),
        title: e.title,
        summary: truncate(e.summary),
        link: e.link,
        source: feed.name,
        scope: feed.scope ?? "national",
        bucket,
        section,
        image: e.image || "",
        publishedAt: new Date(ts).toISOString(),
        promoted,
      });
      kept++;
    }

    report.push({ feed: feed.name, ok: true, kept, error: null });
  });

  if (okFeeds === 0) {
    console.error("Toate feed-urile au eșuat. Nu am modificat data/articles.json.");
    for (const r of report) console.error(`  ✗ ${r.feed}: ${r.error}`);
    process.exit(1);
  }

  // Dedupe: același link, sau același titlu preluat de mai multe publicații.
  const seenLink = new Set();
  const seenTitle = new Set();
  const unique = [];
  for (const a of articles.sort((x, y) => y.publishedAt.localeCompare(x.publishedAt))) {
    const linkKey = a.link.replace(/[?#].*$/, "");
    const titleKey = fold(a.title).replace(/[^a-z0-9]+/g, "").slice(0, 60);
    if (seenLink.has(linkKey) || seenTitle.has(titleKey)) continue;
    seenLink.add(linkKey);
    seenTitle.add(titleKey);
    unique.push(a);
  }

  // Dedupe rămâne cronologic mai sus, ca dintre două copii să supraviețuiască cea
  // mai nouă. Prioritizarea se aplică abia acum, peste rezultat.
  //
  // Doar în ultimele 24h: coloana de ore din stânga fluxului organizează știrea
  // după *când*. Un articol de acum trei zile urcat în capul listei ar face orele
  // să sară înapoi și ar goli coloana de sens.
  const ordered = capPerBucket(orderWithPromoted(unique, now), limits?.maxPerBucket);

  const out = {
    generatedAt: new Date().toISOString(),
    site: config.site,
    editorial: { disclosure: editorial?.disclosure ?? "" },
    editorialFiltered,
    editorialPromoted,
    sections,
    counts: Object.fromEntries(sections.map((s) => [s.id, ordered.filter((a) => a.section === s.id).length])),
    sources: report,
    articles: ordered.slice(0, limits?.maxTotal ?? 120),
  };

  for (const r of report) {
    console.log(r.ok ? `  ✓ ${r.feed}: ${r.kept}` : `  ✗ ${r.feed}: ${r.error}`);
  }
  const peCos = out.articles.reduce((m, a) => m.set(a.bucket, (m.get(a.bucket) ?? 0) + 1), new Map());
  console.log(
    `${out.articles.length} articole, din ${okFeeds}/${feeds.length} surse.  ` +
      [...peCos].map(([k, v]) => `${k}: ${v}`).join(" · ")
  );
  if (editorialFiltered) {
    console.log(`${editorialFiltered} articole respinse de politica editorială.`);
  }
  if (editorialPromoted) {
    const inWindow = out.articles.filter((a) => a.promoted && now - Date.parse(a.publishedAt) <= PROMOTE_WINDOW_MS).length;
    console.log(`${editorialPromoted} articole prioritare, din care ${inWindow} urcate (restul, mai vechi de 24h).`);
  }

  if (DRY) {
    console.log("--dry: nu am scris nimic.");
    return;
  }
  await writeFile(OUT_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`Scris în data/articles.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
