import type {
  EntryRow,
  ReconcileReport,
  ReconcileStats,
  SeedDataset,
} from './types'

export const SEED_VERSION: string

export const NEGATIVE_ACTIONS: string[]

export function checkStatusTransition(
  statuses: string[],
  current: string,
  target: string,
  action: string,
  strict?: boolean,
): { allowed: boolean; reason?: 'duplicate' | 'skip' | 'backward' | 'unknown' }

export function dateOnly(d: Date | string): string
export function dateTime(d: Date | string): string
export function buildDataset(now?: Date): SeedDataset

export function reconcileRows(
  key: string,
  existing: EntryRow[],
  dataset: SeedDataset,
  meta?: { version?: string; bizDate?: string },
  now?: Date,
  force?: boolean,
): { rows: EntryRow[]; stats: ReconcileStats }

export function reconcileStore(
  existingRows: Record<string, EntryRow[]>,
  meta?: { version?: string; bizDate?: string },
  now?: Date,
): { rows: Record<string, EntryRow[]>; report: ReconcileReport }

export function isDispatchedToday(row: EntryRow, today?: string): boolean
