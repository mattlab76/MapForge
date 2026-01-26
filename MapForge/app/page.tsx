"use client";

import { useState } from "react";

type Row = {
  nr: number;
  destinationField: string;
  ediComment: string;
  sourceField: string;
  tmsItComment: string;
  generalComment: string;
};

type Round = {
  roundId: string;
  title: string;
  date: string;
  status: string;
  inputArtifact: string;
  scope: string;
  rows: Row[];
};

function extractJsonPaths(obj: any, prefix = ""): string[] {
  const out: string[] = [];
  if (Array.isArray(obj)) {
    const p = prefix ? `${prefix}[]` : "[]";
    if (obj.length == 0) return [p];
    return extractJsonPaths(obj[0], p);
  }
  if (obj && typeof obj == "object") {
    for (const key of Object.keys(obj)) {
      const p = prefix ? `${prefix}.${key}` : key;
      const v = obj[key];
      if (v && typeof v == "object") out.push(...extractJsonPaths(v, p));
      else out.push(p);
    }
    return out;
  }
  if (prefix) out.push(prefix);
  return out;
}

function nextRoundId(existing: Round[]) {
  const n = existing.length + 1;
  return `R${String(n).padStart(2, "0")}`;
}

export default function Home() {
  const [meta, setMeta] = useState({
    projectCase: "",
    sourceSystem: "",
    sourceFormat: "JSON",
    sourceVersion: "",
    destinationSystem: "",
    destinationFormat: "JSON",
    destinationVersion: "",
    owner: "Matthias Haas",
    lastUpdate: "",
  });

  const [sourcePaths, setSourcePaths] = useState<string[]>([]);
  const [destPaths, setDestPaths] = useState<string[]>([]);

  const [rounds, setRounds] = useState<Round[]>(() => [
    {
      roundId: "R01",
      title: "Analyse",
      date: "",
      status: "In Arbeit",
      inputArtifact: "",
      scope: "",
      rows: Array.from({ length: 20 }).map((_, i) => ({
        nr: i + 1,
        destinationField: "",
        ediComment: "",
        sourceField: "",
        tmsItComment: "",
        generalComment: "",
      })),
    },
  ]);

  const nonEmptyRows = (r: Round) =>
    r.rows.filter((row) => {
      const vals = [
        row.destinationField,
        row.ediComment,
        row.sourceField,
        row.tmsItComment,
        row.generalComment,
      ];
      return vals.some((v) => String(v ?? "").trim() !== "");
    });

  async function exportXlsx() {
    const payload = {
      meta,
      rounds: rounds.map((r) => ({ ...r, rows: nonEmptyRows(r) })),
    };

    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert("Export fehlgeschlagen");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "MapForge_Export.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function loadJsonFile(file: File, target: "source" | "dest") {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const paths = Array.from(new Set(extractJsonPaths(parsed))).sort((a, b) => a.localeCompare(b));
    if (target === "source") setSourcePaths(paths);
    else setDestPaths(paths);
  }

  function addRound() {
    setRounds((prev) => [
      ...prev,
      {
        roundId: nextRoundId(prev),
        title: "Analyse",
        date: "",
        status: "Geplant",
        inputArtifact: "",
        scope: "",
        rows: Array.from({ length: 20 }).map((_, i) => ({
          nr: i + 1,
          destinationField: "",
          ediComment: "",
          sourceField: "",
          tmsItComment: "",
          generalComment: "",
        })),
      },
    ]);
  }

  function addRows(roundIndex: number, count = 10) {
    setRounds((prev) => {
      const copy = [...prev];
      const r = copy[roundIndex];
      const start = r.rows.length;
      r.rows = [
        ...r.rows,
        ...Array.from({ length: count }).map((_, i) => ({
          nr: start + i + 1,
          destinationField: "",
          ediComment: "",
          sourceField: "",
          tmsItComment: "",
          generalComment: "",
        })),
      ];
      copy[roundIndex] = { ...r };
      return copy;
    });
  }

  return (
    <main className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">MapForge – Analyse</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Mapping Analysis Studio for Lobster_data (Dark Theme + Excel Export)
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <div className="text-sm">Projekt/Case</div>
            <input value={meta.projectCase} onChange={(e) => setMeta({ ...meta, projectCase: e.target.value })} />
          </label>

          <label className="space-y-1">
            <div className="text-sm">Owner</div>
            <input value={meta.owner} onChange={(e) => setMeta({ ...meta, owner: e.target.value })} />
          </label>

          <label className="space-y-1">
            <div className="text-sm">Source System</div>
            <input value={meta.sourceSystem} onChange={(e) => setMeta({ ...meta, sourceSystem: e.target.value })} />
          </label>

          <label className="space-y-1">
            <div className="text-sm">Source Format</div>
            <input value={meta.sourceFormat} onChange={(e) => setMeta({ ...meta, sourceFormat: e.target.value })} />
          </label>

          <label className="space-y-1">
            <div className="text-sm">Destination System</div>
            <input
              value={meta.destinationSystem}
              onChange={(e) => setMeta({ ...meta, destinationSystem: e.target.value })}
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm">Destination Format</div>
            <input
              value={meta.destinationFormat}
              onChange={(e) => setMeta({ ...meta, destinationFormat: e.target.value })}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={exportXlsx}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Excel exportieren
          </button>

          <button
            onClick={addRound}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
          >
            Runde hinzufügen
          </button>

          <div className="ml-auto flex flex-wrap gap-3">
            <label className="text-sm">
              Source JSON laden{" "}
              <input
                type="file"
                accept="application/json"
                className="ml-2"
                onChange={(e) => e.target.files?.[0] && loadJsonFile(e.target.files[0], "source")}
              />
            </label>

            <label className="text-sm">
              Destination JSON laden{" "}
              <input
                type="file"
                accept="application/json"
                className="ml-2"
                onChange={(e) => e.target.files?.[0] && loadJsonFile(e.target.files[0], "dest")}
              />
            </label>
          </div>
        </div>

        <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
          Feldsuche: Wenn du JSON lädst, bekommst du Autocomplete-Vorschläge in den Feld-Spalten.
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Source Feldkatalog</div>
          <div className="mt-1 text-2xl font-semibold">{sourcePaths.length}</div>
          <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">JSON laden → Pfade werden extrahiert.</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Destination Feldkatalog</div>
          <div className="mt-1 text-2xl font-semibold">{destPaths.length}</div>
          <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">JSON laden → Pfade werden extrahiert.</div>
        </div>
      </section>

      <section className="space-y-6">
        {rounds.map((round, ri) => (
          <div
            key={round.roundId}
            className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-lg font-semibold">
                {round.roundId}{" "}
                <span className="text-zinc-500 dark:text-zinc-400">•</span>{" "}
                <span className="text-zinc-700 dark:text-zinc-200">{round.title}</span>
              </div>

              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => addRows(ri, 10)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                >
                  +10 Zeilen
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <div className="text-sm">Titel</div>
                <input
                  value={round.title}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRounds((prev) => {
                      const copy = [...prev];
                      copy[ri] = { ...copy[ri], title: v };
                      return copy;
                    });
                  }}
                />
              </label>
              <label className="space-y-1">
                <div className="text-sm">Status</div>
                <input
                  value={round.status}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRounds((prev) => {
                      const copy = [...prev];
                      copy[ri] = { ...copy[ri], status: v };
                      return copy;
                    });
                  }}
                />
              </label>
              <label className="space-y-1">
                <div className="text-sm">Datum</div>
                <input
                  value={round.date}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRounds((prev) => {
                      const copy = [...prev];
                      copy[ri] = { ...copy[ri], date: v };
                      return copy;
                    });
                  }}
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <div className="text-sm">Input / Artefakt</div>
                <input
                  value={round.inputArtifact}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRounds((prev) => {
                      const copy = [...prev];
                      copy[ri] = { ...copy[ri], inputArtifact: v };
                      return copy;
                    });
                  }}
                />
              </label>
              <label className="space-y-1">
                <div className="text-sm">Scope / Annahmen</div>
                <input
                  value={round.scope}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRounds((prev) => {
                      const copy = [...prev];
                      copy[ri] = { ...copy[ri], scope: v };
                      return copy;
                    });
                  }}
                />
              </label>
            </div>

            <datalist id="sourcePaths">
              {sourcePaths.slice(0, 5000).map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <datalist id="destPaths">
              {destPaths.slice(0, 5000).map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-[1100px] border-collapse text-sm">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-950">
                    {[
                      "Nr.",
                      "Destination Feld",
                      "EDI Team Kommentar",
                      "Source Feld",
                      "TMS-IT Kommentar",
                      "Allg. Kommentare",
                    ].map((h) => (
                      <th
                        key={h}
                        className="border border-zinc-200 px-2 py-2 text-left font-semibold dark:border-zinc-800"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {round.rows.map((row, idx) => (
                    <tr key={`${round.roundId}-${row.nr}`}>
                      <td className="border border-zinc-200 px-2 py-2 dark:border-zinc-800">{row.nr}</td>

                      <td className="border border-zinc-200 px-2 py-2 dark:border-zinc-800">
                        <input
                          list="destPaths"
                          value={row.destinationField}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRounds((prev) => {
                              const copy = [...prev];
                              const r = copy[ri];
                              const rowsCopy = [...r.rows];
                              rowsCopy[idx] = { ...rowsCopy[idx], destinationField: v };
                              copy[ri] = { ...r, rows: rowsCopy };
                              return copy;
                            });
                          }}
                        />
                      </td>

                      <td className="border border-zinc-200 px-2 py-2 dark:border-zinc-800">
                        <input
                          value={row.ediComment}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRounds((prev) => {
                              const copy = [...prev];
                              const r = copy[ri];
                              const rowsCopy = [...r.rows];
                              rowsCopy[idx] = { ...rowsCopy[idx], ediComment: v };
                              copy[ri] = { ...r, rows: rowsCopy };
                              return copy;
                            });
                          }}
                        />
                      </td>

                      <td className="border border-zinc-200 px-2 py-2 dark:border-zinc-800">
                        <input
                          list="sourcePaths"
                          value={row.sourceField}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRounds((prev) => {
                              const copy = [...prev];
                              const r = copy[ri];
                              const rowsCopy = [...r.rows];
                              rowsCopy[idx] = { ...rowsCopy[idx], sourceField: v };
                              copy[ri] = { ...r, rows: rowsCopy };
                              return copy;
                            });
                          }}
                        />
                      </td>

                      <td className="border border-zinc-200 px-2 py-2 dark:border-zinc-800">
                        <input
                          value={row.tmsItComment}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRounds((prev) => {
                              const copy = [...prev];
                              const r = copy[ri];
                              const rowsCopy = [...r.rows];
                              rowsCopy[idx] = { ...rowsCopy[idx], tmsItComment: v };
                              copy[ri] = { ...r, rows: rowsCopy };
                              return copy;
                            });
                          }}
                        />
                      </td>

                      <td className="border border-zinc-200 px-2 py-2 dark:border-zinc-800">
                        <input
                          value={row.generalComment}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRounds((prev) => {
                              const copy = [...prev];
                              const r = copy[ri];
                              const rowsCopy = [...r.rows];
                              rowsCopy[idx] = { ...rowsCopy[idx], generalComment: v };
                              copy[ri] = { ...r, rows: rowsCopy };
                              return copy;
                            });
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
              Tipp: JSON laden → Feldpfade erscheinen als Autocomplete-Vorschläge in Source/Destination.
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
