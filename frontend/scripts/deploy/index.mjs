// 部署流水线入口：prepare → typecheck → build → verify。
//
// 特性：
// - 状态落 .deploy/state.json，并镜像到 public|dist/deploy-status.json，工作台可看卡点
// - 中断 / 失败后重跑：成功过的环节跳过，从失败环节继续，不残留上次的半截结果
// - --reset-stage <环节> 从指定环节起重跑（修复后重跑）；--only <环节> 只跑单个环节
// - --reset 清空流水线状态重新走一遍
//
// 用法：
//   node scripts/deploy/index.mjs
//   node scripts/deploy/index.mjs --reset-stage build
//   node scripts/deploy/index.mjs --only prepare
//   node scripts/deploy/index.mjs --reset
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import {
  FRONTEND_ROOT,
  STAGES,
  loadState,
  logFile,
  markStage,
  persistState,
  resetAllState,
  resetStageState,
  stageIndex,
} from './state.mjs'
import { runCommand } from './run.mjs'
import { executePrepare } from './prepare.mjs'
import { executeVerify } from './verify.mjs'

function parseArgs(argv) {
  const args = { reset: false, resetStage: null, only: null }
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i]
    if (item === '--reset') {
      args.reset = true
    } else if (item === '--reset-stage') {
      args.resetStage = argv[i + 1]
      i += 1
    } else if (item === '--only') {
      args.only = argv[i + 1]
      i += 1
    }
  }
  return args
}

async function runStageShell(state, stage, command, commandArgs) {
  const file = logFile(stage)
  await runCommand(command, commandArgs, { cwd: FRONTEND_ROOT, logFile: file })
}

async function execute(state, stage) {
  if (stage === 'prepare') {
    const result = executePrepare()
    state.seed = result.seed
    persistState(state)
    return
  }
  if (stage === 'typecheck') {
    await runStageShell(state, stage, 'npx', ['vue-tsc', '--noEmit'])
    return
  }
  if (stage === 'build') {
    // 先清掉上次构建产物，避免半截 dist 残留被当成成功。
    rmSync(join(FRONTEND_ROOT, 'dist'), { recursive: true, force: true })
    await runStageShell(state, stage, 'npx', ['vite', 'build'])
    return
  }
  if (stage === 'verify') {
    executeVerify()
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  let state = args.reset ? resetAllState() : loadState()

  if (args.resetStage) {
    if (stageIndex(state, args.resetStage) < 0) {
      throw new Error(`未知环节 ${args.resetStage}，可选：${STAGES.map((s) => s.stage).join(', ')}`)
    }
    resetStageState(state, args.resetStage)
  }

  // --only 只单独执行指定环节，不影响其他环节，也不写总结果以外的状态。
  if (args.only) {
    const onlyIndex = stageIndex(state, args.only)
    if (onlyIndex < 0) {
      throw new Error(`未知环节 ${args.only}`)
    }
    await runOne(state, args.only)
    state.result = 'success'
    state.finishedAt = new Date().toISOString()
    persistState(state)
    return
  }

  // 续跑起点：第一个未成功的环节。
  // - 上次失败/中断：成功环节跳过，从失败环节继续，它之后的环节一律重跑（不信任旧产物）。
  // - 上次全部成功：普通重跑不重复部署；想完整重走用 --reset。
  let startFrom = state.stages.findIndex((item) => item.status !== 'success')
  if (startFrom < 0) {
    console.log('✅ 所有环节均已成功，无需重跑；如需完整重新部署请加 --reset')
    return
  }

  for (let index = startFrom; index < STAGES.length; index += 1) {
    const { stage, name } = STAGES[index]
    state.attempts[stage] = (state.attempts[stage] ?? 0) + 1
    markStage(state, stage, {
      status: 'running',
      startedAt: new Date().toISOString(),
      finishedAt: undefined,
      error: undefined,
    })
    console.log(`▶  ${stage.padEnd(10)} ${name}`)

    try {
      await execute(state, stage)
      markStage(state, stage, { status: 'success', finishedAt: new Date().toISOString() })
      console.log(`✔  ${stage.padEnd(10)} 成功`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      markStage(state, stage, { status: 'failed', finishedAt: new Date().toISOString(), error: message })
      state.result = 'failed'
      state.error = `环节「${name}」失败：${message}`
      state.finishedAt = new Date().toISOString()
      persistState(state)
      console.error(`✖  ${stage.padEnd(10)} 失败：${message}`)
      console.error(`   日志：${logFile(stage)}`)
      console.error('   修复后重跑本命令即可从该环节继续，也可用 --reset-stage 指定重跑环节')
      process.exitCode = 1
      return
    }
  }

  state.result = 'success'
  state.error = undefined
  state.finishedAt = new Date().toISOString()
  persistState(state, { syncDist: true })
  console.log('🎉 部署流水线全部通过')
}

async function runOne(state, stage) {
  const name = STAGES.find((item) => item.stage === stage)?.name ?? stage
  state.attempts[stage] = (state.attempts[stage] ?? 0) + 1
  markStage(state, stage, {
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: undefined,
    error: undefined,
  })
  console.log(`▶  ${stage.padEnd(10)} ${name}`)
  try {
    await execute(state, stage)
    markStage(state, stage, { status: 'success', finishedAt: new Date().toISOString() })
    console.log(`✔  ${stage.padEnd(10)} 成功`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    markStage(state, stage, { status: 'failed', finishedAt: new Date().toISOString(), error: message })
    state.result = 'failed'
    state.error = `环节「${name}」失败：${message}`
    state.finishedAt = new Date().toISOString()
    persistState(state)
    console.error(`✖  ${stage.padEnd(10)} 失败：${message}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
