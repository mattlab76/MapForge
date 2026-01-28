"use client";
import React, { useEffect, useMemo, useState } from "react";
import type { Direction, MappingRow, MappingStatus, ProjectV3 } from "@/lib/types";
import { getMessageById, listMessagesFor } from "@/lib/interfaces/registry";
import { makeEmptyProject, normalizeInterfacePath, normalizeProjectPaths, ProjectV3Schema, storageKey } from "@/lib/storage";
import { parseXsdToFieldNames } from "@/lib/xsd";

function uid(prefix = "row") {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

const STATUS_LABEL: Record<MappingStatus, string> = {
  open: "Open",
  in_review: "In Review",
  clarified: "Clarified",
  done: "Done",
};

type RubricDef = { code: string; label: string; defaultDestinations: string[] };

// Inbound-only: Address rubrics (user can enable per project/round by adding rows).
// Destination paths here are placeholders; we can replace them with your exact internal destination paths later.
// Inbound-only: Address areas (added via dropdown; rendered only when added).
const INBOUND_RUBRICS = [
  { code: "CZ", label: "Auftraggeber", uiLabel: "CZ Address" },
  { code: "CN", label: "Empfänger", uiLabel: "CN Address" },
  { code: "XE", label: "EDI Adresse", uiLabel: "XE Address" },
  { code: "SU", label: "Absender", uiLabel: "SU Address" },
  { code: "IV", label: "Rechnungsempfänger", uiLabel: "IV Address" },
  { code: "PU", label: "Abholadresse", uiLabel: "PU Address" },
] as const;

type InboundRubricCode = (typeof INBOUND_RUBRICS)[number]["code"];

const ADDRESS_DEFAULT_FIELDS = [
  "Shipment/Shipment_Address/Name1",
  "Shipment/Shipment_Address/Name2",
  "Shipment/Shipment_Address/Street1",
  "Shipment/Shipment_Address/Street2",
  "Shipment/Shipment_Address/ZIP_Code",
  "Shipment/Shipment_Address/Location",
  "Shipment/Shipment_Address/Country",
  "Shipment/Shipment_Address/Interational_Location_Number",
] as const;

const ADDRESS_QUALIFIER_FIELD = "Shipment/Shipment_Address/Address_Type";


export function MappingStudio(props: { systemId: string; direction: Direction }) {
  const { systemId, direction } = props;

  const messages = useMemo(() => listMessagesFor(systemId, direction), [systemId, direction]);
  const [messageId, setMessageId] = useState<string>(() => messages[0]?.id ?? "");

  useEffect(() => {
    setMessageId(messages[0]?.id ?? "");
  }, [messages]);

  const message = useMemo(() => getMessageById(messageId), [messageId]);
  const fixedSide = direction === "outbound" ? "source" : "destination";

  const [project, setProject] = useState<ProjectV3 | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!messageId) {
      setProject(null);
      return;
    }
    const key = storageKey(systemId, direction, messageId);
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      setProject(makeEmptyProject({ systemId, direction, messageId }));
      return;
    }
    try {
      const parsed = ProjectV3Schema.parse(JSON.parse(raw));
      setProject(normalizeProjectPaths(parsed));
    } catch (e) {
      console.error(e);
      setProject(makeEmptyProject({ systemId, direction, messageId }));
    }
  }, [systemId, direction, messageId]);

  useEffect(() => {
    if (!project) return;
    const key = storageKey(project.systemId, project.direction, project.messageId);
    window.localStorage.setItem(key, JSON.stringify({ ...project, updatedAt: new Date().toISOString() }));
  }, [project]);

  const fixedFields = message?.fixedFields?.map((f) => normalizeInterfacePath(f.path)) ?? [];
  const fixedFieldsFallbackSource = project?.sourceCatalog ?? [];
  const fixedFieldsFallbackDest = project?.destinationCatalog ?? [];

  const sourceSuggestions = fixedSide === "source" ? (fixedFields.length ? fixedFields : fixedFieldsFallbackSource) : project?.sourceCatalog ?? [];
  const destSuggestions = fixedSide === "destination" ? (fixedFields.length ? fixedFields : fixedFieldsFallbackDest) : project?.destinationCatalog ?? [];

  function setCatalog(side: "source" | "destination", items: string[]) {
    const normalized = items.map(normalizeInterfacePath);
    setProject((p) => {
      if (!p) return p;
      const next: ProjectV3 = { ...p };
      if (side === "source") next.sourceCatalog = normalized;
      else next.destinationCatalog = normalized;
      return next;
    });
  }

  function addRow() {
    setProject((p) => {
      if (!p) return p;
      const rid = p.activeRoundId;
      const rounds = p.rounds.map((r) => {
        if (r.id !== rid) return r;
        return {
          ...r,
          rows: [
            ...r.rows,
            { id: uid(), source: "", destination: "", status: "open", comment: "" } satisfies MappingRow,
          ],
        };
      });
      return { ...p, rounds };
    });
  }


  function addInboundRubric(code: InboundRubricCode, destSuggestions: string[]) {
    setError("");
    setProject((p) => {
      if (!p) return p;

      const enabled = new Set(p.rubricEnabled ?? []);
      if (enabled.has(code)) {
        // duplicate
        setError(`Bereich ${code} ist bereits in dieser Analyse vorhanden.`);
        return p;
      }
      enabled.add(code);

      // compute defaults that actually exist in this interface
      const available = new Set(destSuggestions);
      const defaults = (ADDRESS_DEFAULT_FIELDS as readonly string[]).filter((f) => available.has(f));
      const qualifierDest = available.has(ADDRESS_QUALIFIER_FIELD) ? ADDRESS_QUALIFIER_FIELD : "";

      const rid = p.activeRoundId;
      const rounds = p.rounds.map((r) => {
        if (r.id !== rid) return r;

        const existingDest = new Set(r.rows.filter((x) => x.rubric === code).map((x) => x.destination));
        const addRows: MappingRow[] = [];

        // Qualifier row first (FIX:<CODE>)
        if (qualifierDest && !existingDest.has(qualifierDest)) {
          addRows.push({
            id: uid(code.toLowerCase()),
            source: `FIX:${code}`,
            destination: qualifierDest,
            status: "done",
            comment: "Auto: Qualifier",
            rubric: code,
          });
        }

        for (const dest of defaults) {
          if (existingDest.has(dest)) continue;
          addRows.push({ id: uid(code.toLowerCase()), source: "", destination: dest, status: "open", comment: "", rubric: code });
        }

        return { ...r, rows: [...r.rows, ...addRows] };
      });

      return { ...p, rubricEnabled: Array.from(enabled), rounds };
    });
  }

  function removeInboundRubric(code: InboundRubricCode) {
    setError("");
    setProject((p) => {
      if (!p) return p;
      const enabled = new Set(p.rubricEnabled ?? []);
      enabled.delete(code);

      const rounds = p.rounds.map((r) => ({ ...r, rows: r.rows.filter((x) => x.rubric !== code) }));
      return { ...p, rubricEnabled: Array.from(enabled), rounds };
    });
  }

  
  
  function addRubricRow(rubric: string, destination?: string) {
    setProject((p) => {
      if (!p) return p;
      const rid = p.activeRoundId;
      const rounds = p.rounds.map((r) => {
        if (r.id !== rid) return r;
        return {
          ...r,
          rows: [
            ...r.rows,
            {
              id: uid(rubric.toLowerCase()),
              source: "",
              destination: destination ?? "",
              status: "open",
              comment: "",
              rubric,
            } satisfies MappingRow,
          ],
        };
      });
      return { ...p, rounds };
    });
  }

  function updateRow(rowId: string, patch: Partial<MappingRow>) {
    setProject((p) => {
      if (!p) return p;
      const rid = p.activeRoundId;
      const rounds = p.rounds.map((r) => {
        if (r.id !== rid) return r;
        return {
          ...r,
          rows: r.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
        };
      });
      return { ...p, rounds };
    });
  }

  function deleteRow(rowId: string) {
    setProject((p) => {
      if (!p) return p;
      const rid = p.activeRoundId;
      const rounds = p.rounds.map((r) => {
        if (r.id !== rid) return r;
        return { ...r, rows: r.rows.filter((x) => x.id !== rowId) };
      });
      return { ...p, rounds };
    });
  }

  function saveJson() {
    if (!project) return;
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MapForge_${project.systemId}_${project.direction}_${project.messageId}_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function loadJson(file: File) {
    try {
      const txt = await file.text();
      const parsed = ProjectV3Schema.parse(JSON.parse(txt));
      setProject((p) => {
        if (!p) return parsed;
        return {
          ...p,
          sourceCatalog: parsed.sourceCatalog,
          destinationCatalog: parsed.destinationCatalog,
          rubricEnabled: parsed.rubricEnabled ?? [],
          rounds: parsed.rounds,
          activeRoundId: parsed.activeRoundId,
        };
      });
      setError("");
    } catch (e) {
      setError("Import fehlgeschlagen: JSON ist nicht im erwarteten Project-Format (v3).");
    }
  }

  async function importXsd(side: "source" | "destination", file: File) {
    const txt = await file.text();
    const fields = parseXsdToFieldNames(txt);
    setCatalog(side, fields);
  }

  const activeRound = project?.rounds.find((r) => r.id === project.activeRoundId);
  const enabledRubrics = new Set(project?.rubricEnabled ?? []);
  const isInbound = direction === "inbound";
  const ungroupedRows = isInbound ? (activeRound?.rows ?? []).filter((r) => !r.rubric) : (activeRound?.rows ?? []);

  if (!messageId) {
    return (
      <div className="panel">
        <div className="h2">Keine Messages definiert</div>
        <div className="small">Für dieses System und diese Richtung ist noch keine Interface Definition hinterlegt.</div>
      </div>
    );
  }

  
  const activeMessage = useMemo(() => (messageId ? getMessageById(messageId) : null), [messageId]);
return (
    <div>

      {/* Structured Sections (v44 minimal) */}
      {activeMessage && (
        <StructuredSections
          isInbound={isInbound}
          enabledRubrics={enabledRubrics}
          addInboundRubric={addInboundRubric}
          removeInboundRubric={removeInboundRubric}
          addRubricRow={addRubricRow}
          updateRow={updateRow}
          deleteRow={deleteRow}
          activeRows={activeRound?.rows ?? []}
          sourceSuggestions={sourceSuggestions}
          destSuggestions={destSuggestions}
          activeMessage={activeMessage}
        />
      )}


      <div className="row" style={{ marginBottom: 12 }}>
        <div className="panel row" style={{ flex: 1, justifyContent: "space-between" }}>
          <div className="row">
            <div className="h2">Projekt</div>
            <span className="badge">{systemId.toUpperCase()}</span>
            <span className="badge">{direction === "inbound" ? "Inbound" : "Outbound"}</span>
          </div>
          <div className="row">
<button className="btn" onClick={saveJson}>
              Save JSON
            </button>
            <label className="btn">
              Load JSON…
              <input
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadJson(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>

        <div className="panel row">
          <div className="small" style={{ minWidth: 90 }}>
            Message
          </div>
          <select className="input" value={messageId} onChange={(e) => setMessageId(e.target.value)}>
            {messages.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div
          className="panel"
          style={{ borderColor: "rgba(251,113,133,.5)", marginBottom: 12, color: "var(--danger)" }}
        >
          {error}
        </div>
      )}

      <div className="row" style={{ alignItems: "stretch" }}>
        <div className="panel2" style={{ flex: 1 }}>
          <div className="h2" style={{ marginBottom: 8 }}>
            {fixedSide === "source" ? "Source (intern / fix)" : "Source (Kunde)"}
          </div>

          {fixedSide === "source" ? (
            <div className="small">Fix aus Interface Definition (nicht editierbar). {fixedFields.length} Felder.</div>
          ) : (
            <CatalogEditor
              value={project?.sourceCatalog ?? []}
              onApply={(items) => setCatalog("source", items)}
              onImportXsd={(file) => importXsd("source", file)}
            />
          )}
        </div>

        <div className="panel2" style={{ flex: 1 }}>
          <div className="h2" style={{ marginBottom: 8 }}>
            {fixedSide === "destination" ? "Destination (intern / fix)" : "Destination (Kunde)"}
          </div>

          {fixedSide === "destination" ? (
            <div className="small">Fix aus Interface Definition (nicht editierbar). {fixedFields.length} Felder.</div>
          ) : (
            <CatalogEditor
              value={project?.destinationCatalog ?? []}
              onApply={(items) => setCatalog("destination", items)}
              onImportXsd={(file) => importXsd("destination", file)}
            />
          )}
        </div>
      </div>

      

    </div>
  );
}


/**
 * StructuredSections (v44 minimal)
 */
function StructuredSections(props: {
  isInbound: boolean;
  enabledRubrics: Set<string>;
  addInboundRubric: (code: InboundRubricCode, destSuggestions: string[]) => void;
  removeInboundRubric: (code: InboundRubricCode) => void;
  addRubricRow: (rubric: string, destination?: string) => void;
  updateRow: (rowId: string, patch: Partial<MappingRow>) => void;
  deleteRow: (rowId: string) => void;
  activeRows: MappingRow[];
  sourceSuggestions: string[];
  destSuggestions: string[];
  activeMessage: ReturnType<typeof getMessageById> | null;
}) {
  const {
    isInbound,
    enabledRubrics,
    addInboundRubric,
    removeInboundRubric,
    addRubricRow,
    updateRow,
    deleteRow,
    activeRows,
    sourceSuggestions,
    destSuggestions,
    activeMessage,
  } = props;

  const prefix = "Write_Interface.Shipment.";
  const excluded = new Set([
    "Write_Interface.Shipment.clear_Actual_Map_Shipment",
    "Write_Interface.Shipment.identify_Map_Name#Shipment",
  ]);

  const shipmentFixed = useMemo(() => {
    const fixedRaw = (activeMessage?.fixedFields ?? []) as any[];
    const fixed = fixedRaw
      .map((p) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object") {
          return (p.path ?? p.destination ?? p.name ?? p.id ?? "").toString();
        }
        return "";
      })
      .filter((v) => typeof v === "string" && v.length > 0);

    return fixed
      .filter((p) => p.startsWith(prefix))
      .filter((p) => !excluded.has(p))
      .filter((p) => {
        const rest = p.slice(prefix.length);
        return rest.length > 0 && !rest.includes(".");
      })
      .sort((a, b) => a.localeCompare(b));
  }, [activeMessage]);

  const shipmentRows = useMemo(() => activeRows.filter((r) => r.rubric === "Shipment"), [activeRows]);

  const usedShipmentDestinations = useMemo(() => {
    const used = new Set<string>();
    for (const r of shipmentRows) {
      if (r.destination?.startsWith(prefix)) used.add(r.destination);
    }
    return used;
  }, [shipmentRows]);

  const shipmentOptions = useMemo(
    () => shipmentFixed.filter((p) => !usedShipmentDestinations.has(p)),
    [shipmentFixed, usedShipmentDestinations],
  );

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 320 }}>
            <div className="h2">Shipment</div>
            <select
              className="input"
              value=""
              style={{
                minWidth: 320,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              }}
              onChange={(e) => {
                const dest = e.target.value;
                if (!dest) return;
                addRubricRow("Shipment", dest);
              }}
            >
              <option value="">Feld hinzufügen…</option>
              {shipmentOptions.map((p) => (
                <option key={p} value={p}>
                  {p.replace(prefix, "")}
                </option>
              ))}
            </select>
          </div>

          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <button className="btn" onClick={() => addRubricRow("Shipment", "")} title="Leere Zeile hinzufügen">
              + Leere Zeile
            </button>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Source</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Comment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shipmentRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input className="input" list="source-suggestions" style={{ width: "100%" }} value={row.source} onChange={(e) => updateRow(row.id, { source: e.target.value })} />
                  </td>
                  <td>
                    <input className="input" list="dest-suggestions" style={{ width: "100%" }} value={row.destination} onChange={(e) => updateRow(row.id, { destination: e.target.value })} />
                  </td>
                  <td>
                    <select className="input" value={row.status} onChange={(e) => updateRow(row.id, { status: e.target.value as MappingStatus })}>
                      {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input className="input" style={{ width: "100%" }} value={row.comment ?? ""} onChange={(e) => updateRow(row.id, { comment: e.target.value })} />
                  </td>
                  <td>
                    <button className="btn danger" onClick={() => deleteRow(row.id)}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {shipmentRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="small">
                    Noch keine Felder/Rows in Shipment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="h2">Shipment_Address</div>
          <button className="btn" disabled title="(reserved)">
            +
          </button>
        </div>

        {isInbound ? (
          <div style={{ marginTop: 8 }}>
            <select
              className="input"
              value=""
              onChange={(e) => {
                const code = e.target.value as InboundRubricCode;
                if (!code) return;
                addInboundRubric(code, destSuggestions);
              }}
            >
              <option value="">Adresse hinzufügen…</option>
              {INBOUND_RUBRICS.filter((r) => !enabledRubrics.has(r.code)).map((r) => (
                <option key={r.code} value={r.code}>
                  {r.uiLabel} — {r.label}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {INBOUND_RUBRICS.filter((r) => enabledRubrics.has(r.code)).map((rub) => (
                <InboundRubricSection
                  key={rub.code}
                  rubric={rub}
                  rows={activeRows.filter((row) => row.rubric === rub.code)}
                  onAddRow={() => addRubricRow(rub.code)}
                  onRemove={() => removeInboundRubric(rub.code)}
                  onUpdateRow={updateRow}
                  onDeleteRow={deleteRow}
                  sourceSuggestions={sourceSuggestions}
                  destSuggestions={destSuggestions}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="small" style={{ marginTop: 8 }}>
            Address-Bereiche sind aktuell nur für Inbound vorgesehen.
          </div>
        )}
      </div>

      <div className="panel"><div className="h2">Shipment_Text</div></div>
      <div className="panel"><div className="h2">Shipment_Notes</div></div>
      <div className="panel"><div className="h2">Shipment_Attribute</div></div>
      <div className="panel">
        <div className="h2">Shipment_Position</div>
        <div className="panel2" style={{ marginTop: 10 }}><div className="h2">Position_Text</div></div>
        <div className="panel2" style={{ marginTop: 10 }}><div className="h2">Position_Remarks</div></div>
        <div className="panel2" style={{ marginTop: 10 }}><div className="h2">POS_Attribute</div></div>
        <div className="panel2" style={{ marginTop: 10 }}><div className="h2">Dangerous_Goods</div></div>
      </div>
    </div>
  );
}

function InboundRubricSection(props: {
  rubric: { code: InboundRubricCode; label: string; uiLabel: string };
  rows: MappingRow[];
  onAddRow: () => void;
  onRemove: () => void;
  onUpdateRow: (rowId: string, patch: Partial<MappingRow>) => void;
  onDeleteRow: (rowId: string) => void;
  sourceSuggestions: string[];
  destSuggestions: string[];
}) {
  const { rubric, rows } = props;
  const [open, setOpen] = useState(true);

  return (
    <div className="panel" style={{ padding: 10 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <button className="btn" onClick={() => setOpen((v) => !v)} title={open ? "Collapse" : "Expand"}>
            {open ? "▾" : "▸"}
          </button>
          <span className="h2" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {rubric.code} — {rubric.label}
          </span>
          <span className="small">({rows.length} Rows)</span>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={props.onAddRow}>
            + Row
          </button>
          <button className="btn danger" onClick={props.onRemove} title="Bereich entfernen">
            Remove
          </button>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Source</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Comment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      className="input"
                      list="source-suggestions"
                      style={{ width: "100%" }}
                      value={row.source}
                      onChange={(e) => props.onUpdateRow(row.id, { source: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      list="dest-suggestions"
                      style={{ width: "100%" }}
                      value={row.destination}
                      onChange={(e) => props.onUpdateRow(row.id, { destination: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      className="input"
                      value={row.status}
                      onChange={(e) => props.onUpdateRow(row.id, { status: e.target.value as MappingStatus })}
                    >
                      {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="input"
                      style={{ width: "100%" }}
                      value={row.comment ?? ""}
                      onChange={(e) => props.onUpdateRow(row.id, { comment: e.target.value })}
                    />
                  </td>
                  <td>
                    <button className="btn danger" onClick={() => props.onDeleteRow(row.id)}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="small">
                    Noch keine Rows.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FieldInput(props: { value: string; onChange: (v: string) => void; suggestions: string[] }) {
  const { value, onChange, suggestions } = props;
  const listId = useMemo(() => `dl-${Math.random().toString(16).slice(2)}`, []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return suggestions.slice(0, 200);
    // light fuzzy: contains
    const out: string[] = [];
    for (const s of suggestions) {
      if (s.toLowerCase().includes(query)) out.push(s);
      if (out.length >= 200) break;
    }
    return out;
  }, [q, suggestions]);

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        className="input"
        style={{ width: "100%" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
      />
      <button
        type="button"
        className="btn"
        title="Feld auswählen…"
        onClick={() => {
          setQ(value);
          setPickerOpen(true);
        }}
        style={{ padding: "6px 10px" }}
      >
        …
      </button>
      <datalist id={listId}>
        {suggestions.slice(0, 400).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {pickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onMouseDown={(e) => {
            // click outside
            if (e.target === e.currentTarget) setPickerOpen(false);
          }}
        >
          <div
            className="card"
            style={{ width: "min(900px, 95vw)", maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
          >
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Feld auswählen</div>
              <button className="btn" onClick={() => setPickerOpen(false)}>
                Schließen
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              <input
                className="input"
                placeholder="Suchen…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ marginTop: 10, overflow: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
              {filtered.length === 0 ? (
                <div className="small" style={{ padding: 12 }}>
                  Keine Treffer.
                </div>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {filtered.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        className="btn"
                        style={{ width: "100%", textAlign: "left", border: "none", borderRadius: 0, justifyContent: "flex-start" }}
                        onClick={() => {
                          onChange(s);
                          setPickerOpen(false);
                        }}
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="small" style={{ marginTop: 10 }}>
              {filtered.length} / {suggestions.length} angezeigt (max 200)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogEditor(props: {
  value: string[];
  onApply: (items: string[]) => void;
  onImportXsd: (file: File) => void;
}) {
  const [text, setText] = useState<string>(() => (props.value ?? []).join("\n"));

  useEffect(() => {
    setText((props.value ?? []).join("\n"));
  }, [props.value]);

  return (
    <div>
      <div className="small" style={{ marginBottom: 6 }}>
        XML Schema (XSD) importieren oder manuell (ein Feld pro Zeile).
      </div>

      <div className="row" style={{ marginBottom: 8 }}>
        <label className="btn">
          XSD import…
          <input
            type="file"
            accept=".xsd,application/xml,text/xml"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) props.onImportXsd(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <button
          className="btn primary"
          onClick={() => props.onApply(text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))}
        >
          Apply
        </button>
        <button
          className="btn"
          onClick={() => {
            setText("");
            props.onApply([]);
          }}
        >
          Clear
        </button>
        <span className="small">Aktuell: {(props.value ?? []).length} Felder</span>
      </div>

      <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="z.B. Customer/Order/Id" />
    </div>
  );
}
