# Buzău365 — context pentru sesiunile Claude

Agregator de presă. Static, fără server și fără bază de date.

**Din 26 iulie 2026 nu mai e strict buzoian.** A fost, până atunci. Proprietarul a
cerut explicit adăugarea presei centrale și a sportului, ca să aibă ce posta pe
Facebook de două ori pe zi. Nu e derivă, e decizie — nu „repara" înapoi.

Ce s-a păstrat din vechea identitate: **secțiunile locale rămân despre Buzău.**
Politica națională nu intră în „Politică", ci în „Național"; sportul are secțiunea
lui. Așa, „Administrație" înseamnă în continuare administrație buzoiană. Coșul
`buzau` n-are plafon, celelalte au — presa centrală aduce de cinci ori mai multe
articole decât cea locală și ar îneca-o.

Sloganul din `config/sources.json → site.tagline` spune încă „Presa buzoiană,
într-un singur loc". Nu mai e exact adevărat. E o singură cheie de config.

## Cum funcționează

```
config/sources.json  ──▶  scripts/collect.mjs  ──▶  data/articles.json  ──▶  next build  ──▶  Pages
```

Citește `README.md` pentru detalii. Regula de aur: **tot ce se configurează stă în `config/sources.json`**. Dacă ceva pare că cere cod nou, verifică întâi dacă nu e o cheie de config.

## Ce trebuie știut înainte de orice modificare

- **Agregăm, nu republicăm — dar asta se referă la textele ALTORA.** Din presa preluată se păstrează titlul, rezumatul din feed și link către sursă; nu construi pagini cu textul integral al altcuiva, e problemă de drepturi de autor, nu preferință de design.
- **Conținutul propriu e altceva și e permis.** „Articolul Casei” (`content/articole/`, `lib/articole.ts`, `/articol/[slug]`) sunt texte scrise de publicație. Acolo nu există problemă de copyright, fiindcă autorul e chiar publicația. **Nu șterge secțiunea crezând că încalcă regula de mai sus** — sunt două cazuri diferite, iar confuzia dintre ele e exact motivul pentru care regula e scrisă acum în două rânduri.
- **Articolele proprii au antet JSON, nu YAML, iar corpul e text simplu, nu markdown.** Deliberat: nu merită două dependințe noi pentru texte de zece paragrafe. Dacă apar subtitluri, liste sau link-uri în corp, atunci se pune un parser adevărat.
- **`params` e promisiune în rutele dinamice** (`/articol/[slug]`, `/c/[cat]`). Fără `await`, pagina se generează tăcut ca 404: fișierul există, are dimensiune normală, dar înăuntru e 404-ul. S-a întâmplat la prima versiune a paginii de articol. Verifică *conținutul* fișierului generat, nu doar existența lui.
- **Linia editorială e în `config/sources.json` → `editorial`.** E o decizie asumată a proprietarului. Respectă-o și păstreaz-o în config, nu o muta în cod. Are două părți: `protect` respinge articole, `promote` le urcă. `protect` rulează primul — un articol respins nu mai poate fi urcat.
- **Potrivirea cuvintelor-cheie e pe cuvânt întreg** (`hasWord` în `collect.mjs`). A fost pe subșir și clasa greșit: `adi` se regăsea în „tradiția". Nu reveni la `includes()`.
- **`AUR` se potrivește doar cu majuscule, pe titlul original** (`hasUpperWord`). *Aur* e cuvânt întreg în română, deci potrivirea obișnuită ar urca „medalie de aur" sau „furt de bijuterii din aur" ca atac la adresa partidului. Titlurile scrise integral cu majuscule sunt sărite, acolo distincția nu există. Nu simplifica la `hasWord`.
- **Prioritizarea urcă articolele doar din ultimele 24h** (`orderWithPromoted`). Altfel coloana de ore din flux ar arăta ore care sar înapoi. Vezi secțiunea Design.
- **`fallbackSection` e `diverse`, intenționat.** Pe `local`, secțiunea Local se umple cu tot ce n-a fost clasificat (au fost 85 din 96) și nu mai înseamnă nimic.
- **Dacă toate sursele pică, colectorul iese cu eroare și NU scrie `data/articles.json`.** Site-ul rămâne pe ultima colectare bună. Nu „repara" asta scriind un fișier gol.
- **Coșurile (`bucket`) nu sunt același lucru cu secțiunile.** Coșul spune ce fel de știre e — `buzau`, `tara`, `sport` — și decide cotele postării și plafoanele. Secțiunea spune unde apare pe site. Un articol Digi24 despre Buzău are coșul `buzau` și se clasifică normal, într-o secțiune locală.
- **Postarea se face de două ori pe zi, iar ferestrele acoperă intervalul dintre postări plus o oră** (14h dimineața pentru un interval de 13h, 12h seara pentru 11h). Marja există pentru că ora de rulare e aproximativă. Ele sunt singurul lucru care ține postarea de seară să n-o repete pe cea de dimineață — nu există niciun fișier cu ce s-a publicat deja. Dacă muți orele din `digest.yml`, mută și ferestrele.
- **Coroborarea urcă subiectele scrise de mai multe ziare** (`grupeazaSubiecte`). Când trei ziare relatează același eveniment, articolele se comasează într-unul singur, se păstrează cel mai recent, iar numărul publicațiilor devine `coverage`. Rezolvă și o problemă veche: deduplicarea prindea doar titlurile identice, deci aceeași știre apărea de trei ori pe site.
- **Coșul primează în fața coroborării la ordonarea fluxului.** Scorul NU e comparabil între coșuri: cele trei ziare sportive scriu toate despre aceleași meciuri, deci fiecare meci are scor 2-3, în timp ce ziarele buzoiene scriu fiecare despre altceva. Fără separare, prima pagină se deschidea cu patru știri despre Gigi Becali. Singura excepție sunt prioritarele editoriale, care trec înaintea coșurilor — sunt rare și cerute explicit.
- **Coroborarea urcă doar în ultimele 24h.** Un subiect de acum patru zile scris de două ziare nu trece înaintea știrii de azi. Peste 24h se cade pe cronologic.
- **Postarea de prânz compară încadrări, și e restrânsă la coșul `tara`** (`compara.mjs`). Nu din preferință editorială, ci din măsurătoare: gruparea subiectelor merge bine unde titlurile au nume proprii rare (Grindeanu, Cîrpaci, Cernavodă) și greșește des pe presa buzoiană, unde anunțurile primăriilor au formulări identice — ședința Consiliului Local Buzău se lipea de cea din comuna Vadu Pașii. Aproape jumătate din grupurile locale erau greșite, față de aproape niciunul dintre cele naționale. Pentru o postare care spune „uite cum au titrat diferit același eveniment", o grupare greșită nu e o imprecizie, e o dezmințire publică.
- **`compara.maxSuprapunere` există ca să nu publicăm cartonașe fără miez.** Dacă cele două titluri seamănă prea mult, nu e comparație, ci aceeași știre spusă la fel. Calibrat pe date reale: 20% la o pereche bună, 83% și 91% la perechi inutile.
- **Extragerea automată a fragmentului scurt care diferențiază două titluri NU funcționează.** A fost încercată („cea mai lungă bucată de cuvinte prezente într-un titlu și absente din celălalt") și scoate lucruri fără sens: „impostorii ăștia! Vreți", „explica celor", „spune". O singură încercare din șase era utilă. De aceea cartonașul citează titlurile întregi. Nu reîncerca fără un model de limbaj.
- **`pick()` din `digest.mjs` face două treceri.** Prima ține la diversitatea surselor, a doua completează cota dacă n-are de unde. Există pentru că presa buzoiană e concentrată: în 14 ore publică două-trei ziare, iar cu o singură trecere cota de 6 nu s-ar umple aproape niciodată.

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
| `digest.yml` | 05:30, 08:20 și 16:30 UTC | compune postarea, o trimite pe pagina de Facebook prin Make și deschide un issue cu ce a plecat. La prânz rulează `compara.mjs`, în rest `digest.mjs` |

**Proiectul are de acum un serviciu extern și secrete.** Până la 26 iulie 2026 nu avea
niciunul, iar documentația spunea asta explicit. Postarea pe Facebook se face prin Make
(plan gratuit), care deține conexiunea cu pagina.

Două secrete în GitHub, ambele adrese de webhook Make: `MAKE_WEBHOOK_URL` (postarea) și
`TELEGRAM_WEBHOOK_URL` (alertele). Al doilea trimite către un scenariu Telegram care
exista deja în contul proprietarului — de aceea nu e niciun token de bot pe undeva.
Ambele adrese funcționează ca parole: cine le are poate posta pe pagină. Se regenerează
din Make dacă scapă.

Make e doar poștaș: nu citește feed-uri și nu compune text, tocmai ca regulile editoriale
să rămână în repo. Designul complet:
`docs/superpowers/specs/2026-07-26-postare-automata-facebook-design.md`.

`digest.mjs` nu produce text dacă ultima colectare e mai veche de 26 de ore (iese cu cod 3).
Fără asta, o zi în care toate sursele pică ar duce la republicarea titlurilor de ieri.

**Orele programate sunt aproximative.** GitHub tratează `schedule` ca „nu mai devreme de",
nu „exact atunci". Pe 27 iulie 2026 postarea de la 06:10 a plecat la 06:58, iar colectarea
programată la :07 a rulat la 03:57, 06:56, 11:35. De aceea ora e trasă mai devreme decât
ținta reală, iar ferestrele au o oră de marjă. Nu „repara" mutând ora înapoi la fix.

## Decizii deschise (28 iulie 2026)

Lucruri discutate cu proprietarul, neîncheiate. Nu le decide singur.

- [ ] **Secțiunea de comparare a încadrărilor.** Aceeași știre, cum au titrat mai multe ziare. Format ales: o întrebare construită din două citate reale, de forma „«Obiect luminos» sau «prima dronă doborâtă pe teritoriul României»?". Fără etichete pe publicații, fără judecăți. **Interzis** în text: „toate unghiurile", „complet", „nefiltrat" — sunt afirmații verificabile pe care secțiunea nu le poate susține, fiindcă moștenește filtrul `protect`. „Concluzia e a ta" e în regulă: invită, nu promite. Partea nerezolvată e extragerea automată a fragmentului scurt care face diferența dintre două titluri; ideea de testat e „cea mai lungă bucată de cuvinte prezente într-un titlu și absente din celălalt", de probat pe 20-30 de grupuri înainte de a construi ceva.
- [ ] **Repo-ul e public**, deci `editorial.protect` și `editorial.promote` sunt vizibile oricui, iar `disclosure` e gol. Proprietarul știe. Ieșiri discutate: o frază în subsol, plan plătit pentru repo privat, sau lăsat așa. Nu insista — a fost semnalat de trei ori.
- [ ] **`site.tagline`** spune „Presa buzoiană, într-un singur loc", dar site-ul are acum sport și politică națională.
- [ ] **Regulile editoriale prind numele partidelor, nu ale oamenilor.** Presa locală scrie despre persoane: un articol despre Marcel Ciolacu nu conține „PSD" și deci nu e urcat. Proprietarul urmează să dea lista de nume; se adaugă în `protect.subjects`, care servește ambele reguli.
- [x] **Întârzierea GitHub e acceptată.** Postările au plecat la 09:58 și 21:07 în loc de 09:10 și 19:30. Proprietarul a zis „accept așa cum este" pe 27 iulie. Nu propune ceasuri externe decât dacă redeschide el subiectul.

## Rămas de făcut

- [ ] **Domeniul `buzau365.ro`**: DNS-ul e la Cloudflare (nameservere `alexandra`/`wilson`, A-uri către GitHub Pages, toate „DNS only"). Când delegarea `.ro` e publică: adaugă `public/CNAME` cu `buzau365.ro`, scoate `BASE_PATH` din `deploy.yml`, apoi `gh api -X PUT repos/bogdanradulescu84-ui/monitor-local/pages -f cname=buzau365.ro`.
- [x] **Traficul se măsoară**: Cloudflare Web Analytics, token în `config/sources.json` → `analytics.cloudflareToken`, script injectat din `app/layout.tsx`. Datele se văd în Cloudflare → *Analytics & Logs* → *Web Analytics*.
- [ ] `contact@buzau365.ro` — de activat prin Cloudflare Email Routing. Adresa e deja afișată pe site, dar încă nu există.
- [ ] Titlurile preluate din Facebook vin cu litere Unicode „bold" (𝐁𝐮𝐳𝐚̆𝐮) și arată prost în serif. De normalizat în `collect.mjs`.
- [ ] „Diverse" ține majoritatea articolelor. Se reduce adăugând cuvinte-cheie în secțiunile din config, nu schimbând clasificatorul.

## Preferințele proprietarului

Lucrează mult de pe telefon, prin aplicația GitHub. Preferă lucruri mici care funcționează, în locul soluțiilor deștepte. Repo-ul e sursa de adevăr — ce nu e commis nu există.
