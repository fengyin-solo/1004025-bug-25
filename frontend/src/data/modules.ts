import { MODULE_SPECS } from './module-specs.mjs'
import type { ModuleMeta } from './types'

// 模块元数据由统一规格 src/data/module-specs.mjs 派生：字段、状态、动作、流转目标、
// 指标规则只有一处定义，样例生成器与部署校验也引用同一份，页面不再各自抄写。
export const MODULES: ModuleMeta[] = MODULE_SPECS.map((spec) => ({
  key: spec.key,
  name: spec.name,
  entity: spec.entity,
  desc: spec.desc,
  keyField: spec.keyField,
  fields: [...spec.fields],
  statuses: [...spec.statuses],
  actions: [...spec.actions],
  actionTargets: { ...spec.actionTargets },
  strictFlow: spec.strictFlow,
  fieldSync: spec.fieldSync?.map((rule) => ({ action: rule.action, set: { ...rule.set } })),
  metricRules: spec.metricRules?.map((rule) => ({ ...rule })),
  metrics: [...spec.metrics],
}))

export const MODULE_BY_KEY: Map<string, ModuleMeta> = new Map(
  MODULES.map((item) => [item.key, item]),
)
