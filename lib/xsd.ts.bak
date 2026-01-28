import { XMLParser } from "fast-xml-parser";

export function parseXsdToFieldNames(xsdText: string): string[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
  });

  const doc = parser.parse(xsdText);
  const out: string[] = [];
  const seen = new Set<string>();

  function walk(node: any) {
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (k === "element") {
        const elems = Array.isArray(v) ? v : [v];
        for (const e of elems) {
          const name = (e as any)?.["@_name"];
          if (typeof name === "string" && name.trim()) {
            const n = name.trim();
            if (!seen.has(n)) {
              seen.add(n);
              out.push(n);
            }
          }
          walk(e);
        }
      } else {
        walk(v);
      }
    }
  }

  walk(doc);
  return out;
}
