# Postare automată pe Facebook + prioritizare editorială

Design aprobat, 26 iulie 2026.

## Ce rezolvă

Postarea zilnică de promovare există deja: `scripts/digest.mjs` o compune, `digest.yml`
o pune într-un issue la 06:10 UTC, proprietarul o publică pe Facebook prin copy-paste.
Ultimul pas cere om în fiecare zi. Îl eliminăm.

În aceeași lucrare intră două schimbări editoriale cerute odată cu automatizarea și
opt feed-uri noi.

## Ce NU intră (proiecte separate)

- **Arvow scrie textul postării** — cere plan Agency. Se așază peste designul ăsta
  fără să-l rescrie: se schimbă doar sursa textului, nu traseul lui.
- **Secțiune de articole originale pe site** — schimbă natura proiectului din agregator
  în publisher și contrazice regula de copyright din `CLAUDE.md`. Discuție separată.
- **buzau.net ca sursă** — nu are RSS (404 pe toate căile standard). Ar cere scraping.

---

## Arhitectură

```
config/sources.json ─▶ collect.mjs ─▶ data/articles.json ─▶ digest.mjs ─┬─▶ issue (chitanță)
   reguli editoriale     aplică         articole + steag              └─▶ Make ─▶ pagina FB
                         regulile        "prioritar"
```

Nimic nou între colectare și publicare. Se adaugă un singur consumator al textului
deja compus.

### De ce Make și nu Blotato sau API-ul Meta

Toate trei fac același lucru: dețin o aplicație aprobată de Meta și îți permit să
postezi fără să treci tu prin *app review*. Diferă doar prețul.

| | Cost anual | Efort inițial |
|---|---|---|
| **Make** (ales) | 0 lei — planul Free al proprietarului | login Facebook, ~10 min |
| Blotato | ~1.500 lei ($29/lună; API blocat în trial) | login Facebook, ~10 min |
| API Meta direct | 0 lei | app review + verificare business, săptămâni |

Consum estimat: 30-60 operațiuni/lună din 1.000 disponibile.

### Rolul lui Make e deliberat minim

Make **nu** citește feed-uri, **nu** compune text, **nu** decide nimic. Primește un
text gata făcut și îl pune pe pagină.

Motivul: dacă Make ar citi singur RSS-urile, ar ocoli complet regulile editoriale, care
trăiesc în `collect.mjs` și `config/sources.json`. Orice decizie rămâne în repo, unde
poate fi citită și modificată. Make e poștaș, nu redactor.

### Scenariul Make

Trei module:

1. **Webhook (custom)** — primește `POST` cu `{ "text": "..." }`. URL-ul generat de Make
   este un secret: cine îl are poate posta pe pagină. Se regenerează din Make dacă scapă.
2. **Facebook Pages → Create a Post** — pagina se alege o singură dată, la crearea
   conexiunii, dintr-o listă derulantă. Rămâne salvată în scenariu. GitHub nu trimite și
   nu cunoaște identitatea paginii.
3. **Webhook response** — obligatoriu, nu opţional.

**De ce al treilea modul.** Un webhook Make răspunde implicit `Accepted` în clipa în care
primeşte cererea, înainte să ruleze scenariul. Fără modulul de răspuns, GitHub ar primi
confirmare şi ar considera postarea reuşită chiar dacă Facebook a respins-o imediat după.
Alertarea ar acoperi doar căderile de reţea până la Make — adică exact cazul cel mai puţin
probabil — şi ar rata tăcut refuzurile Facebook, token-ul expirat sau conexiunea revocată.
Modulul de răspuns întoarce rezultatul real, iar workflow-ul îl verifică.

---

## Modificări în repo

### `config/sources.json`

Blocul `editorial` devine simetric. Lista de subiecte PSD este una singură și
servește ambele reguli.

```
editorial
├── disclosure          (gol azi — vezi „Riscuri asumate")
├── protect
│   ├── subjects        PSD + variante
│   └── negativeCues    lista existentă, nemodificată
└── promote
    ├── against
    │   ├── subjects    usr, uniunea salvati romania, pnl,
    │   │               partidul national liberal,
    │   │               alianta pentru unirea romanilor
    │   └── subjectsUpper   ["AUR"]  — vezi mai jos
    └── for
        ├── subjects    (gol = refoloseşte protect.subjects, adică PSD)
        └── positiveCues
```

Când `promote.against.negativeCues` lipsește, se refolosește `protect.negativeCues`.
Un singur loc de întreținut: un cuvânt adăugat mâine lucrează în ambele sensuri.

`positiveCues` de pornire: `inaugurat`, `investitie`, `finantare`, `fonduri europene`,
`modernizare`, `reabilitat`, `contract semnat`, `lucrari`, `aprobat`, `alocat`,
`castigat`, `premiat`, `record`, `sprijin`, `deschis`.

**`subjectsUpper` — de ce există.** Potrivirea se face pe cuvânt întreg, tocmai ca să nu
se repete bug-ul cu „adi" din „tradiția". Aici nu ajută: *aur* este cuvânt întreg în
română. „Medalie de aur", „furt de bijuterii din aur", „cotația aurului" ar fi urcate ca
atacuri la adresa partidului AUR — iar cu semnalele negative în listă, „hoț condamnat
pentru furt de aur" ar ajunge în capul postării zilnice.

Soluție: partidul se potrivește prin numele complet (`alianta pentru unirea romanilor`)
sau prin `AUR` **verificat pe titlul original, cu majuscule**, înainte de normalizare.
Partidul se scrie AUR, metalul se scrie aur. `USR` și `PNL` nu au problema asta.

### `scripts/collect.mjs`

- `makePromoteFilter(editorial)`, simetric cu `makeEditorialFilter`. Întoarce `true` când
  articolul leagă un subiect vizat de un semnal, în oricare dintre cele două direcții.
- Fiecare articol primeşte câmpul `promoted: boolean` în `data/articles.json`.
- Sortarea de la linia 290 devine: **prioritare întâi, dar numai în ultimele 24 de ore**,
  apoi cronologic. Motivul e în „Interacţiunea cu designul site-ului".
- Raportul de colectare numără articolele urcate, cum numără azi cele filtrate. Fără
  numărător nu se vede dacă o regulă prinde prea mult sau nimic.

**Ordinea contează şi e o proprietate de siguranţă.** `protect` rulează înaintea
prioritizării. Un articol de tip „proiectul finanţat de PSD, un eşec" conţine şi cuvânt
pozitiv, şi cuvânt negativ — dar e aruncat de `protect` înainte ca regula de urcare
să-l vadă. Nu se poate urca accidental o ştire negativă fiindcă avea „finanţare" în titlu.

### `lib/articles.ts`

Câmpul `promoted` se adaugă în tipul `Article`. Altfel `data/articles.json` capătă o cheie
pe care partea de site n-o cunoaşte, iar sortarea nouă nu poate fi folosită la randare fără
să iasă o eroare de tip la build.

### `scripts/digest.mjs`

- Opţiunea `--raw`: scoate doar textul postării, fără ambalajul markdown pentru citit.
  Compunerea rămâne într-un singur loc; workflow-ul nu duplică logica.
- `rank()` primeşte un nivel pentru articolele prioritare, deasupra criteriului de secţiune.
- **Verificare de prospeţime:** dacă `generatedAt` e mai vechi de 26 de ore, iese cu cod
  distinct şi nu produce text. Vezi „Ziua în care toate sursele pică".

### `.github/workflows/digest.yml`

Paşi noi după compunere: trimite textul la webhook-ul Make; o reîncercare după un minut;
la eşec deschide issue şi trimite pe Telegram. Issue-ul zilnic rămâne, cu rol schimbat:
din „copiază de aici" devine chitanţă — ce a plecat şi când.

### Feed-uri noi în `config/sources.json`

Toate verificate pe 26 iulie 2026.

| Sursă | Feed | scope |
|---|---|---|
| Observatorul Buzoian | `https://www.observatorulbuzoian.ro/feed/` | local |
| Digi24 | `https://www.digi24.ro/rss` | national |
| Ştiri pe surse | `https://www.stiripesurse.ro/feed/` | national |
| DC News | `https://www.dcnews.ro/feed/` | national |
| Antena 3 | `https://www.antena3.ro/feed/` | national |
| HotNews | `https://hotnews.ro/feed/` | national |
| Recorder | `https://recorder.ro/feed/` | national |

Cele naţionale trec prin `filters.requireAny` existent (`buzau`, `buzoian`,
`ramnicu sarat`, `nehoiu`). Din ~366 de articole pe rulare vor trece probabil 0-3 pe zi.
Recorder publică rar şi aproape niciodată despre Buzău; poate să nu aducă nimic luni
întregi, şi nu costă nimic.

`limits.maxTotal` e 120, iar sursele locale produc ~76. Dacă vreodată ştirile locale
încep să dispară de pe site, ăsta e motivul şi se ridică limita.

**Buzoienii:** eroarea `HTTP 403` din colectarea de pe 25 iulie a fost trecătoare. Feed-ul
răspunde `200` inclusiv cu user-agentul actual al colectorului. Nu e nimic de reparat.

### `CLAUDE.md` şi `README.md`

`CLAUDE.md` afirmă azi că proiectul funcţionează „fără token-uri de reţele sociale şi fără
servicii externe". Devine fals şi trebuie corectat.

Nu e birocraţie: dacă rămâne scris acolo, o sesiune viitoare va citi afirmaţia, va deduce
că integrarea Make e o greşeală şi o va „repara" scoţând-o.

---

## Interacţiunea cu designul site-ului

`CLAUDE.md` notează că **coloana de ore din stânga fluxului nu e decorativă** — ştirea
locală se organizează după *când*.

Prioritatea absolută ar strica-o: un articol de acum trei zile ar sta deasupra celor de
azi, cu orele sărind înapoi. De aceea prioritarele urcă **doar în interiorul ultimelor
24 de ore**. Ce e proaspăt şi loveşte ajunge sus; ce e vechi rămâne la locul lui cronologic.

Dacă se decide vreodată prioritate absolută indiferent de vechime, coloana de ore nu mai
înseamnă nimic şi ar trebui scoasă — altă discuţie, altă lucrare.

---

## Comportament la eroare

**Ziua în care toate sursele pică.** Colectorul iese cu eroare şi nu scrie
`data/articles.json`; site-ul rămâne pe ultima colectare bună. Corect pentru site, capcană
pentru postare: digestul ar citi datele de ieri şi ar publica aceleaşi 6 ştiri a doua zi.
Azi nu se întâmplă pentru că un om se uită la issue înainte de copy-paste. Automat, nu se
mai uită nimeni. De aceea verificarea de 26 de ore: mai bine o zi fără postare decât o
postare cu ştirile de ieri.

**Nu sunt ştiri.** Deja tratat: `digest.mjs` iese curat când nu are ce posta. Nu se publică
„nimic nou azi".

**Make sau Facebook nu răspund.** O reîncercare după un minut. Apoi Telegram + issue, cu
textul întreg, pentru publicare manuală.

**Postare dublă.** Dacă workflow-ul e pornit manual în aceeaşi zi în care a rulat şi
programat, ies două postări identice. Nerezolvat intenţionat: ar cere memorarea a ceea ce
s-a publicat, complexitate pentru un caz care apare doar la apăsarea unui buton, cu remediu
imediat (ştergi postarea).

## Secrete

În GitHub secrets pe repo, niciodată în fişiere:

| Secret | Ce e |
|---|---|
| `MAKE_WEBHOOK_URL` | adresa unică de la Make; funcţionează ca parolă |
| `TELEGRAM_BOT_TOKEN` | de la `@BotFather` |
| `TELEGRAM_CHAT_ID` | destinatarul alertelor |

Acestea sunt primele secrete din proiect; până acum nu avea niciunul.

## Testare

`workflow_dispatch` rămâne activ: prima rulare se face manual şi se verifică rezultatul pe
pagină înainte de a lăsa cron-ul să lucreze. O postare greşită se şterge de pe Facebook în
câteva secunde.

Pentru regulile editoriale, verificarea utilă e numărătorul din raportul de colectare, pe
câteva zile: câte articole urcă efectiv şi dacă sunt cele aşteptate.

---

## Riscuri asumate

Consemnate pentru că sunt decizii, nu scăpări. Ambele au fost semnalate şi acceptate
explicit de proprietar pe 26 iulie 2026.

**1. `disclosure` rămâne gol.** Cu PSD protejat de acoperire negativă şi urcat pe cea
pozitivă, iar USR, PNL şi AUR urcate pe acoperire negativă, site-ul are linie politică,
deşi se prezintă drept „Presa buzoiană, într-un singur loc". Câmpul `disclosure` există în
config exact pentru acest caz şi este gol. Completarea lui rămâne o modificare de config,
disponibilă oricând.

**2. Acuzaţiile penale se auto-publică.** Prioritizarea urcă articolele care leagă un
partid vizat de semnale precum `dosar penal`, `condamnat`, `inculpat`, `DNA`, `mita`,
`frauda`. Combinat cu publicarea complet automată, sistemul va trimite zilnic pe pagină, fără
ca cineva să fi citit, cel mai acuzator material apărut în presa locală despre USR, PNL sau
AUR — selectat tocmai pentru că e cel mai acuzator.

Dacă o sursă publică o acuzaţie nefondată, postarea automată o amplifică sub numele
proprietarului. În dreptul românesc, cel care redistribuie o afirmaţie defăimătoare poate
răspunde alături de autor. Riscul nu exista înainte de această lucrare: până acum urcau
ştirile *importante*, de acum urcă cele *acuzatoare*.

A fost propusă o variantă intermediară — acuzaţiile penale urcă pe site, dar intră în postare
doar cu confirmare printr-o etichetă pe issue, de pe telefon. A fost respinsă în favoarea
automatizării complete. Rămâne disponibilă dacă decizia se schimbă: e o ramificaţie în
`digest.mjs`, nu o rescriere.
