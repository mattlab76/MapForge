export type Direction = "inbound" | "outbound";

export type MappingStatus = "open" | "in_review" | "clarified" | "done";

export type MappingRow = {
  id: string;
  source: string;
  destination: string;
  status: MappingStatus;
  comment: string;
  /** Optional grouping for UI sections (e.g., address rubrics on inbound). */
  rubric?: string;
};

export type Round = {
  id: string;
  rows: MappingRow[];
};

export type InterfaceField = {
  path: string;
  type?: string;
  min?: number;
  max?: number | "many";
};

export type MessageDefinition = {
  id: string;
  title: string;
  systemId: string;
  directionRole: {
    fixedSide: "source" | "destination";
  };
  fixedFields: InterfaceField[];
};

export type ProjectV3 = {
  version: 3;
  updatedAt: string;
  systemId: string;
  direction: Direction;
  messageId: string;

  sourceCatalog: string[];
  destinationCatalog: string[];

  /** UI state: which inbound rubrics are enabled for this project. */
  rubricEnabled?: string[];

  rounds: Round[];
  activeRoundId: string;
};
