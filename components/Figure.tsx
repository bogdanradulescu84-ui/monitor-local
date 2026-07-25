"use client";

import { useEffect, useRef, useState } from "react";

type Kind = "civic" | "doc" | "contour";

function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 100000;
}

/** Sections get a consistent visual, so a card reads as local vs. paperwork. */
function kindFor(section: string): Kind {
  if (section === "administratie") return "doc";
  if (section === "local" || section === "comunitate") return "civic";
  return "contour";
}

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function draw(cv: HTMLCanvasElement, kind: Kind, seedValue: number) {
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (!w || !h) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = w * dpr;
  cv.height = h * dpr;
  const c = cv.getContext("2d");
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  const bg = token("--paper-2");
  const ink = token("--ink-3");
  const navy = token("--navy");
  const stamp = token("--stamp");

  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);

  let s = seedValue * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  if (kind === "civic") {
    const base = h * 0.86;
    let x = -10;
    c.strokeStyle = ink;
    c.globalAlpha = 0.5;
    c.lineWidth = 1;
    while (x < w + 20) {
      const bw = 26 + rnd() * 58;
      const bh = 26 + rnd() * (h * 0.48);
      c.strokeRect(Math.round(x) + 0.5, Math.round(base - bh) + 0.5, Math.round(bw), Math.round(bh));
      const rows = Math.max(1, Math.floor(bh / 16));
      const cols = Math.max(1, Math.floor(bw / 14));
      for (let r = 1; r < rows; r++) {
        for (let q = 1; q < cols; q++) {
          if (rnd() > 0.55) continue;
          c.fillStyle = ink;
          c.globalAlpha = 0.18;
          c.fillRect(Math.round(x + q * (bw / cols) - 3), Math.round(base - bh + r * (bh / rows) - 4), 5, 6);
          c.globalAlpha = 0.5;
        }
      }
      x += bw + 6 + rnd() * 10;
    }
    c.globalAlpha = 1;
    c.fillStyle = navy;
    c.fillRect(0, base, w, h - base);
    c.strokeStyle = stamp;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, base);
    c.lineTo(w, base);
    c.stroke();
  } else if (kind === "doc") {
    c.strokeStyle = ink;
    c.globalAlpha = 0.35;
    c.lineWidth = 1;
    for (let y = h * 0.18; y < h * 0.92; y += 13) {
      const len = (0.35 + rnd() * 0.55) * w;
      c.beginPath();
      c.moveTo(w * 0.1, Math.round(y) + 0.5);
      c.lineTo(w * 0.1 + len, Math.round(y) + 0.5);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.save();
    c.translate(w * 0.68, h * 0.62);
    c.rotate(-0.14);
    c.strokeStyle = stamp;
    c.lineWidth = 2;
    c.globalAlpha = 0.8;
    const bw = Math.min(116, w * 0.5);
    c.strokeRect(-bw / 2, -20, bw, 40);
    c.fillStyle = stamp;
    c.font = "600 11px ui-monospace, Menlo, monospace";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("DOCUMENT", 0, 0);
    c.restore();
    c.globalAlpha = 1;
  } else {
    c.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      c.beginPath();
      const amp = 6 + rnd() * 16;
      const ph = rnd() * 6.28;
      const fr = 0.006 + rnd() * 0.012;
      const y0 = (i / 15) * h * 1.1 - h * 0.05;
      for (let px = 0; px <= w; px += 4) {
        const py = y0 + Math.sin(px * fr + ph) * amp + Math.sin(px * fr * 2.3 + ph) * (amp * 0.35);
        if (px === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.strokeStyle = i === 9 ? stamp : ink;
      c.globalAlpha = i === 9 ? 0.75 : 0.28;
      c.stroke();
    }
    c.globalAlpha = 1;
  }
}

export function Figure({ section, seed }: { section: string; seed: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;

    const kind = kindFor(section);
    const value = seedFrom(seed);
    const paint = () => draw(cv, kind, value);

    paint();

    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(paint, 160);
    };
    window.addEventListener("resize", onResize);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", paint);

    // The theme toggle stamps data-theme on <html>; repaint to match.
    const obs = new MutationObserver(paint);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", paint);
      obs.disconnect();
    };
  }, [section, seed]);

  return <canvas ref={ref} style={{ display: "block", width: "100%", height: "100%" }} aria-hidden="true" />;
}

/** Feed image when it loads, generated figure when it doesn't. */
export function Shot({ src, section, seed }: { src: string; section: string; seed: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Figure section={section} seed={seed} />;
  return (
    <img
      className="shot"
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
