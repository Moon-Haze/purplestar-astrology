# Proposal: 主场登记唯一化——装配层预扫描成为「哪些全文是主场」的唯一实现

## Why

「论断全文首现 / 主场登记」（spec report-assembly「论断全文首现原则」「双主星主场展开」）这
一个概念，写策略散在 4 个文件、3 种语义。全仓登记点穷举（`grep -rn "dedupe" scripts/`，登记
`set` 恰 5 处，逐处亲读）：

| 登记点                       | 位置                              | 语义                                       |
| ---------------------------- | --------------------------------- | ------------------------------------------ |
| 装配层预扫描                 | `cli/commands/report.ts:186-188`  | 守卫式 first-wins（`if (!dedupe.has)`）    |
| **内联兜底 ×2**              | `analysis/report.ts:247`、`:259`  | **无条件覆写**（注释 `:244-246` 自称「幂等重写」） |
| 三方联动渲染期               | `views/surround.ts:127`           | 渲染序 first-wins（他星全文，另一协议）    |
| 四化注渲染期                 | `views/mutagen.ts:48`             | 渲染序 first-wins（四化注首现原则）        |

问题三层，均已逐行 + 穷举证实：

1. **「本板块核心论断哪些全文要登记主场」双份实现**。预扫描清单 `[m.content,
   m.secondStarContent]`（`report.ts:145`）与内联两处 set 选中的恰是同两个字段（`:247` /
   `:259`）——同步只靠注释，无任何对拍测试（test 树 `grep dedupe` 零命中）。
2. **兜底零实例 + 语义分叉**。内联 set 声称服务「未预扫描的调用方」（`:245-246`），但全仓唯一
   传 `dedupe` 的调用方（`cli/commands/report.ts:196`）必先预扫描；两个测试调用方
   （`test/topic-suggestions.test.ts:79`、`test/astrology-sections.test.ts:263`）不传
   `dedupe`——兜底形态零实例。且预扫描 first-wins 与内联覆写语义相反：两板块产出逐字相同全文
   时，内联会把预扫描登记的主场翻转为后到板块，静默改指引目标。
3. **无人声明的等价前提**。预扫描走 `makeContext(chart, topic, {})`（`report.ts:140`）而渲染走
   `makeContext(chart, topic, options)`（`:191`），两者等价依赖「核心论断全文与
   AnalysisOptions 四字段无关」（`data.ts:2844-2852`；`overview-material.ts:85` 的解构面证实
   今天结构上成立，但无守卫）——一旦内容随视角变化，登记以板块序相关的部分失效方式劣化，
   无红灯。

deletion test：删掉内联两处 set，「谁在何时登记主场」从 4 文件 3 语义收敛为预扫描单一权威——
复杂度集中而非搬家（views 两处是「渲染时发现他星全文」的另一协议，保留不动）。

## What Changes

1. `scripts/analysis/report.ts`：删除 `getTopicReport` 内两处内联登记（`:244-247` 注释 + set、
   `:256-259` 注释 + set）；`verdictLines.push` 两行保留。`getTopicMainContentTexts` 的 JSDoc
   升格为「主场登记唯一权威」声明；`ReportOptions.dedupe` 的 JSDoc 已声明预扫描口径，保持。
2. 渲染期两处登记**不动**（`views/surround.ts:127`、`views/mutagen.ts:48`）——它们语义不同：
   前者登记预扫描无法预知的「渲染时才发现的他星全文」，后者是 spec「四化注首现原则」的载体。
3. `test/astrology-sections.test.ts` 层 2（既有 describe「全盘报告装配：大限节唯一与全文首现」
   内 +1 it）新增对拍断言，钉住三件事：预扫描清单 = 渲染侧取材展开集（含非缺省
   AnalysisOptions 注入，钉住等价前提）；渲染路径不登记本板块主星全文（登记点唯一性的机制
   守卫）；装配后每条预扫描全文恰落语义主场板块一次（0 落空）。
4. （独立小项，独立 commit）同文件死 import 清除：`report.ts:23` 的 `starBadge`（grep 全文件仅
   import 行 1 处命中；`views/surround.ts:22` 的同名使用不受影响）。
5. spec `report-assembly` 新增 requirement「主场登记单一权威」（ADDED，见 specs delta）。

**预期输出变化：零。** `--report` 与 `--topic` 全主题输出与改动前基线逐字节一致（纯重构档）。

## Capabilities

### New Capabilities

（无——不引入新能力域。）

### Modified Capabilities

- `report-assembly`：新增 requirement「主场登记单一权威」——装配层预扫描 SHALL 是「本板块哪些
  论断全文登记主场」的唯一实现，渲染层 SHALL NOT 对本板块主星全文另行登记；预扫描与渲染取材
  的等价前提 SHALL 由对拍断言守卫。既有 requirement 全部不变（外部输出逐字节不变，本条不改
  任何既有 scenario 的期望值）。

## Impact

- 改动文件：`scripts/analysis/report.ts`（删 2 处 set + 注释 + 1 个死 import）、
  `test/astrology-sections.test.ts`（+1 it）；`openspec/specs/report-assembly/` 经本 delta 归档
  时增 1 条 requirement。
- **不触碰冻结面**：`analysis/index.ts` 导出面不变（`getTopicReport` /
  `getTopicMainContentTexts` / `ReportOptions.dedupe` / `getTopicReportMeta` / `getDecadalSection`
  全保留）；`types.ts` / `algorithm.ts` / `mutagen.ts` / `wenmo-brightness.ts` /
  `palace-relations.ts` / `corpus/data/annotations.ts` 零改动 → `kernel-contract`（层 3）零变动。
- 测试项数：层 2 +1（`astrology-sections.test.ts` 既有 describe 内加 it，无新文件 → 不触
  `test/README.md` 层表与 `run.ts` LAYERS 登记）；层 1 / 层 3 项数与基线一致（内核层越界报警器
  不动）。
- 验证档位：**纯重构（行为不变）**——先取 `--report` / `--topic` 输出基线，改后逐字节 diff=0；
  另跑 `npm run typecheck` + `node scripts/purple-star.ts selftest` + `ZIWEI_NO_CACHE=1 npm test`
  三件套。不升 `iztro`、不改排盘内核输出结构 → 无需 `test:corpus`、无需递增 `CACHE_VERSION`；
  不涉生成物 → 无需 `manual:check`。
- 文档：`docs/code/analysis.md` 无需必改——其口径句「第二主星……在本板块核心论断首现并登记
  主场」在概念层仍真（登记动作改由预扫描承担，首现位置不变），仅任务里留一条人工复核项。

## 不做什么

- **不动 `views/surround.ts:127` 与 `views/mutagen.ts:48` 的渲染期登记**：前者登记的是预扫描
  无法预知的他星全文（渲染序首现），后者是四化注首现原则的载体——删它们会让三方联动失去登记
  能力，全场首现原则退化。
- **不改 `dedupe` 表键值契约**（键 = 论断全文、值 = 板块名）、不动 `ReportOptions.dedupe` /
  `omitDecadal`、不改 `getTopicReport` 与 `getTopicMainContentTexts` 签名与导出面（冻结契约）。
- **不动 `cli/commands/report.ts` 的预扫描实现**（唯一权威就地保留）；不改预扫描清单内容
  （`[m.content, m.secondStarContent]`）。
- **不动 SKILL.md / `references/`**：无 CLI 参数与输出契约变化，三级渐进披露面不受影响。
- **不把 `dedupe` 改为必传**：spec「单主题输出逐字节不变」以 dedupe 缺省为前提，且会牵动两个
  测试调用方，超出「删跨文件冗余」的最小面。

## 被否决的备选方案

| 备选                                                        | 否决理由                                                                                                                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. 内联 set 改守卫式 first-wins，保留兜底**               | 消掉语义分叉但双份实现仍在、同步仍靠注释；兜底零实例，deletion test 不过——删掉后复杂度消失，说明它本就不该存在。                                                            |
| **B. 渲染内改调预扫描补登记**                               | 方向反了：把「哪些全文是主场」的判定重新塞回渲染时序，板块序相关的失效面不变，还让渲染层反向依赖装配语义。                                                                    |
| **C. 不删代码、只加对拍断言**                               | 断言会把「双份实现恰好同步」钉成现状——等价前提被守卫，但 4 文件 3 语义的结构事实原样保留，绕过预扫描的新消费方仍由兜底静默纠正；本条主张先清存量再谈护栏。                  |
| **D. 顺手把 `dedupe` 必传化（消除 undefined 分支）**        | spec「单主题输出逐字节不变」以 dedupe 缺省为前提；牵动单主题路径与两个测试调用方，超出本条最小面。                                                                            |

## 与 AGENTS.md 约束的关系

无冲突，逐条对齐：删除「静默纠正缺失登记」的兜底与**失败可见性**同向（其覆写语义本身可静默
翻转指引目标）；analysis 知识层改动不触排盘内核与 CLI 分发（**分层红线**）；死 import 的清除
单列任务、独立 commit，不与主删改的对账 diff 混装（**最小 diff**）。唯一摩擦点：死 import
「同 diff 顺带清」与「不夹带」的张力，按后者处理并已在 What Changes 第 4 条显式划界。
