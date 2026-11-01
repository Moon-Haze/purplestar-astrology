# 报告形态的取材收进 overview-material 单点

## Why

`scripts/analysis/overview-material.ts` 自称「总览取材单点」，把两个编排器（`views/overview.ts`
的【】版式与 `report.ts` 的 ### 版式）此前各写一遍的取材规则收成一份纯函数。但**单点只覆盖了
一半**：「本宫主星」这一行在仓库里仍有三种手写形态，其中一份绕过了单点：

| 形态                                | 位置                          | 借宫时的文案                     |
| ----------------------------------- | ----------------------------- | -------------------------------- |
| `--topic`（消费 `m.loanNote`）      | `views/overview.ts:81`        | `（财帛宫空宫，借对宫太阳论事）` |
| `--report` 命盘推演（**内联重写**） | `report.ts:272-276`           | `（财帛宫空宫，借对宫论事）`     |
| `--report` 板块标题（第三形态）     | `report.ts:201` 的 `loanTag`  | `借对宫`                         |

这不是理论风险，是**已发生的漂移**。同一张盘（`--date 2005-05-05 --time 09:30 --city 北京
--gender male`）实测：

- `--topic wealth` → `本宫主星：（财帛宫空宫，借对宫太阳论事）太阳（落陷）、太阴化忌（庙旺）`
- `--report` → `本宫主星：（财帛宫空宫，借对宫论事）太阳（落陷）、太阴化忌（庙旺）`

同一行论断在两种输出形态下**逐字不同**（报告侧丢了借来的星名），而 `npm test` 与 `selftest`
全绿：`test/report.test.ts:120` 只断言标题带「（`命宫` · 借对宫」，**没有任何断言比对两种形态
的同一行**。

用架构词汇说：这是 locality 的破口（一条口径三处手写）加上测试面的缺口（接缝存在但一半
消费者绕过它，接口因此不是测试面）。它同时踩到 `analysis-structured` spec「一源双投影」
的边——报告形态的这行文本不是条目的投影，是第二份实现。

## What Changes

1. `OverviewMaterial` 增两个字段，成为「本宫主星行」与「借宫徽标」的唯一产出点：
   - `mainStarLine`：`本宫主星：` + 借宫注 + 主星徽标 + （`overview` 主题的五行局尾）。
     **两个返回分支都要给值**（含主宫无主星的兜底分支，保持该分支现有逐字形态）。
   - `loanTag`：借宫为「借对宫」，否则空串 —— 供 `--report` 板块标题用。
2. 三个消费点全部改经这两个字段：`views/overview.ts:79-85`、`report.ts:272-276`、
   `report.ts:201`。`report.ts` 不再出现「借对宫」字面量与「本宫主星：」拼式。
3. `test/report.test.ts`（层 2）新增**两形态对拍断言**：同盘同主题下 `--topic` 的「本宫主星：」
   行与 `--report`「命盘推演」节同一行逐字相同，覆盖借宫盘与非借宫盘各一张。

预期输出变化：`--topic` 全主题输出**逐字节不变**；`--report` 仅借宫板块的「本宫主星」行补回
星名（固定样本盘 = 2 行：财富运势、感情婚姻）。这是本次唯一有意的行为变更，逐条可溯。

## Capabilities

### Modified

- `analysis-structured`：报告形态（`getTopicReport`）的「本宫主星」行 SHALL 与单主题形态同源，
  取 material 单点的字段；两种形态的同一行 SHALL 由断言对拍。原「与重构前逐字节一致」条款
  为本次显式登记的口径修复让出例外。

## Impact

- 改动文件：`scripts/analysis/overview-material.ts`、`scripts/analysis/views/overview.ts`、
  `scripts/analysis/report.ts`、`test/report.test.ts`（+ 可能一处 `docs/code/analysis.md` 口径描述）。
- **不触碰冻结面**（`types.ts` / `algorithm.ts` / `mutagen.ts` / `wenmo-brightness.ts` /
  `palace-relations.ts` / `corpus/data/annotations.ts`），不改 `analysis/data.ts` 数据表（只引用）。
- **不涉数据链**：已核实 `tools/` 侧零消费 `renderOverviewItems` 与 `main-palace` 槽，
  生成物（`scripts/corpus/data/manual/**`、`docs/manual/**`）不受影响，无需 `manual:check`。
- 测试项数：层 2 报告套件 +1（新增对拍断言），层 1 与内核层项数**必须与基线一致**
  （内核层项数是越界报警器，本次为内容层改动，不得使其变动）。
- 验证档位：**内容 / 渲染层改动且改动 `--report` 文本输出** → 声明 `npm run typecheck` +
  `node scripts/purple-star.ts selftest` + `ZIWEI_NO_CACHE=1 npm test` 三件套；不改内核、
  不升 `iztro`、不涉生成物，故不加 `npm run test:corpus` 与 `manual:check`。

## 不做什么

- **不合并两个编排器**：`getTopicAnalysis`（10 个 view，含年干四化 / 流年 / 流月）与
  `getTopicReport`（5 个 view + 命盘依据 / 经典出处 / 定调）小节集实质不同，强合并会把差异
  塞进条件分支，反而变浅，且会改动报告版式 —— 超出「先堵住已证实的漂移」的范围。
- **不动结构化条目平面**（`items.ts` / `views/*Items`）：`analysis-structured` spec 已把它定为
  唯一产出形态，零外部消费者是断语手册下线的后果，属规范层议题，不在本 change 内。
- **不动其它「借对宫」文案面**：`cli/chart/render.ts:197`（盘面渲染）、`views/surround.ts:148`
  （三方四正联动）、`synastry.ts` 三处的借宫句是各自语境的另一套文案，不在本次接缝内。
- 不改 `--report` 的小节序、Markdown 版式、去重与引文逻辑；不新增参数；不动 `references/`。

## 被否决的备选方案

| 备选                                                        | 否决理由                                                                                                                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. 就地修 `report.ts` 的内联文案**（把星名补上，不动接口） | 修的是副本不是接缝：口径仍在两处，下次漂移依旧无红灯。deletion test 不过 —— 删掉内联副本后复杂度消失，说明它本就不该存在。                                                  |
| **B. 两编排器合一，形态作参数**                             | 两形态小节集实质不同（报告有命盘依据 / 经典出处 / 定调，单主题有流年 / 流月 / 年干四化），合一会把差异塞进条件分支，模块变浅；且必然改动报告版式，风险远超本次要解决的问题。 |
| **C. 只在 selftest 里加对拍断言，不改生产代码**             | 断言会立刻变红并把「两形态不一致」固化成已知状态 —— 守的是症状不是病因；且 selftest 项数自报会因一条恒红断言失去信号价值。                                                  |
| **D. 顺手删除 `views/*Items` 结构化平面（零外部消费者）**   | 与 `analysis-structured` spec 的「一源双投影」直接冲突（该 spec 刚把它定为唯一产出形态）。删它是规范回退，不是深化；若要动，须先重开规范。                                   |
| **E. 优先做 `tools/` 入口协议单点（9 份手抄 + 15 处路径判据）** | 真实且安全相关，但属开发工具面（不进分发件），验证链依赖本机 `db/` 数据集与 DuckDB，无人值守下「跑过」与「跳过」难分辨。另开 change，留待有人工在场时做。                     |
