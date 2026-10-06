// 基于生产构建产物验证运行环境行为：模块打包后 seed-core / local-store 行为与 Node 测试一致。
// 从 dist 中找到入口 chunk 不现实（Vue 组件耦合），这里直接对源 .mjs 做存储层模拟对账，
// 验证「迁移后维修中仍是维修中、当日派遣数量、真实修改保留、二次打开幂等」。
import test from 'node:test'
import assert from 'node:assert/strict'

import { buildDataset, reconcileStore, isDispatchedToday } from '../../src/data/seed-core.mjs'

const KEY = 'underground-pipeline-inspection:entries'
const today = new Date().toISOString().slice(0, 10)

function localStorageMock(initial) {
  const map = new Map(initial === undefined ? [] : [[KEY, JSON.stringify(initial)]])
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    raw: () => (map.has(KEY) ? JSON.parse(map.get(KEY)) : null),
  }
}

// 复刻 local-store.readStorage 的核心流程（同一份 reconcileStore），验证两次打开。
function openApp(ls, now = new Date()) {
  const raw = ls.getItem(KEY)
  let stored = {}
  let meta = {}
  if (raw) {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && ('rows' in parsed || 'version' in parsed)) {
      stored = parsed.rows ?? {}
      meta = { version: parsed.version, bizDate: parsed.bizDate }
    } else {
      stored = parsed
    }
  }
  const result = reconcileStore(stored, meta, now)
  ls.setItem(KEY, JSON.stringify({ version: result.report.version, bizDate: result.report.bizDate, rows: result.rows }))
  return result.rows
}

test('旧版数据首次打开：维修中记录保持维修中，时间字段衔接，当日派遣 ≥ 维修中今日样本', () => {
  const legacy = {
    out_repair: [
      { id: 1, status: '待派遣', pending: true, abnormal: false, 派遣编号: 'OUT_-0001', 缺陷来源: '外出维修样例1', 维修人员: '外出维修样例1', 预计工时: '外出维修样例1', 携带工具: '外出维修样例1', 出发时间: '2026-09-01', 返回时间: '2026-09-01', 维修状态: '外出维修样例1' },
      { id: 2, status: '已派遣', pending: true, abnormal: true, 派遣编号: 'OUT_-0002', 缺陷来源: '外出维修样例2', 维修人员: '外出维修样例2', 预计工时: '外出维修样例2', 携带工具: '外出维修样例2', 出发时间: '2026-09-02', 返回时间: '2026-09-02', 维修状态: '外出维修样例2' },
      { id: 3, status: '维修中', pending: false, abnormal: false, 派遣编号: 'OUT_-0003', 缺陷来源: '外出维修样例3', 维修人员: '外出维修样例3', 预计工时: '外出维修样例3', 携带工具: '外出维修样例3', 出发时间: '2026-09-03', 返回时间: '2026-09-03', 维修状态: '外出维修样例3' },
    ],
  }
  const ls = localStorageMock(legacy)
  const first = openApp(ls)
  const rows = first.out_repair

  // 迁移后 4 行（新样例补了已返回的第 4 行），状态分布正确。
  assert.equal(rows.length, 4)
  const inProgress = rows.filter((r) => r.status === '维修中')
  assert.equal(inProgress.length, 1)
  assert.equal(inProgress[0].维修状态, '维修中')
  assert.ok(inProgress[0].出发时间.startsWith(today))
  assert.equal(inProgress[0].返回时间, '')

  // 当日派遣：维修中 + 已返回两条都是今天的。
  const dispatchedToday = rows.filter((r) => isDispatchedToday(r, today)).length
  assert.equal(dispatchedToday, 2)

  // 第二次打开：完全幂等，不新增记录。
  const second = openApp(ls)
  assert.equal(second.out_repair.length, 4)
  assert.deepEqual(second.out_repair, first.out_repair)
})

test('真实操作过的记录（_touched）刷新后仍是用户改后的样子', () => {
  const ls = localStorageMock()
  const first = openApp(ls)
  // 用户把 0001 从待派遣真实操作到已派遣（等价 runAction 的写入）。
  first.out_repair[0] = {
    ...first.out_repair[0],
    status: '已派遣',
    pending: true,
    _touched: true,
    维修状态: '已派遣',
    出发时间: `${today} 11:20`,
    _dispatchedAt: `${today}T11:20:00`,
  }
  ls.setItem(KEY, JSON.stringify({ version: buildDataset().version, bizDate: today, rows: first }))

  const second = openApp(ls)
  const touched = second.out_repair.find((r) => r.派遣编号 === 'OUT_-0001')
  assert.equal(touched.status, '已派遣')
  assert.equal(touched.出发时间, `${today} 11:20`)
  assert.equal(second.out_repair.length, 4)
})
