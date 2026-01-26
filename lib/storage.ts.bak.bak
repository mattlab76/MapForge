import { z } from "zod";
import type { Direction, ProjectV3 } from "@/lib/types";

export const MappingStatusSchema = z.enum(["open", "in_review", "clarified", "done"]);

const RowSchema = z.object({
  id: z.string().min(1),
  source: z.string(),
  destination: z.string(),
  status: MappingStatusSchema,
  comment: z.string().optional().default(""),
  rubric: z.string().optional(),
});

const RoundSchema = z.object({
  id: z.string().min(1),
  rows: z.array(RowSchema),
});

export const ProjectV3Schema = z.object({
  version: z.literal(3),
  updatedAt: z.string(),
  systemId: z.string().min(1),
  direction: z.enum(["inbound", "outbound"]),
  messageId: z.string().min(1),
  sourceCatalog: z.array(z.string()),
  destinationCatalog: z.array(z.string()),
  rubricEnabled: z.array(z.string()).optional().default([]),
  rounds: z.array(RoundSchema),
  activeRoundId: z.string().min(1),
});

export function storageKey(systemId: string, direction: Direction, messageId: string) {
  return `mapforge:v3:${systemId}:${direction}:${messageId}`;
}

export function makeEmptyProject(params: { systemId: string; direction: Direction; messageId: string }): ProjectV3 {
  const now = new Date().toISOString();
  return {
    version: 3,
    updatedAt: now,
    systemId: params.systemId,
    direction: params.direction,
    messageId: params.messageId,
    sourceCatalog: [],
    destinationCatalog: [],
    rubricEnabled: [],
    rounds: [{ id: "R01", rows: [] }],
    activeRoundId: "R01",
  };
}
