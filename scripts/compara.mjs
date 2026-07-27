#!/usr/bin/env node
/**
 * Compune postarea de prânz: același eveniment politic, așa cum l-au titrat două
 * publicații diferite. Scoate textul la stdout, ca digest.mjs.
 *
 *   node scripts/compara.mjs          markdown pentru issue
 *   node scripts/compara.mjs --raw    doar textul, pentru publicare automată
 *
 * De ce doar politic și doar din presa centrală, deși site-ul e buzoian:
 *
 * Gruparea subiectelor se face pe potrivire de cuvinte, iar asta merge bine doar
 * unde titlurile conțin nume proprii rare — Grindeanu, Cîrpaci, Cernavodă. Presa
 * buzoiană publică multe anunțuri administrative cu formulare identice („Primăria
 * X, anunț public privind..."), iar acolo potrivirea lipește evenimente diferite:
 * ședința Consiliului Local Buzău cu cea din comuna Vadu Pașii. Măsurat pe date
 * reale, aproape jumătate din grupurile buzoiene erau greșite, față de aproape
 * niciunul dintre cele naționale.
 *
 * Pentru o postare care spune „uite cum au titrat diferit același eveniment", o
 * grupare greșită nu e o imprecizie, e o dezmințire publică. De aceea coșul e
 * restrâns la 'tara', unde măsurătoarea arată că grupăm corect.
 */

import { readFile } from "node:fs/promises";

const DATA = new URL("../data/articles.json", import.meta.url);
const CONFIG = new URL("../config/sources.json", import.meta.url);

const RAW = process.argv.includes("--raw");

/** Aceleași coduri ca la digest.mjs, ca workflow-ul să le trateze la fel. */
const STALE_HOURS = 26;
const EXIT_STALE = 3;
const EXIT_EMPTY = 4;

const DIACRITICE = { ș: "s", ş: "s", Ș: "S", Ş: "S", ț: "t", ţ: "t", Ț: "T", Ţ: "T" };

function fold(s) {
  return String(s ?? "")
    .replace(/[șşȘŞțţȚŢ]/g, (c) => DIACRITICE[c])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function cuvinte(s) {
  return new Set(fold(s).match(/[a-z0-9]{4,}/g) ?? []);
}

function hasWord(haystack, needle) {
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${esc}(?:[^a-z0-9]|$)`).test(haystack);
}

/**
 * Cât de mult seamănă două titluri, raportat la cel mai scurt dintre ele.
 * 0 = n-au nimic în comun, 1 = unul îl conține pe celălalt.
 */
function suprapunere(a, b) {
  const ca = cuvinte(a);
  const cb = cuvinte(b);
  const mic = Math.min(ca.size, cb.size);
  if (!mic) return 1;
  let comune = 0;
  for (const w of ca) if (cb.has(w)) comune++;
  return comune / mic;
}

/** Perechea din grup care se aseamănă cel mai puțin — acolo e contrastul. */
function pereche(variante) {
  let best = null;
  let scor = 2;
  for (let i = 0; i < variante.length; i++) {
    for (let j = i + 1; j < variante.length; j++) {
      if (variante[i].source === variante[j].source) continue;
      const s = suprapunere(variante[i].title, variante[j].title);
      if (s < scor) {
        scor = s;
        best = [variante[i], variante[j]];
      }
    }
  }
  return best ? { pereche: best, suprapunere: scor } : null;
}

const data = JSON.parse(await readFile(DATA, "utf8"));
const cfg = JSON.parse(await readFile(CONFIG, "utf8"));
const c = cfg.compara ?? {};

const generat = new Date(data.generatedAt);
const vechime = (Date.now() - generat.getTime()) / 3600_000;
if (vechime > STALE_HOURS) {
  console.error(
    `Colectarea are ${vechime.toFixed(1)} ore (peste ${STALE_HOURS}). Nu compun nimic.`
  );
  process.exit(EXIT_STALE);
}

const url = data.site.url || "";
const cosuri = c.buckets ?? ["tara"];
const maxSuprapunere = c.maxSuprapunere ?? 0.4;
const termeni = (c.termeniPolitici ?? []).map(fold).filter(Boolean);

const grupuri = (data.articles ?? []).filter(
  (a) => a.variants && new Set(a.variants.map((v) => v.source)).size > 1
);

function scorPolitic(g) {
  const t = fold(g.variants.map((v) => v.title).join(" "));
  return termeni.filter((k) => hasWord(t, k)).length;
}

// Candidații: din coșurile permise, politici, cu contrast real între două titluri.
const candidati = [];
for (const g of grupuri) {
  if (!cosuri.includes(g.bucket)) continue;
  const pol = scorPolitic(g);
  if (!pol) continue;
  const p = pereche(g.variants);
  if (!p || p.suprapunere > maxSuprapunere) continue;
  candidati.push({ g, pol, ...p });
}

// Întâi cel mai politic, la egalitate cel cu contrastul cel mai mare.
candidati.sort((x, y) => y.pol - x.pol || x.suprapunere - y.suprapunere);

const surse = (g) => new Set(g.variants.map((v) => v.source)).size;
let post;

if (candidati.length) {
  const { g, pereche: [a, b] } = candidati[0];
  const alte = surse(g) - 2;
  post = [
    c.header ?? "🔎 ACELAȘI EVENIMENT, DOUĂ TITLURI",
    "",
    `„${a.title}”`,
    `— ${a.source}`,
    "",
    `„${b.title}”`,
    `— ${b.source}`,
    "",
    ...(alte > 0 ? [`Încă ${alte} ${alte === 1 ? "publicație a scris" : "publicații au scris"} despre asta.`, ""] : []),
    c.footer ?? "Concluzia e a ta.",
    "",
    url,
  ].join("\n");
} else {
  // Rezerva cerută: dacă nimic politic nu are contrast, arătăm subiectul zilei.
  // Fără pretenția de comparație — aici mesajul e „despre asta a scris toată presa".
  const top = grupuri.sort((x, y) => surse(y) - surse(x))[0];
  if (!top) {
    const msg = "Niciun subiect relatat de mai multe publicații. Nu am ce compara.";
    if (RAW) {
      console.error(msg);
      process.exit(EXIT_EMPTY);
    }
    console.log(msg);
    process.exit(0);
  }
  const v = top.variants;
  post = [
    c.headerRezerva ?? "🔎 DESPRE ASTA A SCRIS AZI TOATĂ PRESA",
    "",
    `„${v[0].title}”`,
    `— ${v[0].source}`,
    "",
    `${surse(top)} publicații au relatat același lucru.`,
    "",
    c.footerRezerva ?? "Citește-le pe toate și compară.",
    "",
    url,
  ].join("\n");
}

if (RAW) {
  console.log(post);
  process.exit(0);
}

console.log("Copiază de aici:\n");
console.log("```");
console.log(post);
console.log("```");
console.log("");
console.log("---");
console.log("");
console.log(
  candidati.length
    ? `${candidati.length} subiecte politice cu contrast; l-am ales pe cel cu scorul politic ${candidati[0].pol} și suprapunere ${(candidati[0].suprapunere * 100).toFixed(0)}%.`
    : `Niciun subiect politic cu contrast sub ${(maxSuprapunere * 100).toFixed(0)}%. Am căzut pe subiectul cel mai acoperit.`
);
