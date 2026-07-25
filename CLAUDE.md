# Buzău365 — context pentru sesiunile Claude

Agregator de presă locală din Buzău. Static, fără server și fără bază de date.

## Cum funcționează

```
config/sources.json  ──▶  scripts/collect.mjs  ──▶  data/articles.json  ──▶  next build  ──▶  Pages
```

Citește `README.md` pentru detalii. Regula de aur: **tot ce se configurează stă în `config/sources.json`**. Dacă ceva pare că cere cod nou, verifică întâi dacă nu e o cheie de config.

## Ce trebuie știut înainte de orice modificare

- **Agregăm, nu republicăm.** Titlu, rezumatul din feed, link către sursă. Nu adăuga pagini de articol cu text integral — e problemă de drepturi de autor, nu preferință de design.
- **Linia editorială e în `config/sources.json` → `editorial`.** E o decizie asumată a proprietarului. Respectă-o și păstreaz-o în config, nu o muta în cod.
- **Potrivirea cuvintelor-cheie e pe cuvânt întreg** (`hasWord` în `collect.mjs`). A fost pe subșir și clasa greșit: `adi` se regăsea în „tradiția". Nu reveni la `includes()`.
- **`fallbackSection` e `diverse`, intenționat.** Pe `local`, secțiunea Local se umple cu tot ce n-a fost clasificat (au fost 85 din 96) și nu mai înseamnă nimic.
- **Dacă toate sursele pică, colectorul iese cu eroare și NU scrie `data/articles.json`.** Site-ul rămâne pe ultima colectare bună. Nu „repara" asta scriind un fișier gol.

## Design

Portat dintr-un prototip aprobat. Elementele care nu sunt decorative:

- coloana de ore din stânga fluxului — știrea locală se organizează după *când*
- bara laterală arată ca un registru administrativ, nu ca un widget
- bleu-cerneală + roșu de ștampilă, temă dublă prin tokens în `app/globals.css`
- figurile sunt desenate pe canvas când feed-ul nu dă imagine, ca să nu apară fotografii false

## Automatizări

| Workflow | Când | Ce face |
|---|---|---|
| `collect.yml` | la 2 ore | trage feed-urile, commit dacă s-a schimbat ceva, cheamă deploy |
| `deploy.yml` | push pe main | build static, publicare pe Pages |
| `digest.yml` | zilnic 06:10 UTC | deschide un issue cu postarea zilei, pentru promovare manuală |

## Rămas de făcut

- [ ] **Domeniul `buzau365.ro`**: DNS-ul e la Cloudflare (nameservere `alexandra`/`wilson`, A-uri către GitHub Pages, toate „DNS only"). Când delegarea `.ro` e publică: adaugă `public/CNAME` cu `buzau365.ro`, scoate `BASE_PATH` din `deploy.yml`, apoi `gh api -X PUT repos/bogdanradulescu84-ui/monitor-local/pages -f cname=buzau365.ro`.
- [ ] `contact@buzau365.ro` — de activat prin Cloudflare Email Routing. Adresa e deja afișată pe site, dar încă nu există.
- [ ] Titlurile preluate din Facebook vin cu litere Unicode „bold" (𝐁𝐮𝐳𝐚̆𝐮) și arată prost în serif. De normalizat în `collect.mjs`.
- [ ] „Diverse" ține majoritatea articolelor. Se reduce adăugând cuvinte-cheie în secțiunile din config, nu schimbând clasificatorul.

## Preferințele proprietarului

Lucrează mult de pe telefon, prin aplicația GitHub. Preferă lucruri mici care funcționează, în locul soluțiilor deștepte. Repo-ul e sursa de adevăr — ce nu e commis nu există.
