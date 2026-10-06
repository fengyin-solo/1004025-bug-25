<template>
  <section class="page" data-module="out_repair-detail">
    <header class="page-head">
      <div>
        <h2>外出维修详情</h2>
        <p class="page-desc">按派遣环节核对状态、出发/返回时间与预计工时的衔接情况。</p>
      </div>
      <div class="page-actions">
        <RouterLink class="btn" to="/out_repair">返回列表</RouterLink>
      </div>
    </header>

    <div v-if="!row" class="detail-empty">
      <p class="error-text">没有找到这条外出维修记录，可能已被重置。</p>
      <RouterLink class="btn" to="/out_repair">返回列表</RouterLink>
    </div>

    <template v-else>
      <div class="stat-row">
        <article class="stat-card">
          <span class="stat-label">当前状态</span>
          <strong class="stat-value">{{ row.status }}</strong>
        </article>
        <article class="stat-card">
          <span class="stat-label">预计工时</span>
          <strong class="stat-value">{{ row['预计工时'] }}</strong>
        </article>
        <article class="stat-card">
          <span class="stat-label">实际用时</span>
          <strong class="stat-value">{{ timing.actualHours }}</strong>
        </article>
        <article class="stat-card">
          <span class="stat-label">衔接校验</span>
          <strong class="stat-value" :class="timing.coherent ? '' : 'error-text'">
            {{ timing.coherent ? '正常' : '异常' }}
          </strong>
        </article>
      </div>

      <ul v-if="timing.warnings.length" class="warn-list">
        <li v-for="warning in timing.warnings" :key="warning" class="error-text">{{ warning }}</li>
      </ul>

      <table class="data-table detail-table">
        <tbody>
          <tr v-for="field in columns" :key="field">
            <th>{{ field }}</th>
            <td>{{ row[field] === '' ? '—' : (row[field] ?? '—') }}</td>
          </tr>
        </tbody>
      </table>

      <div class="detail-actions">
        <button
          v-for="action in availableActions"
          :key="action"
          class="btn primary"
          type="button"
          @click="runAction(action)"
        >
          {{ action }}
        </button>
        <button class="btn" type="button" @click="resetOne">本模块重置为样例</button>
      </div>
      <p v-if="message" :class="messageOk ? 'ok-text' : 'error-text'">{{ message }}</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  listEntries,
  moduleMeta,
  outRepairTiming,
  resetModule,
  runAction as applyAction,
} from '@/api/local-service'
import type { EntryRow } from '@/data/types'

const route = useRoute()
const router = useRouter()
const meta = moduleMeta('out_repair')
const columns = ["派遣编号", "缺陷来源", "维修人员", "预计工时", "携带工具", "出发时间", "返回时间", "维修状态"]
const flowActions = ["下达派遣", "出发维修", "返回确认"]
const flowStatuses = ["待派遣", "已派遣", "维修中", "已返回"]

const row = ref<EntryRow | null>(null)
const message = ref('')
const messageOk = ref(true)

const timing = computed(() =>
  row.value ? outRepairTiming(row.value) : {
    dispatched: false, departed: false, returned: false,
    actualHours: '—', coherent: true, warnings: [],
  },
)

const availableActions = computed(() => {
  if (!row.value) {
    return []
  }
  const index = flowStatuses.indexOf(String(row.value.status))
  return index >= 0 && index < flowActions.length ? [flowActions[index]] : []
})

function load() {
  message.value = ''
  const id = Number(route.params.id)
  row.value = listEntries(meta.key).items.find((item) => Number(item.id) === id) ?? null
}

function runAction(action: string) {
  if (!row.value) {
    return
  }
  const result = applyAction(meta.key, Number(row.value.id), action)
  message.value = result.message
  messageOk.value = result.ok
  if (result.ok) {
    load()
  }
}

function resetOne() {
  // 单模块重置：整模块回到样例口径后回到列表，避免停在已不存在的 id 上
  resetModule(meta.key)
  router.push('/out_repair')
}

watch(() => route.params.id, load, { immediate: true })
</script>
