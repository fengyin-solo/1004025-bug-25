// 样例口径的唯一来源：初始化数据、本地构建（scripts/deploy）、运行环境（浏览器）
// 全部调用这里的 buildDataset()。同时提供 reconcileRows()：幂等对账，
// 重复恢复不产生重复记录，已有真实修改不被样例覆盖，旧版数据可平滑迁移。

import { MODULE_SPECS, MODULE_SPEC_BY_KEY } from './module-specs.mjs'

// 样例版本：口径有调整时递增，运行环境据此决定是否对账迁移。
export const SEED_VERSION = '2026.10.6-1'

/** @typedef {import('./types').EntryRow} EntryRow */
/** @typedef {import('./types').SeedDataset} SeedDataset */
/** @typedef {import('./types').ReconcileStats} ReconcileStats */
/** @typedef {import('./types').ReconcileReport} ReconcileReport */

// ---------- 日期工具（本地时区，与浏览器展示一致） ----------

function pad2(value) {
  return String(value).padStart(2, '0')
}

export function dateOnly(d) {
  const date = new Date(d)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function dateTime(d) {
  return `${dateOnly(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function shiftDate(base, dayOffset) {
  const d = new Date(`${base}T00:00:00`)
  d.setDate(d.getDate() + dayOffset)
  return dateOnly(d)
}

function shiftDateTime(base, dayOffset, hour, minute) {
  return `${shiftDate(base, dayOffset)} ${pad2(hour)}:${pad2(minute)}`
}

function shiftISO(base, dayOffset, hour, minute) {
  const d = new Date(`${shiftDate(base, dayOffset)}T00:00:00`)
  d.setHours(hour, minute, 0, 0)
  // 用不带时区尾缀的本地时间字面量，浏览器按本地时区解析。
  return d.getFullYear() +
    `-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(hour)}:${pad2(minute)}:00`
}

// 业务编号前缀（沿用原手写样例）。
const CODE_PREFIX = {
  pipeline: 'PIPE',
  inspection: 'INSP',
  defect: 'DEFE',
  out_repair: 'OUT_',
  repair_accept: 'REPA',
  pipe_detect: 'PIPE',
  manhole: 'MANH',
  pump_station: 'PUMP',
  drain_network: 'DRAI',
  water_quality: 'WATE',
  flow_monitor: 'FLOW',
  emergency: 'EMER',
  leak_detect: 'LEAK',
  trenchless: 'TREN',
  pipe_cleaning: 'PIPE',
  facility_archive: 'FACI',
  monitor_device: 'MONI',
  contractor: 'CONT',
}

// 编号字段 -> 前缀的重复前缀（PIPE 同时是管线/检测/清洗），按字段直取即可。
const FIELD_PREFIX = {
  管线编号: 'PIPE',
  任务编号: 'INSP',
  缺陷编号: 'DEFE',
  派遣编号: 'OUT_',
  验收编号: 'REPA',
  井盖编号: 'MANH',
  泵站编号: 'PUMP',
  管段编号: 'DRAI',
  监测点编号: 'FLOW',
  事件编号: 'EMER',
  修复编号: 'TREN',
  清洗编号: 'PIPE',
  档案编号: 'FACI',
  设备编号: 'MONI',
  队伍编号: 'CONT',
}

const DATE_FIELD_HINT = ['日期', '时间', '时段']
function isDateField(field) {
  return DATE_FIELD_HINT.some((hint) => field.includes(hint))
}

function isNumericField(field) {
  return field === '漏点数量' || field.includes('数量') || field.includes('长度')
}

function isCodeField(spec, field) {
  return field === spec.keyField || Boolean(FIELD_PREFIX[field])
}

function codeValue(field, n) {
  return `${FIELD_PREFIX[field] || 'CODE'}-${String(n).padStart(4, '0')}`
}

const STATUS_MIRROR_FIELDS = new Set([
  '任务状态', '记录状态', '维修状态', '验收状态', '检测状态', '当前状态', '运行状态',
  '数据状态', '事件状态', '修复状态', '清洗状态', '档案状态', '设备状态', '队伍状态',
])

// ---------- 外出维修专用样例：时间/工时与状态严格衔接 ----------

function buildOutRepairRows(base) {
  const prefix = 'OUT_'
  return [
    {
      派遣编号: `${prefix}-0001`,
      缺陷来源: 'DEFE-0007 滨河路污水管破裂',
      维修人员: '王建军',
      预计工时: '2小时',
      携带工具: '管道疏通机、潜水泵',
      出发时间: '',
      返回时间: '',
      维修状态: '待派遣',
      status: '待派遣',
    },
    {
      派遣编号: `${prefix}-0002`,
      缺陷来源: 'DEFE-0008 解放南路井盖沉降',
      维修人员: '李国栋',
      预计工时: '3小时',
      携带工具: '液压顶管机、检漏仪',
      出发时间: shiftDateTime(base, -1, 9, 10),
      返回时间: '',
      维修状态: '已派遣',
      status: '已派遣',
      _dispatchedAt: shiftISO(base, -1, 9, 10),
    },
    {
      派遣编号: `${prefix}-0003`,
      缺陷来源: 'DEFE-0009 建设大街接口渗漏',
      维修人员: '张海涛',
      预计工时: '4小时',
      携带工具: '快速堵漏套件、发电机',
      出发时间: shiftDateTime(base, 0, 8, 30),
      返回时间: '',
      维修状态: '维修中',
      status: '维修中',
      _dispatchedAt: shiftISO(base, 0, 8, 30),
    },
    {
      派遣编号: `${prefix}-0004`,
      缺陷来源: 'DEFE-0006 朝阳路支管淤堵',
      维修人员: '赵立明',
      预计工时: '2.5小时',
      携带工具: '高压清洗车、风镐',
      出发时间: shiftDateTime(base, 0, 7, 45),
      返回时间: shiftDateTime(base, 0, 10, 20),
      维修状态: '已返回',
      status: '已返回',
      _dispatchedAt: shiftISO(base, 0, 7, 45),
    },
  ]
}

// 外出维修一致性自检：状态推进到哪一步，时间字段就要衔接到哪一步。
function checkOutRepairRows(rows) {
  const problems = []
  for (const row of rows) {
    const code = row.派遣编号
    if (row.维修状态 !== row.status) {
      problems.push(`${code} 维修状态与状态不一致`)
    }
    if (row.status !== '待派遣' && !row._dispatchedAt) {
      problems.push(`${code} 已派遣但缺少派遣时刻`)
    }
    if (row.status === '待派遣' && row.出发时间) {
      problems.push(`${code} 未派遣却有出发时间`)
    }
    if ((row.status === '已派遣' || row.status === '维修中') && !row.出发时间) {
      problems.push(`${code} ${row.status}但缺少出发时间`)
    }
    if ((row.status === '已派遣' || row.status === '维修中') && row.返回时间) {
      problems.push(`${code} ${row.status}不应有返回时间`)
    }
    if (row.status === '已返回' && !(row.出发时间 && row.返回时间)) {
      problems.push(`${code} 已返回但出发/返回时间不完整`)
    }
  }
  return problems
}

// ---------- 通用样例 ----------

function buildGenericRows(spec, base) {
  const offsets = [-2, -1, 0]
  return spec.statuses.slice(0, 3).map((status, index) => {
    const n = index + 1
    const row = {}
    for (const field of spec.fields) {
      if (field === spec.keyField) {
        row[field] = codeValue(field, n)
      } else if (isCodeField(spec, field)) {
        row[field] = codeValue(field, n)
      } else if (STATUS_MIRROR_FIELDS.has(field)) {
        row[field] = status
      } else if (isDateField(field)) {
        row[field] = shiftDate(base, offsets[index])
      } else if (isNumericField(field)) {
        row[field] = n * 10
      } else if (field === '联系电话') {
        row[field] = `1380000000${n}`
      } else {
        row[field] = `${spec.name}样例${n}`
      }
    }
    row.status = status
    return row
  })
}

function finalizeRow(spec, row, id) {
  const finalStatus = spec.statuses[spec.statuses.length - 1]
  return {
    id,
    pending: row.status !== finalStatus,
    abnormal: false,
    ...row,
  }
}

/**
 * 生成整套样例数据。
 * @param {Date} [now] 基准时刻（默认当前时刻），部署构建时固定注入，保证快照可复现。
 * @returns {SeedDataset}
 */
export function buildDataset(now = new Date()) {
  const base = dateOnly(now)
  const modules = {}
  const problems = []

  for (const spec of MODULE_SPECS) {
    const rawRows = spec.key === 'out_repair' ? buildOutRepairRows(base) : buildGenericRows(spec, base)
    const rows = rawRows.map((row, index) => finalizeRow(spec, row, index + 1))
    const checks = spec.key === 'out_repair' ? checkOutRepairRows(rows) : []
    if (checks.length) {
      problems.push(...checks.map((item) => `[${spec.name}] ${item}`))
    }
    modules[spec.key] = { keyField: spec.keyField, checks, rows }
  }

  if (problems.length) {
    throw new Error(`样例数据一致性自检未通过：\n- ${problems.join('\n- ')}`)
  }

  return {
    version: SEED_VERSION,
    generatedAt: new Date(now).toISOString(),
    bizDate: base,
    modules,
  }
}

// ---------- 运行环境对账 ----------

function keyOf(row, keyField) {
  return String(row[keyField] ?? '')
}

// 旧版（version 1 手写 seed.ts）样例行的识别：仍是「模块名样例N」占位口径。
function looksLegacySample(spec, row) {
  if (row._touched) {
    return false
  }
  const code = keyOf(row, spec.keyField)
  const legacyPrefix = CODE_PREFIX[spec.key]
  if (!code.startsWith(`${legacyPrefix}-`)) {
    return false
  }
  const n = Number(code.split('-')[1])
  if (!Number.isInteger(n)) {
    return false
  }
  const status = String(row.status ?? '')
  if (!spec.statuses.slice(0, 3).includes(status)) {
    return false
  }
  const fields = spec.fields.filter((field) => field !== spec.keyField)
  return fields.some((field) => {
    const value = row[field]
    if (value === undefined || value === null || value === '') {
      return false
    }
    if (isDateField(field)) {
      return /^2026-09-0[1-3]$/.test(String(value))
    }
    // 状态镜像字段新旧样例都等于 status，不能单独作为判据。
    if (STATUS_MIRROR_FIELDS.has(field)) {
      return false
    }
    return String(value) === `${spec.name}样例${n}`
  })
}

/**
 * 把已有行和最新样例对账（幂等）。
 * - 样例身份：业务编号（keyField）；真实修改过的样例行打 _touched，原样保留。
 * - 用户自建记录：样例里没有对应编号，永远保留，不删除。
 * - 缺失样例：补齐（重复恢复不会多，也不会少）。
 * - 旧版手写样例：仍是占位口径的，平滑替换为衔接后的新样例。
 * - 业务日期跨天：未改动的当天样例随日期滚动，「当日派遣」等口径不会停在昨天。
 * @param {{ version?: string, bizDate?: string }} [meta]
 * @param {Date} [now]
 * @param {boolean} [force] 显式重置：样例行强制回到当前口径（忽略 _touched），自建记录仍保留。
 * @returns {{ rows: EntryRow[], stats: ReconcileStats }}
 */
export function reconcileRows(key, existing, dataset, meta = {}, now = new Date(), force = false) {
  const spec = MODULE_SPEC_BY_KEY.get(key)
  if (!spec) {
    throw new Error(`没有登记名为 ${key} 的业务模块`)
  }
  const sampleModule = dataset.modules[key]
  const sampleRows = (sampleModule?.rows ?? []).map((row) => ({ ...row }))
  const keyField = spec.keyField
  const today = dateOnly(now)

  const stats = {
    key: keyField,
    kept: 0,
    replaced: 0,
    added: 0,
    customKept: 0,
  }

  const sampleByKey = new Map(sampleRows.map((row) => [keyOf(row, keyField), row]))
  const usedKeys = new Set()
  const next = []

  for (const row of existing) {
    const code = keyOf(row, keyField)
    const sample = code ? sampleByKey.get(code) : undefined
    if (!sample) {
      // 用户自建（或样例已不认识）的记录：原样保留。
      stats.customKept += 1
      next.push({ ...row })
      continue
    }
    usedKeys.add(code)
    const legacy = looksLegacySample(spec, row)
    // 同版本同业务日期：已对账过的数据原样保留，不做启发式判断。
    const rolled = meta.version === dataset.version && meta.bizDate === today
    // 跨版本/跨天：未改动的旧占位样例行滚到新口径；已改成真实内容的行保留。
    const keepAsIs = !force && (Boolean(row._touched) || rolled || !legacy)
    if (keepAsIs) {
      stats.kept += 1
      next.push({ ...row })
    } else {
      // 旧样例迁移，或跨天滚动：用最新口径替换，但沿用原 id。
      stats.replaced += 1
      next.push({ ...sample, id: row.id })
    }
  }

  sampleRows.forEach((sample) => {
    if (!usedKeys.has(keyOf(sample, keyField))) {
      stats.added += 1
      next.push({ ...sample })
    }
  })

  // 按 id 稳定排序（样例 id 连续，用户自建通常更大）。
  next.sort((a, b) => Number(a.id) - Number(b.id))
  return { rows: next, stats }
}

/**
 * 对账整个存储（全部模块），返回新版本信封。
 * @param {Record<string, EntryRow[]>} existingRows
 * @param {{ version?: string, bizDate?: string }} [meta]
 * @param {Date} [now]
 * @returns {{ rows: Record<string, EntryRow[]>, report: ReconcileReport }}
 */
export function reconcileStore(existingRows, meta = {}, now = new Date()) {
  const dataset = buildDataset(now)
  const rows = {}
  const stats = {}
  for (const spec of MODULE_SPECS) {
    const result = reconcileRows(spec.key, existingRows[spec.key] ?? [], dataset, meta, now)
    rows[spec.key] = result.rows
    stats[spec.key] = result.stats
  }
  return {
    rows,
    report: {
      version: dataset.version,
      bizDate: dataset.bizDate,
      stats,
    },
  }
}

// 会写进数据的「往回走/负向」动作：允许跳态，但记录会被标成异常态。
export const NEGATIVE_ACTIONS = ['撤销', '作废', '拒绝', '驳回', '停用', '忽略', '下线', '回滚']

/**
 * 判断动作是否允许从当前状态转到目标状态。
 * - strict（外出维修等时间字段强耦合模块）：必须逐格前进，禁止越级/后退/重复。
 * - 非 strict 模块：允许向前跳态（如验收中→需返修、运行中→故障中），只禁止后退与重复。
 * - 负向动作与「恢复…」回首态一律放行（由调用方标 abnormal）。
 * @param {boolean} [strict]
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function checkStatusTransition(statuses, current, target, action, strict = false) {
  if (current === target) {
    return { allowed: false, reason: 'duplicate' }
  }
  const negative = NEGATIVE_ACTIONS.some((verb) => action.startsWith(verb))
  const restoring = action.includes('恢复') && statuses.indexOf(target) === 0
  if (negative || restoring) {
    return { allowed: true }
  }
  const from = statuses.indexOf(current)
  const to = statuses.indexOf(target)
  if (from < 0 || to < 0) {
    return { allowed: false, reason: 'unknown' }
  }
  if (to < from) {
    return { allowed: false, reason: 'backward' }
  }
  if (strict && to !== from + 1) {
    return { allowed: false, reason: 'skip' }
  }
  return { allowed: true }
}

// 「当日派遣」口径：已越过待派遣，且派遣时刻/出发时间落在今天。
export function isDispatchedToday(row, today = dateOnly(new Date())) {
  if (String(row.status) === '待派遣') {
    return false
  }
  const stamp = String(row._dispatchedAt ?? '')
  if (stamp) {
    return stamp.slice(0, 10) === today
  }
  // 兼容旧数据：没有内部派遣时刻时退回出发时间。
  const departed = String(row.出发时间 ?? '')
  return Boolean(departed) && departed.slice(0, 10) === today
}
