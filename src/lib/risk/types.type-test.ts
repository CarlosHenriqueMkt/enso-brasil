/**
 * Compile-time type tests for risk engine contracts.
 *
 * Filename ends `.type-test.ts` (NOT `.test.ts`) so Vitest does not execute it.
 * `tsc --noEmit` covers it as part of the project's type-check.
 *
 * RISK-03 — Severity ↔ Alert.severity bidirectional assignability.
 * RISK-08 — P2 StateSnapshot forward-assignable to StateSnapshotPayload (superset).
 */

import type { Alert } from "@/lib/sources/schema";
import type { StateSnapshot } from "@/lib/api/schemas";
import type { Severity, StateSnapshotPayload } from "./types";

// RISK-03 (a): Severity is assignable to Alert['severity']
const _sevToAlert: Alert["severity"] = "moderate" as Severity;
// RISK-03 (b): Alert['severity'] is assignable to Severity
const _alertToSev: Severity = "low" as Alert["severity"];

// RISK-08: P2 StateSnapshot is forward-assignable to StateSnapshotPayload
// (additive superset — adding `explanation` MUST be the only structural delta)
declare const p2Snap: StateSnapshot;
const _superset: Omit<StateSnapshotPayload, "explanation"> = p2Snap;

// Suppress unused-var warnings (file exists for type-checking only)
void _sevToAlert;
void _alertToSev;
void _superset;
