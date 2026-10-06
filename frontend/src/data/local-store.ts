import {
  SEED_ROWS,
  SEED_VERSION,
  SEED_KEY_FIELD,
  SEED_VERSION_FIELD,
  TOUCHED_FIELD,
  SEED_NATURAL_KEY_FIELD,
} from './seed'
import type { EntryRow } from './types'

// 本地持久化：数据放在 localStorage 里，刷新、关掉再打开都还在。
const STORAGE_KEY = 'underground-pipeline-inspection:db'
// 旧版（无版本）数据的键，首次读到时迁移进新结构后清掉。
const LEGACY_STORAGE_KEY = 'underground-pipeline-inspection:entries'

const SCHEMA_VERSION = 2

export type RestoreStatus = 'running' | 'done' | 'failed'

export type RestoreState = {
  status: RestoreStatus
  // 已完成的模块即检查点：中断/刷新后从第一个未完成模块继续，不重做已完成部分
  finished: string[]
  total: number
  failedModule: string | null
  error: string
  startedAt: string
  updatedAt: string
  // 本轮累计：新增样例数 / 对齐的陈旧样例数 / 保留的真实记录数
  added: number
  updated: number
  preserved: number
}

type DatabaseShape = {
  schemaVersion: number
  seedVersion: string
  modules: Record<string, EntryRow[]>
  restore: RestoreState
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function nowText(): string {
  return new Date().toISOString()
}

function freshModules(): Record<string, EntryRow[]> {
  return clone(SEED_ROWS)
}

function freshRestoreState(status: RestoreStatus = 'done'): RestoreState {
  const stamp = nowText()
  return {
    status,
    finished: [],
    total: Object.keys(SEED_ROWS).length,
    failedModule: null,
    error: '',
    startedAt: stamp,
    updatedAt: stamp,
    added: 0,
    updated: 0,
    preserved: 0,
  }
}

function writeDb(db: DatabaseShape): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  }
}

// 旧样例行的特征：自动生成的占位文本（如「外出维修样例1」）或旧的错误编号（OUT_-0001）。
// 旧版本没有登记入口，能落库的真实数据只会做状态流转；自然键对不上新样例、
// 又带着占位文本的行必然是重建样例后残留的陈旧样例，迁移时丢弃，不允许它污染新口径。
function isStalePlaceholderRow(row: EntryRow): boolean {
  if (typeof row['派遣编号'] === 'string' && /^OUT_-/.test(String(row['派遣编号']))) {
    return true
  }
  return Object.values(row).some(
    (value) => typeof value === 'string' && /样例[0-9]+$/.test(value),
  )
}

// 单模块幂等合并（恢复流水线的一个环节）：
//   - 命中样例自然键且未被真实修改：整行对齐为新样例（修复状态/时间/工时错档）
//   - 命中自然键但被真实修改（__touched）：只补缺字段，状态等真实值一律保留
//   - 对不上自然键的真实记录：原样保留
//   - 样例里缺失的行：补插（自动避让已用 id）
// 重复执行结果收敛，不会多出记录。
function mergeModule(
  key: string,
  existing: EntryRow[],
  dropStalePlaceholders: boolean,
): { rows: EntryRow[]; added: number; updated: number; preserved: number; dropped: number } {
  const keyField = SEED_NATURAL_KEY_FIELD[key] ?? ''
  const seedList = clone(SEED_ROWS[key] ?? [])
  const pendingSeed = new Map<string, EntryRow>()
  for (const seed of seedList) {
    pendingSeed.set(String(seed[SEED_KEY_FIELD]), seed)
  }

  const next: EntryRow[] = []
  const usedIds = new Set<number>()
  let added = 0
  let updated = 0
  let preserved = 0
  let dropped = 0

  for (const oldRow of existing) {
    const naturalKey =
      (oldRow[SEED_KEY_FIELD] != null && String(oldRow[SEED_KEY_FIELD])) ||
      (keyField && oldRow[keyField] != null ? String(oldRow[keyField]) : '')
    const seed = naturalKey ? pendingSeed.get(naturalKey) : undefined
    if (seed) {
      pendingSeed.delete(naturalKey)
      if (oldRow[TOUCHED_FIELD] === true) {
        // 真实修改优先：新样例只补缺字段，任何已有值（含状态）都不覆盖
        next.push({
          ...seed,
          ...oldRow,
          [SEED_KEY_FIELD]: naturalKey,
          [SEED_VERSION_FIELD]: SEED_VERSION,
          [TOUCHED_FIELD]: true,
        })
        preserved += 1
      } else {
        // 未动过的样例：整行对齐新口径（id 以新样例为准，旧记录被替换而非追加）
        next.push({ ...seed, id: Number(oldRow.id) })
        usedIds.add(Number(oldRow.id))
        updated += 1
      }
    } else if (dropStalePlaceholders && isStalePlaceholderRow(oldRow)) {
      dropped += 1
    } else {
      next.push({ ...oldRow })
      usedIds.add(Number(oldRow.id))
      preserved += 1
    }
  }

  for (const seed of pendingSeed.values()) {
    let id = Number(seed.id)
    while (usedIds.has(id)) {
      id += 1
    }
    usedIds.add(id)
    next.push({ ...seed, id })
    added += 1
  }

  next.sort((a, b) => Number(a.id) - Number(b.id))
  return { rows: next, added, updated, preserved, dropped }
}

function blankDb(): DatabaseShape {
  return {
    schemaVersion: SCHEMA_VERSION,
    seedVersion: SEED_VERSION,
    modules: {},
    restore: freshRestoreState('running'),
  }
}

// 从无版本的旧存储读出模块数据（旧结构就是 {模块: 行[]}）。
function readLegacy(): Record<string, EntryRow[]> | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, EntryRow[]>
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

// 从失败/中断环节继续：每个模块完成后立即落检查点，出错则记录卡在哪个模块。
function runPendingModules(db: DatabaseShape, dropStalePlaceholders: boolean): DatabaseShape {
  const state = db.restore
  state.status = 'running'
  state.updatedAt = nowText()
  writeDb(db)

  for (const key of Object.keys(SEED_ROWS)) {
    if (state.finished.includes(key)) {
      continue
    }
    try {
      const result = mergeModule(key, db.modules[key] ?? [], dropStalePlaceholders)
      db.modules[key] = result.rows
      state.added += result.added
      state.updated += result.updated
      state.preserved += result.preserved
      state.finished.push(key)
      state.updatedAt = nowText()
      state.failedModule = null
      state.error = ''
      writeDb(db)
    } catch (error) {
      state.status = 'failed'
      state.failedModule = key
      state.error = error instanceof Error ? error.message : String(error)
      state.updatedAt = nowText()
      writeDb(db)
      return db
    }
  }
  state.status = 'done'
  state.total = Object.keys(SEED_ROWS).length
  state.failedModule = null
  state.error = ''
  state.updatedAt = nowText()
  writeDb(db)
  return db
}

function initDb(): DatabaseShape {
  if (typeof window === 'undefined' || !window.localStorage) {
    // SSR/测试环境拿不到 localStorage：直接返回内存样例，不做持久化。
    return { ...blankDb(), modules: freshModules(), restore: freshRestoreState('done') }
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const db = JSON.parse(raw) as DatabaseShape
      if (db && db.schemaVersion === SCHEMA_VERSION && db.modules) {
        // 上次中断在某个模块：打开工作台时自动从断点继续
        if (db.restore && db.restore.status !== 'done') {
          return runPendingModules(db, false)
        }
        return db
      }
    } catch {
      // 落到下面重建
    }
  }

  const legacy = readLegacy()
  if (legacy) {
    // 旧版数据：分模块迁移对齐，陈旧占位样例允许丢弃；迁完再移除旧键。
    const db = blankDb()
    db.modules = clone(legacy)
    runPendingModules(db, true)
    if (db.restore.status === 'done') {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
    return db
  }

  if (raw) {
    // 新键损坏：旧逻辑同样回退到样例
    const db = blankDb()
    db.modules = freshModules()
    db.restore = freshRestoreState('done')
    writeDb(db)
    return db
  }

  // 首次打开：整库播种样例
  const db = blankDb()
  db.modules = freshModules()
  db.restore = freshRestoreState('done')
  db.restore.finished = Object.keys(SEED_ROWS)
  writeDb(db)
  return db
}

let cache: DatabaseShape | null = null

function db(): DatabaseShape {
  if (cache === null) {
    cache = initDb()
  }
  return cache
}

export function allRows(): Record<string, EntryRow[]> {
  return db().modules
}

export function listRows(key: string): EntryRow[] {
  return allRows()[key] ?? []
}

export function saveRows(key: string, rows: EntryRow[]): void {
  const current = db()
  current.modules = { ...current.modules, [key]: rows }
  writeDb(current)
}

// 显式重置单个模块：回到样例口径（幂等，重复执行不多记录）。
export function resetRows(key: string): EntryRow[] {
  const rows = clone(SEED_ROWS[key] ?? [])
  saveRows(key, rows)
  return rows
}

export function restoreState(): RestoreState {
  return clone(db().restore)
}

// 手动恢复样例：整轮按模块重跑合并，自然键 upsert 保证幂等；
// 中途失败保留检查点，再次调用从未完成模块继续。
export function restoreSamples(): RestoreState {
  const current = db()
  current.restore = freshRestoreState('running')
  writeDb(current)
  runPendingModules(current, false)
  return clone(current.restore)
}

export function storageKey(): string {
  return STORAGE_KEY
}

export { SEED_VERSION }
