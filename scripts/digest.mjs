#!/usr/bin/env node
/**
 * Compune postarea zilnică de promovare din ce a colectat colectorul și o
 * scrie la stdout, în markdown. Workflow-ul digest.yml o pune într-un issue,
 * ca s-o ai pe telefon și s-o publici cu copy-paste.
 *
 * Nu inventează nimic: titlurile și sursele sunt exact cele colectate.
 * Filtrul editorial s-a aplicat deja, la colectare.
 *
 *   node scripts/digest.mjs               markdown pentru issue, de citit pe telefon
 *   node scripts/digest.mjs --raw         doar textul postării, pentru publicare automată
 *   node scripts/digest.mjs --window=11   ia doar articolele din ultimele 11 ore
 */

import { readFile } from "node:fs/promises";

const DATA = new URL("../data/articles.json", import.meta.url);

// Forma postării se citește din config, nu din articles.json: schimbarea unui
// cuvânt din antet n-are de ce să ceară o recolectare a tuturor feed-urilor.
const CONFIG = new URL("../config/sources.json", import.meta.url);

const RAW = process.argv.includes("--raw");

/**
 * Fereastra de timp din care se aleg articolele.
 *
 * Se postează de două ori pe zi, iar fereastra e singurul lucru care ține
 * postarea de seară să n-o repete pe cea de dimineață. Nu ținem minte ce s-a
 * publicat deja — dimineața acoperă intervalul de la postarea de aseară, seara
 * pe cel de la postarea de dimineață. Fără stare, fără fișier de urmărit.
 *
 * Ferestrele sunt puțin mai largi decât intervalul real, ca să nu cadă nimic
 * între ele. Prețul e că un articol apărut fix la graniță poate apărea de două
 * ori — preferabil unuia pierdut.
 */
const WINDOW_HOURS = (() => {
  const arg = process.argv.find((a) => a.startsWith("--window="));
  const n = arg ? Number(arg.slice("--window=".length)) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 24;
})();

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
    // Câte ziare au scris despre subiect. Se calculează la colectare; e cel mai
    // apropiat lucru de „ce contează azi" pe care îl avem fără date de trafic.
    const c = (b.coverage ?? 1) - (a.coverage ?? 1);
    if (c !== 0) return c;
    const wa = weight.get(a.section) ?? 50;
    const wb = weight.get(b.section) ?? 50;
    if (wa !== wb) return wa - wb;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
}

/**
 * Alege pe cote, coș cu coș: atâtea buzoiene, atâtea naționale, atâtea de sport.
 *
 * Nu se completează dintr-un coș în altul și nu se reia din afara ferestrei. Dacă
 * azi n-a fost decât o știre națională, postarea are o singură știre națională —
 * varianta cealaltă ar fi să repete ceva deja publicat, ceea ce e mai rău.
 *
 * Coșurile respectă ordinea din 'quota'; articolele fără coș (colectate înainte
 * de introducerea lor) intră în „buzau", ca postarea să meargă și pe date vechi.
 */
function pick(articles, sections, since, quota, maxPerSource) {
  const fresh = articles.filter((a) => new Date(a.publishedAt) >= since);
  const perSource = new Map();
  const chosen = [];

  for (const [bucket, cota] of Object.entries(quota)) {
    const pool = rank(fresh.filter((x) => (x.bucket ?? "buzau") === bucket), sections);
    const luate = new Set();

    // Două treceri. Prima ține la diversitate: cel mult maxPerSource de la
    // aceeași publicație. A doua completează locurile rămase fără limita asta.
    //
    // Există pentru că presa buzoiană e concentrată: într-o fereastră de 14 ore
    // publică de obicei două-trei ziare, iar Opinia și Buzău Media scot mai tot.
    // Cu o singură trecere, cota de 6 s-ar umple rar. Mai bine șase știri de la
    // trei surse decât patru de la trei surse.
    for (const limit of [maxPerSource, Infinity]) {
      for (const a of pool) {
        if (luate.size >= cota) break;
        if (luate.has(a)) continue;
        const used = perSource.get(a.source) ?? 0;
        if (used >= limit) continue;
        perSource.set(a.source, used + 1);
        luate.add(a);
        chosen.push(a);
      }
    }
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

const shape = JSON.parse(await readFile(CONFIG, "utf8")).post ?? {};
const quota = shape.quota ?? { buzau: 6 };
const maxPerSource = shape.maxPerSource ?? 2;

// Fereastra pornește de la ora colectării, nu de la ora curentă: dacă ultima
// colectare a fost acum 40 de minute, articolele de dinaintea ei tot intră.
const since = new Date(generated.getTime() - WINDOW_HOURS * 3600_000);
const items = pick(data.articles, data.sections, since, quota, maxPerSource);
const url = data.site.url || "";

if (!items.length) {
  const msg = `Nimic de postat: niciun articol nou în ultimele ${WINDOW_HOURS} ore.`;
  // Cu --raw, stdout e textul care ajunge pe Facebook. Mesajul ăsta nu are ce
  // căuta acolo: ar fi publicat ca postare.
  if (RAW) {
    console.error(msg);
    process.exit(EXIT_EMPTY);
  }
  console.log(msg);
  process.exit(0);
}

/**
 * Forma postării vine din config → post. Substituie {n}, {stiri}, {data}, {url}.
 *
 * Facebook taie textul după câteva rânduri și pune „Vezi mai mult". De aceea
 * primul rând e cârlig, nu antet decorativ: ce nu intră acolo nu se citește.
 * Rândul liber dintre știri le face să se vadă ca elemente separate.
 */
const fill = (tpl, fallback) =>
  String(tpl ?? fallback)
    .replaceAll("{n}", String(items.length))
    .replaceAll("{stiri}", items.length === 1 ? "știre" : "știri")
    .replaceAll("{data}", roDate(generated))
    .replaceAll("{url}", url);

const bullet = shape.bullet ?? "•";

const post = [
  fill(shape.header, "{data} — {n} {stiri} din Buzău"),
  "",
  items.map((a) => `${bullet} ${a.title} (${a.source})`).join("\n\n"),
  "",
  fill(shape.footer, "Toate știrile, într-un singur loc: {url}"),
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
