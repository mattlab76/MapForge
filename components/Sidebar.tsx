"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { systems, type SystemCategory } from "@/lib/systems";

const categoryOrder: SystemCategory[] = ["TMS", "WMS", "ERP"];

export default function Sidebar() {
  const pathname = usePathname();

  const grouped = categoryOrder
    .map((cat) => ({
      category: cat,
      items: systems.filter((s) => s.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <nav className="sidebar" style={{ padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 24 }}>MapForge</div>
      {grouped.map((group) => (
        <div key={group.category} style={{ marginBottom: 16 }}>
          <div className="small" style={{ marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            {group.category}
          </div>
          {group.items.map((sys) => {
            const href = `/systems/${sys.slug}`;
            const active = pathname.startsWith(href);
            return (
              <Link key={sys.slug} href={href} className={active ? "active" : undefined}>
                {sys.name}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
