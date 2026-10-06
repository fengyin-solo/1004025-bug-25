<template>
  <section class="page">
    <header class="page-head">
      <div>
        <h2>运营概览</h2>
        <p class="page-desc">汇总各业务模块的关键指标，先看总量再看异常；部署流水线与样例恢复状态也在这里。</p>
      </div>
      <div class="page-actions">
        <button class="btn" type="button" @click="refresh">重新统计</button>
      </div>
    </header>

    <h3 class="section-title">部署流水线</h3>
    <div class="deploy-panel">
      <ol class="deploy-flow">
        <li
          v-for="stage in deployStages"
          :key="stage.key"
          class="deploy-stage"
          :class="`is-${stage.status}`"
        >
          <span class="stage-mark">{{ stageMark(stage.status) }}</span>
          <div class="stage-body">
            <strong>{{ stage.label }}</strong>
            <span class="stage-msg">{{ stageMessage(stage) }}</span>
          </div>
        </li>
      </ol>
      <footer class="deploy-foot">
        <span>
          总体状态：
          <strong :class="deployBadgeClass">{{ deployStatusText }}</strong>
          <template v-if="deployState">
            · 样例版本 {{ deployState.seedVersion }} · 开始 {{ formatTime(deployState.startedAt) }}
          </template>
        </span>
        <span v-if="deployError" class="error-text">{{ deployError }}</span>
        <span v-else-if="!deployState" class="muted-text">
          当前是开发模式（未执行部署流水线）。发布环境若失败，这里会显示卡在哪个环节。
        </span>
      </footer>
    </div>

    <h3 class="section-title">样例数据恢复</h3>
    <div class="restore-panel">
      <div class="restore-line">
        <span>
          状态：<strong :class="restore.status === 'failed' ? 'error-text' : ''">{{ restoreStatusText }}</strong>
          · 环节 {{ restore.finished.length }}/{{ restore.total }}
          · 样例版本 {{ restore.seedVersion }}
        </span>
        <button class="btn primary" type="button" :disabled="restoring" @click="runRestore">
          {{ restoring ? '恢复中…' : '重跑样例恢复' }}
        </button>
      </div>
      <div class="progress-bar">
        <div class="progress-inner" :style="{ width: `${restoreProgress}%` }" :class="`bar-${restore.status}`"></div>
      </div>
      <p class="muted-text">
        按业务编号幂等合并：重复执行不会多出记录；已做真实修改的记录只补缺字段、不被覆盖；
        中断后自动从失败模块继续。本轮新增 {{ restore.added }} 条、对齐陈旧样例 {{ restore.updated }} 条、保留真实记录 {{ restore.preserved }} 条。
      </p>
      <p v-if="restore.status === 'failed'" class="error-text">
        卡在模块「{{ restore.failedModule }}」：{{ restore.error }}（修复后再次点击即可从该模块继续）
      </p>
    </div>

    <h3 class="section-title">业务指标</h3>
    <div class="stat-row">
      <article v-for="card in cards" :key="card.label" class="stat-card">
        <span class="stat-label">{{ card.label }}</span>
        <strong class="stat-value">{{ card.value }}</strong>
      </article>
    </div>
    <table class="data-table">
      <thead>
        <tr><th>业务模块</th><th>关键指标</th><th>登记总量</th><th>待处理</th><th>异常量</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in moduleRows" :key="row.key">
          <td>
            <RouterLink :to="`/${row.key}`" class="link">{{ row.name }}</RouterLink>
            <span v-if="row.key === 'out_repair'" class="tag-hint">含当日派遣</span>
          </td>
          <td>
            <span v-for="metric in row.metrics" :key="metric.label" class="metric-chip">
              {{ metric.label }} {{ metric.value }}
            </span>
          </td>
          <td>{{ row.created }}</td>
          <td>{{ row.pending }}</td>
          <td>{{ row.abnormal }}</td>
        </tr>
      </tbody>
    </table>
    <footer class="page-foot">
      <span>数据保存在本机浏览器里，换浏览器或清缓存会回到示例数据</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { getRestoreState, loadOverview, restoreSampleData } from '@/api/local-service'
import type { DeployState, DeployStageState, OverviewResult, RestoreInfo } from '@/data/types'

const cards = ref<OverviewResult['cards']>([])
const moduleRows = ref<OverviewResult['modules']>([])
const restore = ref<RestoreInfo>(getRestoreState())
const restoring = ref(false)

const deployState = ref<DeployState | null>(null)
let pollTimer: number | null = null

const deployStages = computed<DeployStageState[]>(() =>
  deployState.value
    ? deployState.value.stages
    : [
        { key: 'env', label: '环境检查', status: 'pending' },
        { key: 'deps', label: '安装依赖', status: 'pending' },
        { key: 'verify', label: '样例口径校验', status: 'pending' },
        { key: 'typecheck', label: '类型检查', status: 'pending' },
        { key: 'build', label: '生产构建', status: 'pending' },
        { key: 'package', label: '产物核对', status: 'pending' },
      ],
)

const deployStatusText = computed(() => {
  if (!deployState.value) return '开发模式（无部署记录）'
  return { running: '部署中', success: '成功', failed: '失败' }[deployState.value.status]
})

const deployBadgeClass = computed(() => {
  if (!deployState.value) return 'muted-text'
  return deployState.value.status === 'failed' ? 'error-text' : 'ok-text'
})

const deployError = computed(() => deployState.value?.error ?? '')

const restoreStatusText = computed(
  () => ({ running: '进行中', done: '完成', failed: '失败' })[restore.value.status],
)

const restoreProgress = computed(() =>
  restore.value.total === 0 ? 0 : Math.round((restore.value.finished.length / restore.value.total) * 100),
)

function stageMark(status: DeployStageState['status']): string {
  return { pending: '○', running: '…', success: '✓', failed: '✗', skipped: '↷' }[status]
}

function stageMessage(stage: DeployStageState): string {
  if (stage.status === 'pending') return '待执行'
  if (stage.status === 'running') return '执行中…'
  const base = stage.message ?? ''
  const duration = stage.durationMs != null ? `（${(stage.durationMs / 1000).toFixed(1)}s）` : ''
  return `${base}${duration}`
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

async function loadDeployState() {
  try {
    const response = await fetch('/deploy-state.json', { cache: 'no-store' })
    if (!response.ok) {
      deployState.value = null
      stopPolling()
      return
    }
    deployState.value = (await response.json()) as DeployState
    if (deployState.value.status === 'running') {
      startPolling()
    } else {
      stopPolling()
    }
  } catch {
    deployState.value = null
    stopPolling()
  }
}

function startPolling() {
  if (pollTimer === null) {
    pollTimer = window.setInterval(loadDeployState, 3000)
  }
}

function stopPolling() {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

function runRestore() {
  restoring.value = true
  try {
    restore.value = restoreSampleData()
  } finally {
    restoring.value = false
  }
  refresh()
}

function refresh() {
  const payload = loadOverview()
  cards.value = payload.cards
  moduleRows.value = payload.modules
  restore.value = getRestoreState()
}

onMounted(() => {
  refresh()
  loadDeployState()
})

onUnmounted(stopPolling)
</script>
