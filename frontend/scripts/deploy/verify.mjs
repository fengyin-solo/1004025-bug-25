// verify 环节：部署产物与样例口径的最后一道校验，失败即整个流水线标失败。
// - dist 产物齐全（index.html、JS chunk、seed.json、deploy-status.json）
// - public/seed.json 必须能用同一生成器原样复现（口径被手改/过期会直接暴露）
// - 快照里每个模块的一致性自检项必须为空
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { buildDataset, SEED_VERSION } from '../../src/data/seed-core.mjs'
import { FRONTEND_ROOT } from './state.mjs'
import { SEED_SNAPSHOT } from './prepare.mjs'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

export function executeVerify() {
  const distDir = join(FRONTEND_ROOT, 'dist')
  assert(existsSync(join(distDir, 'index.html')), 'dist/index.html 缺失，生产构建未成功产出')

  const assetsDir = join(distDir, 'assets')
  const hasJs = existsSync(assetsDir) && readdirSync(assetsDir).some((name) => name.endsWith('.js'))
  assert(hasJs, 'dist/assets 下没有 JS 产物，构建不完整')

  assert(existsSync(SEED_SNAPSHOT), 'public/seed.json 缺失，prepare 环节未完成')
  assert(
    existsSync(join(distDir, 'seed.json')),
    'dist/seed.json 缺失，样例快照没有进入构建产物',
  )
  assert(
    existsSync(join(distDir, 'deploy-status.json')),
    'dist/deploy-status.json 缺失，部署状态没有进入构建产物',
  )

  const snapshot = JSON.parse(readFileSync(SEED_SNAPSHOT, 'utf8'))
  assert(snapshot.version === SEED_VERSION, `样例快照版本 ${snapshot.version} 与生成器版本 ${SEED_VERSION} 不一致，请重跑 prepare`)

  // 用快照固定时刻重新生成，必须与快照逐字节结构一致，证明只有一套口径。
  const reproduced = buildDataset(new Date(snapshot.generatedAt))
  const a = JSON.stringify(snapshot)
  const b = JSON.stringify(reproduced)
  assert(a === b, '样例快照无法由统一生成器复现：src/data/seed-core.mjs 与 public/seed.json 口径不一致')

  for (const [key, module] of Object.entries(snapshot.modules)) {
    assert(Array.isArray(module.checks), `${key} 缺少自检结果`)
    assert(module.checks.length === 0, `${key} 样例一致性自检未通过：${module.checks.join('；')}`)
    assert(module.rows.length > 0, `${key} 样例行数为 0`)
  }
}
