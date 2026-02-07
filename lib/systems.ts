export type SystemCategory = "TMS" | "WMS" | "ERP";

export interface SystemDef {
  slug: string;
  name: string;
  category: SystemCategory;
}

export const systems: SystemDef[] = [
  { slug: "translogica", name: "Translogica", category: "TMS" },
  { slug: "lbase", name: "Lbase", category: "TMS" },
  { slug: "lfs", name: "LFS", category: "WMS" },
  { slug: "warta", name: "Warta", category: "WMS" },
  { slug: "sap", name: "SAP", category: "ERP" },
];
