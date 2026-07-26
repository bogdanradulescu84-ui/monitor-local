#!/usr/bin/env node
/**
 * Compune postarea zilnică de promovare din ce a colectat colectorul și o
 * scrie la stdout, în markdown. Workflow-ul digest.yml o pune într-un issue,
 * ca s-o ai pe telefon și s-o publici cu copy-paste.
 *
 * Nu inventează nimic: titlurile și sursele sunt exact cele colectate.
 * Filtrul editorial s-a aplicat deja, la colectare.
 *
 *   node scripts/digest.mjs          markdown pentru issue, de citit pe telefon
 *   node scripts/digest.mjs --raw    doar textul postării, pentru publicare automată
 */

import { readFile } from "node:fs/promises";

const DATA = new URL("../data/articles.json", import.meta.url);

const RAW = process.argv.includes("--raw");

const MAX_ITEMS = 6;
const MAX_PER_SOURCE = 2;
const WINDOW_HOURS = 24;

/**
 * Peste atât, colectarea e prea veche pentru publicare automată.
 *
 * Când toate sursele pică, colectorul nu rescrie data/articles.json — site-ul
 * rămâne pe ultima colectare bună, ceea ce e corect pentru site. Pentru postare
 * ar însemna însă aceleași titluri publicate a doua zi. Până acum se uita un om
 * la issue înainte de copy-paste; automat, nu se mai uită nimeni.
 */
const STALE_HOURS = 26;

/** Ieșire distinctă pentru „date prea vechi": workflow-ul nu postează, dar alertează. */
const EXIT_STALE = 3;

/** Ieșire distinctă pentru „nu e nimic de postat": zi liniștită, fără alertă. */
const EXIT_EMPTY = 4;

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
 *
 * Articolele marcate „prioritar" de regulile din config trec înaintea
 * criteriului de secțiune. Marcarea s-a făcut la colectare; aici doar se citește.
 */
function rank(articles, sections) {
  const weight = new Map(sections.map((s, i) => [s.id, s.id === "diverse" ? 99 : i]));
  return [...articles].sort((a, b) => {
    if (Boolean(a.promoted) !== Boolean(b.promoted)) return a.promoted ? -1 : 1;
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
const ageHours = (Date.now() - generated.getTime()) / 3600_000;

if (ageHours > STALE_HOURS) {
  console.error(
    `Colectarea are ${ageHours.toFixed(1)} ore (peste ${STALE_HOURS}). ` +
      "Probabil toate sursele au picat și data/articles.json a rămas neschimbat. " +
      "Nu compun postarea: ar republica titlurile de ieri."
  );
  process.exit(EXIT_STALE);
}

const since = new Date(generated.getTime() - WINDOW_HOURS * 3600_000);
const items = pick(data.articles, data.sections, since);
const url = data.site.url || "";

if (!items.length) {
  const msg = "Nimic de postat: nu există articole colectate.";
  // Cu --raw, stdout e textul care ajunge pe Facebook. Mesajul ăsta nu are ce
  // căuta acolo: ar fi publicat ca postare.
  if (RAW) {
    console.error(msg);
    process.exit(EXIT_EMPTY);
  }
  console.log(msg);
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

// --raw: doar textul, pentru publicare automată. Compunerea de mai sus rămâne
// singura; workflow-ul nu o duplică.
if (RAW) {
  console.log(post);
  process.exit(0);
}

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
