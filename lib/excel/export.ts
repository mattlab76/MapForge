import ExcelJS from "exceljs";
import { AppState } from "@/lib/state";

export async function exportStateToExcel(state: AppState) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MapForge";
  wb.created = new Date();

  for (const round of state.rounds) {
    const ws = wb.addWorksheet(round.id);
    ws.columns = [
      { header: "Source", key: "source", width: 40 },
      { header: "Destination", key: "destination", width: 40 },
      { header: "Status", key: "status", width: 14 },
      { header: "Comment", key: "comment", width: 50 }
    ];

    for (const row of round.rows) {
      ws.addRow({
        source: row.source ?? "",
        destination: row.destination ?? "",
        status: row.status,
        comment: row.comment ?? ""
      });
    }

    // freeze header, style
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.getRow(1).font = { bold: true };
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `MapForge_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
