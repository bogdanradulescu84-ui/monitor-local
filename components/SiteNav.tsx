"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Section } from "@/lib/articles";

export function SiteNav({ sections }: { sections: Section[] }) {
  const path = usePathname();
  // „Articolele Casei" nu vine din config, ca celelalte secțiuni: nu e un coș
  // de articole preluate, ci conținutul propriu. De aceea are intrare proprie
  // și rută proprie (/articole), nu /c/<id>.
  const casa = path.startsWith("/articol");
  const active = path === "/" ? "toate" : (path.match(/^\/c\/([^/]+)/)?.[1] ?? "");

  return (
    <nav className="nav">
      <div className="wrap nav-in">
        <Link href="/" className={active === "toate" ? "on" : ""}>
          Prima pagină
        </Link>
        <Link href="/articole/" className={casa ? "on" : ""}>
          Articolele Casei
        </Link>
        {sections.map((s) => (
          <Link key={s.id} href={`/c/${s.id}/`} className={active === s.id ? "on" : ""}>
            {s.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
