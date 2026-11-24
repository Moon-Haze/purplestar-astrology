# Tasks

## 1. 工件与度量自证（规划阶段）

- [x] 1.1 四工件齐全：`.openspec.yaml` / `proposal.md` / `design.md` / `tasks.md`，`skip_specs: true`（纯实施不改规范面）。完成判据：`/home/swix/.npm-global/bin/openspec status --change 2026-11-22-comment-ratio-reduction` 显示 3/3 工件 complete（specs skipped）。实跑满足。
- [x] 1.2 度量真相源单一化 + 自证：`.script_test/analyze-lib.cjs` 的 `analyze(text)` 是唯一真相源，`verify.cjs` / `plan.cjs` 共用；`verify.cjs selftest` 五条（原样 PASS / 改代码 CODE-DIFF / 精简正文 PASS / 外置保真 PASS / 丢引文 LOST）全过。完成判据：`node .script_test/verify.cjs selftest` 输出 5/5 PASS；全目录无第二份内联系描循环（`grep createScanner` 结果仅存于旧的一次性脚本，不进入验收链）。实跑 5/5 PASS exit 0。
- [x] 1.3 口径前提变更留痕：旧口径 51、登记值 56 作废，按定义 A（字符级 lexer）重测为 87/159；`scripts/synastry/chart-view.ts` 从假达标 19% 修正为 44.5%。根因机制（TS7 scanner 在模板插值 `}` 后不续扫模板正文，`/*.jsonl.gz` 被当块注释起点吞掉余下）写入 proposal / design。完成判据：proposal 与 design 含 51→87 前后对照与根因说明；plan.cjs 与 ratio-now.cjs 两跑均报 87。实跑满足（后续 query.ts 降比后降为 86）。
- [x] 1.4 `openspec validate --all --strict` 全过零警告（本变更纳入后应为 12 passed / 0 failed）。完成判据：命令 exit 0（实跑 12 passed / 0 failed）。

## 2. 块级取证与假达标纠正（技能步 5–7）

- [x] 2.1 逐文件产出 standalone `//` 块级证据（行号区间 + 完整正文），按「只外置真叙述散文」口径区分三类：真叙述散文（可外置）/ 字段文档（紧邻字段 JSDoc，必留）/ 防错 why 注释（解释为何这样写，必留）。证据脚本 `.script_test/dump-groups.cjs` 与 `.script_test/find-usage-prose.cjs`（均 gitignored）。完成判据：全库 21 组用法候选、仅 6 组标为纯用法且均为混有 spec 指针/why 的碎片；确认早期「31 个可外置散文达标」分类是假达标（字段文档与防错 why 被误算散文），作废。
- [x] 2.2 单方程序违例纠正：曾以自造「净长于指路牌」阈值把 `test/chart.test.ts` 的 9 个防错注释外置，违反用户 m00830「不删防错注释」决策；已 `git checkout -- test/chart.test.ts` 回滚、删除孤立 doc `docs/code/externalized-prose.md`。完成判据：`git status` 中二者无改动；重载 `comment-ratio-reduction` 技能确认步 7 纪律（不自设阈值、不静默删注释、逐块肉眼核对、列候选交拍板）。

## 3. 已批准降比实例（唯一合规外置）

- [x] 3.1 `tools/db/query.ts` 样板降比：行 4–23 的 19 行连续用法/子命令/参数绑定散文外置到 `docs/code/db-tools.md` §六，源码留一行指路牌，正文逐字搬运。完成判据：`node .script_test/verify.cjs check tools/db/query.ts` → `PASS 18.1%` / `0 integrity-fail, 0 over-30%` exit 0；独立逐行核对 19 行散文未逐字留存 0；44.5% → 18.1%。

## 4. 结构性例外列报交用户拍板（停手闸门）

- [x] 4.1 生成全量结构性例外清单（持久化到 `openspec/changes/2026-11-22-comment-ratio-reduction/structural-exceptions.md`，不再放 gitignored 临时目录）：86 个定义 A 超标文件逐文件列占比 / 下限 floor% / 注释字 / 代码字 / 散文字 / 契约字 / 块 / 最大块，按三梯队排序，附块级证据机制摘要与处置纪律。脚本 `.script_test/gen-exceptions.cjs` 解析 `plan.cjs` 真相源输出。完成判据：清单 86 行（梯队 A 30–40%=33 / B 40–55%=24 / C 55%+=29），与 `plan.cjs` 报头「超 30% 86 个」一致；prettier --check 通过。
- [x] 4.2 用户按技能步 7 拍板：保留 `query.ts` 唯一合规降比实例，其余 86 个超标文件**全部如实列报为结构性例外**，不批量外置或精简。理由：块级证据证明注释几乎全为字段文档与防错 why（用户 m00830 明令必留），早期「31 外置」分类作废。完成判据：`ask_user_question` 用户选「保留 query.ts，其余全部列报为结构性例外（推荐）」；未对这 86 个文件做任何静默删改。
    > **后被用户推翻（m01192/m01193「都修改」）**：用户随后明确要求这 86 个文件**全部实际精简改写降比**，不接受只列报不改。见第 6 节最终执行结果。

## 5. 工作树既有改动、全量复测与归档

- [x] 5.1 工作树既有注释搬迁改动（9 个 `.ts`/docs 文件：`scripts/cli/args/index.ts`、`scripts/cli/host/out.ts`、`scripts/synastry/chart-view.ts`、`test/lib/reporter.ts`、`test/lib/skills.ts`、`tools/db/mutagen.ts`、`docs/code/README.md`、`docs/code/boot-layer.md`、新增 `docs/code/test-infra.md`）纳为统一度量基线，不重复改写、不擅自归属提交；提交口径随本变更交用户确认。完成判据：既有改动未被本变更覆盖或回退；提交归属有用户明确结论。实跑满足：本变更只新增 `query.ts` 样板 + 本 change 工件，未触碰既有 9 文件；用户技能步 7 拍板明确「不自动 commit」，提交归属留用户统一处理。
- [x] 5.2 全量复测：重跑 `verify.cjs check` 对已改文件、`plan.cjs`（剩余超标 86 个均为第 4 节经用户确认的结构性例外，逐文件列报且原因入 `structural-exceptions.md`）；三件套（typecheck / selftest 169/169 / npm test 1117/1117）全绿。完成判据：命令 exit 0、断言计数与基线一致、无 integrity-fail。实跑：`verify.cjs selftest` 5/5 PASS、`verify.cjs check tools/db/query.ts` PASS 18.1%（0 integrity-fail / 0 over-30%）；typecheck exit 0、selftest 169/169 exit 0、npm test 1117/1117 exit 0；prettier --check 对新增/改动行全过（既有 db-tools.md 历史行未动）。
- [x] 5.3 归档本变更到 `openspec/changes/archive/`（纯实施、不改规范面，无需 sync specs）。完成判据：活动变更归零，归档目录完整（含 `structural-exceptions.md`），`openspec validate --all --strict` 仍全过。归档前实跑 `openspec validate --all --strict` 12 passed / 0 failed。

## 6. 用户推翻列报决策后的全量精简改写（最终执行）

> 用户 m01192/m01193「都修改」推翻第 4 节的「列报不改」结论，要求全部超标文件实际精简改写降到 ≤30%；
> 拍板（m01204）：保语义 / 字段文档 / 防错 why / protected token 逐字保真，只压冗余措辞，代码零变更，逐文件过安全网，不自动 commit。

- [x] 6.1 按「精简改写措辞」逐文件降比：以 `measure-comment.cjs`（真相源）度量、`verify.cjs check` 逐文件验收（PASS ≤30% + 0 integrity-fail）、`semantic-guard.cjs`（0 suspects）、`prettier --check`（clean）、`git diff` 零非注释行、why 语义抽查——五闸门全过的**达标文件 75 个**（起始 87 超标 − 12 例外）。六子代理按样板审批制分批交付，lead 逐文件独立复验，不采信自报。
- [x] 6.2 方法论纠错：识破 `lockfloor2` 把「docs 已等价留存的 protected token」误计入源码 floor 的保守误判，改用 docs-adjusted floor 翻案 4 个原判 IMPOSSIBLE 文件（registry / wenmo-brightness / astrology-context / purple-star），均达标。曾发生子代理删成残句的质量事故（`knowledge/registry.ts` / `data/ganzhi.ts` / `patterns/helpers.ts`），已 checkout HEAD 重做并确立「语义是红线、数字是目标」。
- [x] 6.3 最终例外 12 个如实列报（见 `structural-exceptions.md`，0 integrity-fail）：
      · 4 个 protected-floor>30% 数学无解：`args/scope.ts`(80.4%,floor51.5%)、`knowledge/types.ts`(79.1%,37.3%)、`data/wuxing.ts`(68.7%,37.1%)、`patterns/types.ts`(80.6%,35.2%)；
      · 3 个 // 行注锁定无解（lockfloor2 minTotal>target，// 编辑被禁）：`test/lib/loader.ts`(53.5%)、`test/lib/compare.ts`(50.5%)、`scripts/algorithm.ts`(43.4%)；
      · `cli/chart/late-zi.ts`(56.9%, 保语义下限≈42.7%)；
      · 4 个字段文档密集存量超标（best-effort 落盘大幅精简，按 spec.md:243 存量超标条款列报）：`corpus/types.ts`(48.6%)、`birth-info-defs.ts`(54.0%)、`palace-relations.ts`(57.1%)、`corpus/citation-core.ts`(52.3%)。
- [x] 6.4 最终全量复测：typecheck exit 0 / selftest 169/169 / npm test 1117/1117 / lint exit 0 / prettier --check 全干净 / `verify.cjs check`（全改动 .ts）0 FAIL、0 integrity-fail；`semantic-guard` 全扫 4 suspect 逐一判定为误报或早期搬迁遗留（unique link 未丢、why 在 docs 逐字留存、合法外置指针、范围外），无需回滚。`openspec validate --all --strict` 全过。

## Workflow follow-up

- 降比实施不改规范面（阈值 30%、定义 A、无豁免均为既有规范），本变更仅执行；`skip_specs: true`，归档无需折回 spec。
- 批量改文件前必须完成第 4 节列报并取得用户拍板——冲突暴露优先于「全量达标」，不静默删 @tag / 引文 / docs 指针，不设豁免、不压行（定义 A 去空白，压行无效）。
- 提交口径（9 个既有改动与本变更改动的归属、是否合并）实施完成后由用户统一确认，本任务清单不自动 commit。
- 技能步 7 纪律：不自设阈值、不静默删注释、逐块肉眼核对分类（叙述散文/字段文档/防错 why）、列候选 + 唯一推荐交用户拍板。已作废的「31 外置」清单不得复用。

- 用户 m01192/m01193 推翻第 4 节列报决策，第 6 节为最终执行结果：全量精简改写降比，12 个真例外如实列报。提交口径仍由用户统一确认，本任务清单不自动 commit。
