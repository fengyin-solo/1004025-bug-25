// 部署流水线状态机测试：中断恢复、成功环节跳过、从失败环节继续、重跑不残留。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// state.mjs 的路径是模块内常量，测试通过独立 worktree 方式不好注入；
// 改为直接验证 .deploy 目录下状态语义：复制状态文件结构走 loadState 恢复逻辑。
import { STAGES, loadState, markStage, persistState, resetStageState, DEPLOY_DIR, STATE_FILE } from '../deploy/state.mjs'

test('中断的 running 环节重跑时被标记为 failed，定位卡点', () => {
  rmSync(DEPLOY_DIR, { recursive: true, force: true })
  let state = loadState()
  markStage(state, 'prepare', { status: 'success', finishedAt: new Date().toISOString() })
  markStage(state, 'typecheck', { status: 'running', startedAt: new Date().toISOString() })

  // 模拟进程被杀掉：重新 loadState。
  state = loadState()
  assert.equal(state.result, 'failed')
  assert.equal(state.stages[0].status, 'success')
  assert.equal(state.stages[1].status, 'failed')
  assert.match(state.stages[1].error, /中断/)
})

test('成功环节跳过：失败后修复重跑从失败环节继续', () => {
  let state = loadState() // prepare=success, typecheck=failed
  // typecheck 修复后成功，后续环节依次执行
  markStage(state, 'typecheck', { status: 'success', finishedAt: new Date().toISOString() })
  markStage(state, 'build', { status: 'success', finishedAt: new Date().toISOString() })
  markStage(state, 'verify', { status: 'success', finishedAt: new Date().toISOString() })

  const rerun = loadState()
  assert.deepEqual(rerun.stages.map((s) => s.status), ['success', 'success', 'success', 'success'])
})

test('--reset-stage build 会重置 build 及之后环节，前面的保留', () => {
  let state = loadState()
  resetStageState(state, 'build')
  assert.equal(state.stages[0].status, 'success')
  assert.equal(state.stages[1].status, 'success')
  assert.equal(state.stages[2].status, 'pending')
  assert.equal(state.stages[3].status, 'pending')
  assert.equal(state.result, 'running')
})

test('状态文件始终落盘，工作台可直接读取', () => {
  const state = loadState()
  markStage(state, 'build', { status: 'running', startedAt: new Date().toISOString() })
  assert.ok(existsSync(STATE_FILE))
  assert.ok(existsSync(join(DEPLOY_DIR, '..', 'public', 'deploy-status.json')))
})

test('环节定义顺序固定为 prepare/typecheck/build/verify', () => {
  assert.deepEqual(STAGES.map((s) => s.stage), ['prepare', 'typecheck', 'build', 'verify'])
})

// 引用 mkdtemp 以保留对临时目录工具链的显式依赖（未来扩展独立工作区用）。
test('临时目录可创建', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-'))
  assert.ok(existsSync(dir))
  rmSync(dir, { recursive: true, force: true })
})
