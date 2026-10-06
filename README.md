# 城市地下管网巡检养护管理系统

面向城市地下管线登记建档、巡检任务、缺陷记录、外出维修、修复验收与设施档案全流程的地下管网巡检养护管理平台。

这是一个**纯前端**管理平台：Vue 3 + Vite + TypeScript，仓库里没有后端服务。业务数据由
`frontend/src/data/` 下的本地数据层提供：首次打开用示例数据播种，之后的登记、筛选与状态流转
结果都持久化在浏览器 `localStorage` 里，刷新或重开浏览器都还在。dev server 已关掉自动打开页面，
启动后按终端打印的地址手工打开。

## 目录结构

```text
.
├── frontend/                 Vue 3 + Vite + TypeScript 前端（唯一运行单元）
│   ├── src/views/            每个业务模块一个页面；外出维修含详情页 /out_repair/:id
│   ├── src/api/local-service.ts   本地数据服务：列表、筛选、动作流转、指标口径、导出
│   ├── src/data/             模块元数据 / 样例唯一来源 / localStorage 版本化持久化
│   │   ├── seed-builder.mjs  样例数据唯一定义（Node 与浏览器共用，部署脚本也引它）
│   │   ├── seed.ts           浏览器侧入口（补类型）
│   │   └── local-store.ts    版本迁移、幂等样例恢复、断点续跑
│   ├── scripts/deploy.mjs    分阶段部署流水线（含失败状态与续跑）
│   └── scripts/test-store.mjs 数据层行为测试（模拟 localStorage）
├── Makefile
├── Dockerfile + nginx.conf   构建期跑流水线，运行期由 nginx 提供 dist 静态产物
└── docker-compose.yml
```

## 启动

```bash
cd frontend
npm install
npm run dev
```

前端默认监听 `http://127.0.0.1:5173/`，dev server 不会自动打开浏览器，需要自己访问。

生产构建：

```bash
cd frontend
npm run build
```

## 样例口径（初始化数据 = 本地构建 = 运行环境）

样例只有 `src/data/seed-builder.mjs` 一份定义，浏览器运行、生产构建、部署校验都引用它，
样例版本号（`SEED_VERSION`）会一并打进运行产物，构建产物核对环节会验证产物里确实带这个版本。

- 外出维修样例严格衔接：待派遣无出发/返回时间；已派遣、维修中只有出发时间；
  已返回两个时间齐全且返回不早于出发；预计工时为「N小时」格式。
- 「当日派遣」按**出发时间是今天**的派遣单数统计（今日已派遣/维修中/已返回都计入），
  列表页与运营工作台用同一函数计算，不会再出现页面与看板对不上。
- 调整样例后请升 `SEED_VERSION`：旧浏览器打开时会自动迁移对齐。
- 旧版（无版本）数据首次打开时迁移：带占位文本（「…样例N」「OUT_-xxxx」）的陈旧样例
  按新口径对齐或丢弃；业务编号对不上的真实记录原样保留。

## 样例恢复（幂等、可断点续跑）

运营概览页有「重跑样例恢复」按钮，数据层按业务编号（如 `OUT-0003`）做 upsert：

- **重复执行不多记录**：同编号样例只对齐，不新增；
- **真实修改不被覆盖**：状态流转等操作会给记录打 `__touched` 标记，恢复时只补缺字段；
- **中断可续跑**：恢复按模块逐个落检查点（`restore.status/finished/failedModule`），
  中断或刷新后再次打开自动从失败模块继续，工作台显示卡在哪个模块及原因。
- 单模块重置：`resetModule(模块)`（外出维修详情页有入口），同样幂等。

## 部署流水线

`npm run deploy`（或 `make deploy`）依次执行六个环节，每个环节开始/结束都把状态原子写入
`public/deploy-state.json`，构建后拷进 `dist/`，运营概览页顶部直接展示各环节状态与失败原因：

| 环节 | 内容 |
| --- | --- |
| 环境检查 | Node/npm 版本与运行环境 |
| 安装依赖 | npm install，并按当前平台补齐 rollup/esbuild 原生二进制 |
| 样例口径校验 | 样例自检 + 数据层行为测试（`test:store`） |
| 类型检查 | vue-tsc --noEmit |
| 生产构建 | vite build |
| 产物核对 | dist 完整性 + 产物里必须含当前样例版本 |

- **全新执行** `npm run deploy`：先清 `dist/` 和上次状态，不残留上次结果。
- **失败后续跑** `npm run deploy:resume`（或 `make deploy-resume`）：已成功环节标记跳过，
  从失败环节重新执行。
- Docker 镜像在构建阶段跑同一条流水线，失败则镜像构建失败；运行阶段是 nginx 托管的
  纯静态产物（端口 8080），`make up` 一键构建启动。

## 业务模块

| 模块 | 目录 | 业务对象 | 主要字段 |
| --- | --- | --- | --- |
| 管线登记 | `pipeline` | 管线 | 管线编号、管线类型、起点位置 |
| 巡检任务 | `inspection` | 巡检任务 | 任务编号、巡检区域、巡检人员 |
| 缺陷记录 | `defect` | 缺陷记录 | 缺陷编号、所属管线、缺陷类型 |
| 外出维修 | `out_repair` | 外出维修 | 派遣编号、缺陷来源、维修人员 |
| 维修验收 | `repair_accept` | 维修验收记录 | 验收编号、关联维修、验收人员 |
| 管道检测 | `pipe_detect` | 检测记录 | 检测编号、检测管段、检测方式 |
| 井盖设施 | `manhole` | 井盖设施 | 井盖编号、所属道路、井盖类型 |
| 泵站运行 | `pump_station` | 泵站 | 泵站编号、泵站名称、所在区域 |
| 排水管网 | `drain_network` | 排水管段 | 管段编号、上游节点、下游节点 |
| 水质监测 | `water_quality` | 水质监测记录 | 监测编号、取样点位、取样日期 |
| 流量监测 | `flow_monitor` | 流量监测点 | 监测点编号、监测点位、监测时段 |
| 应急事件 | `emergency` | 应急事件 | 事件编号、事件类型、事发地点 |
| 漏水检测 | `leak_detect` | 漏水检测记录 | 检测编号、检测管段、检测方法 |
| 非开挖修复 | `trenchless` | 非开挖修复记录 | 修复编号、修复管段、修复工艺 |
| 管道清洗 | `pipe_cleaning` | 管道清洗记录 | 清洗编号、清洗管段、清洗方式 |
| 设施档案 | `facility_archive` | 设施档案 | 档案编号、设施名称、设施类别 |
| 监测设备 | `monitor_device` | 监测设备 | 设备编号、设备类型、安装位置 |
| 施工队伍 | `contractor` | 施工队伍 | 队伍编号、队伍名称、资质等级 |

## 约定

- 每个模块的页面在 `frontend/src/views/<模块>/index.vue`，页面只负责渲染，读写统一走
  `frontend/src/api/local-service.ts`。
- 字段、状态、动作与流转目标集中在 `frontend/src/data/modules.ts`；样例数据唯一定义在
  `frontend/src/data/seed-builder.mjs`。
- 状态流转只允许在 `local-service.ts` 里改，页面组件不做业务判断。外出维修按派遣顺序流转
  （待派遣→已派遣→维修中→已返回），并自动维护出发/返回时间与「维修状态」镜像字段。
- 指标口径统一由 `computeMetric()` 计算，页面卡片与运营工作台共用。
- 想回到初始数据：清掉浏览器里 `underground-pipeline-inspection:db` 这一项，或调用
  `resetModule(模块)`。旧键名 `…:entries` 会在迁移后自动清除。
