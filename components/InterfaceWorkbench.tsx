"use client";

import { useRef, useState } from "react";
import type { InterfaceDefinition } from "@/lib/interface-types";
import { parseXmlToInterface } from "@/lib/xml-parser";
import InterfaceTree from "./InterfaceTree";

type Direction = "inbound" | "outbound";

interface ImportedInterface {
  name: string;
  def: InterfaceDefinition;
}

interface Props {
  systemName: string;
  category: string;
}

function countElements(def: InterfaceDefinition): number {
  let count = 0;
  function walk(segments: InterfaceDefinition["segments"]) {
    for (const seg of segments) {
      count += seg.elements?.length ?? 0;
      if (seg.children) walk(seg.children);
    }
  }
  walk(def.segments);
  return count;
}

export default function InterfaceWorkbench({ systemName, category }: Props) {
  const [direction, setDirection] = useState<Direction | null>(null);
  const [customerInterfaces, setCustomerInterfaces] = useState<ImportedInterface[]>([]);
  const [internalInterfaces, setInternalInterfaces] = useState<ImportedInterface[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [selectedInternal, setSelectedInternal] = useState<number | null>(null);
  const customerFileRef = useRef<HTMLInputElement>(null);
  const internalFileRef = useRef<HTMLInputElement>(null);

  function importFile(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<ImportedInterface[]>>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const name = file.name.replace(/\.(json|xml)$/i, "");
        let def: InterfaceDefinition;

        if (file.name.toLowerCase().endsWith(".xml")) {
          def = parseXmlToInterface(content, name);
        } else {
          const json = JSON.parse(content);
          if (!json.segments || !json.message_type) {
            alert("JSON hat nicht das erwartete Interface-Format (message_type, segments)");
            return;
          }
          def = json;
        }

        setter((prev) => [...prev, { name, def }]);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Import fehlgeschlagen");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function removeCustomer(index: number) {
    setCustomerInterfaces((prev) => prev.filter((_, i) => i !== index));
    if (selectedCustomer === index) setSelectedCustomer(null);
    else if (selectedCustomer !== null && selectedCustomer > index) setSelectedCustomer(selectedCustomer - 1);
  }

  function removeInternal(index: number) {
    setInternalInterfaces((prev) => prev.filter((_, i) => i !== index));
    if (selectedInternal === index) setSelectedInternal(null);
    else if (selectedInternal !== null && selectedInternal > index) setSelectedInternal(selectedInternal - 1);
  }

  const customerIsSource = direction === "inbound";
  const selCust = selectedCustomer !== null ? customerInterfaces[selectedCustomer] : null;
  const selInt = selectedInternal !== null ? internalInterfaces[selectedInternal] : null;

  function interfaceList(
    items: ImportedInterface[],
    selectedIdx: number | null,
    onSelect: (i: number) => void,
    onRemove: (i: number) => void,
  ) {
    if (items.length === 0) {
      return (
        <div className="panel2" style={{ minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="small">Noch keine Interfaces importiert</span>
        </div>
      );
    }
    return (
      <div className="panel2" style={{ minHeight: 120 }}>
        {items.map((iface, i) => (
          <div
            key={i}
            onClick={() => onSelect(i)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 10px",
              borderRadius: 8,
              cursor: "pointer",
              background: selectedIdx === i ? "rgba(96,165,250,.1)" : "transparent",
              border: selectedIdx === i ? "1px solid rgba(96,165,250,.25)" : "1px solid transparent",
              marginBottom: 4,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{iface.def.message_type}</div>
              <div className="small">{iface.name}</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <span className="badge">{iface.def.version}</span>
              <span className="badge">{countElements(iface.def)} Felder</span>
              <button
                className="btn danger"
                style={{ padding: "4px 8px", fontSize: 12 }}
                onClick={(e) => { e.stopPropagation(); onRemove(i); }}
              >
                Entfernen
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const customerPanel = (
    <div className="panel" style={{ flex: 1 }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <div className="h2">
          {customerIsSource ? "Quelle" : "Ziel"}
          <span className="small" style={{ marginLeft: 8, fontWeight: 400 }}>Kundenschnittstelle</span>
        </div>
        <button className="btn" onClick={() => customerFileRef.current?.click()}>Importieren</button>
        <input ref={customerFileRef} type="file" accept=".json,.xml" style={{ display: "none" }} onChange={(e) => importFile(e, setCustomerInterfaces)} />
      </div>
      {interfaceList(customerInterfaces, selectedCustomer, setSelectedCustomer, removeCustomer)}
    </div>
  );

  const internalPanel = (
    <div className="panel" style={{ flex: 1 }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <div className="h2">
          {customerIsSource ? "Ziel" : "Quelle"}
          <span className="small" style={{ marginLeft: 8, fontWeight: 400 }}>{systemName} (intern)</span>
        </div>
        <button className="btn" onClick={() => internalFileRef.current?.click()}>Importieren</button>
        <input ref={internalFileRef} type="file" accept=".json,.xml" style={{ display: "none" }} onChange={(e) => importFile(e, setInternalInterfaces)} />
      </div>
      {interfaceList(internalInterfaces, selectedInternal, setSelectedInternal, removeInternal)}
    </div>
  );

  return (
    <div className="container">
      {/* Header */}
      <div className="row" style={{ marginBottom: 20 }}>
        <h1 className="h1">{systemName}</h1>
        <span className="badge">{category}</span>
      </div>

      {/* Inbound / Outbound Toggle */}
      <div className="row" style={{ marginBottom: 20 }}>
        <button className={`btn ${direction === "inbound" ? "primary" : ""}`} onClick={() => setDirection("inbound")}>
          Inbound
        </button>
        <button className={`btn ${direction === "outbound" ? "primary" : ""}`} onClick={() => setDirection("outbound")}>
          Outbound
        </button>
      </div>

      {/* Quelle | Ziel */}
      {direction && (
        <div style={{ display: "flex", gap: 16 }}>
          {customerIsSource ? customerPanel : internalPanel}
          {customerIsSource ? internalPanel : customerPanel}
        </div>
      )}

      {/* Detail-Ansicht: Quelle und Ziel nebeneinander */}
      {(selInt || selCust) && (
        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          {/* Quelle-Detail */}
          {(() => {
            const source = customerIsSource ? selCust : selInt;
            const label = customerIsSource ? "Kundenschnittstelle" : `${systemName} (intern)`;
            return source ? (
              <div className="panel" style={{ flex: 1 }}>
                <div className="row" style={{ marginBottom: 8 }}>
                  <div className="h2">Quelle</div>
                  <span className="small">{label}</span>
                </div>
                <div className="row" style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{source.def.message_type}</span>
                  <span className="badge">{source.def.version}</span>
                  <span className="badge">{source.def.guideline_version}</span>
                </div>
                <div className="small" style={{ marginBottom: 8 }}>{source.def.guideline}</div>
                <div className="panel2" style={{ maxHeight: 500, overflowY: "auto" }}>
                  <InterfaceTree segments={source.def.segments} />
                </div>
              </div>
            ) : (
              <div className="panel" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                <span className="small">Quelle auswählen</span>
              </div>
            );
          })()}

          {/* Ziel-Detail */}
          {(() => {
            const target = customerIsSource ? selInt : selCust;
            const label = customerIsSource ? `${systemName} (intern)` : "Kundenschnittstelle";
            return target ? (
              <div className="panel" style={{ flex: 1 }}>
                <div className="row" style={{ marginBottom: 8 }}>
                  <div className="h2">Ziel</div>
                  <span className="small">{label}</span>
                </div>
                <div className="row" style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{target.def.message_type}</span>
                  <span className="badge">{target.def.version}</span>
                  <span className="badge">{target.def.guideline_version}</span>
                </div>
                <div className="small" style={{ marginBottom: 8 }}>{target.def.guideline}</div>
                <div className="panel2" style={{ maxHeight: 500, overflowY: "auto" }}>
                  <InterfaceTree segments={target.def.segments} />
                </div>
              </div>
            ) : (
              <div className="panel" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                <span className="small">Ziel auswählen</span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
