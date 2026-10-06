// 只（重新）生成样例快照 public/seed.json：初始化数据 / 构建 / 运行环境同一套口径。
// 完整的可恢复部署流程用 `npm run deploy`。
import { SEED_SNAPSHOT, writeStandalonePrepareStatus } from './deploy/prepare.mjs'

const state = writeStandalonePrepareStatus()
console.log(`样例快照已生成：${SEED_SNAPSHOT}`)
console.log(`版本 ${state.seed.version} · 业务日期 ${state.seed.bizDate}`)
