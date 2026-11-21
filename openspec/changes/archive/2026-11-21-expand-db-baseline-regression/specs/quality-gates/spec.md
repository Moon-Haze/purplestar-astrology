# Spec Delta

## ADDED Requirements

### Requirement: JSON 契约语料级回归

`npm test` 层 1 SHALL 含一条 `astrology --json` 产物契约的语料级回归测试：对基准 fixtures
全集逐条**进程内**直调排盘与 JSON 装配（不经 CLI 子进程、不经缓存链路），把装配路径的
对拍覆盖从层 2 的单例断言扩到语料规模。断言面 SHALL 含四组：顶层键集冻结（多键少键即红）、
`.chart` 与 db 基准经比对器逐字段全等（同归一化同白名单，比对面与层 1 同源）、
`.nativeSiHua` 与基准四化标记双向一致且 stem 等于基准农历年干、null 语义与大限派生
（流月/流日/流时恒 null；大限层按盘派生、stem 与基准大限宫干互证）。测试 SHALL 注入
固定流年，同盘双跑产物逐字节一致。

#### Scenario: 键集冻结

- **WHEN** 测试对任一基准样本装配 JSON 产物
- **THEN** 顶层键集与冻结键集逐键一致（断言形态）；装配单点增删顶层键即红，点名差异键

#### Scenario: chart 面语料级对拍

- **WHEN** 基准全集逐条比对 `.chart` 与基准盘面
- **THEN** 经比对器零差异；反向注入装配路径漂移（改装配单点的任一派生键名）时该组当场红

#### Scenario: nativeSiHua 双向核对

- **WHEN** 任一基准样本的化曜落宫与基准 mutagen 标记比对
- **THEN** 双向一致：每个化曜星所在宫的基准标记为同四化，基准每个非空 mutagen 标记
  恰被四个化曜覆盖，stem 等于基准农历年干；反向注入装配链改用公历年干时，生年
  农历年干与公历年干不同的样本当场红

#### Scenario: null 语义、大限派生与确定性

- **WHEN** 未配置运限参数装配、流年年号注入固定值并同盘双跑
- **THEN** 流月/流日/流时恒为 null（显式 null 非缺键）；大限层按盘派生——期望下标由
  虚岁重算 + 基准大限区间独立推导，起运后 stem 等于基准大限宫干、童限未起运为 null；
  双跑产物逐字节一致

### Requirement: parquet 中档快测

大样本回归 SHALL 提供独立中档入口（独立命令，SHALL NOT 进入 `npm test` 日常回归），
流式读取 `db/dataset` 跑与层 1 同源的基准比对组，样本量 SHALL 可调。本机缺
`db/dataset` 或 DuckDB 依赖时 SHALL 显式跳过并标注原因，不得静默绿。`npm test` SHALL
保持 fixtures 管路不变——日常回归不因中档入口存在而新增原生依赖或显著变慢。

#### Scenario: 中档实跑

- **WHEN** 中档入口带样本量参数运行
- **THEN** 流式读取完成全量比对，输出汇总与实测耗时；比对器与层 1 同一实现（同归一、同白名单），
  不存在第二套比对口径

#### Scenario: 环境缺失可见跳过

- **WHEN** 本机无 `db/dataset` 或 DuckDB 依赖不可用
- **THEN** 入口输出显式跳过标注与原因（跳过必须可见），不以全绿掩盖未检查

#### Scenario: 不进日常回归

- **WHEN** 运行 `npm test`
- **THEN** 不触发 parquet 读取；未安装 DuckDB 原生依赖的环境日常回归照常全绿

#### Scenario: 双档结论一致

- **WHEN** 中档入口与层 1 对同一条基准样本比对
- **THEN** 结论一致（同一比对器、同一归一与白名单）

### Requirement: 亮度分歧普查

亮度审计 SHALL 由信息级普查工具承担：对基准样本逐条统计文墨亮度表与 db 基准亮度的
分歧分布（星、基准档位、本项目档位、命中盘数）并输出报告。普查 SHALL NOT 设 pass/fail、
SHALL NOT 进入任何闸门面——分歧是 2026-10 文墨口径切换的预期结果，闸门化会使红灯
失去信号；文墨 SB 表抄写笔误的发现路径是普查的分布形态（异常离散的孤例模式），属
人工审计而非自动拦截。

#### Scenario: 普查实跑

- **WHEN** 普查工具对基准全集运行
- **THEN** 输出总比对数、分歧数与占比、分歧组合分布表；各计数自报、不写死

#### Scenario: 不进闸门

- **WHEN** 运行 `npm test` 与 `selftest`
- **THEN** 不触发普查；普查输出任何取值都不影响闸门红绿

#### Scenario: 抄写笔误可分辨

- **WHEN** 文墨亮度表某单元格被注入错值后重跑普查
- **THEN** 分布表出现可识别的**新增组合行**（孤例或成簇，命中盘数 = 该星落该宫的
  频次），总分歧数的增量与之严格对应，可被人工识别——工具产出的是审计证据，
  不自动设闸

## MODIFIED Requirements

### Requirement: 基准回归的分层与登记

`npm test` SHALL 覆盖 7 层（层 1 排盘对标与 JSON 契约语料级回归 / 层 2 CLI 端到端 /
层 3 排盘结构不变量与内核契约 / 层 4 三合派约束 / 层 5 数据源纯函数 / 层 6 仓库自洽 /
层 7 引文守卫）。测试文件数 SHALL NOT 写死：`lib/run.ts` 的 `LAYERS` 登记与 `test/`
磁盘实况由对账断言双向盯住，文件增减时分层汇总自动跟随。

新增 `test/*.test.ts` SHALL 同时登记两处：`test/README.md` 的层表，与 `test/lib/run.ts` 的
`LAYERS` 数组。`LAYERS` 的 `suites` SHALL 与测试内的 describe 名逐字对应。
未登记的文件会被显式报出，不静默少计。

#### Scenario: 新增测试文件

- **WHEN** 新增 `test/foo.test.ts`
- **THEN** 同时登记层表与 LAYERS，否则被报为未登记

#### Scenario: suites 名字不符

- **WHEN** LAYERS 的 `suites` 与实际 describe 名不一致
- **THEN** 断言失败，不静默跳过该套件

#### Scenario: 文件数不写死

- **WHEN** 新增或退役测试文件
- **THEN** 分层汇总按 LAYERS 实况自报，文档与 spec 不残留旧文件数（本修订前的
  「14 个测试文件」已与磁盘 15 个实况腐烂，即为该规则的现实案例）

### Requirement: 生成物漂移探针

`docs/manual/` 的两份生成物（`tools/db/export-manual.ts` 从 `db/dataset` 与内核表导出）
与当前内核表 / 导出工具的一致性 SHALL 由漂移探针守住、不得只依赖人工重导：
`export-manual --check`（独立命令 `npm run manual:check`，纳入 review 闸门面）SHALL 在
内存中重导并与已提交产物逐字对拍，有差异即非零退出并报出漂移清单与样例；SHALL NOT
进入 `npm test` 日常回归；缺 `db/dataset` 或 DuckDB 时 SHALL 显式跳过并标注原因。
review 闸门的生成物清单（GENERATED）SHALL 由各生成器自报的托管面派生（无本地生成器的
以带理由的登记常量入册），SHALL NOT 手抄第二份；手写文件 SHALL NOT 被当成生成物拦截。

#### Scenario: 内核表改了、生成物未重导

- **WHEN** 内核数据表或导出工具改动后，`docs/manual/` 的生成物（`combo-frequency.md` / `geju-audit.md`）未重导
- **THEN** `npm run manual:check` 非零退出，报出漂移产物清单与差异样例

#### Scenario: 环境缺失时可见跳过

- **WHEN** 本机无 `db/dataset` 或 DuckDB 依赖不可用
- **THEN** 探针输出显式的跳过标注与原因，不以全绿掩盖未检查

#### Scenario: 不进日常回归

- **WHEN** 运行 `npm test`
- **THEN** 不触发重导对拍（探针只在独立命令与 review 面执行），日常回归时长不受影响

#### Scenario: 生成物与内核一致

- **WHEN** 生成物刚按当前内核表与导出工具重导提交
- **THEN** `npm run manual:check` 零退出，输出一行确认（无差异）

#### Scenario: 库漂移以哈希报出

- **WHEN** 盘上残留 `scripts/corpus/data/manual/oracle.db` 或 `docs/manual/topics/`
  （下线产物未清理）
- **THEN** 探针报盘上孤儿（重导不再生成，应删除），非零退出

#### Scenario: 手写文件不再被误伤

- **WHEN** 手改 `docs/manual/README.md`（自述文件，非生成物）
- **THEN** review 闸门不再按「改了已入库的生成文件」拦截

#### Scenario: 新增托管面即入册

- **WHEN** 某生成器（`export-manual` / `tools/notes/export-notes.ts` / `tools/corpus/import-tianji.ts`）新增托管路径或托管分区
- **THEN** 其自报清单随之演化，review 闸门自动覆盖——「生成器加了托管面、闸门不知道」
  的 miss 类从结构上消失
