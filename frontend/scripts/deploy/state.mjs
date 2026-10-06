// 部署流水线的状态持久化：环节进度落在 .deploy/state.json，
// 同时把工作台要看的状态镜像写到 public/ 与 dist/ 的 deploy-status.json。
// 任何时候中断，重跑时都能认出卡住的环节并从那里继续。

import { copyFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FRONTEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DEPLOY_DIR = join(FRONTEND_ROOT, '.deploy')
export const STATE_FILE = join(DEPLOY_DIR, 'state.json')
export const LOG_DIR = join(DEPLOY_DIR, 'logs')
export const PUBLIC_STATUS = join(FRONTEND_ROOT, 'public', 'deploy-status.json')
export const DIST_STATUS = join(FRONTEND_ROOT, 'dist', 'deploy-status.json')

export const STAGES = [
  { stage: 'prepare', name: '准备样例口径快照' },
  { stage: 'typecheck', name: 'TypeScript 类型检查' },
  { stage: 'build', name: '生产构建' },
  { stage: 'verify', name: '产物与口径校验' },
]

function freshState() {
  const now = new Date().toISOString()
  return {
    stageIndex: -1,
    stages: STAGES.map(({ stage, name }) => ({ stage, name, status: 'pending' })),
    result: 'running',
    startedAt: now,
    attempts: {},
    seed: null,
  }
}

function atomicWriteJson(file, data) {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, file)
}

// 读到一半中断的流水线：running 环节在重跑时判为失败，从该环节继续。
function recoverInterruption(state) {
  let interrupted = false
  for (const item of state.stages) {
    if (item.status === 'running') {
      item.status = 'failed'
      item.finishedAt = new Date().toISOString()
      item.error = '上次执行在此环节中断，已自动标记为失败，可直接重跑续跑'
      interrupted = true
    }
  }
  if (interrupted) {
    state.result = 'failed'
    state.error = '检测到未完成的部署，已定位到中断环节'
  }
  return state
}

export function loadState() {
  if (!existsSync(STATE_FILE)) {
    return freshState()
  }
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    return recoverInterruption({ ...freshState(), ...parsed })
  } catch {
    return freshState()
  }
}

export function stageIndex(state, stage) {
  return state.stages.findIndex((item) => item.stage === stage)
}

// 状态每次变更都落盘三处，工作台随时打开都能看到当前卡在哪。
// syncDist=true 时即便 dist 目录刚被重建也强制同步（流水线收尾用）。
export function persistState(state, { syncDist = false } = {}) {
  mkdirSync(DEPLOY_DIR, { recursive: true })
  atomicWriteJson(STATE_FILE, state)

  const publicView = { ...state }
  atomicWriteJson(PUBLIC_STATUS, publicView)
  if (syncDist || existsSync(dirname(DIST_STATUS))) {
    mkdirSync(dirname(DIST_STATUS), { recursive: true })
    copyFileSync(PUBLIC_STATUS, DIST_STATUS)
  }
}

export function markStage(state, stage, patch) {
  const index = stageIndex(state, stage)
  if (index < 0) {
    throw new Error(`未知部署环节：${stage}`)
  }
  state.stages[index] = { ...state.stages[index], ...patch }
  state.stageIndex = index
  persistState(state)
}

export function resetStageState(state, stage) {
  const index = stageIndex(state, stage)
  if (index < 0) {
    throw new Error(`未知部署环节：${stage}`)
  }
  for (let i = index; i < state.stages.length; i += 1) {
    state.stages[i] = {
      stage: state.stages[i].stage,
      name: state.stages[i].name,
      status: 'pending',
    }
  }
  state.result = 'running'
  delete state.finishedAt
  delete state.error
  persistState(state)
}

export function logFile(stage) {
  mkdirSync(LOG_DIR, { recursive: true })
  return join(LOG_DIR, `${stage}.log`)
}

export function resetAllState() {
  rmSync(DEPLOY_DIR, { recursive: true, force: true })
  return freshState()
}
