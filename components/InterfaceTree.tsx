"use client";

import { useState } from "react";
import type { InterfaceSegment, InterfaceElement } from "@/lib/interface-types";

const statusColor: Record<string, string> = {
  M: "#60a5fa",
  R: "#facc15",
  O: "#94a3b8",
  C: "#c084fc",
  D: "#fb923c",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "1px 6px",
        borderRadius: 4,
        background: `${statusColor[status] ?? "#94a3b8"}22`,
        color: statusColor[status] ?? "#94a3b8",
        marginLeft: 6,
      }}
    >
      {status}
    </span>
  );
}

function ElementRow({ el }: { el: InterfaceElement }) {
  // Zeige nur den letzten Pfad-Teil als Name (z.B. "DateTime" statt "TranslogicaOrder/Header/DateTime")
  const shortPath = el.path.includes("/") ? el.path.split("/").pop()! : el.path;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "3px 0 3px 20px",
        fontSize: 12,
      }}
    >
      <span className="kbd" style={{ color: "var(--accent)", minWidth: 160 }} title={el.path}>
        {shortPath}
      </span>
      {el.description && (
        <span className="kbd" style={{ color: "var(--muted)", flex: 1, opacity: 0.7 }} title={el.path}>
          {el.description}
        </span>
      )}
      <StatusBadge status={el.status} />
    </div>
  );
}

function SegmentNode({ segment, depth }: { segment: InterfaceSegment; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const hasContent = (segment.elements && segment.elements.length > 0) || (segment.children && segment.children.length > 0);
  const isGroup = segment.path.startsWith("SG");

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      <div
        onClick={() => hasContent && setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          borderRadius: 8,
          cursor: hasContent ? "pointer" : "default",
          background: open && hasContent ? "rgba(255,255,255,.02)" : "transparent",
        }}
      >
        {/* Toggle-Pfeil */}
        <span style={{ width: 16, textAlign: "center", fontSize: 10, color: "var(--muted)" }}>
          {hasContent ? (open ? "▼" : "▶") : "·"}
        </span>

        {/* Segment-Path */}
        <span
          className="kbd"
          style={{
            fontWeight: 600,
            color: isGroup ? "#c084fc" : "var(--text)",
            minWidth: 60,
          }}
        >
          {segment.path}
        </span>

        {/* Qualifier */}
        {segment.qualifier && (
          <span
            style={{
              fontSize: 10,
              padding: "1px 5px",
              borderRadius: 4,
              background: "rgba(96,165,250,.1)",
              color: "var(--accent)",
            }}
          >
            {segment.qualifier}
          </span>
        )}

        {/* Description */}
        <span style={{ flex: 1, color: "var(--muted)", fontSize: 13 }}>
          {segment.description}
        </span>

        <StatusBadge status={segment.status} />
      </div>

      {/* Expandierter Inhalt */}
      {open && hasContent && (
        <div style={{ borderLeft: "1px solid var(--border)", marginLeft: 15, paddingLeft: 4 }}>
          {segment.elements?.map((el, i) => (
            <ElementRow key={i} el={el} />
          ))}
          {segment.children?.map((child, i) => (
            <SegmentNode key={i} segment={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  segments: InterfaceSegment[];
}

export default function InterfaceTree({ segments }: Props) {
  return (
    <div>
      {segments.map((seg, i) => (
        <SegmentNode key={i} segment={seg} depth={0} />
      ))}
    </div>
  );
}
