# monitor-local

Agregator de presă locală și politică. Un job trage feed-urile RSS ale publicațiilor din zonă, le clasifică pe secțiuni și scrie un fișier JSON; site-ul e generat static din acel fișier.

Publicăm titlul, un rezumat scurt luat din feed și link către articolul original. Textul integral rămâne la publicația care l-a scris.

## Cum funcționează

```
config/sources.json  ──▶  scripts/collect.mjs  ──▶  data/articles.json  ──▶  next build  ──▶  out/
      (editezi tu)            (cron, 2h)              (commis în repo)         (static)      (Pages)
```

Nu există server, bază de date sau panou de administrare. Tot ce schimbi, schimbi în `config/sources.json`.

## Local

```bash
npm install
npm run collect      # trage feed-urile în data/articles.json
npm run dev          # http://localhost:3000
```

Fără `npm run collect`, site-ul afișează `data/articles.sample.json` — un set demonstrativ fictiv — și pune un avertisment în pagină.

`npm run collect -- --dry` arată ce ar colecta, fără să scrie nimic.

## Configurare

Tot în `config/sources.json`:

| cheie | ce face |
|---|---|
| `site` | numele publicației, localitatea, județul, contactul |
| `analytics.cloudflareToken` | token-ul de Cloudflare Web Analytics. Gol = nu se măsoară nimic |
| `sections` | secțiunile și cuvintele-cheie după care se clasifică articolele |
| `feeds` | lista de feed-uri RSS/Atom |
| `fallbackSection` | unde ajung articolele care nu potrivesc niciun cuvânt-cheie |
| `editorial` | linia editorială aplicată la colectare, plus textul afișat cititorului |
| `filters.requireAny` | filtru pentru sursele naționale: păstrează doar articolele care menționează orașul, județul, primarul etc. Sursele locale nu trec prin el |
| `filters.excludeAny` | ce se aruncă indiferent de sursă |
| `limits` | vechimea maximă, câte articole pe feed, câte în total |

### Clasificarea

Un articol primește secțiunea cu cele mai multe cuvinte-cheie potrivite. Potrivirea e pe **cuvânt întreg**, nu pe subșir — altfel `adi` ar prinde „tra**di**ția", iar `psd` orice cuvânt care îl conține.

Ce nu potrivește nimic ajunge în `fallbackSection`. Ține-o pe `diverse`: dacă o pui pe `local`, secțiunea Local se umple cu tot ce n-a fost clasificat și nu mai înseamnă nimic. Dacă „Diverse" crește prea mult, adaugă cuvinte-cheie în secțiunile de sus — asta e întreținerea normală a proiectului.

### Linia editorială

`editorial.protect` respinge la colectare articolele care leagă un subiect protejat de un semnal negativ. Filtrarea e pe cuvinte, deci greșește în ambele sensuri: aruncă uneori un articol neutru care conține din întâmplare „anchetă", și lasă să treacă o critică formulată fără cuvintele din listă. Nu e un filtru pe care să te bazezi ca fiind exact.

`editorial.disclosure` apare în subsolul site-ului. Dacă îl golești, filtrul rămâne activ dar cititorul nu mai află de el — iar site-ul se prezintă în continuare drept agregator. Numărul de articole respinse la ultima rulare stă în `data/articles.json`, în câmpul `editorialFiltered`.

Un feed arată așa:

```json
{ "name": "Gazeta de X", "url": "https://gazetadex.ro/feed/", "scope": "local", "section": "local" }
```

- `scope: "local"` — presă din zonă, intră fără filtru de relevanță
- `scope: "national"` — sursă mare, trece prin `filters.requireAny`
- `section` — secțiunea implicită, dacă niciun cuvânt-cheie nu se potrivește (opțional)

Cuvintele-cheie se scriu **fără diacritice**. Colectorul le elimină din ambele părți înainte să compare, deci `licitatie` prinde și `licitație`.

## Automatizare

- `.github/workflows/collect.yml` — la fiecare două ore: colectează, face commit dacă s-a schimbat ceva, apoi cheamă deploy-ul
- `.github/workflows/deploy.yml` — la fiecare push pe `main`: build static și publicare pe GitHub Pages

Ca să pornească, în repo: **Settings → Pages → Source: GitHub Actions**.

Pentru domeniu propriu, scoate `BASE_PATH` din `deploy.yml` și adaugă fișierul `CNAME` în `public/`.

## Trafic

GitHub Pages nu dă statistici de acces, iar „Insights → Traffic" din repo numără vizitele pe pagina de GitHub, nu pe site. Măsurarea se face cu Cloudflare Web Analytics: token-ul din *Manage site → JS snippet* stă în `config/sources.json` la `analytics.cloudflareToken`, iar `app/layout.tsx` îl pune în pagini la build.

Funcționează și cu înregistrările DNS pe „DNS only" — e un beacon în pagină, nu depinde de proxy-ul Cloudflare. Nu pune cookie-uri și nu reține date personale, deci site-ul nu are nevoie de banner de consimțământ. Cât timp token-ul e gol nu se încarcă niciun script.

## Dacă un editor cere retragerea

Scoate feed-ul din `config/sources.json` și fă push. Următoarea colectare curăță și articolele lui, pentru că fișierul se rescrie de la zero la fiecare rulare.

## Robustețe

- O sursă căzută nu oprește colectarea; apare cu „EROARE" în registrul din bara laterală.
- Dacă **toate** sursele pică, colectorul iese cu eroare și **nu** atinge `data/articles.json` — site-ul rămâne pe ultima colectare bună.
- Deduplicare după link și după titlu, ca aceeași știre preluată de trei publicații să apară o singură dată.
