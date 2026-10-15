# Design: 1986–91 中国夏令时自动校正

## Context

`--time HH:MM` 的换算链在 `scripts/cli/birth/birth-info.ts`：解析钟表时刻后调
`calcTrueSolar(ch, cm, longitude, { eot, year, month, day })`，返回 branch / dayOffset /
各项校正分钟数，note 在调用点拼装。`calcTrueSolar` 是纯函数，selftest 的 calc.ts
直调断言它（含 1990-05-15 的 eot 案例）——**DST 不进纯函数的默认行为**，作为
显式 opts 传入，既有断言零影响。

## Goals / Non-Goals

- Goals：区间内默认回拨 60 分；判定含时刻边界（02:00）；`--no-dst` 逃生门；
  note 把 DST 项与经度 / 均时差并列展示；`--branch` 路径不动。
- Non-Goals：不做其他时区 / 其他年代；不做动态规则计算；不在歧义段（结束日
  01:00–01:59）弹交互；不递增 `CACHE_VERSION`（缓存键是换算后 BirthInfo 的哈希，
  时辰变则键变，旧缓存自然不命中——已核 `chart-cache.ts` 的 `cacheKeyOf`）。

## Decisions

### 起止表：写死六年，来源 tzdata

百科类来源在 1988 年开始日上自相矛盾（04-10 vs 04-17）；以 IANA tzdata
（`Asia/Shanghai`，Rule PRC：`Apr Sun>=11` / `Sep Sun>=11`，1986 特例 5 月 4 日）
为准，已用本机 zoneinfo 逐年扫描核对切换点（1988-04-17 起、1989-09-17 止等）。
tzdata 是操作系统与排盘软件链的事实基准；表驱动比动态算规则直白
（首年特例让规则计算必须带分支）。

### 判定函数：`isChinaDstClock(year, month, day, clockMins)`

- 六年表之外整年直接 false。
- 年内区间：`[startDay, endDay)` 半开（按日序数比较），叠加时刻边界——
  `date == startDay` 时须 `clockMins >= 120` 才 true；`date == endDay` 时
  `clockMins < 120` 为 true（拨回前的重复段，保守取夏令时）。
- 结束日 01:00–01:59 的物理歧义不弹交互，note 提示「已按夏令时口径回拨」。
- 纯函数放 `birth-info.ts`（单消费者数据表归位纪律），供 selftest 直调断言。

### 换算函数：`calcTrueSolar` 加 `dstMinutes` 选项

`opts.dstMinutes?: number`（默认 0），`totalRaw = clockMins + longitudeRaw + eotRaw
- dstMinutes`；返回值加 `dstMinutes` 字段（取整后）。回拨与经度、均时差同列，
dayOffset / solar 的负数路径本就走 `Math.floor` + 双模，天然安全
（00:30 回拨 60 分 → 前一日 23:30 会正确产生 dayOffset −1，跨午夜测试口径复用）。

### 调用点接线与 note

`birth-info.ts` 的 `--time` 分支：`--no-dst` 未给时判定 DST，传入
`{ dstMinutes: isDst ? 60 : 0 }`。note 的校正量文案在 useEot 形态为
「经度 ±X 分 + 均时差 ±Y 分 − 夏令时 60 分 = ±Z 分」，非 eot 形态加「− 夏令时 60 分」；
不回拨时不出现 DST 字样（区间外输出零变化）。

### 参数面

`--no-dst` 注册进 args 表出生时辰组（`switch` / `noIntent`，与 `--no-cache` 同款），
`cmds: ["astrology", "synastry"]` 视 time 的命令面而定（time 在哪些命令可用就挂哪些）。
拼写容错与未知参数报错由 args 引擎统一兜底。

### 测试策略

- `test/cli.test.ts`：既有 DST 区间 `--time` 用例（`1990-05-15` 约 12 处）统一追加
  `--no-dst`——这些用例测的是各自功能点（跨午夜、eot、面板结构），不是 DST，
  期望值与注释零改动。新增「夏令时自动回拨」describe：区间内默认回拨（盘与
  手工 `--branch` 等价）、区间外零影响（与改前逐字一致）、`--no-dst` 复原、
  边界时刻两侧、`--branch` 不判定。
- `scripts/cli/selftest/calc.ts`：`isChinaDstClock` 断言（六年起止各取样、
  首尾年外、边界时刻、1992 之后）。
- 等价性基准沿用仓库风格：`--time 09:50`（区间内）排出的盘 必须等于
  `--branch`（换算后时辰）手输的盘——两条输入路径互证。

## Risks / Trade-offs

- **行为变化是本变更的目的本身**：区间内时辰回拨直至跨边界换盘。老用法
  （用户已自行减 1 小时）二次回拨 → `--no-dst` 复原，帮助与 note 都指路。
- 1988 年开始日两说（04-10 / 04-17）择 tzdata——若用户举证其他口径，
  改表是一行数据 + 断言同步，影响面收敛在判定函数。
- 歧义段保守取 DST 可能让结束日 01:xx 出生者时辰早一位——note 已提示，
  且 `--no-dst` 可切换对照（与 `--eot` 的两口径对照哲学一致）。

## Migration Plan

单次提交。既有 DST 区间测试补 `--no-dst` 属语义保持（不是迁就断言——
那些用例的意图本就不含 DST），专项新块钉新口径。
