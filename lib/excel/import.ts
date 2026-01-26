import * as XLSX from "xlsx";
import { MappingRow } from "@/lib/state";
import { v4 as uuid } from "uuid";

export type ImportedRound = {
  sheetName: string;
  rows: MappingRow[];
};

function normalizeHeader(h: unknown): string {
  return String(h ?? "").trim().toLowerCase();
}

export async function importMappingExcel(file: File): Promise<ImportedRound[]> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array" });
  const rounds: ImportedRound[] = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;

    const json: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
    if (json.length === 0) continue;

    const header = (json[0] ?? []).map(normalizeHeader);
    const idxSource = header.findIndex((h) => ["source", "src", "quelle"].includes(h));
    const idxDest = header.findIndex((h) => ["destination", "dest", "ziel"].includes(h));
    const idxStatus = header.findIndex((h) => ["status"].includes(h));
    const idxComment = header.findIndex((h) => ["comment", "kommentar", "note"].includes(h));

    const outRows: MappingRow[] = [];

    for (let i = 1; i < json.length; i++) {
      const r = json[i] ?? [];
      const source = idxSource >= 0 ? String(r[idxSource] ?? "") : "";
      const destination = idxDest >= 0 ? String(r[idxDest] ?? "") : "";
      const comment = idxComment >= 0 ? String(r[idxComment] ?? "") : "";
      const statusRaw = idxStatus >= 0 ? String(r[idxStatus] ?? "") : "";

      // Map status to our enum
      const status = ((): MappingRow["status"] => {
        const s = statusRaw.trim().toLowerCase();
        if (["done", "fertig"].includes(s)) return "done";
        if (["clarified", "geklärt", "geklaert"].includes(s)) return "clarified";
        if (["in_review", "review", "in review"].includes(s)) return "in_review";
        return "open";
      })();

      if (!source && !destination && !comment && !statusRaw) continue;

      outRows.push({ id: uuid(), source, destination, comment, status });
    }

    if (outRows.length > 0) {
      rounds.push({ sheetName: name, rows: outRows });
    }
  }

  return rounds;
}
