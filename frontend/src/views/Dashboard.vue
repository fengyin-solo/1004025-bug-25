<template>
  <section class="page">
    <header class="page-head">
      <div>
        <h2>运营概览</h2>
        <p class="page-desc">汇总各业务模块的关键指标，先看总量再看异常。</p>
      </div>
      <div class="page-actions">
        <button class="btn" type="button" @click="refresh">重新统计</button>
      </div>
    </header>

    <article class="deploy-panel">
      <div class="deploy-head">
        <h3>初始化与部署</h3>
        <span :class="['deploy-badge', deployBadgeClass]">{{ deployBadgeText }}</span>
      </div>

      <ol class="stage-list">
        <li v-for="stage in deployStages" :key="stage.stage" class="stage-item">
          <span :class="['stage-dot', stage.status]"></span>
          <div class="stage-body">
            <span class="stage-name">{{ stage.name }}</span>
            <span v-if="stage.error" class="stage-error">{{ stage.error }}</span>
          </div>
          <span :class="['stage-status', stage.status]">{{ stageStatusText(stage.status) }}</span>
        </li>
        <li v-if="!deployStages.length" class="stage-item stage-empty">
          尚未执行部署流水线（npm run deploy），当前没有环节状态
        </li>
      </ol>

      <p class="deploy-meta">
        <span>样例口径版本：{{ runtimeSample.version }}（业务日期 {{ runtimeSample.bizDate }}）</span>
        <span v-if="deploy?.seed" :class="['sample-consistency', seedConsistent ? 'ok' : 'mismatch']">
          部署快照：{{ deploy.seed.version }} · {{ seedConsistent ? '与运行环境一致' : '与运行环境不一致，请重跑 prepare' }}
        </span>
        <span v-if="blockedHint" class="stage-error">{{ blockedHint }}</span>
      </p>
    </article>

    <div class="stat-row">
      <article v-for="card in cards" :key="card.label" class="stat-card">
        <span class="stat-label">{{ card.label }}</span>
        <strong class="stat-value">{{ card.value }}</strong>
      </article>
      <article class="stat-card">
        <span class="stat-label">当日派遣</span>
        <strong class="stat-value">{{ todayDispatched }}</strong>
      </article>
    </div>
    <table class="data-table">
      <thead>
        <tr><th>业务模块</th><th>今日新增</th><th>待处理</th><th>异常量</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in moduleRows" :key="row.name">
          <td>{{ row.name }}</td>
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
import { computed, onMounted, ref } from 'vue'

import {
  loadDeploymentStatus,
  loadOverview,
  moduleStats,
} from '@/api/local-service'
import type { DeployStatus, OverviewResult, StageState } from '@/data/types'

const cards = ref<OverviewResult['cards']>([])
const moduleRows = ref<OverviewResult['modules']>([])
const deploy = ref<DeployStatus | null>(null)
const runtimeSample = ref({ version: '-', bizDate: '-', generatedAt: '' })
const seedConsistent = ref(false)

const deployStages = computed<StageState[]>(() => deploy.value?.stages ?? [])

const outRepairStats = computed(() => moduleStats('out_repair'))
const todayDispatched = computed(
  () => outRepairStats.value.find((item) => item.label === '当日派遣')?.value ?? 0,
)

const blockedStage = computed(
  () => deployStages.value.find((stage) => stage.status === 'failed') ?? null,
)
const blockedHint = computed(() => {
  if (blockedStage.value) {
    return `卡在「${blockedStage.value.name}」，修复后重跑 npm run deploy 即可从该环节继续`
  }
  return ''
})

const deployBadgeClass = computed(() => {
  if (!deploy.value) {
    return 'pending'
  }
  return deploy.value.result === 'success' ? 'success' : deploy.value.result === 'failed' ? 'failed' : 'running'
})
const deployBadgeText = computed(() => {
  if (!deploy.value) {
    return '流水线未执行'
  }
  if (deploy.value.result === 'success') {
    return '部署完成'
  }
  if (deploy.value.result === 'failed') {
    return `部署失败 · ${blockedStage.value?.stage ?? ''}`
  }
  return '部署进行中'
})

function stageStatusText(status: StageState['status']): string {
  return {
    pending: '待执行',
    running: '进行中',
    success: '已完成',
    failed: '失败',
    skipped: '已跳过',
  }[status]
}

function refresh() {
  const payload = loadOverview()
  cards.value = payload.cards
  moduleRows.value = payload.modules
  void loadDeploymentStatus().then((result) => {
    deploy.value = result.deploy
    runtimeSample.value = result.runtimeSample
    seedConsistent.value = result.seedConsistent
  })
}

onMounted(refresh)
</script>

<style scoped>
.deploy-panel {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.deploy-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.deploy-head h3 {
  font-size: 14px;
  margin: 0;
}
.deploy-badge {
  font-size: 12px;
  border-radius: 999px;
  padding: 2px 10px;
}
.deploy-badge.success { background: #ecfdf3; color: #027a48; }
.deploy-badge.failed { background: #fef3f2; color: #b42318; }
.deploy-badge.running { background: #eff8ff; color: #175cd3; }
.deploy-badge.pending { background: #eef2f7; color: #475467; }
.stage-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}
.stage-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
}
.stage-empty { color: var(--muted); font-size: 13px; }
.stage-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 4px;
  background: #98a2b3;
  flex: none;
}
.stage-dot.success { background: #12b76a; }
.stage-dot.failed { background: #f04438; }
.stage-dot.running { background: #2e90fa; }
.stage-body { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.stage-name { font-size: 13px; }
.stage-status { font-size: 12px; color: var(--muted); }
.stage-status.success { color: #027a48; }
.stage-status.failed { color: #b42318; }
.stage-error {
  font-size: 12px;
  color: #b42318;
  word-break: break-all;
}
.deploy-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--muted);
}
.sample-consistency.ok { color: #027a48; }
.sample-consistency.mismatch { color: #b42318; }
</style>
