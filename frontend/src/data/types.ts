/** 纯前端数据层的公共类型：与全栈版后端返回的结构保持一致，换回后端时页面不用改。 */

export type EntryRow = {
  id: number
  status: string
  pending: boolean
  abnormal: boolean
  __seed?: string
  __seedVersion?: string
  __touched?: boolean
  [field: string]: string | number | boolean | undefined
}

export type ModuleMeta = {
  key: string
  name: string
  entity: string
  desc: string
  fields: string[]
  statuses: string[]
  actions: string[]
  actionTargets: Record<string, string>
  metrics: string[]
}

export type PageResult = {
  items: EntryRow[]
  total: number
  page: number
  size: number
}

export type ActionResult = {
  ok: boolean
  message: string
}

export type MetricValue = {
  label: string
  value: number
}

export type OverviewModule = {
  key: string
  name: string
  created: number
  pending: number
  abnormal: number
  metrics: MetricValue[]
}

export type OverviewResult = {
  cards: { label: string; value: number }[]
  modules: OverviewModule[]
  seedVersion: string
}

// 样例恢复（部署流水线最后一环）的运行状态：工作台据此显示卡在哪个环节。
export type RestoreInfo = {
  status: 'running' | 'done' | 'failed'
  finished: string[]
  total: number
  failedModule: string | null
  error: string
  startedAt: string
  updatedAt: string
  added: number
  updated: number
  preserved: number
  seedVersion: string
}

// 部署流水线环节状态（由部署脚本写入 window.__DEPLOY_STATE__，工作台直接展示）。
export type DeployStageState = {
  key: string
  label: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  message?: string
}

export type DeployState = {
  runId: string
  status: 'running' | 'success' | 'failed'
  stage: string | null
  stages: DeployStageState[]
  startedAt: string
  finishedAt?: string
  seedVersion: string
  error?: string
}
