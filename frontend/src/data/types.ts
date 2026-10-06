/** 纯前端数据层的公共类型：与全栈版后端返回的结构保持一致，换回后端时页面不用改。 */

export type EntryRow = {
  id: number
  status: string
  pending: boolean
  abnormal: boolean
  /** 内部字段：这条记录被真实操作改过，样例对账时保留，不被新样例覆盖。 */
  _touched?: boolean
  [field: string]: string | number | boolean | undefined
}

// 指标规则：待派遣维修=状态计数；当日派遣=当天新派遣的外出维修。
export type MetricRule =
  | { kind: 'statusCount'; status: string }
  | { kind: 'todayDispatched' }

// 状态动作触发的业务字段同步：派遣记录时刻、返回写返回时间、镜像状态列跟随当前状态。
export type FieldSyncRule = {
  action: string
  set: Record<string, 'nowDate' | 'nowDateTime' | 'status'>
}

export type ModuleMeta = {
  key: string
  name: string
  entity: string
  desc: string
  /** 业务编号字段（样例对账时的稳定身份键）。 */
  keyField: string
  fields: string[]
  statuses: string[]
  actions: string[]
  actionTargets: Record<string, string>
  /** 严格逐格流转（如外出维修：时间字段与状态强耦合，禁止越级/后退）。 */
  strictFlow?: boolean
  /** 动作执行时要联动写入的业务字段。 */
  fieldSync?: FieldSyncRule[]
  /** 页面指标卡的计算规则，与 metrics 文案一一对应。 */
  metricRules?: MetricRule[]
  metrics: string[]
}

/** 模块规格的 Node/浏览器同构形态（src/data/module-specs.mjs）。 */
export type ModuleSpec = {
  key: string
  name: string
  entity: string
  desc: string
  keyField: string
  fields: string[]
  statuses: string[]
  actions: string[]
  actionTargets: Record<string, string>
  strictFlow?: boolean
  fieldSync?: FieldSyncRule[]
  metricRules?: MetricRule[]
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

export type OverviewResult = {
  cards: { label: string; value: number }[]
  modules: { name: string; created: number; pending: number; abnormal: number }[]
}

/** 样例数据集：初始化数据 / 本地构建 / 运行环境共用同一份口径。 */
export type SeedDataset = {
  version: string
  generatedAt: string
  bizDate: string
  modules: Record<
    string,
    {
      keyField: string
      checks: string[]
      rows: EntryRow[]
    }
  >
}

export type ReconcileStats = {
  /** 样例键（业务编号）。 */
  key: string
  kept: number
  replaced: number
  added: number
  /** 用户自己登记、样例里没有的记录数（原样保留）。 */
  customKept: number
}

export type ReconcileReport = {
  version: string
  bizDate: string
  stats: Record<string, ReconcileStats>
}

/** 部署流水线状态：工作台据此展示卡在哪个环节。 */
export type StageStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

export type DeployStage =
  | 'prepare'
  | 'typecheck'
  | 'build'
  | 'verify'

export type StageState = {
  stage: DeployStage
  name: string
  status: StageStatus
  startedAt?: string
  finishedAt?: string
  error?: string
}

export type DeployStatus = {
  stageIndex: number
  stages: StageState[]
  result: 'running' | 'success' | 'failed'
  startedAt: string
  finishedAt?: string
  error?: string
  seed: {
    version: string
    bizDate: string
    generatedAt: string
  } | null
  attempts: Record<string, number>
}
