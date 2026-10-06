import { MODULE_BY_KEY } from '@/data/modules'
import {
  allRows,
  listRows,
  resetRows,
  runtimeSampleInfo,
  saveRows,
} from '@/data/local-store'
import { dateTime, isDispatchedToday, NEGATIVE_ACTIONS, checkStatusTransition } from '@/data/seed-core.mjs'
import type {
  ActionResult,
  DeployStatus,
  EntryRow,
  ModuleMeta,
  OverviewResult,
  PageResult,
} from '@/data/types'

// 负向动作清单来自统一口径 seed-core；内部字段不导出、不参与筛选。
export const INTERNAL_FIELDS = ['id', 'status', 'pending', 'abnormal', '_touched', '_dispatchedAt']

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

  // 外出维修（strictFlow）动作必须逐格推进，防止越级造成出发/返回时间衔接不上；
  // 其他模块允许向前跳态（如验收中→需返修、运行中→故障中），只拦后退与重复。
  // 负向动作（忽略/作废/驳回等）允许跳态，但留下 abnormal 标记；「恢复…」回首态也放行。
  // 规则与样例生成器同处一处（seed-core.checkStatusTransition）。
  const transition = checkStatusTransition(meta.statuses, current, target, action, Boolean(meta.strictFlow))
  if (!transition.allowed) {
    if (transition.reason === 'duplicate') {
      return { ok: false, message: `${meta.entity}已经是「${target}」，不用重复操作` }
    }
    const hint = transition.reason === 'skip' ? '请按顺序逐环节流转' : '不能回退到更早的状态'
    return {
      ok: false,
      message: `${meta.entity}当前是「${current}」，不能直接${action}到「${target}」，${hint}`,
    }
  }
  const isNegative = NEGATIVE_ACTIONS.some((verb) => action.startsWith(verb))

  const lastStatus = meta.statuses[meta.statuses.length - 1]
  const updated: EntryRow = {
    ...rows[index],
    status: target,
    pending: target !== lastStatus,
    abnormal: isNegative,
    _touched: true,
  }

  // 动作与业务字段衔接（如下达派遣写派遣时刻、返回确认写返回时间、镜像状态列跟随状态）。
  const syncRule = meta.fieldSync?.find((rule) => rule.action === action)
  if (syncRule) {
    const stamp = dateTime(new Date())
    for (const [field, kind] of Object.entries(syncRule.set)) {
      if (kind === 'status') {
        updated[field] = target
      } else if (kind === 'nowDate') {
        updated[field] = stamp.slice(0, 10)
      } else {
        updated[field] = stamp
      }
    }
  }

  const next = [...rows]
  next[index] = updated
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
  return { filename: `${meta.name}-清单.csv`, content: `﻿${lines.join('\n')}` }
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

// 页面指标卡：按模块 metricRules 实时计算，不再让页面写死 0。
export function moduleStats(key: string): { label: string; value: number }[] {
  const meta = moduleMeta(key)
  const rows = listRows(key)
  const rules = meta.metricRules ?? []
  const values = rules.map((rule) => {
    if (rule.kind === 'statusCount') {
      return rows.filter((row) => String(row.status) === rule.status).length
    }
    if (rule.kind === 'todayDispatched') {
      return rows.filter((row) => isDispatchedToday(row)).length
    }
    return 0
  })
  // 没有配置规则的模块仍按原顺序展示文案，值置 0（保持旧页面行为）。
  return meta.metrics.map((label, index) => ({
    label,
    value: values[index] ?? 0,
  }))
}

export function loadOverview(): OverviewResult {
  const rows = allRows()
  const modules = [...MODULE_BY_KEY.values()].map((meta) => {
    const entries = rows[meta.key] ?? []
    return {
      name: meta.name,
      created: entries.length,
      pending: entries.filter((row) => row.pending).length,
      abnormal: entries.filter((row) => row.abnormal).length,
    }
  })
  const cards = [
    { label: '业务模块', value: modules.length },
    { label: '登记总量', value: modules.reduce((sum, item) => sum + item.created, 0) },
    { label: '待处理', value: modules.reduce((sum, item) => sum + item.pending, 0) },
    { label: '异常量', value: modules.reduce((sum, item) => sum + item.abnormal, 0) },
  ]
  return { cards, modules }
}

// 工作台读取部署流水线状态（public/deploy-status.json，dev/preview/部署后都同路径）。
export async function loadDeploymentStatus(): Promise<{
  deploy: DeployStatus | null
  runtimeSample: ReturnType<typeof runtimeSampleInfo>
  seedConsistent: boolean
}> {
  const runtimeSample = runtimeSampleInfo()
  let deploy: DeployStatus | null = null
  let seedConsistent = false
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}deploy-status.json`, { cache: 'no-store' })
    if (response.ok) {
      deploy = (await response.json()) as DeployStatus
      seedConsistent = deploy?.seed?.version === runtimeSample.version
    }
  } catch {
    // dev 环境没跑过部署流水线时拿不到状态文件，工作台按「未执行」展示。
  }
  return { deploy, runtimeSample, seedConsistent }
}
