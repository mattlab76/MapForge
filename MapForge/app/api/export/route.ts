import { NextRequest } from "next/server";
import ExcelJS from "exceljs";

type MappingRow = {
  nr: number;
  destinationField: string;
  ediComment: string;
  sourceField: string;
  tmsItComment: string;
  generalComment: string;
};

type ExportPayload = {
  meta: {
    projectCase?: string;
    sourceSystem?: string;
    sourceFormat?: string;
    sourceVersion?: string;
    destinationSystem?: string;
    destinationFormat?: string;
    destinationVersion?: string;
    owner?: string;
    lastUpdate?: string;
  };
  rounds: Array<{
    roundId: string;
    title?: string;
    date?: string;
    status?: string;
    inputArtifact?: string;
    scope?: string;
    rows: MappingRow[];
  }>;
};

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as ExportPayload;

  const wb = new ExcelJS.Workbook();
  wb.creator = "MapForge";
  wb.created = new Date();

  // Robust Excel output: no merges, no formulas, no data validation.
  const titleFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } } as const;
  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF305496" } } as const;
  const inputFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } } as const;

  const thinBorder = {
    top: { style: "thin" as const, color: { argb: "FF9E9E9E" } },
    left: { style: "thin" as const, color: { argb: "FF9E9E9E" } },
    bottom: { style: "thin" as const, color: { argb: "FF9E9E9E" } },
    right: { style: "thin" as const, color: { argb: "FF9E9E9E" } },
  };

  // 01_Allgemein
  const wsMain = wb.addWorksheet("01_Allgemein", { views: [{ showGridLines: false }] });
  wsMain.columns = [{ width: 30 }, { width: 55 }];

  wsMain.getCell("A1").value = "MapForge – Mapping Analyse (Source ↔ Destination)";
  wsMain.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  wsMain.getCell("A1").fill = titleFill;

  wsMain.addRow([]);
  wsMain.addRow(["Feld", "Wert"]);
  const hdr = wsMain.lastRow!;
  hdr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hdr.fill = headerFill;
  hdr.eachCell((c) => (c.border = thinBorder));

  const metaRows: Array<[string, string | undefined]> = [
    ["Projekt/Case", payload.meta.projectCase],
    ["Source Partner/System", payload.meta.sourceSystem],
    ["Source Format", payload.meta.sourceFormat],
    ["Source Spezifikation/Version", payload.meta.sourceVersion],
    ["Destination Partner/System", payload.meta.destinationSystem],
    ["Destination Format", payload.meta.destinationFormat],
    ["Destination Spezifikation/Version", payload.meta.destinationVersion],
    ["Analyse Owner", payload.meta.owner],
    ["Letztes Update", payload.meta.lastUpdate],
  ];

  for (const [k, v] of metaRows) {
    const r = wsMain.addRow([k, v ?? ""]);
    r.getCell(1).font = { bold: true };
    r.getCell(2).fill = inputFill;
    r.eachCell((c) => {
      c.border = thinBorder;
      c.alignment = { vertical: "middle", wrapText: true };
    });
  }

  // Runde Sheets
  for (const round of payload.rounds) {
    const ws = wb.addWorksheet(`Runde_${round.roundId}`, { views: [{ showGridLines: false }] });

    ws.getCell("A1").value = `Analyse-Runde – ${round.roundId}${round.title ? ` – ${round.title}` : ""}`;
    ws.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    ws.getCell("A1").fill = titleFill;

    ws.columns = [
      { width: 6 },
      { width: 30 },
      { width: 26 },
      { width: 30 },
      { width: 26 },
      { width: 34 },
    ];

    ws.addRow([]);
    const metaStart = ws.addRow(["Runden-ID", round.roundId]);
    ws.addRow(["Datum", round.date ?? ""]);
    ws.addRow(["Status", round.status ?? ""]);
    ws.addRow(["Input Datei/Artefakt", round.inputArtifact ?? ""]);
    ws.addRow(["Scope/Annahmen", round.scope ?? ""]);

    for (let r = metaStart.number; r <= metaStart.number + 4; r++) {
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 2).fill = inputFill;
      ws.getRow(r).eachCell((c) => {
        c.border = thinBorder;
        c.alignment = { vertical: "middle", wrapText: true };
      });
    }

    ws.addRow([]);
    ws.addRow(["Nr.", "Destination Feld", "EDI Team Kommentar", "Source Feld", "TMS-IT Kommentar", "Allgemeine Kommentare"]);
    const headerRow = ws.lastRow!;
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = headerFill;
    headerRow.eachCell((c) => {
      c.border = thinBorder;
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });

    for (const row of round.rows) {
      const rr = ws.addRow([
        row.nr,
        row.destinationField,
        row.ediComment,
        row.sourceField,
        row.tmsItComment,
        row.generalComment,
      ]);
      rr.eachCell((c, idx) => {
        c.border = thinBorder;
        c.alignment = {
          vertical: "top",
          horizontal: idx === 1 ? "center" : "left",
          wrapText: true,
        };
      });
    }

    ws.autoFilter = {
      from: { row: headerRow.number, column: 1 },
      to: { row: headerRow.number, column: 6 },
    };
    ws.views = [{ state: "frozen", ySplit: headerRow.number }];
  }

  const buffer = await wb.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="MapForge_Export.xlsx"`,
    },
  });
}
