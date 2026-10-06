// seed-core 对账逻辑测试：重复恢复不多记录、真实修改不覆盖、旧样例迁移、跨天滚动。
import test from 'node:test'
import assert from 'node:assert/strict'

import { buildDataset, reconcileRows, reconcileStore, isDispatchedToday } from '../../src/data/seed-core.mjs'

const now = new Date('2026-10-06T10:00:00')
const today = '2026-10-06'

function sample(key, nowArg = now) {
  return buildDataset(nowArg).modules[key]
}

test('样例自检：外出维修状态与出发/返回时间、派遣时刻衔接', () => {
  const module = sample('out_repair')
  assert.deepEqual(module.checks, [])
  const byCode = new Map(module.rows.map((row) => [row.派遣编号, row]))
  assert.equal(byCode.get('OUT_-0001').出发时间, '')
  assert.equal(byCode.get('OUT_-0002').返回时间, '')
  assert.match(byCode.get('OUT_-0003').出发时间, /^2026-10-06 /)
  assert.equal(byCode.get('OUT_-0004').返回时间, '2026-10-06 10:20')
})

test('当日派遣口径：今天已派遣/维修中/已返回计入，待派遣与昨天的不计入', () => {
  const rows = sample('out_repair').rows
  const count = rows.filter((row) => isDispatchedToday(row, today)).length
  assert.equal(count, 2) // 0003 维修中 + 0004 已返回
  assert.equal(isDispatchedToday(rows[0], today), false)
  assert.equal(isDispatchedToday(rows[1], today), false)
})

test('空存储对账后等于样例，且幂等（重复恢复不多记录）', () => {
  const first = reconcileRows('out_repair', [], buildDataset(now), {}, now)
  assert.equal(first.stats.added, 4)
  assert.equal(first.rows.length, 4)

  const second = reconcileRows('out_repair', first.rows, buildDataset(now), {
    version: buildDataset(now).version,
    bizDate: today,
  }, now)
  assert.equal(second.stats.added, 0)
  assert.equal(second.stats.kept, 4)
  assert.equal(second.rows.length, 4)
})

test('_touched 的真实修改不被样例覆盖', () => {
  const dataset = buildDataset(now)
  const modified = dataset.modules.out_repair.rows.map((row) =>
    row.派遣编号 === 'OUT_-0002'
      ? { ...row, 维修人员: '我改成新人了', status: '维修中', _touched: true }
      : row,
  )
  const result = reconcileRows('out_repair', modified, buildDataset(now), {
    version: dataset.version,
    bizDate: today,
  }, now)
  const row = result.rows.find((item) => item.派遣编号 === 'OUT_-0002')
  assert.equal(row.维修人员, '我改成新人了')
  assert.equal(row.status, '维修中')
  assert.equal(result.stats.kept, 4)
  assert.equal(result.stats.replaced, 0)
})

test('旧版手写样例（占位口径）平滑迁移为衔接后的新样例', () => {
  const legacy = [
    {
      id: 1,
      status: '待派遣',
      pending: true,
      abnormal: false,
      派遣编号: 'OUT_-0001',
      缺陷来源: '外出维修样例1',
      维修人员: '外出维修样例1',
      预计工时: '外出维修样例1',
      携带工具: '外出维修样例1',
      出发时间: '2026-09-01',
      返回时间: '2026-09-01',
      维修状态: '外出维修样例1',
    },
  ]
  const result = reconcileRows('out_repair', legacy, buildDataset(now), {}, now)
  assert.equal(result.stats.replaced, 1)
  assert.equal(result.stats.added, 3)
  assert.equal(result.rows.length, 4)
  // 沿用原 id，不产生重复键。
  assert.equal(result.rows[0].id, 1)
  assert.equal(result.rows[0].维修状态, '待派遣')
  const codes = result.rows.map((row) => row.派遣编号)
  assert.equal(new Set(codes).size, codes.length)
})

test('用户自建记录在对账与重置中都保留', () => {
  const dataset = buildDataset(now)
  const withCustom = [
    ...dataset.modules.out_repair.rows,
    {
      id: 99,
      status: '维修中',
      pending: true,
      abnormal: false,
      派遣编号: 'OUT_-9999',
      缺陷来源: '自建',
      维修人员: '临时班组',
      预计工时: '1小时',
      携带工具: '',
      出发时间: '2026-10-06 09:00',
      返回时间: '',
      维修状态: '维修中',
      _touched: true,
    },
  ]
  const result = reconcileRows('out_repair', withCustom, buildDataset(now), {
    version: dataset.version,
    bizDate: today,
  }, now, true)
  const custom = result.rows.find((row) => row.派遣编号 === 'OUT_-9999')
  assert.ok(custom)
  assert.equal(custom.维修人员, '临时班组')
  assert.equal(result.rows.length, 5)

  // 再来一轮：不新增、不重复。
  const again = reconcileRows('out_repair', result.rows, buildDataset(now), {
    version: dataset.version,
    bizDate: today,
  }, now, true)
  assert.equal(again.rows.length, 5)
  assert.equal(again.stats.added, 0)
})

test('跨天后未改动的样例随日期滚动，真实修改保持不动', () => {
  // 旧版手写样例只有 3 行且是 2026-09 占位口径；0003 被人真实改过。
  const stored = [
    {
      id: 1, status: '待派遣', pending: true, abnormal: false,
      派遣编号: 'OUT_-0001', 缺陷来源: '外出维修样例1', 维修人员: '外出维修样例1',
      预计工时: '外出维修样例1', 携带工具: '外出维修样例1',
      出发时间: '2026-09-01', 返回时间: '2026-09-01', 维修状态: '外出维修样例1',
    },
    {
      id: 2, status: '已派遣', pending: true, abnormal: true,
      派遣编号: 'OUT_-0002', 缺陷来源: '外出维修样例2', 维修人员: '外出维修样例2',
      预计工时: '外出维修样例2', 携带工具: '外出维修样例2',
      出发时间: '2026-09-02', 返回时间: '2026-09-02', 维修状态: '外出维修样例2',
    },
    {
      id: 3, status: '维修中', pending: false, abnormal: false,
      派遣编号: 'OUT_-0003', 缺陷来源: '真实缺陷单号', 维修人员: '改过的人',
      预计工时: '6小时', 携带工具: '专用设备',
      出发时间: '2026-10-05 08:00', 返回时间: '', 维修状态: '维修中', _touched: true,
    },
  ]
  const result = reconcileRows('out_repair', stored, buildDataset(now), {
    version: '2026.9.1-1',
    bizDate: '2026-10-05',
  }, now)

  // 0003 被真实修改过，人和状态原样保留。
  const touched = result.rows.find((row) => row.派遣编号 === 'OUT_-0003')
  assert.equal(touched.维修人员, '改过的人')
  assert.equal(touched.status, '维修中')
  // 占位旧样例换成今天的新口径（0004 是新样例补出来的），当日派遣能统计到 0004。
  const inProgress = result.rows.filter((row) => isDispatchedToday(row, today))
  assert.ok(inProgress.some((row) => row.派遣编号 === 'OUT_-0004'))
  assert.equal(result.stats.added, 1)
  assert.equal(result.stats.replaced, 2)
})

test('reconcileStore 覆盖全部模块且行数与样例一致', () => {
  const { rows, report } = reconcileStore({}, {}, now)
  const dataset = buildDataset(now)
  assert.equal(Object.keys(rows).length, Object.keys(dataset.modules).length)
  for (const key of Object.keys(dataset.modules)) {
    assert.equal(rows[key].length, dataset.modules[key].rows.length)
    assert.equal(report.stats[key].added, dataset.modules[key].rows.length)
  }
})
