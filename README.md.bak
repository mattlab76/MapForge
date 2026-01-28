# MapForge – Systemseiten (v5)

## Navigation / Routen
- Pro internes System eigene Route:
  - `/systems/lbase/inbound` / `/systems/lbase/outbound`
  - `/systems/translogica/...`
  - `/systems/sap/...`
  - `/systems/lfs/...`
  - `/systems/warta/...`

## Inbound / Outbound Logik (wie besprochen)
- **Outbound (Meine Firma → Kunde)**:
  - **Source** = fix hinterlegte Interface-Definition (intern)
  - **Destination** = Kunde (XSD import oder manuell)

- **Inbound (Kunde → Meine Firma)**:
  - **Source** = Kunde (XSD import oder manuell)
  - **Destination** = fix hinterlegte Interface-Definition (intern)

## Fixe Interface Definitions
- `lib/interfaces/*` + Registrierung in `lib/interfaces/registry.ts`
- Aktuell live: **LBase / Outbound: SFAR-Fahrt (SDG)** (aus Lobster ExportTree CSV)

Andere Systeme sind vorbereitet (Navigation + Routen), aber aktuell ohne Messages.
