// prepare 环节：生成唯一口径的样例快照 public/seed.json，并让部署状态带上样例版本。
// 快照内容与运行环境 buildDataset() 同源，初始化数据 / 本地构建 / 运行环境不会各说各话。
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { buildDataset } from '../../src/data/seed-core.mjs'
import { FRONTEND_ROOT, STAGES, persistState } from './state.mjs'

export const SEED_SNAPSHOT = join(FRONTEND_ROOT, 'public', 'seed.json')

export function executePrepare({ fixedNow } = {}) {
  const dataset = buildDataset(fixedNow ? new Date(fixedNow) : new Date())
  mkdirSync(dirname(SEED_SNAPSHOT), { recursive: true })
  writeFileSync(SEED_SNAPSHOT, `${JSON.stringify(dataset, null, 2)}\n`)
  return {
    seed: {
      version: dataset.version,
      bizDate: dataset.bizDate,
      generatedAt: dataset.generatedAt,
    },
  }
}

// 只生成快照的独立入口（npm run seed:generate）：没有跑完整流水线，
// 给工作台一份「仅完成准备环节」的状态，dev 模式下也能看到样例口径版本。
export function writeStandalonePrepareStatus() {
  const now = new Date().toISOString()
  const state = {
    stageIndex: 0,
    stages: STAGES.map(({ stage, name }, index) => ({
      stage,
      name,
      status: index === 0 ? 'success' : 'pending',
      ...(index === 0 ? { startedAt: now, finishedAt: now } : {}),
    })),
    result: 'running',
    startedAt: now,
    attempts: Object.fromEntries(STAGES.map(({ stage }, index) => [stage, index === 0 ? 1 : 0])),
    seed: executePrepare().seed,
  }
  persistState(state)
  return state
}
