#!/usr/bin/env node
// 部署流水线：env（环境检查）→ deps（安装依赖）→ verify（样例口径校验）
//   → typecheck（类型检查）→ build（生产构建）→ package（产物核对）
//
// 用法：
//   node scripts/deploy.mjs            全新执行：清掉上次的状态与 dist，从头跑
//   node scripts/deploy.mjs --resume   断点续跑：跳过已成功环节，从失败环节继续
//
// 每个环节开始/结束都会立即把状态写到 public/deploy-state.json（再拷进 dist），
// 运营工作台据此展示流水线卡在哪个环节。重跑成功后状态整体覆盖，不残留上次结果。

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSeedRows, validateSeed, SEED_VERSION } from '../src/data/seed-builder.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_DIR = join(ROOT, 'public')
const STATE_FILE = join(PUBLIC_DIR, 'deploy-state.json')
const DIST_DIR = join(ROOT, 'dist')
const DIST_STATE = join(DIST_DIR, 'deploy-state.json')

const STAGES = [
  { key: 'env', label: '环境检查' },
  { key: 'deps', label: '安装依赖' },
  { key: 'verify', label: '样例口径校验' },
  { key: 'typecheck', label: '类型检查' },
  { key: 'build', label: '生产构建' },
  { key: 'package', label: '产物核对' },
]

function isoNow() {
  return new Date().toISOString()
}

function freshState() {
  return {
    runId: `run-${Date.now()}`,
    status: 'running',
    stage: null,
    seedVersion: SEED_VERSION,
    startedAt: isoNow(),
    stages: STAGES.map(({ key, label }) => ({
      key,
      label,
      status: 'pending',
    })),
  }
}

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return null
  }
}

function saveState(state) {
  mkdirSync(PUBLIC_DIR, { recursive: true })
  // 先写临时文件再重命名，避免工作台读到写了一半的 JSON
  const tmp = `${STATE_FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(state, null, 2))
  renameSync(tmp, STATE_FILE)
  if (existsSync(DIST_DIR)) {
    cpSync(STATE_FILE, DIST_STATE)
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} 退出码 ${result.status ?? '未知'}`)
  }
}

const stageHandlers = {
  env() {
    const major = Number(process.versions.node.split('.')[0])
    if (Number.isNaN(major) || major < 18) {
      throw new Error(`Node 版本过低：当前 ${process.versions.node}，需要 >= 18`)
    }
    const npm = spawnSync('npm', ['--version'], { cwd: ROOT, shell: process.platform === 'win32' })
    if (npm.status !== 0) {
      throw new Error('未找到 npm，请先安装 Node.js（含 npm）')
    }
    return `Node ${process.versions.node} / npm ${npm.stdout.toString().trim()} / APP_ENV=${process.env.APP_ENV ?? '未设置'}`
  },
  deps() {
    run('npm', ['install', '--no-audit', '--no-fund'])
    // 旧 node_modules 若是从别的平台拷过来的，optional 平台二进制会缺失，
    // 这里按当前平台显式补齐，避免构建环节才炸。
    const platformPackages = {
      'darwin-arm64': ['@rollup/rollup-darwin-arm64', '@esbuild/darwin-arm64'],
      'darwin-x64': ['@rollup/rollup-darwin-x64', '@esbuild/darwin-x64'],
      'linux-arm64-gnu': ['@rollup/rollup-linux-arm64-gnu', '@esbuild/linux-arm64'],
      'linux-arm64-musl': ['@rollup/rollup-linux-arm64-musl', '@esbuild/linux-arm64'],
      'linux-x64-gnu': ['@rollup/rollup-linux-x64-gnu', '@esbuild/linux-x64'],
      'linux-x64-musl': ['@rollup/rollup-linux-x64-musl', '@esbuild/linux-x64'],
    }
    const libc = process.platform === 'linux'
      ? (process.report?.getReport?.().header?.glibcVersionRuntime ? 'gnu' : 'musl')
      : ''
    const platformKey = `${process.platform}-${process.arch}${libc ? `-${libc}` : ''}`
    const extras = platformPackages[platformKey] ?? []
    const missing = extras.filter((name) => {
      const slash = name.indexOf('/')
      const base = slash >= 0 ? name.slice(0, slash) : name
      return !existsSync(join(ROOT, 'node_modules', base, name.slice(slash + 1), 'package.json'))
    })
    if (missing.length > 0) {
      run('npm', ['install', '--no-save', '--no-audit', '--no-fund', ...missing])
      return `依赖安装完成，并补齐当前平台（${platformKey}）二进制`
    }
    return '依赖安装完成'
  },
  verify() {
    // 初始化数据、构建、运行共用同一套样例口径，这里是部署前的最后一道闸
    const rows = buildSeedRows(new Date())
    const problems = validateSeed(rows)
    if (problems.length > 0) {
      throw new Error(`样例口径不通过：\n - ${problems.join('\n - ')}`)
    }
    const count = Object.values(rows).reduce((sum, list) => sum + list.length, 0)
    // 数据层行为：迁移、幂等恢复、真实修改保护、中断续跑都要过关
    run('node', ['scripts/test-store.mjs'])
    return `样例版本 ${SEED_VERSION}，共 ${Object.keys(rows).length} 个模块 ${count} 条记录，外出维修时间/工时衔接与数据层行为校验通过`
  },
  typecheck() {
    run('npx', ['vue-tsc', '--noEmit'])
    return 'vue-tsc 类型检查通过'
  },
  build() {
    run('npx', ['vite', 'build'])
    return 'vite build 完成，产物输出到 dist/'
  },
  package() {
    if (!existsSync(join(DIST_DIR, 'index.html'))) {
      throw new Error('dist/index.html 不存在，构建产物不完整')
    }
    const assets = readdirSync(join(DIST_DIR, 'assets')).filter((name) => name.endsWith('.js'))
    if (assets.length === 0) {
      throw new Error('dist/assets 下没有 JS 产物，构建不完整')
    }
    // 样例版本必须真的打进了运行产物，避免运行环境拿到另一套口径
    const bundled = assets.some((name) =>
      readFileSync(join(DIST_DIR, 'assets', name), 'utf8').includes(SEED_VERSION),
    )
    if (!bundled) {
      throw new Error('运行产物里找不到样例版本标记，初始化数据与运行环境口径可能不一致')
    }
    cpSync(STATE_FILE, DIST_STATE)
    return `产物核对通过（${assets.length} 个 JS 包含样例版本 ${SEED_VERSION}），部署状态已随产物发布`
  },
}

function main() {
  const resume = process.argv.includes('--resume')
  let state = resume ? loadState() : null

  if (!resume) {
    // 全新执行：不残留上次结果
    rmSync(DIST_DIR, { recursive: true, force: true })
    rmSync(STATE_FILE, { force: true })
    state = freshState()
  } else if (!state) {
    state = freshState()
    console.log('[deploy] 没有找到可续跑的状态，按全新流程执行')
  } else {
    const failed = state.stages.find((s) => s.status === 'failed')
    if (!failed && state.status === 'success') {
      console.log('[deploy] 上次流程已全部成功，无需续跑；如需重跑请去掉 --resume')
      process.exit(0)
    }
    state.status = 'running'
    state.stage = null
    state.error = undefined
  }

  // 断点续跑：已成功的环节标记 skipped 直接跳过，从失败环节重新执行
  for (const stage of state.stages) {
    if (stage.status === 'success') {
      stage.status = 'skipped'
      stage.message = `${stage.message ?? ''}（续跑跳过）`.trim()
    } else if (stage.status !== 'running') {
      stage.status = 'pending'
      delete stage.startedAt
      delete stage.finishedAt
      delete stage.durationMs
      delete stage.message
    }
  }

  saveState(state)

  for (const stage of state.stages) {
    if (stage.status === 'skipped') {
      console.log(`[deploy] ↷ ${stage.label}：跳过（上次已成功）`)
      continue
    }
    state.stage = stage.key
    const startedAt = isoNow()
    Object.assign(stage, { status: 'running', startedAt, finishedAt: undefined, durationMs: undefined, message: undefined })
    saveState(state)
    const t0 = Date.now()
    try {
      console.log(`[deploy] ▶ ${stage.label} ...`)
      const message = stageHandlers[stage.key]()
      Object.assign(stage, {
        status: 'success',
        finishedAt: isoNow(),
        durationMs: Date.now() - t0,
        message: message ?? '完成',
      })
      state.stage = null
      saveState(state)
      console.log(`[deploy] ✓ ${stage.label}：${message ?? '完成'}`)
    } catch (error) {
      Object.assign(stage, {
        status: 'failed',
        finishedAt: isoNow(),
        durationMs: Date.now() - t0,
        message: error instanceof Error ? error.message : String(error),
      })
      state.status = 'failed'
      state.stage = stage.key
      state.error = `环节「${stage.label}」失败：${stage.message}`
      state.finishedAt = isoNow()
      saveState(state)
      console.error(`[deploy] ✗ ${stage.label} 失败：${stage.message}`)
      console.error(`[deploy] 修复后执行 npm run deploy:resume，可从「${stage.label}」继续`)
      process.exit(1)
    }
  }

  state.status = 'success'
  state.finishedAt = isoNow()
  saveState(state)
  cpSync(STATE_FILE, DIST_STATE)
  console.log('[deploy] 全部环节成功，dist/ 可直接发布')
}

main()
