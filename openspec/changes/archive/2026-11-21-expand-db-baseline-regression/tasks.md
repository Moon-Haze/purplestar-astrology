# Tasks

## 1. JSON 契约语料级回归（层 1 族）

- [x] 1.1 前置验证 JSON roundtrip 零噪声：写最小探针（临时脚本或测试内首条断言），取 1 条 fixture，进程内 `generateChart` → `buildAnalyzeJson` → `JSON.parse` → `compareChart` 对 baseline，期望零差异；若出现 undefined 丢键类噪声，在测试输入侧显式归一（不给 compare.ts 加分支）。完成判据：单样本探针绿，比对器零改动。（探针零噪声 ✓，顺带实证 daXianSiHua 起运样本非 null → 触发 spec 大限语义修正）
- [x] 1.2 新建 `test/json-contract.test.ts`（名可调，归层 1）：对 fixtures 全集逐条进程内装配并断言四组——顶层键集冻结 13 键；`.chart` 经 `compareChart` 全等；`.nativeSiHua` 双向核对（化曜落宫 ↔ 基准 mutagen 标记 + stem === 基准农历年干）；未配置运限层恒 null + 同进程双跑产物逐字节一致。`liuNianYear` 注入样本出生公历年。完成判据：`ZIWEI_NO_CACHE=1 npm test` 该文件全绿；若反向核对暴露基准标记域覆盖不足（SIHUA_STARS 域外辅星），停下按失败可见性处理并回 spec 层面，不静默放行。（301/301 全绿，基准标记域零例外）
- [x] 1.3 反向注入验证断言活性：临时改装配单点顶层键名 → 键集组红；临时改 `buildMutagenChain` 取公历年干 → 农≠公历年干样本的 nativeSiHua 组红；还原后 `ZIWEI_NO_CACHE=1 npm test` 全绿、`git diff` 干净。（注入 1：5/5 红且报错点名缺/多键；注入 2：仅农≠公历年干样本红、其余绿——区分度符合设计；还原后 scripts/ 零 diff、301/301 绿）
- [x] 1.4 登记两处：`test/lib/run.ts` 的 `LAYERS`（层 1，suites 与 describe 名逐字对应）+ `test/README.md` 层表（层 1 描述更新为「排盘对标与 JSON 契约语料级回归」）。完成判据：`ZIWEI_NO_CACHE=1 npm test` 分层汇总含新文件、对账无报警；repo 层登记断言绿。（npm test 942 项全绿，层 1 607 项含新文件，无对账报警）

## 2. parquet 中档快测

- [x] 2.1 新建 `test/tools/` 中档脚本（名 apply 定）：等距 stride 确定性抽样（`⌊518400/N⌋`，默认三千量级、`--` 传参可调）、`sample-source.ts` 的 `forEachSample` 单次表扫、比对与层 1 同一 `compareChart`；环境缺失（无 `db/dataset` / DuckDB 不可用）输出显式 SKIP 行（原因 + 指引）并**非零退出**；package.json 挂 script（`--` 透传参数）。完成判据：脚本空跑（无 dataset 时模拟）输出 SKIP 非零；`npm run typecheck` 过。（`test/tools/mid-corpus.ts` + `test:midcorpus`；抽样改 linspace——固定 stride 与样本序日内周期混叠，实测 121 条全同性别；typecheck 0 错误）
- [x] 2.2 实跑验证：`npm run <script> -- --n 3000` 全量比对零差异（白名单机制同层 1），记录实测耗时与覆盖维度自报（年份 / 性别 / 五行局 / 闰月年）。完成判据：退出码 0，汇总行含条数 / 白名单命中 / 耗时（实测值）。（3,000 条 / 77 年 / 2 性别 / 5 五行局 / 89 闰月，零差异，实测 123.6s）
- [x] 2.3 双档一致性 + 登记：脚本内置单条 fixtures 交叉核对（取一条 fixture 的出生五元组走中档管线，结论与层 1 一致——同一比对器由构造保证，抽查钉住）；`test/README.md`「验证手段分工」表与文件清单登记（含实测耗时、跳过语义）。完成判据：交叉核对绿；README 命令段按实跑输出可复现。（交叉核对绿——实现期发现盘上数据集为 1950–2026 共 674,976 条，fixtures 的 1924–1983 与之部分重叠且重叠区逐字段一致，故核对取「第一条在数据集内存在」的基准样本；README 三处登记完成）

## 3. 亮度分歧普查

- [x] 3.1 新建 `test/tools/brightness-census.ts`：fixtures 全集普查，输出首行「信息级审计」声明（分歧是 2026-10 口径切换的预期结果，不作对错判据）+ 总比对数 / 分歧数与占比 / 分歧组合分布表（星 × 基准档 → 文墨档 × 命中盘数），计数自报不写死；带「仅直接执行才跑 main()」守卫（同 `build-fixtures` 惯例，防 `node --test` 误执行）；package.json 挂 script。完成判据：`npm run typecheck` 过；直接执行输出分布表。（typecheck 0 错误；script `brightness:census`）
- [x] 3.2 实跑验证 + 可分辨性演练：实跑输出与探索阶段实测同量级（总比对 ≈4200、分歧 ≈811、占比 ≈19.3%——以实跑为准，README 记实测值不抄估算）；临时对文墨亮度表注错一格 → 重跑普查，该星该档组合呈孤例形态（分布表可人工识别）→ 还原后 `git diff` 干净、重跑恢复原分布。完成判据：两轮普查输出符合上述形态。（实跑 4200/811/19.3%、269/300 盘与探索逐项吻合；注错天机@子 庙→陷：分布表新增「27 天机: 庙旺 → 陷」组合行、总分歧 +27 严格对应——形态为成簇新增行非字面孤例，spec scenario 措辞已按实测校准；还原后普查输出与注错前逐字节一致、scripts/ 零 diff）
- [x] 3.3 登记：`test/README.md`「验证手段分工」表与文件清单登记（标注**信息级、不进任何闸门**）。完成判据：`ZIWEI_NO_CACHE=1 npm test` 与 `selftest` 输出不含普查触发痕迹（不进闸门的面无协同改动）。（README 两处登记完成；闸门面无协同改动——group 4 的全量跑复核）

## 4. 集成验收

- [x] 4.1 三件套全绿：`npm run typecheck` 0 错误；`node scripts/purple-star.ts selftest` 全绿；`ZIWEI_NO_CACHE=1 npm test` 全绿且分层汇总对账一致。完成判据：三条命令退出码均为 0（不接管道取码）。（typecheck 0 错误 / selftest 169/169 / npm test 942 项 942 通过、层 1 607 项含新文件、对账无报警；格式化后复跑仍全绿）
- [x] 4.2 风格闸门：`npm run lint` 0 error；`npm run format` 仅对本次新增 / 改动行执行、不整跑。完成判据：两命令退出码 0，`git diff` 无关行零噪声。（lint 0 error / 8 warning 全部预存于 5 个非本变更文件；prettier 只对 6 个新增/改动文件跑；表格重排为新行引起的自然连动，pretier 夹带的一行无关缩进已还原——HEAD 版 README 本就不满足 prettier，属选择性 format 文件）
- [x] 4.3 规范校验：`openspec validate --all` 通过且零警告。完成判据：退出码 0、输出无 WARNING。（普通与 --strict 双模式 12/12 全过零警告）
