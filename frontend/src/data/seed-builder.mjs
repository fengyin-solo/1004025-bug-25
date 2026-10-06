// 样例数据的唯一来源（纯 ESM，Node 与浏览器都能直接跑）：
//   - 浏览器：src/data/seed.ts 包一层类型后给数据层用
//   - 构建部署：scripts/deploy.mjs 用它做口径校验
// 初始化播种、本地构建、运行环境、样例恢复都走这一份，避免两套口径对不上。

export const SEED_VERSION = '2026.10.06-02'

// 样例行与真实行的区分标记（下划线开头，页面表格与导出自动忽略）：
//   __seed        样例自然键（业务编号），恢复时按它幂等 upsert，重复执行不会多出记录
//   __seedVersion 该行来自哪个样例版本
//   __touched     用户是否做过真实修改；为 true 时恢复只补缺字段，不覆盖已有内容
export const SEED_KEY_FIELD = '__seed'
export const SEED_VERSION_FIELD = '__seedVersion'
export const TOUCHED_FIELD = '__touched'

function pad(value) {
  return String(value).padStart(2, '0')
}

// 样例基准日期取运行当天：外出维修的「当日派遣」要跟今天对上。
// dev、build、运行环境同一天打开时口径完全一致。
function dateText(base, offsetDays) {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function timeText(base, offsetDays, hour, minute = 0) {
  return `${dateText(base, offsetDays)} ${pad(hour)}:${pad(minute)}`
}

function tag(row, naturalKey) {
  return { ...row, [SEED_KEY_FIELD]: naturalKey, [SEED_VERSION_FIELD]: SEED_VERSION }
}

export function buildSeedRows(base) {
  const d0 = dateText(base, 0)
  const dm1 = dateText(base, -1)
  const dm2 = dateText(base, -2)
  return {
    "pipeline": [
      tag({
        "id": 1,
        "status": "待建档",
        "pending": true,
        "abnormal": false,
        "管线编号": "PIPE-0001",
        "管线类型": "给水管",
        "起点位置": "人民东路与解放大道交口",
        "终点位置": "人民东路泵站",
        "管径规格": "DN400",
        "管材类型": "球墨铸铁管",
        "敷设深度": "1.8m",
        "投运日期": dm2,
      }, "PIPE-0001"),
      tag({
        "id": 2,
        "status": "已建档",
        "pending": true,
        "abnormal": false,
        "管线编号": "PIPE-0002",
        "管线类型": "排水管",
        "起点位置": "滨河路西段",
        "终点位置": "滨河污水处理厂",
        "管径规格": "DN600",
        "管材类型": "钢筋混凝土管",
        "敷设深度": "2.4m",
        "投运日期": dm1,
      }, "PIPE-0002"),
      tag({
        "id": 3,
        "status": "待复核",
        "pending": true,
        "abnormal": false,
        "管线编号": "PIPE-0003",
        "管线类型": "中压燃气管",
        "起点位置": "工业园区南门",
        "终点位置": "园区调压站",
        "管径规格": "DN200",
        "管材类型": "PE管",
        "敷设深度": "1.2m",
        "投运日期": d0,
      }, "PIPE-0003"),
    ],
    "inspection": [
      tag({
        "id": 1,
        "status": "待分配",
        "pending": true,
        "abnormal": false,
        "任务编号": "INSP-0001",
        "巡检区域": "老城区供水管网",
        "巡检人员": "待分配",
        "巡检日期": d0,
        "巡检路线": "人民东路—解放大道环线",
        "计划时长": "4小时",
        "完成情况": "未开始",
        "任务状态": "待分配",
      }, "INSP-0001"),
      tag({
        "id": 2,
        "status": "已分配",
        "pending": true,
        "abnormal": false,
        "任务编号": "INSP-0002",
        "巡检区域": "滨河路排水管网",
        "巡检人员": "李建国",
        "巡检日期": d0,
        "巡检路线": "滨河西路—污水厂专线",
        "计划时长": "6小时",
        "完成情况": "未开始",
        "任务状态": "已分配",
      }, "INSP-0002"),
      tag({
        "id": 3,
        "status": "执行中",
        "pending": true,
        "abnormal": false,
        "任务编号": "INSP-0003",
        "巡检区域": "工业园区",
        "巡检人员": "王晓东",
        "巡检日期": d0,
        "巡检路线": "园区南—北线",
        "计划时长": "8小时",
        "完成情况": "巡检中",
        "任务状态": "执行中",
      }, "INSP-0003"),
    ],
    "defect": [
      tag({
        "id": 1,
        "status": "待确认",
        "pending": true,
        "abnormal": false,
        "缺陷编号": "DEFE-0001",
        "所属管线": "PIPE-0001",
        "缺陷类型": "接口渗漏",
        "发现位置": "人民东路 K1+200",
        "严重等级": "一般",
        "发现日期": dm1,
        "缺陷描述": "管道接口处有明显渗水痕迹",
        "记录状态": "待确认",
      }, "DEFE-0001"),
      tag({
        "id": 2,
        "status": "已确认",
        "pending": true,
        "abnormal": true,
        "缺陷编号": "DEFE-0002",
        "所属管线": "PIPE-0002",
        "缺陷类型": "管道破裂",
        "发现位置": "滨河西路 K0+650",
        "严重等级": "严重",
        "发现日期": d0,
        "缺陷描述": "管顶纵向裂缝约 40cm，路面有沉陷风险",
        "记录状态": "已确认",
      }, "DEFE-0002"),
      tag({
        "id": 3,
        "status": "已修复",
        "pending": false,
        "abnormal": false,
        "缺陷编号": "DEFE-0003",
        "所属管线": "PIPE-0003",
        "缺陷类型": "防腐层破损",
        "发现位置": "园区南门支线 K0+120",
        "严重等级": "轻微",
        "发现日期": dm2,
        "缺陷描述": "局部防腐层脱落，已补做防腐",
        "记录状态": "已修复",
      }, "DEFE-0003"),
    ],
    // 外出维修：状态、出发/返回时间、预计工时必须衔接，运营工作台「当日派遣」据此统计。
    //   待派遣：尚未派遣，出发/返回时间留空
    //   已派遣（今日下达并出发）：有出发时间、无返回时间；预计工时为计划值
    //   维修中（今日出发）：有出发时间、无返回时间
    //   已返回：两个时间齐全，预计工时与实际往返用时衔接
    "out_repair": [
      tag({
        "id": 1,
        "status": "待派遣",
        "pending": true,
        "abnormal": false,
        "派遣编号": "OUT-0001",
        "缺陷来源": "DEFE-0001 接口渗漏",
        "维修人员": "待派遣",
        "预计工时": "2小时",
        "携带工具": "检漏仪、管件、警示桩",
        "出发时间": "",
        "返回时间": "",
        "维修状态": "待派遣",
      }, "OUT-0001"),
      tag({
        "id": 2,
        "status": "已派遣",
        "pending": true,
        "abnormal": false,
        "派遣编号": "OUT-0002",
        "缺陷来源": "DEFE-0002 管道破裂",
        "维修人员": "赵海涛、孙鹏",
        "预计工时": "4小时",
        "携带工具": "挖掘机、封堵气囊、抽水泵",
        "出发时间": timeText(base, 0, 8, 30),
        "返回时间": "",
        "维修状态": "已派遣",
      }, "OUT-0002"),
      tag({
        "id": 3,
        "status": "维修中",
        "pending": true,
        "abnormal": false,
        "派遣编号": "OUT-0003",
        "缺陷来源": "巡检上报 井盖周边积水",
        "维修人员": "周勇、陈立",
        "预计工时": "3小时",
        "携带工具": "抽水泵、防护栏、应急灯",
        "出发时间": timeText(base, 0, 9, 0),
        "返回时间": "",
        "维修状态": "维修中",
      }, "OUT-0003"),
      tag({
        "id": 4,
        "status": "已返回",
        "pending": false,
        "abnormal": false,
        "派遣编号": "OUT-0004",
        "缺陷来源": "DEFE-0003 防腐层破损复检",
        "维修人员": "吴强",
        "预计工时": "2小时",
        "携带工具": "防腐胶带、磨光机",
        "出发时间": timeText(base, 0, 8, 0),
        "返回时间": timeText(base, 0, 9, 50),
        "维修状态": "已返回",
      }, "OUT-0004"),
      tag({
        "id": 5,
        "status": "已返回",
        "pending": false,
        "abnormal": false,
        "派遣编号": "OUT-0005",
        "缺陷来源": "昨日应急 阀门渗漏",
        "维修人员": "郑凯",
        "预计工时": "1.5小时",
        "携带工具": "扳手、密封件",
        "出发时间": timeText(base, -1, 14, 0),
        "返回时间": timeText(base, -1, 15, 30),
        "维修状态": "已返回",
      }, "OUT-0005"),
    ],
    "repair_accept": [
      tag({
        "id": 1,
        "status": "待验收",
        "pending": true,
        "abnormal": false,
        "验收编号": "REPA-0001",
        "关联维修": "OUT-0004",
        "验收人员": "待安排",
        "验收日期": d0,
        "维修质量": "待验收",
        "验收结论": "待验收",
        "复修要求": "",
        "验收状态": "待验收",
      }, "REPA-0001"),
      tag({
        "id": 2,
        "status": "验收中",
        "pending": true,
        "abnormal": false,
        "验收编号": "REPA-0002",
        "关联维修": "OUT-0005",
        "验收人员": "钱晓芸",
        "验收日期": d0,
        "维修质量": "现场复核中",
        "验收结论": "待定",
        "复修要求": "",
        "验收状态": "验收中",
      }, "REPA-0002"),
      tag({
        "id": 3,
        "status": "已通过",
        "pending": false,
        "abnormal": false,
        "验收编号": "REPA-0003",
        "关联维修": "OUT-0003",
        "验收人员": "冯丽华",
        "验收日期": dm1,
        "维修质量": "合格",
        "验收结论": "通过",
        "复修要求": "",
        "验收状态": "已通过",
      }, "REPA-0003"),
    ],
    "pipe_detect": [
      tag({
        "id": 1,
        "status": "待检测",
        "pending": true,
        "abnormal": false,
        "检测编号": "PIDE-0001",
        "检测管段": "人民东路 K1+000—K1+500",
        "检测方式": "CCTV检测",
        "检测设备": "CCTV机器人 A-02",
        "检测日期": d0,
        "检测长度": "500m",
        "检测结果": "待检测",
        "检测状态": "待检测",
      }, "PIDE-0001"),
      tag({
        "id": 2,
        "status": "检测中",
        "pending": true,
        "abnormal": false,
        "检测编号": "PIDE-0002",
        "检测管段": "滨河西路 K0+500—K1+100",
        "检测方式": "声呐检测",
        "检测设备": "声呐仪 S-11",
        "检测日期": d0,
        "检测长度": "600m",
        "检测结果": "检测中",
        "检测状态": "检测中",
      }, "PIDE-0002"),
      tag({
        "id": 3,
        "status": "已完成",
        "pending": false,
        "abnormal": false,
        "检测编号": "PIDE-0003",
        "检测管段": "园区南线 K0+000—K0+800",
        "检测方式": "CCTV检测",
        "检测设备": "CCTV机器人 A-01",
        "检测日期": dm1,
        "检测长度": "800m",
        "检测结果": "结构性缺陷 2 处",
        "检测状态": "已完成",
      }, "PIDE-0003"),
    ],
    "manhole": [
      tag({
        "id": 1,
        "status": "正常",
        "pending": false,
        "abnormal": false,
        "井盖编号": "MANH-0001",
        "所属道路": "人民东路",
        "井盖类型": "污水井盖",
        "井盖材质": "球墨铸铁",
        "规格尺寸": "Φ700",
        "安装日期": dm2,
        "养护周期": "12个月",
        "当前状态": "正常",
      }, "MANH-0001"),
      tag({
        "id": 2,
        "status": "待维护",
        "pending": true,
        "abnormal": true,
        "井盖编号": "MANH-0002",
        "所属道路": "滨河西路",
        "井盖类型": "雨水井盖",
        "井盖材质": "复合材料",
        "规格尺寸": "Φ700",
        "安装日期": dm1,
        "养护周期": "6个月",
        "当前状态": "井座松动",
      }, "MANH-0002"),
      tag({
        "id": 3,
        "status": "维护中",
        "pending": true,
        "abnormal": false,
        "井盖编号": "MANH-0003",
        "所属道路": "工业园区南路",
        "井盖类型": "电力井盖",
        "井盖材质": "球墨铸铁",
        "规格尺寸": "Φ800",
        "安装日期": d0,
        "养护周期": "12个月",
        "当前状态": "防坠网更换中",
      }, "MANH-0003"),
    ],
    "pump_station": [
      tag({
        "id": 1,
        "status": "待启机",
        "pending": true,
        "abnormal": false,
        "泵站编号": "PUMP-0001",
        "泵站名称": "人民东路泵站",
        "所在区域": "老城区",
        "水泵型号": "300QW-800",
        "额定流量": "800m³/h",
        "运行电流": "0A",
        "运行时长": "0h",
        "运行状态": "待启机",
      }, "PUMP-0001"),
      tag({
        "id": 2,
        "status": "运行中",
        "pending": true,
        "abnormal": false,
        "泵站编号": "PUMP-0002",
        "泵站名称": "滨河污水提升泵站",
        "所在区域": "滨河片区",
        "水泵型号": "400QW-1200",
        "额定流量": "1200m³/h",
        "运行电流": "168A",
        "运行时长": "6.5h",
        "运行状态": "运行中",
      }, "PUMP-0002"),
      tag({
        "id": 3,
        "status": "已停机",
        "pending": false,
        "abnormal": false,
        "泵站编号": "PUMP-0003",
        "泵站名称": "园区雨水泵站",
        "所在区域": "工业园区",
        "水泵型号": "250QW-600",
        "额定流量": "600m³/h",
        "运行电流": "0A",
        "运行时长": "182h",
        "运行状态": "已停机",
      }, "PUMP-0003"),
    ],
    "drain_network": [
      tag({
        "id": 1,
        "status": "正常",
        "pending": false,
        "abnormal": false,
        "管段编号": "DRAI-0001",
        "上游节点": "PS-01",
        "下游节点": "PS-04",
        "管段长度": "320m",
        "断面尺寸": "d800",
        "设计坡度": "0.15%",
        "排水能力": "满管过流",
        "运行状况": "正常",
      }, "DRAI-0001"),
      tag({
        "id": 2,
        "status": "淤积预警",
        "pending": true,
        "abnormal": true,
        "管段编号": "DRAI-0002",
        "上游节点": "PS-04",
        "下游节点": "PS-09",
        "管段长度": "410m",
        "断面尺寸": "d1000",
        "设计坡度": "0.12%",
        "排水能力": "下降约三成",
        "运行状况": "淤积超 1/4 管径",
      }, "DRAI-0002"),
      tag({
        "id": 3,
        "status": "溢流风险",
        "pending": true,
        "abnormal": true,
        "管段编号": "DRAI-0003",
        "上游节点": "PS-09",
        "下游节点": "WS-01",
        "管段长度": "260m",
        "断面尺寸": "d1200",
        "设计坡度": "0.10%",
        "排水能力": "高水位运行",
        "运行状况": "暴雨时存在溢流风险",
      }, "DRAI-0003"),
    ],
    "water_quality": [
      tag({
        "id": 1,
        "status": "待取样",
        "pending": true,
        "abnormal": false,
        "监测编号": "WATE-0001",
        "取样点位": "滨河污水厂进口",
        "取样日期": d0,
        "PH值": "待检测",
        "氨氮浓度": "待检测",
        "COD值": "待检测",
        "浊度": "待检测",
        "监测结论": "待取样",
      }, "WATE-0001"),
      tag({
        "id": 2,
        "status": "已取样",
        "pending": true,
        "abnormal": false,
        "监测编号": "WATE-0002",
        "取样点位": "人民东路管网节点",
        "取样日期": d0,
        "PH值": "7.2",
        "氨氮浓度": "化验中",
        "COD值": "化验中",
        "浊度": "38NTU",
        "监测结论": "待出结果",
      }, "WATE-0002"),
      tag({
        "id": 3,
        "status": "已出结果",
        "pending": false,
        "abnormal": false,
        "监测编号": "WATE-0003",
        "取样点位": "园区排口",
        "取样日期": dm1,
        "PH值": "7.8",
        "氨氮浓度": "1.2mg/L",
        "COD值": "26mg/L",
        "浊度": "12NTU",
        "监测结论": "达标",
      }, "WATE-0003"),
    ],
    "flow_monitor": [
      tag({
        "id": 1,
        "status": "在线",
        "pending": false,
        "abnormal": false,
        "监测点编号": "FLOW-0001",
        "监测点位": "滨河西路 d1000 管段",
        "监测时段": d0,
        "瞬时流量": "0.42m³/s",
        "累计流量": "12860m³",
        "水位标高": "38.20m",
        "流速": "0.8m/s",
        "数据状态": "在线",
      }, "FLOW-0001"),
      tag({
        "id": 2,
        "status": "离线",
        "pending": true,
        "abnormal": true,
        "监测点编号": "FLOW-0002",
        "监测点位": "人民东路 d800 管段",
        "监测时段": d0,
        "瞬时流量": "—",
        "累计流量": "9420m³",
        "水位标高": "—",
        "流速": "—",
        "数据状态": "通信中断 6 小时",
      }, "FLOW-0002"),
      tag({
        "id": 3,
        "status": "数据异常",
        "pending": true,
        "abnormal": true,
        "监测点编号": "FLOW-0003",
        "监测点位": "园区排口",
        "监测时段": d0,
        "瞬时流量": "3.1m³/s（超量程）",
        "累计流量": "15100m³",
        "水位标高": "40.60m",
        "流速": "2.4m/s",
        "数据状态": "数值跳变待核",
      }, "FLOW-0003"),
    ],
    "emergency": [
      tag({
        "id": 1,
        "status": "待响应",
        "pending": true,
        "abnormal": false,
        "事件编号": "EMER-0001",
        "事件类型": "路面塌陷",
        "事发地点": "滨河西路 K0+650",
        "危害等级": "二级",
        "接报时间": timeText(base, 0, 7, 50),
        "处置时限": "2小时",
        "处置方案": "待制定",
        "事件状态": "待响应",
      }, "EMER-0001"),
      tag({
        "id": 2,
        "status": "响应中",
        "pending": true,
        "abnormal": false,
        "事件编号": "EMER-0002",
        "事件类型": "污水冒溢",
        "事发地点": "建设路市场门口",
        "危害等级": "三级",
        "接报时间": timeText(base, 0, 6, 20),
        "处置时限": "4小时",
        "处置方案": "出动抽排车 + 疏通班组",
        "事件状态": "响应中",
      }, "EMER-0002"),
      tag({
        "id": 3,
        "status": "处置中",
        "pending": true,
        "abnormal": false,
        "事件编号": "EMER-0003",
        "事件类型": "阀门井进水",
        "事发地点": "人民东路与中山交口",
        "危害等级": "三级",
        "接报时间": timeText(base, -1, 22, 10),
        "处置时限": "6小时",
        "处置方案": "抽水后更换密封件",
        "事件状态": "处置中",
      }, "EMER-0003"),
    ],
    "leak_detect": [
      tag({
        "id": 1,
        "status": "待检测",
        "pending": true,
        "abnormal": false,
        "检测编号": "LEAK-0001",
        "检测管段": "人民东路 DN400 给水管",
        "检测方法": "相关仪检漏",
        "检测人员": "待安排",
        "检测日期": d0,
        "漏点数量": 0,
        "漏损程度": "待评估",
        "检测状态": "待检测",
      }, "LEAK-0001"),
      tag({
        "id": 2,
        "status": "检测中",
        "pending": true,
        "abnormal": false,
        "检测编号": "LEAK-0002",
        "检测管段": "滨河路 DN300 配水管",
        "检测方法": "听音巡检",
        "检测人员": "马俊",
        "检测日期": d0,
        "漏点数量": 0,
        "漏损程度": "评估中",
        "检测状态": "检测中",
      }, "LEAK-0002"),
      tag({
        "id": 3,
        "status": "已出报告",
        "pending": false,
        "abnormal": false,
        "检测编号": "LEAK-0003",
        "检测管段": "园区 DN200 中水管",
        "检测方法": "相关仪检漏",
        "检测人员": "马俊",
        "检测日期": dm1,
        "漏点数量": 2,
        "漏损程度": "轻微",
        "检测状态": "已出报告",
      }, "LEAK-0003"),
    ],
    "trenchless": [
      tag({
        "id": 1,
        "status": "待施工",
        "pending": true,
        "abnormal": false,
        "修复编号": "TREN-0001",
        "修复管段": "滨河西路 K0+500—K0+720",
        "修复工艺": "CIPP紫外光固化",
        "修复材料": "玻纤软管",
        "施工日期": d0,
        "修复长度": "220m",
        "修复效果": "待施工",
        "修复状态": "待施工",
      }, "TREN-0001"),
      tag({
        "id": 2,
        "status": "施工中",
        "pending": true,
        "abnormal": false,
        "修复编号": "TREN-0002",
        "修复管段": "园区南线 K0+100—K0+300",
        "修复工艺": "短管内衬",
        "修复材料": "PE短管",
        "施工日期": d0,
        "修复长度": "200m",
        "修复效果": "施工中",
        "修复状态": "施工中",
      }, "TREN-0002"),
      tag({
        "id": 3,
        "status": "已完成",
        "pending": false,
        "abnormal": false,
        "修复编号": "TREN-0003",
        "修复管段": "建设路 K0+000—K0+180",
        "修复工艺": "CIPP热水固化",
        "修复材料": "聚酯软管",
        "施工日期": dm1,
        "修复长度": "180m",
        "修复效果": "过流恢复、闭水合格",
        "修复状态": "已完成",
      }, "TREN-0003"),
    ],
    "pipe_cleaning": [
      tag({
        "id": 1,
        "status": "待清洗",
        "pending": true,
        "abnormal": false,
        "清洗编号": "CLN-0001",
        "清洗管段": "DRAI-0002 淤积管段",
        "清洗方式": "高压水射流",
        "清洗设备": "联合疏通车 HC-03",
        "计划日期": d0,
        "实际日期": "",
        "清洗长度": "410m",
        "清洗状态": "待清洗",
      }, "CLN-0001"),
      tag({
        "id": 2,
        "status": "清洗中",
        "pending": true,
        "abnormal": false,
        "清洗编号": "CLN-0002",
        "清洗管段": "人民东路 d800 管段",
        "清洗方式": "绞车清淤",
        "清洗设备": "绞车 JW-01",
        "计划日期": d0,
        "实际日期": d0,
        "清洗长度": "320m",
        "清洗状态": "清洗中",
      }, "CLN-0002"),
      tag({
        "id": 3,
        "status": "已完成",
        "pending": false,
        "abnormal": false,
        "清洗编号": "CLN-0003",
        "清洗管段": "园区排口上游管段",
        "清洗方式": "高压水射流",
        "清洗设备": "联合疏通车 HC-02",
        "计划日期": dm1,
        "实际日期": dm1,
        "清洗长度": "560m",
        "清洗状态": "已完成",
      }, "CLN-0003"),
    ],
    "facility_archive": [
      tag({
        "id": 1,
        "status": "待归档",
        "pending": true,
        "abnormal": false,
        "档案编号": "FACI-0001",
        "设施名称": "人民东路给水管线工程",
        "设施类别": "给水管道",
        "所属区域": "老城区",
        "竣工日期": dm2,
        "设计图纸": "已收 12 张，待归档",
        "承建企业": "市政建设集团",
        "档案状态": "待归档",
      }, "FACI-0001"),
      tag({
        "id": 2,
        "status": "已归档",
        "pending": false,
        "abnormal": false,
        "档案编号": "FACI-0002",
        "设施名称": "滨河污水提升泵站",
        "设施类别": "泵站",
        "所属区域": "滨河片区",
        "竣工日期": dm1,
        "设计图纸": "图档 A-2026-018",
        "承建企业": "水务工程公司",
        "档案状态": "已归档",
      }, "FACI-0002"),
      tag({
        "id": 3,
        "status": "待更新",
        "pending": true,
        "abnormal": false,
        "档案编号": "FACI-0003",
        "设施名称": "园区雨水管线",
        "设施类别": "雨水管道",
        "所属区域": "工业园区",
        "竣工日期": d0,
        "设计图纸": "改线后图纸未补齐",
        "承建企业": "园区开发公司",
        "档案状态": "待更新",
      }, "FACI-0003"),
    ],
    "monitor_device": [
      tag({
        "id": 1,
        "status": "待安装",
        "pending": true,
        "abnormal": false,
        "设备编号": "MONI-0001",
        "设备类型": "液位计",
        "安装位置": "DRAI-0002 管段检查井",
        "监测参数": "水位、流速",
        "安装日期": d0,
        "校准周期": "6个月",
        "最近校准": "—",
        "设备状态": "待安装",
      }, "MONI-0001"),
      tag({
        "id": 2,
        "status": "运行中",
        "pending": false,
        "abnormal": false,
        "设备编号": "MONI-0002",
        "设备类型": "在线水质仪",
        "安装位置": "滨河污水厂进口",
        "监测参数": "pH、氨氮、COD、浊度",
        "安装日期": dm1,
        "校准周期": "3个月",
        "最近校准": dm1,
        "设备状态": "运行中",
      }, "MONI-0002"),
      tag({
        "id": 3,
        "status": "待校准",
        "pending": true,
        "abnormal": false,
        "设备编号": "MONI-0003",
        "设备类型": "电磁流量计",
        "安装位置": "园区排口",
        "监测参数": "瞬时流量、累计流量",
        "安装日期": dm2,
        "校准周期": "12个月",
        "最近校准": "2025-12-01",
        "设备状态": "待校准",
      }, "MONI-0003"),
    ],
    "contractor": [
      tag({
        "id": 1,
        "status": "待审核",
        "pending": true,
        "abnormal": false,
        "队伍编号": "CONT-0001",
        "队伍名称": "恒通管道工程队",
        "资质等级": "市政公用工程三级",
        "所属企业": "恒通建设有限公司",
        "联系人": "许文彬",
        "联系电话": "13800000001",
        "特种作业证": "待核验",
        "队伍状态": "待审核",
      }, "CONT-0001"),
      tag({
        "id": 2,
        "status": "已备案",
        "pending": false,
        "abnormal": false,
        "队伍编号": "CONT-0002",
        "队伍名称": "清源养护有限公司",
        "资质等级": "市政公用工程二级",
        "所属企业": "清源养护集团",
        "联系人": "沈丽华",
        "联系电话": "13800000002",
        "特种作业证": "SPE-2025-1102",
        "队伍状态": "已备案",
      }, "CONT-0002"),
      tag({
        "id": 3,
        "status": "作业中",
        "pending": true,
        "abnormal": false,
        "队伍编号": "CONT-0003",
        "队伍名称": "安达非开挖工程队",
        "资质等级": "特种作业（非开挖修复）",
        "所属企业": "安达工程技术公司",
        "联系人": "曹志远",
        "联系电话": "13800000003",
        "特种作业证": "SPE-2024-0876",
        "队伍状态": "作业中",
      }, "CONT-0003"),
    ],
  }
}

// 每个模块第一个业务字段即业务编号，作为样例自然键与恢复去重依据。
export function naturalKeyFields(rows) {
  const map = {}
  for (const [key, list] of Object.entries(rows)) {
    map[key] = Object.keys(list[0]).find((name) => !name.startsWith('__') && name !== 'id') ?? ''
  }
  return map
}

// 样例口径自检：任何一条不过，部署流水线 verify 环节直接失败。
// 重点守外出维修：状态、出发/返回时间、预计工时必须衔接。
export function validateSeed(rows) {
  const problems = []
  const requireField = (moduleKey, row, field, expect, actual) => {
    if (actual !== expect) {
      problems.push(`${moduleKey}#${row.id} ${field} 应为「${expect}」，实际「${actual}」`)
    }
  }
  for (const [moduleKey, list] of Object.entries(rows)) {
    const seen = new Set()
    for (const row of list) {
      if (!row[SEED_KEY_FIELD] || row[SEED_VERSION_FIELD] !== SEED_VERSION) {
        problems.push(`${moduleKey}#${row.id} 缺少样例标记/版本`)
      }
      if (seen.has(row[SEED_KEY_FIELD])) {
        problems.push(`${moduleKey} 自然键重复：${row[SEED_KEY_FIELD]}`)
      }
      seen.add(row[SEED_KEY_FIELD])
      const lastStatus = {
        out_repair: '已返回',
      }[moduleKey]
      if (moduleKey === 'out_repair') {
        const departed = row['出发时间'] !== ''
        const returned = row['返回时间'] !== ''
        switch (row.status) {
          case '待派遣':
            requireField(moduleKey, row, '出发时间', '', row['出发时间'])
            requireField(moduleKey, row, '返回时间', '', row['返回时间'])
            break
          case '已派遣':
          case '维修中':
            if (!departed) problems.push(`${moduleKey}#${row.id} 已${row.status}但缺少出发时间`)
            requireField(moduleKey, row, '返回时间', '', row['返回时间'])
            break
          case '已返回':
            if (!departed) problems.push(`${moduleKey}#${row.id} 已返回但缺少出发时间`)
            if (!returned) problems.push(`${moduleKey}#${row.id} 已返回但缺少返回时间`)
            if (departed && returned && row['返回时间'] < row['出发时间']) {
              problems.push(`${moduleKey}#${row.id} 返回时间早于出发时间`)
            }
            break
          default:
            problems.push(`${moduleKey}#${row.id} 出现未登记状态「${row.status}」`)
        }
        requireField(moduleKey, row, '维修状态', row.status, row['维修状态'])
        requireField(moduleKey, row, 'pending', row.status !== '已返回', row.pending)
        if (!/^\d+(\.\d+)?小时$/.test(String(row['预计工时']))) {
          problems.push(`${moduleKey}#${row.id} 预计工时口径非法：${row['预计工时']}`)
        }
      }
      if (lastStatus && row.status === lastStatus && row.pending !== false) {
        problems.push(`${moduleKey}#${row.id} 终态记录 pending 应为 false`)
      }
    }
  }
  return problems
}
