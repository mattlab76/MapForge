import { z } from "zod";
import { Direction, getDefaultMessageId, getMessage } from "@/lib/interfaces";

export const MappingRowSchema = z.object({
  id: z.string(),
  source: z.string().optional().default(""),
  destination: z.string().optional().default(""),
  status: z.enum(["open", "in_review", "clarified", "done"]).default("open"),
  comment: z.string().optional().default(""),
});

export type MappingRow = z.infer<typeof MappingRowSchema>;

export const RoundSchema = z.object({
  id: z.string(), // "R01"...
  rows: z.array(MappingRowSchema).default([]),
});
export type Round = z.infer<typeof RoundSchema>;

/**
 * AppState v4:
 * - direction: inbound/outbound separation (stored & separate localStorage slots)
 * - messageId: fixed interface/message definition (fixed fields are derived from it)
 * - otherFieldCatalog: fields for the non-fixed side (from XSD import or manual entry)
 * - rounds: mapping rounds (Source/Destination strings, depending on direction)
 */
export const AppStateV4Schema = z.object({
  version: z.literal(4),
  updatedAt: z.string(),
  direction: z.enum(["inbound", "outbound"]),
  messageId: z.string(),
  otherFieldCatalog: z.array(z.string()).default([]),
  rounds: z.array(RoundSchema),
  activeRoundId: z.string(),
});
export type AppState = z.infer<typeof AppStateV4Schema>;

/** Legacy v2 */
const AppStateV2Schema = z.object({
  version: z.literal(2),
  updatedAt: z.string(),
  messageId: z.string(),
  sourceFieldCatalog: z.array(z.string()).default([]),
  rounds: z.array(RoundSchema),
  activeRoundId: z.string(),
});

/** Legacy v1 */
const AppStateV1Schema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  fieldCatalog: z.array(z.string()).default([]),
  rounds: z.array(RoundSchema),
  activeRoundId: z.string(),
});

export function storageKey(direction: Direction): string {
  return `mapforge_state_v4_${direction}`;
}

export function createEmptyState(direction: Direction, defaultMessageId?: string): AppState {
  const messageId = defaultMessageId ?? getDefaultMessageId(direction);
  const msg = getMessage(messageId);
  return {
    version: 4,
    updatedAt: new Date().toISOString(),
    direction,
    messageId: msg.id,
    otherFieldCatalog: [],
    rounds: [{ id: "R01", rows: [] }],
    activeRoundId: "R01",
  };
}

export function normalizeRoundId(n: number): string {
  const s = String(n).padStart(2, "0");
  return `R${s}`;
}

export function validateState(input: unknown, fallbackDirection: Direction = "outbound"): AppState {
  const v4 = AppStateV4Schema.safeParse(input);
  if (v4.success) {
    const msg = getMessage(v4.data.messageId);
    return {
      ...v4.data,
      messageId: msg.id,
      otherFieldCatalog: v4.data.otherFieldCatalog ?? [],
      rounds: v4.data.rounds?.length ? v4.data.rounds : [{ id: "R01", rows: [] }],
      activeRoundId: v4.data.activeRoundId ?? "R01",
    };
  }

  // v3 migration
  const v3 = z
    .object({
      version: z.literal(3),
      updatedAt: z.string(),
      direction: z.enum(["inbound", "outbound"]),
      messageId: z.string(),
      sourceFieldCatalog: z.array(z.string()).default([]),
      rounds: z.array(RoundSchema),
      activeRoundId: z.string(),
    })
    .safeParse(input);
  if (v3.success) {
    const msg = getMessage(v3.data.messageId);
    const migrated = createEmptyState(v3.data.direction, msg.id);
    migrated.updatedAt = v3.data.updatedAt;
    // Previous "sourceFieldCatalog" is kept as the "other" side catalog in v4.
    migrated.otherFieldCatalog = v3.data.sourceFieldCatalog ?? [];
    migrated.rounds = v3.data.rounds?.length ? v3.data.rounds : migrated.rounds;
    migrated.activeRoundId = v3.data.activeRoundId ?? migrated.activeRoundId;
    return migrated;
  }

  const v2 = AppStateV2Schema.safeParse(input);
  if (v2.success) {
    // If message is outbound/inbound we can infer direction from the message.
    const msg = getMessage(v2.data.messageId);
    const direction: Direction = (msg as any).direction ?? fallbackDirection;
    const migrated = createEmptyState(direction, msg.id);
    migrated.updatedAt = v2.data.updatedAt;
    migrated.otherFieldCatalog = v2.data.sourceFieldCatalog ?? [];
    migrated.rounds = v2.data.rounds?.length ? v2.data.rounds : migrated.rounds;
    migrated.activeRoundId = v2.data.activeRoundId ?? migrated.activeRoundId;
    return migrated;
  }

  const v1 = AppStateV1Schema.safeParse(input);
  if (v1.success) {
    const migrated = createEmptyState(fallbackDirection);
    migrated.updatedAt = v1.data.updatedAt;
    migrated.otherFieldCatalog = v1.data.fieldCatalog ?? [];
    migrated.rounds = v1.data.rounds?.length ? v1.data.rounds : migrated.rounds;
    migrated.activeRoundId = v1.data.activeRoundId ?? migrated.activeRoundId;
    return migrated;
  }

  return createEmptyState(fallbackDirection);
}
