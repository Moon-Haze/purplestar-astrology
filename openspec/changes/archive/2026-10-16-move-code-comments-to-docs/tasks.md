# Tasks

> 全局前提：本 change **无文件物理位置变动**，import 语句、`load<>("@/…")` 字符串字面量、`resolve(ctx.root, …)` 拼路径三类字符串**零涉及**；每个任务的 `git diff` 审阅须覆盖此点（只允许注释行变动与新增 `docs/code/` 文件）。顺序遵循 design D5：chart-kernel 试点 → CLI 五层 → 知识与扩展层 → boot-layer 收尾。

## 1. 基建与试点：chart-kernel（防呆密度最高，先立模式样板）

- [x] 1.1 创建 `docs/code/` 目录与 `README.md`：登记 15 篇导航表、「改模块设计先改文档」维护纪律、倪师引文软纪律（搬入文档的引文与源码同受 `ANNOTATIONS` 核对表约束）；验证：README 的导航表覆盖全部 15 个单元且与后续产出篇名一一对应
- [x] 1.2 写 `docs/code/chart-kernel.md`：原文照搬 `types.ts` / `algorithm.ts` / `palace-relations.ts` / `mutagen.ts` / `wenmo-brightness.ts` 的 B 类模块头论文与 C 类 ⚠️ 防呆（须含：冻结内核契约、绊线字段、独立预言机刻意不收敛、口径锁论证四节）；验证：对照源文件逐条清点，文档收录数 ≥ 源文件搬走的 B/C 条数（知识零丢失）
- [x] 1.3 瘦身上述 5 个源文件：删搬走的 B/C 长文，保留 A 类 TSDoc 与 D 类口径锁，按 design D2 形态留指路牌（一行摘要 + ⚠️ 结论 + `docs/code/chart-kernel.md`）；验证：`git diff -- scripts/` 无可执行代码变动，且每个被搬空的导出符号处残留注释含 `docs/code/` 字样
- [x] 1.4 试点批闸门：`node scripts/purple-star.ts selftest` 全绿 + `npm test` 全绿 + `npm run typecheck` 0 错误

## 2. CLI 层五单元

- [x] 2.1 `cli-args`：写 `docs/code/cli-args.md`（搬 `cli/args/` 全部 .ts 的 B/C：门面定位、parse 四件事与贪婪取值、table 单点声明与归属投影、scope 空表机制），瘦身源码留指路牌；验证：diff 只动注释行 + `selftest` 全绿
- [x] 2.2 `cli-birth`：写 `docs/code/cli-birth.md`（搬 `cli/birth/` 的 B/C：真太阳时口径、晚子时两盘、省名回退、 cities 表唯一来源），瘦身源码留指路牌；验证：diff 只动注释行 + `selftest` 全绿
- [x] 2.3 `cli-chart`（含 `cli/host/`）：写 `docs/code/cli-chart.md`（搬渲染口径、缓存层键设计与版本纪律、分发协议唯一真相源、`--out` 逐字对拍），瘦身源码留指路牌；验证：diff 只动注释行 + `selftest` 全绿
- [x] 2.4 `cli-commands`（含 `cli/fortune/`）：写 `docs/code/cli-commands.md`（搬四命令合一、help man 结构、报告装配层、运限各节口径），瘦身源码留指路牌；验证：diff 只动注释行 + `selftest` 全绿
- [x] 2.5 `cli-selftest`：写 `docs/code/cli-selftest.md`（搬三段汇总结构、kit 共用 harness、断言组机制），瘦身源码留指路牌；验证：diff 只动注释行 + `selftest` 全绿
- [x] 2.6 CLI 层集成闸门：`npm test` 全绿（外部基准，跨全部 CLI 输出）+ `npm run typecheck` 0 错误

## 3. 知识与扩展层七单元

- [x] 3.1 `patterns`：写 `docs/code/patterns.md`（搬 `patterns/` 的 B/C：helpers 底座定位、index 公开面收窄、各分组判定共享前提），瘦身源码留指路牌；验证：diff 只动注释行 + `selftest` 全绿
- [x] 3.2 `analysis`：写 `docs/code/analysis.md`（搬论断库 v3 结构、grades 档位、context/report 分层），瘦身源码留指路牌；验证：diff 只动注释行 + `selftest` 全绿
- [x] 3.3 `data-tables`：写 `docs/code/data-tables.md`（搬干支/五行表的口径与兜底规则），瘦身源码留指路牌；验证：diff 只动注释行 + `selftest` 全绿
- [x] 3.4 `corpus`：写 `docs/code/corpus.md`（搬三部古籍 + 天纪语料 + 引文核对表定位、manual 快照生成关系），瘦身源码留指路牌；验证：diff 只动注释行 + `selftest` 全绿
- [x] 3.5 `knowledge`：写 `docs/code/knowledge.md`（搬 KnowledgeSource 接缝、registry 清单注册、重数据懒加载理由），瘦身源码留指路牌；验证：diff 只动注释行 + `selftest` 全绿
- [x] 3.6 `school`：写 `docs/code/school.md`（搬 SchoolAdapter 接缝、guard 三合派约束、citationRoots 引用而非迁移），瘦身源码留指路牌；验证：diff 只动注释行 + `selftest` 全绿
- [x] 3.7 `synastry`：写 `docs/code/synastry.md`（搬 chart-view 消费方契约、断语库定位、合盘不排盘），瘦身源码留指路牌；验证：diff 只动注释行 + `selftest` 全绿
- [x] 3.8 知识与扩展层集成闸门：`npm test` 全绿 + `npm run typecheck` 0 错误

## 4. boot-layer 收尾

- [x] 4.1 写 `docs/code/boot-layer.md`（搬 `purple-star.ts` / `boot-hooks.ts` 的 B/C：纯机制定位、node: 内置铁律、候选序分叉史、LOADED 自检理念），瘦身两文件留指路牌；验证：diff 只动注释行 + `selftest` 全绿
- [x] 4.2 boot-layer 闸门：`npm test` 全绿 + `npm run typecheck` 0 错误

## 5. 仓库联动与全量收尾

- [x] 5.1 `CLAUDE.md:211` 联动：「先读 `types.ts` 里紧挨着它们的说明」改为指向 `docs/code/chart-kernel.md` 的绊线字段一节；验证：全仓再无「先读 + 代码文件内注释」形态的跨文件指引（grep 复核）
- [x] 5.2 `docs/README.md` 目录表登记 `docs/code/`（手写维护，注明活文档纪律）；验证：表格行与磁盘目录一致
- [x] 5.3 全量收尾：`npm run typecheck` + `npm run lint` + `npm run format` 全绿，`selftest` 与 `npm test` 全绿，`npm run pack` 产物解压后 selftest 全绿（证明包内行为不变）；验证：15 篇文档齐备，`grep -L "docs/code/" $(被搬空文件清单)` 为空（每个搬空的源码文件都有指路牌）

## Workflow follow-up

- 按仓库评审要求过审后，`/opsx:archive` 归档本 change；归档时 `docs/code/` 转为活文档，README 的维护纪律生效。
- 归档后如要硬化引文守卫支持 `.md`（design D4 的将来项），另案提案，不混入本 change。
