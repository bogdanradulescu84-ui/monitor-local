#!/usr/bin/env python3
"""Decupează un PNG din colțul stânga-sus, la dimensiuni exacte.

Există fiindcă lanțul de export de pe macOS nu oferă nimic de încredere:
`qlmanage` randează SVG-ul la scară 1:1 în colțul unei pânze pătrate, iar
`sips -c` rescalează imaginea în loc s-o decupeze. Coperțile de Facebook au
dimensiuni fixe, deci aproximările nu sunt acceptabile.

    python3 crop.py fisier.png 820 312
"""

import struct
import sys
import zlib

PNG_SIG = b"\x89PNG\r\n\x1a\n"
CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}


def read_chunks(data):
    assert data[:8] == PNG_SIG, "nu e PNG"
    pos = 8
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        ctype = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        yield ctype, body
        pos += 12 + length


def chunk(ctype, body):
    return struct.pack(">I", len(body)) + ctype + body + struct.pack(">I", zlib.crc32(ctype + body) & 0xFFFFFFFF)


def unfilter(raw, width, height, bpp):
    """Inversează filtrele PNG pe scanlinii, ca să obținem pixeli bruți."""
    stride = width * bpp
    out = bytearray()
    prev = bytearray(stride)
    pos = 0
    for _ in range(height):
        ftype = raw[pos]
        line = bytearray(raw[pos + 1:pos + 1 + stride])
        pos += 1 + stride
        if ftype == 1:
            for i in range(bpp, stride):
                line[i] = (line[i] + line[i - bpp]) & 0xFF
        elif ftype == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ftype == 3:
            for i in range(stride):
                left = line[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        elif ftype != 0:
            raise ValueError(f"filtru necunoscut: {ftype}")
        out += line
        prev = line
    return bytes(out), stride


def main():
    path, want_w, want_h = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    data = open(path, "rb").read()

    idat = b""
    ihdr = None
    for ctype, body in read_chunks(data):
        if ctype == b"IHDR":
            ihdr = body
        elif ctype == b"IDAT":
            idat += body

    width, height, depth, color, comp, filt, interlace = struct.unpack(">IIBBBBB", ihdr)
    if depth != 8 or interlace != 0:
        raise SystemExit(f"acceptă doar 8 biți neîntrețesut (are depth={depth}, interlace={interlace})")
    if want_w > width or want_h > height:
        raise SystemExit(f"decupajul {want_w}x{want_h} depășește imaginea {width}x{height}")

    bpp = CHANNELS[color]
    pixels, stride = unfilter(zlib.decompress(idat), width, height, bpp)

    new_stride = want_w * bpp
    out = bytearray()
    for y in range(want_h):
        start = y * stride
        out.append(0)  # filtru „none", simplu și suficient
        out += pixels[start:start + new_stride]

    new_ihdr = struct.pack(">IIBBBBB", want_w, want_h, depth, color, comp, filt, interlace)
    png = PNG_SIG + chunk(b"IHDR", new_ihdr) + chunk(b"IDAT", zlib.compress(bytes(out), 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(png)
    print(f"{path}: {width}x{height} -> {want_w}x{want_h}")


if __name__ == "__main__":
    main()
