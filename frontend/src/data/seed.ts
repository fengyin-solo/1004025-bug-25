// 浏览器侧入口：样例只有 seed-builder.mjs 一份定义（Node 部署脚本也引用它），
// 这里补上 TypeScript 类型，保证 dev、build、运行环境取到的是同一套口径。
import {
  buildSeedRows,
  naturalKeyFields,
  SEED_VERSION as VERSION,
  SEED_KEY_FIELD as KEY_FIELD,
  SEED_VERSION_FIELD as VERSION_FIELD,
  TOUCHED_FIELD as TOUCHED,
} from './seed-builder.mjs'
import type { EntryRow } from './types'

export const SEED_VERSION: string = VERSION
export const SEED_KEY_FIELD: '__seed' = KEY_FIELD as '__seed'
export const SEED_VERSION_FIELD: '__seedVersion' = VERSION_FIELD as '__seedVersion'
export const TOUCHED_FIELD: '__touched' = TOUCHED as '__touched'

const bundle = buildSeedRows(new Date())

export const SEED_ROWS: Record<string, EntryRow[]> = bundle as Record<string, EntryRow[]>

export const SEED_NATURAL_KEY_FIELD: Record<string, string> =
  naturalKeyFields(bundle) as Record<string, string>
