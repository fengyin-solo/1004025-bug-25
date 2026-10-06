import { MODULE_BY_KEY } from '@/data/modules'
import {
  allRows,
  listRows,
  resetRows,
  restoreSamples as restoreSamplesInStore,
  restoreState,
  saveRows,
  SEED_VERSION,
} from '@/data/local-store'
import { TOUCHED_FIELD } from '@/data/seed'
import type {
  ActionResult,
  EntryRow,
  MetricValue,
  ModuleMeta,
  OverviewResult,
  PageResult,
  RestoreInfo,
} from '@/data/types'

// 会写进数据的「往回走」动作：命中就把这条记录标成异常态，看板上能一眼看出来。
const NEGATIVE_ACTIONS = ['撤销', '作废', '拒绝', '驳回', '停用', '忽略', '下线', '回滚']

// 外出维修的动作必须按派遣顺序走，防止跳过出发直接返回之类的状态/时间错档。
const ORDERED_FLOW: Record<string, string> = {
  out_repair: 'out_repair',
}

export function moduleMeta(key: string): ModuleMeta {
  const meta = MODULE_BY_KEY.get(key)
  if (!meta) {
    throw new Error(`没有登记名为 ${key} 的业务模块`)
  }
  return meta
}

export function filterRows(rows: EntryRow[], filters: Record<string, string>): EntryRow[] {
  const pairs = Object.entries(filters).filter(([, value]) => value.trim() !== '')
  if (pairs.length === 0) {
    return rows
  }
  return rows.filter((row) =>
    pairs.every(([field, value]) => String(row[field] ?? '').includes(value.trim())),
  )
}

export function listEntries(key: string, filters: Record<string, string> = {}): PageResult {
  const matched = filterRows(listRows(key), filters)
  return { items: matched, total: matched.length, page: 1, size: matched.length }
}

function nowStamp(): string {
  const now = new Date()
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function todayText(): string {
  return nowStamp().slice(0, 10)
}

// 动作流转时顺手维护的派生字段，保证列表/详情里状态与业务字段不打架。
function deriveSideEffects(key: string, action: string, row: EntryRow): EntryRow {
  const next = { ...row }
  if (key === 'out_repair') {
    if (action === '下达派遣') {
      if (!String(next['出发时间'] ?? '')) {
        next['出发时间'] = nowStamp()
      }
      next['返回时间'] = ''
    } else if (action === '出发维修') {
      if (!String(next['出发时间'] ?? '')) {
        next['出发时间'] = nowStamp()
      }
      next['返回时间'] = ''
    } else if (action === '返回确认') {
      if (!String(next['出发时间'] ?? '')) {
        next['出发时间'] = nowStamp()
      }
      next['返回时间'] = nowStamp()
    }
    next['维修状态'] = next.status
  }
  return next
}

export function runAction(key: string, id: number, action: string): ActionResult {
  const meta = moduleMeta(key)
  const target = meta.actionTargets[action]
  if (!target) {
    return { ok: false, message: `${meta.entity}没有登记「${action}」这个动作` }
  }
  const rows = listRows(key)
  const index = rows.findIndex((row) => Number(row.id) === id)
  if (index < 0) {
    return { ok: false, message: `没有找到编号为 ${id} 的${meta.entity}` }
  }
  const current = String(rows[index].status)
  if (current === target) {
    return { ok: false, message: `${meta.entity}已经是「${target}」，不用重复操作` }
  }
  if (ORDERED_FLOW[key]) {
    // 外出维修：动作 i 只能从状态 i 发起（待派遣→已派遣→维修中→已返回）
    const actionIndex = meta.actions.indexOf(action)
    const required = meta.statuses[actionIndex]
    if (actionIndex >= 0 && current !== required) {
      return {
        ok: false,
        message: `当前是「${current}」，不能直接${action}，请先完成前置环节`,
      }
    }
  }
  const lastStatus = meta.statuses[meta.statuses.length - 1]
  const updated: EntryRow = {
    ...rows[index],
    status: target,
    pending: target !== lastStatus,
    abnormal: NEGATIVE_ACTIONS.some((verb) => action.startsWith(verb)),
    // 真实修改标记：样例恢复时这条只补缺字段，不被样例覆盖
    [TOUCHED_FIELD]: true,
  }
  const next = [...rows]
  next[index] = deriveSideEffects(key, action, updated)
  saveRows(key, next)
  return { ok: true, message: `${meta.entity}已${action}，当前状态「${target}」` }
}

export function resetModule(key: string): PageResult {
  resetRows(key)
  return listEntries(key)
}

export function exportEntries(key: string): { filename: string; content: string } {
  const meta = moduleMeta(key)
  const header = ['编号', ...meta.fields, '当前状态']
  const lines = [header.join(',')]
  for (const row of listRows(key)) {
    lines.push([row.id, ...meta.fields.map((field) => row[field] ?? ''), row.status].join(','))
  }
  return { filename: `${meta.name}-清单.csv`, content: `\uFEFF${lines.join('\n')}` }
}

export function downloadEntries(key: string): void {
  const { filename, content } = exportEntries(key)
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

// 各模块「当日/今日」类指标对应的时间字段（口径写死在这里，页面不各算各的）。
const DATE_FIELD_HINTS: Record<string, string[]> = {
  out_repair: ['出发时间'],
  inspection: ['巡检日期'],
  water_quality: ['取样日期'],
  emergency: ['接报时间'],
}

function dateFieldFor(meta: ModuleMeta): string | null {
  const hinted = DATE_FIELD_HINTS[meta.key]
  if (hinted) {
    return hinted.find((f) => meta.fields.includes(f)) ?? null
  }
  return (
    meta.fields.find((f) => f.includes('时间') || f.includes('时段')) ??
    meta.fields.find((f) => f.includes('日期')) ??
    null
  )
}

function statusForMetricLabel(meta: ModuleMeta, label: string): string | null {
  return meta.statuses.find((status) => label.includes(status)) ?? null
}

// 模块指标统一口径（页面不各算各的）：
//   - 指标名含状态名：按状态计数
//   - 含「当日/今日」：按该模块时间字段是否是今天计数（外出维修即当日派遣=今天出发的派遣单数）
//   - 含「总数/计划数」：按记录总数
//   - 漏点总数：对「漏点数量」求和
//   - 严重缺陷：严重等级含「严重」
export function computeMetric(meta: ModuleMeta, label: string, rows: EntryRow[]): number {
  const status = statusForMetricLabel(meta, label)
  if (status && !/(当日|今日)/.test(label)) {
    return rows.filter((row) => String(row.status) === status).length
  }
  if (/(当日|今日)/.test(label)) {
    const field = dateFieldFor(meta)
    if (!field) {
      return 0
    }
    const today = todayText()
    return rows.filter((row) => String(row[field] ?? '').slice(0, 10) === today).length
  }
  if (label.includes('漏点总数')) {
    return rows.reduce((sum, row) => sum + (Number(row['漏点数量']) || 0), 0)
  }
  if (label === '严重缺陷') {
    return rows.filter((row) => String(row['严重等级'] ?? '').includes('严重')).length
  }
  if (/(总数|计划数)/.test(label)) {
    return rows.length
  }
  return 0
}

export function moduleMetrics(key: string, rows: EntryRow[] = listRows(key)): MetricValue[] {
  const meta = moduleMeta(key)
  return meta.metrics.map((label) => ({ label, value: computeMetric(meta, label, rows) }))
}

// 外出维修专用：详情页展示的衔接信息（时间是否齐全、实际工时）。
export function outRepairTiming(row: EntryRow): {
  dispatched: boolean
  departed: boolean
  returned: boolean
  actualHours: string
  coherent: boolean
  warnings: string[]
} {
  const depart = String(row['出发时间'] ?? '')
  const back = String(row['返回时间'] ?? '')
  const warnings: string[] = []
  let coherent = true
  const departed = depart !== ''
  const returned = back !== ''
  const dispatched = String(row.status) !== '待派遣'

  if (row.status === '待派遣' && (depart !== '' || back !== '')) {
    warnings.push('待派遣记录不应存在出发/返回时间')
    coherent = false
  }
  if ((row.status === '已派遣' || row.status === '维修中') && !departed) {
    warnings.push('已派出但缺少出发时间')
    coherent = false
  }
  if ((row.status === '已派遣' || row.status === '维修中') && returned) {
    warnings.push('尚未返回却已填写返回时间')
    coherent = false
  }
  if (row.status === '已返回' && (!departed || !returned)) {
    warnings.push('已返回但出发/返回时间不完整')
    coherent = false
  }
  if (returned && departed && back < depart) {
    warnings.push('返回时间早于出发时间')
    coherent = false
  }

  let actualHours = '—'
  if (depart) {
    const start = new Date(depart.replace(' ', 'T')).getTime()
    const end = returned ? new Date(back.replace(' ', 'T')).getTime() : Date.now()
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      actualHours = `${Math.round(((end - start) / 3600000) * 10) / 10}小时`
    }
  }
  return { dispatched, departed, returned, actualHours, coherent, warnings }
}

export function loadOverview(): OverviewResult {
  const rows = allRows()
  const modules = [...MODULE_BY_KEY.values()].map((meta) => {
    const entries = rows[meta.key] ?? []
    return {
      key: meta.key,
      name: meta.name,
      created: entries.length,
      pending: entries.filter((row) => row.pending).length,
      abnormal: entries.filter((row) => row.abnormal).length,
      metrics: meta.metrics.map((label) => ({
        label,
        value: computeMetric(meta, label, entries),
      })),
    }
  })
  const cards = [
    { label: '业务模块', value: modules.length },
    { label: '登记总量', value: modules.reduce((sum, item) => sum + item.created, 0) },
    { label: '待处理', value: modules.reduce((sum, item) => sum + item.pending, 0) },
    { label: '异常量', value: modules.reduce((sum, item) => sum + item.abnormal, 0) },
  ]
  return { cards, modules, seedVersion: SEED_VERSION }
}

export function getRestoreState(): RestoreInfo {
  const state = restoreState()
  return { ...state, seedVersion: SEED_VERSION }
}

export function restoreSampleData(): RestoreInfo {
  const state = restoreSamplesInStore()
  return { ...state, seedVersion: SEED_VERSION }
}
