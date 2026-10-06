import { buildDataset, reconcileRows, reconcileStore } from './seed-core.mjs'
import type { EntryRow } from './types'

// 本地持久化：数据放在 localStorage 里，刷新、关掉再打开都还在。
// 信封带样例版本与业务日期；读取时按 src/data/seed-core.mjs 的统一口径对账：
// 重复初始化不产生重复记录，真实修改（_touched）不被样例覆盖，跨版本/跨天平滑滚动。
const STORAGE_KEY = 'underground-pipeline-inspection:entries'

// 运行环境基准样例（模块加载时按当前时刻生成一次，HMR/会话内保持稳定）。
const runtimeDataset = buildDataset()

let cache: Record<string, EntryRow[]> | null = null

type StorageEnvelope = {
  version?: string
  bizDate?: string
  rows?: Record<string, EntryRow[]>
}

function isEnvelope(value: unknown): value is StorageEnvelope {
  if (!value || typeof value !== 'object') {
    return false
  }
  const envelope = value as Record<string, unknown>
  return 'rows' in envelope || 'version' in envelope || 'bizDate' in envelope
}

function seedRows(): Record<string, EntryRow[]> {
  const rows: Record<string, EntryRow[]> = {}
  for (const [key, module] of Object.entries(runtimeDataset.modules)) {
    rows[key] = module.rows.map((row) => ({ ...row }))
  }
  return rows
}

function normalize(raw: unknown): { rows: Record<string, EntryRow[]>; meta: { version?: string; bizDate?: string } } {
  if (isEnvelope(raw)) {
    return { rows: raw.rows ?? {}, meta: { version: raw.version, bizDate: raw.bizDate } }
  }
  if (raw && typeof raw === 'object') {
    // 旧版直接存 Record<模块, 行[]>，没有版本信封。
    return { rows: raw as Record<string, EntryRow[]>, meta: {} }
  }
  return { rows: {}, meta: {} }
}

function readStorage(): Record<string, EntryRow[]> {
  const persist = typeof window !== 'undefined' && Boolean(window.localStorage)

  if (!persist) {
    const fresh = seedRows()
    cache = fresh
    return fresh
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const fresh = seedRows()
    writeStorage(fresh, runtimeDataset.version, runtimeDataset.bizDate)
    cache = fresh
    return fresh
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const fresh = seedRows()
    writeStorage(fresh, runtimeDataset.version, runtimeDataset.bizDate)
    cache = fresh
    return fresh
  }

  const { rows: stored, meta } = normalize(parsed)
  const { rows, report } = reconcileStore(stored, meta)
  // 对账结果与现状一致时也回写一次信封，保证旧存储升级为新结构。
  writeStorage(rows, report.version, report.bizDate)
  cache = rows
  return rows
}

function writeStorage(rows: Record<string, EntryRow[]>, version: string, bizDate: string): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version, bizDate, rows }),
  )
}

export function allRows(): Record<string, EntryRow[]> {
  if (cache === null) {
    cache = readStorage()
  }
  return cache
}

export function listRows(key: string): EntryRow[] {
  return allRows()[key] ?? []
}

export function saveRows(key: string, rows: EntryRow[]): void {
  const next = { ...allRows(), [key]: rows }
  cache = next
  writeStorage(next, runtimeDataset.version, runtimeDataset.bizDate)
}

// 重置单个模块：样例行强制回到当前口径，用户自己登记的记录（样例编号之外）继续保留；
// 重复执行结果一致，不会多出记录。
export function resetRows(key: string): EntryRow[] {
  const existing = allRows()[key] ?? []
  const { rows } = reconcileRows(key, existing, runtimeDataset, {}, new Date(), true)
  saveRows(key, rows)
  return rows
}

export function storageKey(): string {
  return STORAGE_KEY
}

export function runtimeSampleInfo(): { version: string; bizDate: string; generatedAt: string } {
  return {
    version: runtimeDataset.version,
    bizDate: runtimeDataset.bizDate,
    generatedAt: runtimeDataset.generatedAt,
  }
}
