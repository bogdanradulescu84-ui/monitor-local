#!/usr/bin/env node
/**
 * Compune postarea zilnică de promovare din ce a colectat colectorul și o
 * scrie la stdout, în markdown. Workflow-ul digest.yml o pune într-un issue,
 * ca s-o ai pe telefon și s-o publici cu copy-paste.
 *
 * Nu inventează nimic: titlurile și sursele sunt exact cele colectate.
 * Filtrul editorial s-a aplicat deja, la colectare.
 */

import { readFile } from "node:fs/promises";

const DATA = new URL("../data/articles.json", import.meta.url);

const MAX_ITEMS = 6;
const MAX_PER_SOURCE = 2;
const WINDOW_HOURS = 24;

const MONTHS = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

function roDate(d) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * Ce nu s-a putut clasifica ajunge în „diverse" — de obicei divertisment.
 * Pentru o postare zilnică vrem întâi ce are miez, apoi umplem cu restul.
 */
function rank(articles, sections) {
  const weight = new Map(sections.map((s, i) => [s.id, s.id === "diverse" ? 99 : i]));
  return [...articles].sort((a, b) => {
    const wa = weight.get(a.section) ?? 50;
    const wb = weight.get(b.section) ?? 50;
    if (wa !== wb) return wa - wb;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
}

function pick(articles, sections, since) {
  const fresh = articles.filter((a) => new Date(a.publishedAt) >= since);
  const pool = fresh.length >= MAX_ITEMS ? fresh : articles;

  const perSource = new Map();
  const chosen = [];
  for (const a of rank(pool, sections)) {
    const used = perSource.get(a.source) ?? 0;
    if (used >= MAX_PER_SOURCE) continue;
    perSource.set(a.source, used + 1);
    chosen.push(a);
    if (chosen.length >= MAX_ITEMS) break;
  }
  return chosen;
}

const data = JSON.parse(await readFile(DATA, "utf8"));
const generated = new Date(data.generatedAt);
const since = new Date(generated.getTime() - WINDOW_HOURS * 3600_000);
const items = pick(data.articles, data.sections, since);
const url = data.site.url || "";

if (!items.length) {
  console.log("Nimic de postat: nu există articole colectate.");
  process.exit(0);
}

const post = [
  `${data.site.name} — ${roDate(generated)}`,
  "",
  "Ce s-a scris azi în presa buzoiană:",
  "",
  ...items.map((a) => `• ${a.title} (${a.source})`),
  "",
  `Toate știrile, într-un singur loc: ${url}`,
].join("\n");

// Blocul de sus e textul de publicat; restul e context pentru tine.
console.log("Copiază de aici:\n");
console.log("```");
console.log(post);
console.log("```");
console.log("");
console.log("---");
console.log("");
console.log(`Colectare: ${generated.toLocaleString("ro-RO")} · ${data.articles.length} articole în total · ` +
  `${data.sources.filter((s) => s.ok).length}/${data.sources.length} surse active`);
console.log("");
console.log("Linkurile directe, dacă vrei să postezi doar unul:");
console.log("");
for (const a of items) {
  console.log(`- [${a.title}](${a.link}) — ${a.source}`);
}
