# Design

## Context

现状与约束（动机见 proposal.md）：

- 层 1 链路：`db/dataset parquet → build-fixtures.ts（确定性抽样 300 条）→ fixtures/charts.jsonl → chart.test.ts 经 compare.ts 逐字段比对内核直调产物`。fixtures 已入库，`npm test` 零数据依赖。
- `test/lib/compare.ts` 的契约**禁止改动**（比对器 + 归一化 + `KNOWN_DIVERGENCES` 白名单，sample-source 注释明文）；宫名归一只施加在 baseline 侧（单向，防「同源同错」吞差异）。
- `buildAnalyzeJson`（`scripts/cli/commands/astrology.ts`）是 `--json` 装配单点，顶层 13 键冻结；`nativeSiHua` 经 `buildMutagenChain`（生年取**农历**年干）+ `locateSihua`（主星优先落宫）装配。
- 探索阶段实测：文墨 vs db 基准亮度分歧 19.3%（811/4200）、89.7% 的盘有分歧；单条样本普查秒级完成。
- `manual:check`（生成物漂移探针）是「独立命令 + 不进日常回归 + 环境缺失可见跳过」的既有先例，本变更两个工具沿同一形态。

## Goals / Non-Goals

**Goals:**

- JSON 契约装配路径获得语料级（300 条全集）外部真值对拍。
- 「8 秒 / 2.3 小时」两档之间补一个按需中档（约 3 分钟量级）。
- 文墨亮度表的抄写质量获得分布形态级审计手段。

**Non-Goals:**

- 不给 patterns / 流年 / 流月 / 流日 / 流时 / `liuNianPalace` / `xiaoXian` 找外部真值（db 是静态盘；值面仍归层 3 预言机）——**大限层为例外**：其 stem 可由基准大限宫干独立复算（见 D3）。
- 不改 `npm test` 数据管路、不改比对器契约、不触内核导出。
- 普查不做自动拦截。

## 不可逾越的约束

- 文墨排盘口径与倪师三合派论断不动；亮度继续退出 db 对拍（2026-10 决定）。
- `kernel-contract` 冻结面零协同改动；`compare.ts` 契约只复用不修改。
- 失败可见性 / 跳过必须可见 / 计数不写死（spec 既有 requirement）。
- 回归链路纪律照旧：涉及 spawn 的路径恒设 `ZIWEI_NO_CACHE=1`（本设计主路径进程内直调，天然不经缓存）。

## Decisions

### D1 JSON 契约测试走进程内直调，不走 CLI 子进程

- **决策**：新测试文件经 `test/lib/loader.ts` 动态加载内核，进程内调 `generateChart` + `buildAnalyzeJson`；`liuNianYear` 注入样本出生公历年、运限参数不传。
- **备选否决**：CLI 子进程逐条跑——300 次 spawn 慢一个量级、stdout 解析与缓存协调引入新失败面、失败信息隔一层。进程边界（内核直调 ≡ CLI `--json`）已由层 2 既有单例断言钉住，两边互补不重叠。
- **后果两面**：收益是快、失败堆栈直指装配单点、绕开缓存链路；代价是不覆盖 spawn / 参数解析路径——该路径归层 2，边界在此声明。
- **确定性边界**：`xiaoXian.age`（= `chart.currentAge`）随运行日期漂移，产物**跨日**不逐字节稳定；确定性断言限于**同进程双跑**逐字节一致（钉「不随环境/随机漂移」，不钉时变字段——与层 1 `expectedAge()` 独立重算思路同向但更弱，因为本测试不做 xiaoXian 值面断言）。

### D2 `.chart` 比对面全量复用 compareChart

- **决策**：`JSON.parse(装配产物).chart` 与 fixtures 的 baseline chart 直接喂 `compareChart`（同归一化、同白名单）。
- **理由**：比对口径单一真相源（接缝判据）；另写「JSON 版比对」必与层 1 漂移。形状对称性成立——fixtures 的 baseline 本就是 JSON parse 产物，装配产物同样经 JSON roundtrip，两侧 undefined 丢键行为一致。
- **deletion test**：删掉复用就得重写一套比对器，复杂度净增，无收益。
- **前置验证**：apply 首步先对 1 条样本做 roundtrip 对拍，确认零噪声后再扩全集。

### D3 nativeSiHua 双向核对直接吃基准 mutagen 标记

- **决策**：正向——每个化曜星在基准宫位里的 mutagen 标记 === 化；反向——基准全部非空 mutagen 标记 === 四化星集合；外加 `.stem === 基准 chart.lunarInfo.yearStem`（农历年干）。基准标记域 = 14 主星（恒有键）+ SIHUA_STARS 4 辅星。
- **反向注入计划**（apply 时验证断言活性）：改 `buildMutagenChain` 用公历年干 → 农≠公历年干样本红（1990-01-15 形态）；改 `locateSihua` 宫位查找偏移 → 落宫断言红。
- **已知风险**：若十干四化落到 SIHUA_STARS 域外的辅星，反向核对会红——按失败可见性处理：先核实是基准标记域覆盖不足还是装配缺陷；前者属 spec 级例外，停下来修订 spec 而非代码里静默放行。（实测全集 300 条首跑零例外，风险未兑现。）
- **大限层同样获得独立真值（实现期修正）**：`daXianSiHua` 并非规划期所写的「未配置恒 null」——它是**从盘面派生**的（`chart.currentDecadalIndex`，探针实证起运样本非 null）。断言按 `expectedAge` + 基准 `decadals` 独立复算期望下标（与 compareChart 的 currentDecadalIndex 重算同思路），非童限时断言 `stem === STEMS[基准大限宫 stem]`——大限层因此也对上 db 外部真值。童限分支在本语料恒不触发（1924–1983 生虚岁 103+），契约形态保留、该侧由 selftest 童限用例覆盖。

### D4 中档快测 = 独立脚本 + stride 确定性抽样

- **决策**：`test/tools/mid-corpus.ts`，package.json 挂 script `test:midcorpus`（`--` 传样本量参数，默认三千量级）；复用 `sample-source.ts` 的 `forEachSample` 单次表扫 + `compareChart`；**linspace 等距取样**（第 k 点 = `round((k+0.5)×total/n)`，总数现查不写死）——实现期发现固定步长 stride 会与样本序的日内周期（24 条/日）混叠（实测 121 条全同性别），linspace 的 ⌊⌋/⌈⌉ 交替间距打散相位且不依赖 sample_id 编码假设，取够即停；输出汇总（条数 / 覆盖维度 / 白名单命中 / 失败明细 / 实测耗时），全部自报。交叉核对取「fixtures 中第一条在数据集内存在」的样本（数据集年份范围随数据链演化——实测盘上 1950–2026 共 674,976 条，与 fixtures 的 1924–1983 部分重叠且重叠区逐字段一致）。
- **备选否决（探索阶段用户选项 B 的彻底版：npm test 直读 parquet）**：a) `@duckdb/node-api` 原生模块进热路径，装环境失败面变大，违背「日常回归什么都不需要」的既有设计意图；b) fixtures 是 iztro 2.5.8 **行为快照**，升级 iztro 流程（登记 → 单年 corpus 确认 → 重建）绕快照语义设计，直读会把基准从「快照」弱化为「活数据」，审阅锚点变软；c) 双档并行已补覆盖断层，收益相近、风险远小。fixtures 保留全部现有角色（层 1 输入、层 5 真实行基准、升级流程锚点）。
- **后果两面**：收益是日常回归零风险、中档按需跑；代价是中档不自动执行，依赖 CI 可选挂载或人工纪律——与 `manual:check` 同型，接受。
- **环境缺失语义**：无 `db/dataset` 或 DuckDB 不可用 → 显式 SKIP 行（打印原因与安装指引）+ **非零退出**（「要求跑而环境不允许」不是成功；跳过必须看得见的机器可读形态）。

### D5 普查工具 = fixtures-only MVP，纯文本分布表

- **决策**：`test/tools/` 新增手动脚本（带「仅直接执行才跑 main()」守卫，同 `build-fixtures` 惯例），默认跑 fixtures 300 条，输出：总比对数 / 分歧数与占比 / 分歧组合分布表（星 × 基准档 → 文墨档 × 命中盘数）；挂 npm script 便于发现。
- **备选否决**：--parquet 扩样参数——deletion test 不通过：删掉它普查仍完整覆盖审计目标（抄写笔误呈孤例形态），需要更大样本时加一个参数即可，不预支。做成 pass/fail 闸门——proposal 已否决（19.3% 分歧是预期学派差异，闸门红灯无信号）。
- **探索阶段种子**：`/tmp/brightness-census-300.mts` 演示脚本已验证可行性与输出形态，apply 时按仓库惯例（守卫 / 计数自报 / 错误处理）重写入库，不直接拷贝。

### D6 层号归属：JSON 契约测试归层 1 族

- **决策**：新测试文件登记进 `LAYERS` 的层 1（依赖基准样本是层 1 的定义性特征；层 2/3 刻意不依赖基准）。层描述更新为「层 1 排盘对标与 JSON 契约语料级回归」。
- **理由**：分层语义（依赖基准 vs 不依赖）不被打破；不新增层号（七层结构稳定，加层是结构变更，无必要）。

### 抽象三问自检

本设计**不新增任何抽象**：三个新文件全部落在既有接缝上（loader 加载、compare 比对、sample-source 流式），登记面是既有机制（LAYERS / README 层表 / package.json scripts）。接缝判据：每个交付物 = 一个文件 + 一行登记；deletion test：删任一文件只减能力不挪复杂度。

## Risks / Trade-offs

- [nativeSiHua 双向核对暴露基准标记域覆盖不足] → 按失败可见性处理；若属基准域问题，停下来修订 spec（例外须显式登记带理由），不在代码里静默放行
- [xiaoXian / currentAge 时变字段造成跨日漂移] → 契约测试不做其值面断言；确定性断言限同进程双跑；边界已在 D1 声明
- [JSON roundtrip 引入比对噪声（undefined 丢键、键序）] → apply 首步 1 条样本 roundtrip 对拍前置验证（D2）；若有噪声在**测试输入侧**显式归一，不给 compare.ts 加分支
- [中档实测耗时超出三千条 ≈3 分钟的估算] → apply 实跑记录真实耗时写入 README（自报实测值）；必要时调默认样本量，不硬撑
- [普查结果被误读为「质量报告」] → 工具输出首行显式声明「信息级审计，分歧是口径切换的预期结果，不作对错判据」

## Migration Plan

纯增量：三个新文件 + 三处登记（LAYERS / README 层表与分工表 / package.json script）+ 归档时折回 quality-gates spec。无数据迁移、无行为变更。回滚 = 删新文件 + 还原三处登记。

## Open Questions

（无阻塞性未知。中档与普查的 script 命名属 apply 细节；nativeSiHua 全集首跑是否零例外由 apply 首跑回答，若出现真例外按 D3 的失败可见性路径处理——那会回到 spec 层面，不属可静默延迟的开放问题。）
