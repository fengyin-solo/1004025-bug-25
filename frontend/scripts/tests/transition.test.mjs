// 状态流转守卫测试。
import test from 'node:test'
import assert from 'node:assert/strict'

import { checkStatusTransition, NEGATIVE_ACTIONS } from '../../src/data/seed-core.mjs'

const S = ['待派遣', '已派遣', '维修中', '已返回']

test('外出维修（strict）：只能逐格前进', () => {
  assert.equal(checkStatusTransition(S, '待派遣', '已派遣', '下达派遣', true).allowed, true)
  assert.equal(checkStatusTransition(S, '已派遣', '维修中', '出发维修', true).allowed, true)
  assert.equal(checkStatusTransition(S, '维修中', '已返回', '返回确认', true).allowed, true)
})

test('外出维修（strict）：越级、后退、重复都被拦下', () => {
  assert.equal(checkStatusTransition(S, '待派遣', '维修中', '出发维修', true).allowed, false)
  assert.equal(checkStatusTransition(S, '待派遣', '已返回', '返回确认', true).reason, 'skip')
  assert.equal(checkStatusTransition(S, '已返回', '已派遣', '下达派遣', true).reason, 'backward')
  assert.equal(checkStatusTransition(S, '已派遣', '已派遣', '下达派遣', true).reason, 'duplicate')
})

test('非 strict 模块：允许向前跳态，只拦后退与重复', () => {
  // 验收中(1) → 需返修(3)、待验收(0) → 已通过(2) 都是现有登记的合法跳态。
  const A = ['待验收', '验收中', '已通过', '需返修']
  assert.equal(checkStatusTransition(A, '验收中', '需返修', '退回返修').allowed, true)
  assert.equal(checkStatusTransition(A, '待验收', '已通过', '确认通过').allowed, true)
  assert.equal(checkStatusTransition(A, '需返修', '验收中', '发起验收').reason, 'backward')
  assert.equal(checkStatusTransition(A, '已通过', '已通过', '确认通过').reason, 'duplicate')
})

test('负向动作允许跳态（会被服务层标 abnormal）', () => {
  for (const verb of ['忽略缺陷', '作废档案', '驳回申请', '停用管线']) {
    assert.ok(NEGATIVE_ACTIONS.some((v) => verb.startsWith(v)))
    assert.equal(checkStatusTransition(S, '维修中', '待派遣', verb, true).allowed, true)
  }
})

test('恢复在线这类回首态动作放行', () => {
  assert.equal(
    checkStatusTransition(['在线', '离线', '数据异常', '已校准'], '数据异常', '在线', '恢复在线', true).allowed,
    true,
  )
})
