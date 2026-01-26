"use client";

import { useEffect, useMemo, useState } from "react";
import type { Direction, MappingRow, MappingStatus, ProjectV3 } from "@/lib/types";
import { getMessageById, listMessagesFor } from "@/lib/interfaces/registry";
import { makeEmptyProject, ProjectV3Schema, storageKey } from "@/lib/storage";
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
const INBOUND_RUBRICS: RubricDef[] = [
  { code: "CZ", label: "Auftraggeber", defaultDestinations: ["CZ/Name", "CZ/Strasse", "CZ/PLZ", "CZ/Ort", "CZ/Land"] },
  { code: "CN", label: "Empfänger", defaultDestinations: ["CN/Name", "CN/Strasse", "CN/PLZ", "CN/Ort", "CN/Land"] },
  { code: "XE", label: "EDI Adresse", defaultDestinations: ["XE/EDI-Adresse"] },
  { code: "SU", label: "Absender", defaultDestinations: ["SU/Name", "SU/Strasse", "SU/PLZ", "SU/Ort", "SU/Land"] },
  { code: "IV", label: "Rechnungsempfänger", defaultDestinations: ["IV/Name", "IV/Strasse", "IV/PLZ", "IV/Ort", "IV/Land"] },
  { code: "PU", label: "Abholadresse", defaultDestinations: ["PU/Name", "PU/Strasse", "PU/PLZ", "PU/Ort", "PU/Land"] },
];

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
      setProject(parsed);
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

  const fixedFields = message?.fixedFields?.map((f) => f.path) ?? [];

  const sourceSuggestions = fixedSide === "source" ? fixedFields : project?.sourceCatalog ?? [];
  const destSuggestions = fixedSide === "destination" ? fixedFields : project?.destinationCatalog ?? [];

  function setCatalog(side: "source" | "destination", items: string[]) {
    setProject((p) => {
      if (!p) return p;
      const next: ProjectV3 = { ...p };
      if (side === "source") next.sourceCatalog = items;
      else next.destinationCatalog = items;
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

  function enableRubric(code: string, defaults: string[]) {
    setProject((p) => {
      if (!p) return p;
      const enabled = new Set(p.rubricEnabled ?? []);
      enabled.add(code);

      const rid = p.activeRoundId;
      const rounds = p.rounds.map((r) => {
        if (r.id !== rid) return r;
        const existing = new Set(r.rows.filter((x) => x.rubric === code).map((x) => x.destination));
        const add = defaults
          .filter((d) => !existing.has(d))
          .map(
            (dest) =>
              ({ id: uid(code.toLowerCase()), source: "", destination: dest, status: "open", comment: "", rubric: code }) satisfies MappingRow,
          );
        return { ...r, rows: [...r.rows, ...add] };
      });

      return { ...p, rubricEnabled: Array.from(enabled), rounds };
    });
  }

  function disableRubric(code: string) {
    setProject((p) => {
      if (!p) return p;
      const enabled = new Set(p.rubricEnabled ?? []);
      enabled.delete(code);
      return { ...p, rubricEnabled: Array.from(enabled) };
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

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="panel row" style={{ flex: 1, justifyContent: "space-between" }}>
          <div className="row">
            <div className="h2">Projekt</div>
            <span className="badge">{systemId.toUpperCase()}</span>
            <span className="badge">{direction === "inbound" ? "Inbound" : "Outbound"}</span>
          </div>
          <div className="row">
            <button className="btn primary" onClick={addRow}>
              + Row
            </button>
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

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <div className="h2">Mapping Grid</div>
          <div className="small">
            Fixed Side: <span className="kbd">{fixedSide}</span>
          </div>
        </div>

        <table className="grid">
          <thead>
            <tr>
              <th style={{ width: "34%" }}>Source</th>
              <th style={{ width: "34%" }}>Destination</th>
              <th style={{ width: "12%" }}>Status</th>
              <th>Comment</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {ungroupedRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <FieldInput value={row.source} onChange={(v) => updateRow(row.id, { source: v })} suggestions={sourceSuggestions} />
                </td>
                <td>
                  <FieldInput
                    value={row.destination}
                    onChange={(v) => updateRow(row.id, { destination: v })}
                    suggestions={destSuggestions}
                  />
                </td>
                <td>
                  <select
                    className="input"
                    value={row.status}
                    onChange={(e) => updateRow(row.id, { status: e.target.value as MappingStatus })}
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
                    value={row.comment}
                    onChange={(e) => updateRow(row.id, { comment: e.target.value })}
                  />
                </td>
                <td>
                  <button className="btn danger" onClick={() => deleteRow(row.id)}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {ungroupedRows.length === 0 && (
              <tr>
                <td colSpan={5} className="small">
                  Noch keine Rows — klicke <span className="kbd">+ Row</span>.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {direction === "inbound" && (
          <div style={{ marginTop: 14 }}>
            <div className="small" style={{ marginBottom: 8 }}>
              Adress-Rubriken (Inbound): Rubrik aktivieren → vordefinierte Destination-Felder erscheinen; zusätzlich kannst du
              weitere Rows je Rubrik hinzufügen.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {INBOUND_RUBRICS.map((rub) => (
                <RubricSection
                  key={rub.code}
                  rubric={rub}
                  enabled={enabledRubrics.has(rub.code)}
                  rows={(activeRound?.rows ?? []).filter((r) => r.rubric === rub.code)}
                  onToggle={(next) =>
                    next ? enableRubric(rub.code, rub.defaultDestinations) : disableRubric(rub.code)
                  }
                  onAddRow={() => addRubricRow(rub.code)}
                  onUpdateRow={updateRow}
                  onDeleteRow={deleteRow}
                  sourceSuggestions={sourceSuggestions}
                  destSuggestions={destSuggestions}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RubricSection(props: {
  rubric: RubricDef;
  enabled: boolean;
  rows: MappingRow[];
  onToggle: (nextEnabled: boolean) => void;
  onAddRow: () => void;
  onUpdateRow: (rowId: string, patch: Partial<MappingRow>) => void;
  onDeleteRow: (rowId: string) => void;
  sourceSuggestions: string[];
  destSuggestions: string[];
}) {
  const { rubric, rows, enabled } = props;
  const [open, setOpen] = useState(true);

  return (
    <div className="panel" style={{ padding: 10 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn" onClick={() => setOpen((v) => !v)} title={open ? "Collapse" : "Expand"}>
            {open ? "▾" : "▸"}
          </button>
          <label className="row" style={{ gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                props.onToggle(e.target.checked);
                if (e.target.checked) setOpen(true);
              }}
            />
            <span className="h2" style={{ margin: 0 }}>
              {rubric.code} — {rubric.label}
            </span>
          </label>
          {!enabled && rows.length > 0 && <span className="small">(nicht aktiv, {rows.length} Rows)</span>}
          {!enabled && rows.length === 0 && <span className="small">(nicht aktiv)</span>}
        </div>

        <button className="btn primary" disabled={!enabled} onClick={props.onAddRow}>
          + Row
        </button>
      </div>

      {open && enabled && (
        <div style={{ marginTop: 10 }}>
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: "34%" }}>Source</th>
                <th style={{ width: "34%" }}>Destination</th>
                <th style={{ width: "12%" }}>Status</th>
                <th>Comment</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <FieldInput
                      value={row.source}
                      onChange={(v) => props.onUpdateRow(row.id, { source: v })}
                      suggestions={props.sourceSuggestions}
                    />
                  </td>
                  <td>
                    <FieldInput
                      value={row.destination}
                      onChange={(v) => props.onUpdateRow(row.id, { destination: v })}
                      suggestions={props.destSuggestions}
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
                    Keine Rows — klicke <span className="kbd">+ Row</span>.
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
  return (
    <>
      <input className="input" style={{ width: "100%" }} value={value} onChange={(e) => onChange(e.target.value)} list={listId} />
      <datalist id={listId}>
        {suggestions.slice(0, 400).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
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
