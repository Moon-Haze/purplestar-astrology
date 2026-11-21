# GLOSSARY（术语表）

本仓术语速查，供 AI 助手与贡献者对齐口径。**只做定义，不立规矩**：纪律与约束的单一真相源在
[AGENTS.md](AGENTS.md)，本文与其冲突时以 AGENTS.md 为准；细节展开见 `docs/` 与 `references/`。
条目分三组：紫微斗数领域 / 仓库工程 / 多根工作区。

---

## 一、紫微斗数领域

### 体系与流派

- **紫微斗数**：本 skill 排盘与论断的术数体系。排盘引擎是 [iztro](https://github.com/SylarLong/iztro)（版本锁定见 `package-lock.json`），农历换算用 lunar-typescript。
- **三合派**：论断框架所属流派，按《天纪》体系——四化星永远固定（只按生年干起），大限只看宫位移动，不另起宫干四化。
- **飞星派**：以宫干四化、自化、来因宫论命的流派。**本仓禁用**，相关函数已删除，全仓零调用点。
- **文墨天机**：排盘口径的来源站点。亮度（SB 表覆写）与运限四化（含大限宫干层）以其为准。
- **混合口径**：本仓既定组合 = 文墨排盘 + 倪师论断（《天纪》三合派）。体系立场详见 AGENTS.md「体系口径」节。
- **《天纪》**：论断框架与判语语料的同源出处。本仓只收录其紫微五册（主星 / 十二宫 / 格局 / 四化 / 疾厄）。

### 星曜与四化

- **十四主星**：星曜名以 `scripts/data/stars.ts` 为唯一真相源。`Star.type` 的 `"major"` **只能**由 iztro 给出，两张吉煞名单里没有主星。
- **吉星 / 煞星 / 杂曜**：`Star.type` 的 `"soft"` / `"tough"` / `"minor"`。名单住 `algorithm.ts`（`SOFT_STARS` / `TOUGH_STARS`，如文昌文曲左辅右弼 / 擎羊陀罗火星铃星）——改名单即改格局命中，别顺手加星。
- **四化**：化禄 / 化权 / 化科 / 化忌。生年四化按出生年干查 `data/sihua.ts` 的 `SI_HUA_TABLE`。
- **六层四化**：`mutagen.ts` 导出六层——生年 / 大限宫干（`getDaXianMutagen`）/ 流年 / 流月 / 流日 / 流时。
- **宫干自化**（禁用）：宫的天干对其本宫星曜再化。`Palace.selfMutagen` 不填充。
- **来因宫**（禁用）：飞星派概念，本仓无实现。
- **绊线字段**：`types.ts` 里**刻意保留**的禁用字段（`Palace.selfMutagen`、`Decadal.stemIndex` / `stemName` / `mutagen` 等），运行时恒为 `undefined`——断言盯的正是「有没有被填回」。要删先读 `docs/code/chart-kernel.md`「绊线字段」节。
- **亮度**：`brightness` 三档（`bright` 庙旺 / `dim` 陷不闲 / 其余 `normal`）由 `brightnessRaw` 中文细档塌缩而来。
- **SB 表**：文墨天机的星曜亮度表（`data/wenmo-tables.ts`，生成文件）。四流派 `QS` / `XD1` / `ZZ` / `XD2`，本仓默认 `XD2`；未收录或留白的星，主星回落 iztro 原值、辅杂曜无亮度。

### 宫位与命盘

- **展开形宫名**：带「宫」字的宫名，运行时宫名域。有序序列 `PALACE_NAMES_ORDER`（`data/ganzhi.ts`）：命宫 → 兄弟宫 → … → 父母宫。analysis 侧数据表一律用它做键。
- **紧凑形宫名**：iztro 原始短名（无「宫」字），只作归一中间量，经 `IZTRO_TO_PROJECT_PALACE` 映射为展开形，未命中抛错不回退。
- **交友宫口径**：第 8 宫项目用词是**交友宫**（承自《天纪》体系），**不是** iztro 旧口径的「仆役」。
- **命宫 / 身宫**：`soulBranch` / `bodyBranch`，地支索引 0–11。
- **命主 / 身主**：`mingZhu` / `shenZhu`，iztro 按命 / 身宫地支查表定星。
- **空宫与借宫**：本宫无主星（`isEmpty`）时借对宫主星论，结构化字段 `borrowedFromBranch` / `borrowedFromName` / `borrowedStars`——文案层不得从自然语言反查借宫信息。
- **三方四正**：本宫、三合两宫（地支 +4 / +8）与对宫，共四宫。对宫偏移的全仓单点在 `palace-relations.ts`。
- **会照**：带四化的星落在所论宫位的三方四正里。口径按 `mutagen` 真值取、不按星型过滤——文昌文曲左辅右弼在特定年干下带四化，与主星同等计入（`analysis/palace-query.ts` 的 `mutagenInPalaces`）。
- **五行局**：`fiveElementsClass`（2–6 数字）+ `fiveElementsClassName`（iztro 原文如「水二局」）。局数由局名首字五行查表解析，可能不一致，**展示以原文名为准**。
- **`chart.palaces` 数组序**：按 iztro 原生序，`branch` 序列为 `2,3,…,11,0,1`（寅起）——**按 `branch` 建索引**，不要依赖数组下标。

### 运限

- **虚岁**：本仓一切年龄的域，以农历年正月初一为界（`currentAge` 与 `decadals[].startAge` 同域）。不得换算成周岁。
- **起运**：`currentDecadalIndex === -1` 表示尚未起运，属正常状态，不得硬套大限。
- **大限**：十年一限，`decadals` 按起始虚岁升序；当前限以 `isCurrentDecadal` 标注。大限四化走 `getDaXianMutagen` 纯函数层，`Decadal` 结构不带字段。
- **小限**：每年一宫的流年辅参，`ages` 为各宫所辖虚岁表（iztro 原样提取）。
- **流年 / 流月 / 流日 / 流时**：逐年 / 月 / 日 / 时的运限层，各有对应四化函数。
- **子年斗君**：`douJunBranch`，流月定位的基准（流年正月自斗君宫起）。iztro 静态盘不带，由 `algorithm.ts` 按口诀自推（闰月按所闰月数计、晚子时按子时论）。

### 排盘输入口径

- **晚子时**：23:00–23:59 出生。子正换日与早晚子两种口径排出**两张不同的盘**；`--late-zi` 切换，`astrology` 自动输出两盘差异对照。
- **真太阳时**：默认只做经度校正 `(经度−120)×4` 分钟；`--eot` 才计入均时差（±16 分钟，足以改变时辰判定）。校正跨午夜时日期跟着走（`calcTrueSolar` 返回 `dayOffset`，调用点用 `shiftDate` 调整）。

### 知识内容

- **格局（pattern）**：`patterns/` 按`主星组合 + 四化 + 煞曜`判定的成格条件，`--pattern` 输出。
- **主题论断（topic）**：`analysis/` 的主题数据库（十二宫 × 主题的断语），`--topic` 输出；主题键集 `TOPIC_KEYS`。
- **合盘（synastry）**：两盘关系分析。**合盘不排盘**——消费 `astrology --json` 的产物，`synastry/chart-view.ts` 只声明它真读到的字段子集（消费方契约）。
- **三部古籍**：`corpus/data/` 下的 quanshu（《紫微斗数全书》，明·罗洪先）/ quanji（《紫微斗数全集》）/ gusuifu（《骨髓赋》）。
- **天纪判语**：`corpus/data/tianji.ts`，由 `nihai-tianji-corpus` 导入的生成快照，**勿手改**（重导 `npx tsx tools/corpus/import-tianji.ts`；条数以快照自报 `importedCount` 为准）。检索入口 `knowledge --source tianji`，懒加载。
- **引文核对表（annotations）**：`corpus/data/annotations.ts`，引文防回流禁语清单，引文守卫的比对基准。
- **知识分级（grades）**：`analysis/grades.ts` 登记每条倪师引句的档位；新引文不登记，`npm test` 引文守卫变红。**占位或自撰内容绝不可挂倪师引语**（属伪造引文）。

---

## 二、仓库工程

### 引导与加载

- **skill 根 = 仓库根**：本仓单 skill 形态，根 `SKILL.md` + `scripts/` + `references/` 即 skill 本体，整体可拷进宿主 skills 目录使用。
- **内核根**：`scripts/`。排盘内核、CLI 与语料同处一层。
- **引导层**：`scripts/purple-star.ts`（入口）+ `boot-hooks.ts`（机制）。职责：定位内核根 → 注册 TS 钩子 → 启动自检 → 分发命令。
- **解析钩子**：`module.registerHooks`（Node ≥ 22.18）实现的模块解析。`@/xxx` 解析到内核根下；`@/` 与 `.` 相对说明符走**同一条候选序**（先补 `.ts`、再兜底 `/index.ts`），候选序分叉的症状是 typecheck 全绿而运行时崩。
- **类型走静态、值走动态**：CLI 自举手法——`import type` 运行时被擦除可写在顶部，内核模块一律 `await load<T>("@/...")` 动态导入（钩子注册先于求值）。
- **`LOADED` 启动自检**：主流程模块的全量导出非空扫描，缺任何一个直接退出——宁可启动失败，也不静默产出错盘。
- **轻路径**：help 与未知命令路径不得触发 iztro 加载（`command-meta` 禁 import 命令实现）；重语料（tianji）只能在 `search` 体内 `await import` 懒加载。
- **`pickRoot` / `ZIWEI_ROOT`**：内核根两级定位——环境变量优先，回落脚本自身目录。CLI 与 `test/lib/loader.ts` 共用机制、各自策略。

### 参数面

- **声明表（`OPTION_GROUPS`）**：`cli/args/table.ts`，「有哪些参数」的唯一来源。解析器、help 参数段、别名表、selftest 参数契约都从它派生。
- **camelCase 键名**：`--late-zi` → `lateZi`，换算只在 `camelKey()` 一处；声明表里 `name` 一律写 kebab。
- **拼音别名（`OPTION_ALIASES`）**：`--geju→--pattern` 等，解析时归一到英文主名。
- **归属投影（`ownedOptions(cmd)`）**：每个参数标 `cmds` / `global`，help 据此裁剪展示——**只过滤视图，不做硬校验**，参数作用域仍是 skill 级。
- **差量化（`excluded`）**：作用域清单写法——空表即默认全集，显式声明才排除；`OPTION_NAMES` 由解析器按排除项派生。
- **贪婪取值**：`--limit -3` 的 `-3` 是值不是旗标（`util.parseArgs` tokens 底座 + 薄适配层；Node 版本敏感，selftest 钉死）。
- **专题菜单（`DEEP_DIVE_MENU`）**：指路行与 help DESCRIPTION 旗标列举段的展示元数据（短标签 / 取值提示 / 长段），两处消费由它拼装——`deep: true` 声明「判定链跟上」，菜单声明「用户看到什么」；selftest 双向对拍钉「deep 旗标 ⊆ 菜单 ⊆ 声明表」。
- **无默认值原则**：未给出的参数键根本不出现，调用方靠 `undefined` 判空取默认；判定链输入（性别、日期等）缺了就报错，绝不静默取默认。

### 质量闸门

- **三件套**：`typecheck`（只看类型自洽，不用 `any` 绕错）/ `selftest`（代码逻辑自洽）/ `npm test`（外部基准比对）——互不替代；另有 `lint` / `format` 两条风格闸门（只扫 `scripts/ tools/ test/`）。
- **selftest 三段合一**：排盘 / 古籍 / 合盘三段在同一条 selftest，报告分段、首行合计；古籍与合盘断言组住各自 `*/selftest-asserts.ts`。
- **七层回归**：`npm test` 的分层（层 1 排盘对标 → 层 7 引文守卫），层表登记在 `test/lib/run.ts` 的 `LAYERS` 与 `test/README.md`，双向对账。
- **基准回归**：db/dataset 全量样本（674,976 条 / 1950–2026，字节指纹登记在 `db/dataset/MANIFEST.json`，日常回归按其对账）；日常抽 385 条，全量 `test:corpus`（条数自报）。
- **冻结内核契约**：`test/kernel-contract.test.ts` 钉住内核对外形状——改内核导出即破坏契约，须显式说明并同步该测试，不得顺手改断言迁就实现。
- **引文守卫**：扫描 `.ts` 与 `.md`，凡「倪师 / 倪海厦 + 引号句」形态必须在 `grades.ts` 有档位登记，比对基准是 annotations。引文比对核心住 `corpus/citation-core.ts`（各扫描面同引一份）。
- **键域漂移**：数据表键与运行时键不一致导致的静默 miss，由 `test/invariants.test.ts` 拦截；消费点不得用 `?? ""` 掩盖 miss。
- **反恒真守卫**：跳过类断言必须证明自己真的跑过——与「跑过了」不可区分的恒真守卫比没有更坏。
- **`skipUnlessRepo` / ⏭ 可见跳过**：依赖仓库级文档（不入分发件）的断言在包形态下显式跳过，报告上必须标 `⏭`。
- **注释指针有效性（MD_POINTER）**：`scripts/ test/ tools/` 注释里引用的 `.md` 路径必须真实存在（带理由白名单）——改名不断锚。
- **缓存纪律**：改内核输出结构或升级 iztro 必须递增 `CACHE_VERSION`；回归链路**显式禁缓存**——selftest / 测试进程经缓存模块的旁路 API（`setCacheBypassAll`）直排，子进程排盘探针 argv 携带 `--no-cache`，外壳残留的退役变量在回归入口当场报错（环境变量注入通道已删除）。缓存只求快不参与正确性——故障表现是「慢」，不是「错」。
- **生成文件与重导**：`data/wenmo-tables.ts`、`corpus/data/tianji.ts`、cli-samples 产物不手改，改生成器再重导；「重构不改行为」验收 = 与基线逐字节 diff=0。

### 内容扩展

- **注册表纪律**：插件一律清单注册（`registry.ts` 显式 import），不用文件系统自动发现；新增实现 = 一个文件 + 一行注册（接缝判据）。
- **分层红线**：排盘内核（`algorithm.ts` / `mutagen.ts` / `patterns/` / `data/` / `wenmo-brightness.ts`）与知识内容（`analysis/` / `corpus/` / `synastry/`）严格分层；插件层禁反向依赖 `cli/`、禁改内核模块状态；新增知识内容不触内核与 CLI 分发。
- **deletion test**：删掉一个抽象是让复杂度集中还是只是搬家？搬家不算重构成果；每个新抽象要答得出「删掉它会多写几行」。

---

## 三、多根工作区

- **六仓 / 产品仓**：宿主「紫微斗数」工作区共六仓，本仓是唯一产品仓，其余五仓供给数据与知识。
- **知识链**：`purplestar-voice`（课程视频转写）→ `nihai-tianji-corpus`（外部语料仓，判语结构化）→ 本仓 `corpus/`（导入快照 + 检索）。
- **基准数据链**：`ziwei-doushu`（上游参照引擎）→ `ziwei-samples-toolkit`（样本导出，现为 674,976 条 / 1950–2026，`npm test` 基准源头）→ `purplestar-db-slim`（DuckDB 工具仓）。
- **许可双轨**：引入的数据集走 CC BY 4.0，语料走 CC BY-NC-SA 4.0——本仓代码许可与语料许可分开声明的根源；新引内容先对号入座。
- **记忆分库**：三个记忆后端以 `-purplestar` 前缀隔离（`qdrant-purplestar` / `memory-purplestar` / longmemory 的 `user_id: "purplestar"`）；本仓会话禁用用户级全局 qdrant / memory。
- **OpenSpec**：规范驱动工作流，`openspec/specs/` 是各能力域当前规范、`changes/` 是进行中变更；触及规范面的改动先提案（propose）再实现（apply），归档（archive）折回 specs。项目约束的指针指向 AGENTS.md，不复制。
