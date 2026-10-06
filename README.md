# 城市地下管网巡检养护管理系统

面向城市地下管线登记建档、巡检任务、缺陷记录、外出维修、修复验收与设施档案全流程的地下管网巡检养护管理平台。

这是一个**纯前端**管理平台：Vue 3 + Vite + TypeScript，仓库里没有后端服务。业务数据由
`frontend/src/data/` 下的本地数据层提供：首次打开用示例数据播种，之后的登记、筛选与状态流转
结果都持久化在浏览器 `localStorage` 里，刷新或重开浏览器都还在。dev server 已关掉自动打开页面，
启动后按终端打印的地址手工打开。

## 样例口径与数据恢复

初始化数据、本地构建、运行环境共用**同一套样例口径**：`src/data/seed-core.mjs` 的
`buildDataset()` 是唯一生成器（模块字段/状态/动作定义在 `src/data/module-specs.mjs`），
部署构建时由 `prepare` 环节固化成 `public/seed.json`，运行环境则按同一生成器播种并对账。

- 外出维修样例的状态与时间字段严格衔接：待派遣无出发/返回时间；已派遣、维修中有出发时间无返回时间；
  已返回两个时间都有。「当日派遣」按当天派遣时刻（`_dispatchedAt`）统计，运营工作台和列表页同一口径。
- 数据按业务编号（如派遣编号）对账，存储信封带样例版本与业务日期：
  - **重复恢复不会多出记录**（按业务键去重补齐，幂等）；
  - **真实操作过的记录打 `_touched` 标记，不被样例覆盖**；用户自己登记的记录始终保留；
  - 旧版手写样例自动平滑迁移；跨天未改动的当天样例随日期滚动。
- 想让单个模块回到初始样例：调用 `resetModule(模块)`（用户自建记录仍保留）。

## 部署流水线（可恢复、可观测）

```bash
cd frontend
npm run deploy          # prepare → typecheck → build → verify
npm run deploy          # 失败修复后重跑：成功环节跳过，从失败环节继续，其后环节级联重跑
npm run deploy -- --reset-stage build   # 从指定环节起重跑
npm run deploy -- --reset               # 完整重新部署，不残留上次结果
npm run seed:generate   # 只重新生成样例快照
```

- 每个环节状态实时落 `.deploy/state.json`，并镜像到 `public|dist/deploy-status.json`；
  **运营工作台首页直接展示流水线卡在哪个环节、错误信息是什么**。
- 中断（进程被杀）的环节重跑时自动判为失败并从该环节继续；`build` 前会先清空旧 `dist`，不残留半截产物。
- `verify` 校验构建产物完整性，并证明 `public/seed.json` 能用同一生成器逐字节复现（口径漂移直接失败）。
- Docker 镜像构建（`docker compose build`）走的也是这条流水线。

## 目录结构

```text
.
├── frontend/                 Vue 3 + Vite + TypeScript 前端（唯一运行单元）
│   ├── src/views/            每个业务模块一个页面
│   ├── src/api/local-service.ts   本地数据服务：列表、筛选、动作流转、导出、指标、部署状态
│   ├── src/data/             模块规格 / 样例生成器 / 版本化对账 / localStorage 持久化
│   │   ├── module-specs.mjs  模块字段、状态、动作、指标的唯一定义（Node/浏览器同构）
│   │   └── seed-core.mjs     样例生成 + 一致性自检 + 幂等对账（去重/迁移/_touched 保护）
│   ├── scripts/deploy/       可恢复部署流水线（prepare/typecheck/build/verify + 状态机）
│   ├── src/stores/           会话与筛选状态
│   └── vite.config.ts        dev server 配置（open: false，无 /api 代理）
├── .gitignore
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
- 字段、状态、动作与流转目标集中在 `frontend/src/data/modules.ts`；示例数据在
  `frontend/src/data/seed.ts`。
- 状态流转只允许在 `local-service.ts` 里改，页面组件不做业务判断。
- 想回到初始数据：清掉浏览器里 `underground-pipeline-inspection:entries` 这一项，或调用 `resetModule(模块)`。
