import type { InterfaceDefinition, InterfaceSegment, InterfaceElement } from "./interface-types";

/**
 * Parst eine XML-Datei und konvertiert sie in eine InterfaceDefinition.
 * Kinder-Elemente mit eigenen Kindern werden zu Segmenten (aufklappbar),
 * Blatt-Elemente werden zu Elements (Felder).
 */
export function parseXmlToInterface(xmlString: string, fileName: string): InterfaceDefinition {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Ungültiges XML-Format");
  }

  const root = doc.documentElement;

  function hasChildElements(el: Element): boolean {
    for (let i = 0; i < el.children.length; i++) {
      if (el.children[i].nodeType === Node.ELEMENT_NODE) return true;
    }
    return false;
  }

  function walkElement(el: Element, parentPath: string, level: number): InterfaceSegment {
    const path = parentPath ? `${parentPath}/${el.localName}` : el.localName;
    const childElements: InterfaceElement[] = [];
    const childSegments: InterfaceSegment[] = [];

    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      if (hasChildElements(child)) {
        childSegments.push(walkElement(child, path, level + 1));
      } else {
        const elPath = `${path}/${child.localName}`;
        const value = child.textContent?.trim() ?? "";
        const isNil = child.getAttributeNS("http://www.w3.org/2001/XMLSchema-instance", "nil") === "true";
        childElements.push({
          path: elPath,
          description: isNil ? "(nil)" : value || "",
          status: isNil ? "O" : "M",
        });
      }
    }

    return {
      path: el.localName,
      description: path,
      status: "M",
      level,
      elements: childElements.length > 0 ? childElements : undefined,
      children: childSegments.length > 0 ? childSegments : undefined,
    };
  }

  const rootSegment = walkElement(root, "", 0);

  return {
    message_type: root.localName,
    version: "XML",
    guideline: fileName,
    guideline_version: "1.0",
    segments: rootSegment.children ?? (rootSegment.elements ? [rootSegment] : []),
  };
}
