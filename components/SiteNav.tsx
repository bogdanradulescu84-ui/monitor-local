"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Section } from "@/lib/articles";

export function SiteNav({ sections }: { sections: Section[] }) {
  const path = usePathname();
  const active = path === "/" ? "toate" : (path.match(/^\/c\/([^/]+)/)?.[1] ?? "");

  return (
    <nav className="nav">
      <div className="wrap nav-in">
        <Link href="/" className={active === "toate" ? "on" : ""}>
          Prima pagină
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
