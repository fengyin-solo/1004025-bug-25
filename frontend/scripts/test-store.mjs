// 数据层行为测试（node scripts/test-store.mjs）：
// 模拟浏览器 localStorage，验证旧数据迁移、幂等恢复、真实修改保护、中断续跑。
import { build } from 'esbuild'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'node_modules/.tmp-test')
mkdirSync(OUT, { recursive: true })

await build({
  entryPoints: [join(ROOT, 'src/data/local-store.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: join(OUT, 'store.mjs'),
  logLevel: 'silent',
})

const LEGACY_KEY = 'underground-pipeline-inspection:entries'
const NEW_KEY = 'underground-pipeline-inspection:db'

let memory = new Map()
const localStorageMock = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
}
globalThis.window = { localStorage: localStorageMock }

let failures = 0
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  ✓ ${name}`)
  } else {
    failures += 1
    console.error(`  ✗ ${name} ${detail}`)
  }
}

function freshStore() {
  memory = new Map()
}

async function importStore() {
  return import(`${join(OUT, 'store.mjs')}?t=${Date.now()}-${Math.random()}`)
}

// --- 场景 1：全新播种 -------------------------------------------------------
console.log('场景1 全新播种')
{
  freshStore()
  const store = await importStore()
  const rows = store.listRows('out_repair')
  check('外出维修 5 条样例', rows.length === 5, `实际 ${rows.length}`)
  const repairing = rows.find((r) => r['派遣编号'] === 'OUT-0003')
  check('OUT-0003 是维修中（不再错显为待派遣）', repairing.status === '维修中', repairing.status)
  check('维修中有出发时间无返回时间', repairing['出发时间'] && !repairing['返回时间'])
  const waiting = rows.find((r) => r['派遣编号'] === 'OUT-0001')
  check('待派遣无出发/返回时间', waiting.status === '待派遣' && !waiting['出发时间'] && !waiting['返回时间'])
  const today = new Date().toISOString().slice(0, 10)
  const todayDispatched = rows.filter((r) => String(r['出发时间']).slice(0, 10) === today).length
  check('当日派遣基线为 3（已派遣/维修中/已返回各 1）', todayDispatched === 3, `实际 ${todayDispatched}`)
}

// --- 场景 2：旧版数据迁移（重建样例后的状态丢失现场） ------------------------
console.log('场景2 旧版数据迁移')
{
  freshStore()
  const today = new Date().toISOString().slice(0, 10)
  memory.set(LEGACY_KEY, JSON.stringify({
    out_repair: [
      // 旧的错档数据：维修中但结构陈旧 + 占位文本
      { id: 1, status: '待派遣', pending: true, abnormal: false, '派遣编号': 'OUT_-0001', '缺陷来源': '外出维修样例1', '维修人员': '外出维修样例1', '预计工时': '外出维修样例1', '携带工具': '外出维修样例1', '出发时间': '2026-09-01', '返回时间': '2026-09-01', '维修状态': '外出维修样例1' },
      { id: 2, status: '维修中', pending: false, abnormal: false, '派遣编号': 'OUT_-0003', '缺陷来源': '外出维修样例3', '维修人员': '外出维修样例3', '预计工时': '外出维修样例3', '携带工具': '外出维修样例3', '出发时间': '2026-09-03', '返回时间': '2026-09-03', '维修状态': '外出维修样例3' },
      // 用户真实登记的记录（无占位文本）必须保留
      { id: 7, status: '已派遣', pending: true, abnormal: false, '派遣编号': 'OUT-REAL-01', '缺陷来源': '真实缺陷', '维修人员': '张三', '预计工时': '5小时', '携带工具': '抽水泵', '出发时间': `${today} 10:00`, '返回时间': '', '维修状态': '已派遣' },
    ],
  }))
  const store = await importStore()
  // 触发一次惰性初始化，迁移才会执行
  store.listRows('pipeline')
  const rows = store.listRows('out_repair')
  check('陈旧占位样例被丢弃且新样例补齐为 6 条', rows.length === 6, `实际 ${rows.length}`)
  check('旧键已清理', !memory.has(LEGACY_KEY))
  check('真实记录 OUT-REAL-01 保留', rows.some((r) => r['派遣编号'] === 'OUT-REAL-01'))
  const real = rows.find((r) => r['派遣编号'] === 'OUT-REAL-01')
  check('真实记录状态未被样例覆盖', real.status === '已派遣')
  check('样例 OUT-0003 为维修中且时间衔接', rows.find((r) => r['派遣编号'] === 'OUT-0003')['返回时间'] === '')
  const state = store.restoreState()
  check('迁移恢复状态 done', state.status === 'done')
  check('迁移计数：保留真实 1 条', state.preserved === 1, `实际 ${state.preserved}`)
}

// --- 场景 3：重复恢复不多记录、真实修改不被覆盖 ------------------------------
console.log('场景3 幂等恢复 + 真实修改保护')
{
  freshStore()
  let store = await importStore()
  // 用户把 OUT-0002 从已派遣流转到维修中（真实修改）
  const before = store.listRows('out_repair')
  const target = before.find((r) => r['派遣编号'] === 'OUT-0002')
  store.saveRows('out_repair', before.map((r) =>
    r.id === target.id ? { ...r, status: '维修中', __touched: true } : r,
  ))
  const first = store.restoreSamples()
  const after1 = store.listRows('out_repair')
  check('恢复后总数仍为 5（无重复）', after1.length === 5, `实际 ${after1.length}`)
  const touched = after1.find((r) => r['派遣编号'] === 'OUT-0002')
  check('真实流转的状态保留为维修中', touched.status === '维修中')
  const second = store.restoreSamples()
  const after2 = store.listRows('out_repair')
  check('第二次恢复总数仍为 5', after2.length === 5)
  check('两轮计数收敛：新增均为 0', first.added === 0 && second.added === 0, `${first.added}/${second.added}`)
  check('真实修改两轮后仍保留', after2.find((r) => r['派遣编号'] === 'OUT-0002').status === '维修中')
}

// --- 场景 4：恢复中断后从失败模块继续 ----------------------------------------
console.log('场景4 中断续跑')
{
  freshStore()
  // 先播种一份完整数据，再把它改写成「卡在第 3 个模块」的中断现场
  const seededStore = await importStore()
  seededStore.listRows('pipeline')
  const seeded = JSON.parse(memory.get(NEW_KEY))
  const moduleKeys = Object.keys(seeded.modules)
  seeded.restore = {
    status: 'failed', finished: moduleKeys.slice(0, 3), total: moduleKeys.length,
    failedModule: moduleKeys[3], error: '模拟中断', startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), added: 0, updated: 3, preserved: 0,
  }
  memory.set(NEW_KEY, JSON.stringify(seeded))
  const store2 = await importStore()
  store2.listRows('pipeline') // 触发惰性初始化与自动续跑
  const state = store2.restoreState()
  check('中断后打开自动续跑为 done', state.status === 'done', state.error)
  check('所有模块均完成', state.finished.length === moduleKeys.length)
  check('模块数据齐全', Object.keys(store2.allRows()).length === moduleKeys.length)
}

// --- 场景 5：单模块重置幂等 --------------------------------------------------
console.log('场景5 单模块重置')
{
  freshStore()
  const store = await importStore()
  store.resetRows('out_repair')
  store.resetRows('out_repair')
  const rows = store.listRows('out_repair')
  check('重复重置仍为 5 条', rows.length === 5)
}

rmSync(OUT, { recursive: true, force: true })
if (failures > 0) {
  console.error(`\n${failures} 项失败`)
  process.exit(1)
}
console.log('\n全部通过')
