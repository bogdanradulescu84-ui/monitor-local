# Buzău365 — identitate vizuală

**Cadranul.** Inelul este anul, cele 52 de liniuțe sunt săptămânile, punctul roșu este ziua în curs. Vine din coloana de ore de pe prima pagină a site-ului, îndoită în rotund — nu e o emblemă lipită peste produs, e un fragment din el.

## Cele două tăieturi

Marca are **două versiuni**, și asta nu e opțional.

| Fișier | Când se folosește |
|---|---|
| `mark.svg` | peste ~64 px: poză de profil, antet, tipar |
| `mark-small.svg` | sub ~64 px: favicon, avatar în comentarii, listă de grupuri |

La dimensiuni mici, cele 52 de liniuțe subțiri se strâng și inelul devine o pată gri. Tăietura mică are 12 liniuțe groase, radiale, și renunță la textul mărunt. **Nu micșora `mark.svg` sub 64 px** — folosește tăietura mică.

## Fișiere

| SVG | Ce e |
|---|---|
| `mark.svg` | marca completă, fond deschis |
| `mark-dark.svg` | marca completă, fond bleu-cerneală |
| `mark-small.svg` | tăietura pentru dimensiuni mici |
| `lockup.svg` | marcă + „Buzău365" + slogan, orizontal |
| `lockup-dark.svg` | idem, pe fond închis |
| `cover-page.svg` | copertă pagină Facebook, 820 × 312 |
| `cover-group.svg` | copertă grup Facebook, 1640 × 856 |

PNG-urile exportate stau în `png/`. Cele pentru Facebook sunt gata dimensionate:

- `fb-profil-1000.png` — poză de profil, pagină și grup
- `fb-coperta-pagina-820x312.png`
- `fb-coperta-grup-1640x856.png`

Faviconul site-ului e legat din `app/icon.png` și `app/apple-icon.png`, copiate din `png/`.

## Culori

| | hex | unde |
|---|---|---|
| Bleu-cerneală | `#16263F` | fond închis, linii, cifre |
| Roșu de ștampilă | `#A8231D` | punctul, filetul — pe fond deschis |
| Roșu deschis | `#E0554D` | aceleași, pe fond închis |
| Hârtie | `#F7F7F4` | fond deschis |
| Gri-bleu | `#9FAEC4` | text secundar pe fond închis |

Aceleași valori ca tokenii din `app/globals.css`. Dacă schimbi paleta acolo, schimb-o și aici.

## Tipografie

- cifrele și numele: **Iowan Old Style** (macOS), cu Palatino și Georgia ca rezerve
- textul mărunt: font monospațiat de sistem

Literele sunt text viu în SVG, nu contururi. Pe un calculator fără Iowan Old Style, cifrele cad pe Palatino și arată puțin altfel. Pentru orice livrare în afară — tipografie, agenție, colaborator — **trimite PNG-urile**, nu SVG-urile.

## Regenerare

```bash
cd brand && python3 export.py
```

Rescrie tot ce e în `png/` și verifică fiecare dimensiune. Rulează doar pe macOS: folosește `qlmanage` pentru randare și `crop.py` pentru tăiere. Motivele acestor ocolișuri sunt explicate în capul celor două fișiere — pe scurt, `qlmanage` deformează SVG-urile nepătrate, iar `sips -c` rescalează în loc să decupeze.

## De reținut

- Punctul roșu stă **la ora douăsprezece**, întotdeauna. Acolo e „azi".
- Nu modifica `stroke-dasharray` fără să recalculezi perioada din circumferință, altfel apare o liniuță parțială la îmbinarea inelului.
- Pe fond închis se folosește `#E0554D`, nu `#A8231D` — roșul închis nu are contrast suficient pe bleu.
