#!/usr/bin/env python3
"""Regenerează toate PNG-urile din SVG-urile din acest folder.

    cd brand && python3 export.py

Lanțul: `qlmanage` randează SVG-ul cu motorul WebKit al macOS — deci exact ca
în Safari, cu fontul Iowan Old Style instalat în sistem — iar `crop.py` taie
pânza la dimensiunea reală.

Două ocolișuri, ambele impuse de comportamentul lui qlmanage:

1. Pentru un SVG nepătrat, qlmanage scalează desenul ca să umple pânza
   pătrată de ieșire, adică îl deformează ca poziție și mărime. Ocolire:
   împachetăm desenul într-o pânză pătrată, în colțul stânga-sus, unde
   scalarea e obligatoriu 1:1, apoi tăiem.
2. `sips -c` rescalează în loc să decupeze, deci nu poate fi folosit pentru
   dimensiunile fixe cerute de Facebook. De aici crop.py.

Rulează doar pe macOS. Pe alt sistem, înlocuiește qlmanage cu rsvg-convert
sau cu un Chrome headless și păstrează restul.
"""

import pathlib
import shutil
import struct
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
PNG = HERE / "png"

# (svg, lățime, înălțime, nume-ieșire) — înălțime None înseamnă pătrat
JOBS = [
    ("mark.svg",        1000, None, "fb-profil-1000.png"),
    ("mark.svg",         512, None, "mark-512.png"),
    ("mark-dark.svg",    512, None, "mark-dark-512.png"),
    ("mark-small.svg",   512, None, "favicon-512.png"),
    ("mark-small.svg",   180, None, "apple-touch-180.png"),
    ("mark-small.svg",    32, None, "favicon-32.png"),
    ("lockup.svg",      1120,  320, "lockup-1120x320.png"),
    ("lockup-dark.svg", 1120,  320, "lockup-dark-1120x320.png"),
    ("cover-page.svg",   820,  312, "fb-coperta-pagina-820x312.png"),
    ("cover-group.svg", 1640,  856, "fb-coperta-grup-1640x856.png"),
]


def squarify(svg_path: pathlib.Path, w: int, h: int, dest: pathlib.Path) -> pathlib.Path:
    """Același desen, în colțul unei pânze pătrate."""
    src = svg_path.read_text()
    inner = src.split(">", 1)[1].rsplit("</svg>", 1)[0]
    side = max(w, h)
    dest.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{side}" height="{side}" viewBox="0 0 {side} {side}">\n'
        f'<rect width="{side}" height="{side}" fill="#FFFFFF"/>\n'
        f'<svg x="0" y="0" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{inner}</svg>\n</svg>\n'
    )
    return dest


def render(svg: pathlib.Path, size: int, out: pathlib.Path):
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(
            ["qlmanage", "-t", "-s", str(size), "-o", tmp, str(svg)],
            capture_output=True, check=False,
        )
        produced = pathlib.Path(tmp) / f"{svg.name}.png"
        if not produced.exists():
            raise SystemExit(f"qlmanage nu a randat {svg.name}")
        shutil.copy(produced, out)


def dims(p: pathlib.Path):
    return struct.unpack(">II", p.read_bytes()[16:24])


def main():
    PNG.mkdir(exist_ok=True)
    for old in PNG.glob("*.png"):
        old.unlink()

    ok = True
    with tempfile.TemporaryDirectory() as work:
        for svg_name, w, h, out_name in JOBS:
            svg = HERE / svg_name
            out = PNG / out_name
            if h is None:
                render(svg, w, out)
                want = (w, w)
            else:
                sq = squarify(svg, w, h, pathlib.Path(work) / f"sq-{out_name}.svg")
                render(sq, max(w, h), out)
                subprocess.run([sys.executable, str(HERE / "crop.py"), str(out), str(w), str(h)],
                               capture_output=True, check=True)
                want = (w, h)

            got = dims(out)
            mark = "OK " if got == want else "GREȘIT"
            if got != want:
                ok = False
            print(f"{mark} {out_name:32} {got[0]:>5} x {got[1]:<5}")

    print("\nToate dimensiunile corecte." if ok else "\nAtenție: dimensiuni greșite mai sus.")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
