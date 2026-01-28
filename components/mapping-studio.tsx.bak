"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import { AppState, MappingRow, createEmptyState, normalizeRoundId, validateState } from "@/lib/state";
import { downloadJson, loadFromLocalStorage, readTextFile, saveToLocalStorage } from "@/lib/persistence";
import { exportStateToExcel } from "@/lib/excel/export";
import { importMappingExcel } from "@/lib/excel/import";
import { Direction, formatMessageLabel, getMessage, getMessagesByDirection } from "@/lib/interfaces";
import { parseXsdToElementPaths } from "@/lib/xsd";

const STATUS_LABEL: Record<MappingRow["status"], string> = {
  open: "Open",
  in_review: "In Review",
  clarified: "Clarified",
  done: "Done",
};

export default function MappingStudio() {
  const [direction, setDirection] = useState<Direction>("outbound");
  const [state, setState] = useState<AppState>(() => createEmptyState("outbound"));
  const importJsonInputRef = useRef<HTMLInputElement | null>(null);
  const importExcelInputRef = useRef<HTMLInputElement | null>(null);
  const importXsdInputRef = useRef<HTMLInputElement | null>(null);

  const [otherFieldsText, setOtherFieldsText] = useState<string>("");

  const message = useMemo(() => getMessage(state.messageId), [state.messageId]);
  const fixedFields = useMemo(() => Array.from(new Set(message.fixedFields)).sort(), [message]);
  const messagesForDirection = useMemo(() => getMessagesByDirection(direction), [direction]);


  // load per direction
  useEffect(() => {
    const loaded = loadFromLocalStorage(direction);
    if (loaded) {
      setState(loaded);
    } else {
      setState(createEmptyState(direction));
    }
  }, [direction]);

  // autosave (separate inbound/outbound slots)
  useEffect(() => {
    saveToLocalStorage(direction, { ...state, direction, updatedAt: new Date().toISOString() });
  }, [direction, state]);

  const activeRound = useMemo(
    () => state.rounds.find((r) => r.id === state.activeRoundId) ?? state.rounds[0],
    [state]
  );

  // "Other" side: schema/manual field catalog
  const otherOptions = useMemo(() => Array.from(new Set(state.otherFieldCatalog ?? [])).sort(), [state.otherFieldCatalog]);

  // Direction semantics:
  // - Outbound: Fixed interface is SOURCE, and Destination is customer schema/manual (OTHER).
  // - Inbound:  Source is customer schema/manual (OTHER), and Destination is fixed interface.
  const sourceOptions = useMemo(() => (direction === "outbound" ? fixedFields : otherOptions), [direction, fixedFields, otherOptions]);
  const destinationOptions = useMemo(() => (direction === "outbound" ? otherOptions : fixedFields), [direction, fixedFields, otherOptions]);
  const otherSideLabel = direction === "outbound" ? "Destination" : "Source";

  // Keep textarea in sync
  useEffect(() => {
    setOtherFieldsText((state.otherFieldCatalog ?? []).join("\n"));
  }, [state.otherFieldCatalog, direction]);

  function ensureAtLeastOneRow() {
    setState((prev) => {
      const r = prev.rounds.find((x) => x.id === prev.activeRoundId);
      if (!r) return prev;
      if (r.rows.length > 0) return prev;
      const updatedRounds = prev.rounds.map((x) =>
        x.id === r.id ? { ...x, rows: [{ id: uuid(), source: "", destination: "", status: "open", comment: "" }] } : x
      );
      return { ...prev, rounds: updatedRounds };
    });
  }

  useEffect(() => {
    ensureAtLeastOneRow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeRoundId]);

  function addRound() {
    setState((prev) => {
      const n = prev.rounds.length + 1;
      const id = normalizeRoundId(n);
      const rounds = [...prev.rounds, { id, rows: [{ id: uuid(), source: "", destination: "", status: "open", comment: "" }] }];
      return { ...prev, rounds, activeRoundId: id };
    });
  }

  function removeRound(roundId: string) {
    setState((prev) => {
      if (prev.rounds.length <= 1) return prev;
      const rounds = prev.rounds.filter((r) => r.id !== roundId);
      const activeRoundId = prev.activeRoundId === roundId ? rounds[0].id : prev.activeRoundId;
      return { ...prev, rounds, activeRoundId };
    });
  }

  function updateRow(rowId: string, patch: Partial<MappingRow>) {
    setState((prev) => {
      const rounds = prev.rounds.map((r) => {
        if (r.id !== prev.activeRoundId) return r;
        return {
          ...r,
          rows: r.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
        };
      });
      return { ...prev, rounds };
    });
  }

  function addRow() {
    setState((prev) => {
      const rounds = prev.rounds.map((r) => {
        if (r.id !== prev.activeRoundId) return r;
        return { ...r, rows: [...r.rows, { id: uuid(), source: "", destination: "", status: "open", comment: "" }] };
      });
      return { ...prev, rounds };
    });
  }

  function deleteRow(rowId: string) {
    setState((prev) => {
      const rounds = prev.rounds.map((r) => {
        if (r.id !== prev.activeRoundId) return r;
        const rows = r.rows.filter((row) => row.id !== rowId);
        return { ...r, rows: rows.length ? rows : [{ id: uuid(), source: "", destination: "", status: "open", comment: "" }] };
      });
      return { ...prev, rounds };
    });
  }

  async function importXsd(file: File) {
    const text = await readTextFile(file);
    const paths = parseXsdToElementPaths(text);
    if (!paths.length) {
      alert("Konnte aus dem XSD keine Felder ableiten (Parser/Schema evtl. zu komplex). Bitte manuell eintragen.");
      return;
    }
    setState((prev) => ({ ...prev, otherFieldCatalog: paths }));
  }

  function applyManualOtherFields() {
    const lines = otherFieldsText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    setState((prev) => ({ ...prev, otherFieldCatalog: Array.from(new Set(lines)).sort() }));
  }

  function exportJsonState() {
    downloadJson(`MapForge_${state.direction}_${state.messageId.replace(/[^a-z0-9_.-]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.json`, state);
  }

  async function importJsonState(file: File) {
    const text = await readTextFile(file);
    try {
      const parsed = JSON.parse(text);
      const validated = validateState(parsed, direction);
      setDirection(validated.direction);
      setState(validated);
    } catch {
      alert("Ungültiges JSON");
    }
  }

  async function importExcel(file: File) {
    try {
      const imported = await importMappingExcel(file);
      if (imported.length === 0) {
        alert("Keine passenden Daten in Excel gefunden (Header: Source/Destination/Status/Comment)");
        return;
      }

      setState((prev) => {
        const rounds = prev.rounds.map((r) => {
          if (r.id !== prev.activeRoundId) return r;
          const first = imported[0];
          return { ...r, rows: first.rows };
        });
        return { ...prev, rounds };
      });

      alert(`Import OK: ${imported[0].sheetName} (${imported[0].rows.length} Zeilen) → ${state.activeRoundId}`);
    } catch (e) {
      console.error(e);
      alert("Excel Import fehlgeschlagen");
    }
  }

  function changeMessage(messageId: string) {
    setState((prev) => ({
      ...prev,
      messageId,
      updatedAt: new Date().toISOString(),
      direction,
      // Rounds bleiben bestehen, damit man nicht aus Versehen verliert.
    }));
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
              <button
                className={`rounded-lg px-3 py-2 text-sm ${direction === "inbound" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"}`}
                onClick={() => setDirection("inbound")}
                title="Inbound: Kunde → Meine Firma"
              >
                Inbound
              </button>
              <button
                className={`rounded-lg px-3 py-2 text-sm ${direction === "outbound" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"}`}
                onClick={() => setDirection("outbound")}
                title="Outbound: Meine Firma → Kunde"
              >
                Outbound
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Analyse</span>
              <select
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800"
                value={state.messageId}
                onChange={(e) => changeMessage(e.target.value)}
                title="Fix hinterlegte Interface-Definition auswählen"
              >
                {messagesForDirection.length ? (
                  messagesForDirection.map((m) => (
                    <option key={m.id} value={m.id}>
                      {formatMessageLabel(m)}
                    </option>
                  ))
                ) : (
                  <option value={state.messageId}>Keine Messages für diese Richtung</option>
                )}
              </select>
            </div>

            <span className="mx-2 hidden h-6 w-px bg-zinc-200 dark:bg-zinc-800 md:block" />

            <button
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800"
              onClick={() => importXsdInputRef.current?.click()}
              title={`${otherSideLabel}-Felder aus XML Schema (XSD) ableiten`}
            >
              {otherSideLabel} XSD…
            </button>
            <input
              ref={importXsdInputRef}
              type="file"
              accept="application/xml,text/xml,.xsd"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importXsd(f);
                e.currentTarget.value = "";
              }}
            />

            <button
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800"
              onClick={() => void exportStateToExcel(state)}
            >
              Export Excel
            </button>

            <button
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800"
              onClick={() => importExcelInputRef.current?.click()}
            >
              Import Excel…
            </button>
            <input
              ref={importExcelInputRef}
              type="file"
              accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importExcel(f);
                e.currentTarget.value = "";
              }}
            />

            <span className="mx-2 hidden h-6 w-px bg-zinc-200 dark:bg-zinc-800 md:block" />

            <button
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800"
              onClick={exportJsonState}
            >
              Save JSON
            </button>

            <button
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800"
              onClick={() => importJsonInputRef.current?.click()}
            >
              Load JSON…
            </button>
            <input
              ref={importJsonInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importJsonState(f);
                e.currentTarget.value = "";
              }}
            />
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Autosave: localStorage · Fixed Felder: {fixedFields.length} · {otherSideLabel} Felder: {otherOptions.length} · Rounds: {state.rounds.length}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold">{otherSideLabel} Feldkatalog (XML Schema oder manuell)</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Outbound: Source = fix (Interface) · Destination = Kunde (Schema/Manuell) · Inbound: umgekehrt.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800"
              onClick={applyManualOtherFields}
              title="Text übernehmen → Feldkatalog aktualisieren"
            >
              Apply
            </button>
            <button
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800"
              onClick={() => {
                setOtherFieldsText("");
                setState((prev) => ({ ...prev, otherFieldCatalog: [] }));
              }}
              title="Feldkatalog leeren"
            >
              Clear
            </button>
          </div>
        </div>

        <textarea
          className="mt-3 min-h-[140px] w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm font-mono dark:border-zinc-800 dark:bg-zinc-950"
          placeholder={`Ein Feldpfad pro Zeile (z.B. Order.Header.CustomerId)\nOder importiere ein XSD über '${otherSideLabel} XSD…'`}
          value={otherFieldsText}
          onChange={(e) => setOtherFieldsText(e.target.value)}
        />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold">Rounds</div>
            <div className="flex flex-wrap gap-2">
              {state.rounds.map((r) => (
                <button
                  key={r.id}
                  className={
                    "rounded-xl border px-3 py-1.5 text-sm " +
                    (r.id === state.activeRoundId
                      ? "border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
                      : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800")
                  }
                  onClick={() => setState((prev) => ({ ...prev, activeRoundId: r.id }))}
                >
                  {r.id}
                </button>
              ))}
              <button
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                onClick={addRound}
              >
                + Add
              </button>

              <button
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                onClick={() => removeRound(state.activeRoundId)}
                disabled={state.rounds.length <= 1}
                title={state.rounds.length <= 1 ? "Mindestens ein Round" : "Aktuellen Round entfernen"}
              >
                − Remove
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800"
              onClick={addRow}
            >
              + Row
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-950">
              <tr className="text-xs text-zinc-500 dark:text-zinc-400">
                <th className="px-3 py-2 w-[40%]">Source {direction === "outbound" ? "(Fixed)" : "(Schema/Manual)"}</th>
                <th className="px-3 py-2 w-[40%]">Destination {direction === "outbound" ? "(Schema/Manual)" : "(Fixed)"}</th>
                <th className="px-3 py-2 w-[12%]">Status</th>
                <th className="px-3 py-2 w-[8%]"></th>
              </tr>
            </thead>
            <tbody>
              {activeRound.rows.map((row) => (
                <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2 align-top">
                    <input
                      className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                      placeholder="source field path"
                      list="sourceCatalog"
                      value={row.source ?? ""}
                      onChange={(e) => updateRow(row.id, { source: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                      placeholder="destination field path"
                      list="destinationCatalog"
                      value={row.destination ?? ""}
                      onChange={(e) => updateRow(row.id, { destination: e.target.value })}
                    />
                    <div className="mt-2">
                      <input
                        className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                        placeholder="comment"
                        value={row.comment ?? ""}
                        onChange={(e) => updateRow(row.id, { comment: e.target.value })}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                      value={row.status}
                      onChange={(e) => updateRow(row.id, { status: e.target.value as MappingRow["status"] })}
                    >
                      {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <button
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      onClick={() => deleteRow(row.id)}
                      title="Delete row"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <datalist id="sourceCatalog">
            {sourceOptions.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>

          <datalist id="destinationCatalog">
            {destinationOptions.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>

        <datalist id="sourceCatalog">
          {sourceOptions.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
        <datalist id="destinationCatalog">
          {destinationOptions.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      </section>
    </div>
  );
}
