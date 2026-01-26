"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SYSTEMS } from "@/lib/interfaces/registry";

export function Sidebar() {
  const path = usePathname();
  return (
    <div className="panel sidebar">
      <div className="h2" style={{ marginBottom: 10 }}>Interne Systeme</div>
      {SYSTEMS.map((s) => {
        const active = path?.startsWith(`/systems/${s.id}`);
        return (
          <Link key={s.id} href={`/systems/${s.id}/outbound`} className={active ? "active" : ""}>
            {s.title}
          </Link>
        );
      })}
      <div style={{ marginTop: 10 }} className="small">
        Pro System eigene Seite/Route — dadurch können wir später system-spezifische Anforderungen separat umsetzen.
      </div>
    </div>
  );
}
