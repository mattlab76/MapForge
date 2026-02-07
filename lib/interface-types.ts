/** Element innerhalb eines Segments */
export interface InterfaceElement {
  path: string;
  description?: string;
  status: string;
}

/** Segment oder Segment-Gruppe */
export interface InterfaceSegment {
  path: string;
  description: string;
  status: string;
  level: number;
  qualifier?: string;
  elements?: InterfaceElement[];
  children?: InterfaceSegment[];
}

/** Importierte Interface-Definition (z.B. EDIFACT DESADV) */
export interface InterfaceDefinition {
  message_type: string;
  version: string;
  guideline: string;
  guideline_version: string;
  segments: InterfaceSegment[];
}
