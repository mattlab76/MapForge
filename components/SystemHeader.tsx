"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SystemHeader({ systemTitle }: { systemTitle: string }) {
  const path = usePathname() || "";
  const isInbound = path.includes("/inbound");

  const inboundHref = isInbound ? path : path.replace("/outbound", "/inbound");
  const outboundHref = isInbound ? path.replace("/inbound", "/outbound") : path;

  return (
    <div className="panel row" style={{ justifyContent: "space-between" }}>
      <div>
        <div className="h1">{systemTitle}</div>
        <div className="small">Analyse & Mapping Studio</div>
      </div>
      <div className="row">
        <Link className={"btn " + (isInbound ? "primary" : "")} href={inboundHref}>Inbound</Link>
        <Link className={"btn " + (!isInbound ? "primary" : "")} href={outboundHref}>Outbound</Link>
      </div>
    </div>
  );
}
