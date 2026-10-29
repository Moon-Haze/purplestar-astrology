# Proposal

## Why

「三方四正会照本命四化」这条规则当前有两套星曜口径并存：论断层（`palace-query.ts:65-66` 经
`context.ts:136-142` 投影）取**所有带 `mutagen` 的星**，而大限节（`views/decadal.ts:61`）与流年节
（`views/yearly.ts:54`）只取 `type === "major"` 的主星。二者**不是恒等**——文昌、文曲、左辅、右弼四颗
`soft` 星在丙 / 戊 / 己 / 辛 / 壬五个年干下带四化（`scripts/data/sihua.ts:22-33`，与 iztro 同源），
实测 1989-05-05（己巳年）盘面即出现 `文曲 type=soft 化忌 落疾厄宫`。

结果是同一张盘、同一个「本命四化」概念，在三处给出**不同的会照集合**；且这一差异既无成文口径
（`docs/code/analysis.md` 8.4 / 8.5 / 8.6 只写「本命四化」，未提主星过滤），也无任何断言钉住
（全仓搜「本命四化会照 / 大限三方四正 / 流年三方四正 / 年干四化」，`test/` 与 `selftest/` 零命中）。
改动任一侧都不会有红灯，属静默分叉。

现在动它，是因为它同时是「同一规则两种口径」里唯一已经产出不同语义的一处（其余双写只是维护成本）；
且它牵动综合建议的信号集与「年干四化·关键宫位影响」节的回补集，越晚定口径，受影响的输出面越大。

## What Changes

- 确立**一条**三方四正会照的星曜口径：**会照集合 = 该宫三方四正内所有 `mutagen` 为真的星**（含文昌 /
  文曲 / 左辅 / 右弼四颗辅星四化），与 `Star.mutagen` 字段取值口径一致（iztro 原样落字段，不分主星）。
  - **BREAKING**：`views/decadal.ts` 与 `views/yearly.ts` 两节的会照清单会**新增**辅星四化行；
    原本「未会本命四化」的兜底句在部分盘上不再出现。
- 把「取某宫三方四正内会照的本命四化」收敛为一个查询，`context.ts` / `views/decadal.ts` /
  `views/yearly.ts` 三处改由它取数——三处各自的宫范围（主题主宫 / 大限宫 / 流年宫）保持不同，
  只有星曜口径与遍历算式归一。
- `views/year-stem.ts` 的回补集随之自然收敛（`alreadyShown` 变大，已在节三露面的辅星四化不再被回补）。
- `suggestions.ts` 的禄 / 忌信号改用同一口径，不再因只算主星而在辅星为唯一信号时降级。
- 修 `suggestions.ts` 的「本命四化」槽：`m.mutagen` 是中文四化字（禄 / 权 / 科 / 忌），模板
  `kind` 是 `lu` / `ji`，早年那句 `m.mutagen === t.kind` **恒假**，该槽从未命中过（主星、辅星
  都一样）。改经既有的 `SIHUA_CHAR_TO_KEY` 对形，不新立一张表。
  - **BREAKING**：所有三方四正内有四化的盘，13 个主题的综合建议会**新增**「本命 X 化 Y」句
    （`--topic` 与 `--report` 均受影响）。
  - ⚠️ 这是一次**范围扩大**：该缺陷与「口径」是两件事，原提案未声明。拍板理由是
    `interpretation-content` 的「综合建议按盘推算」已把本命四化列为最小信号集——槽死了等于
    规范在说谎；且口径统一后辅星四化要能成为建议信号，槽不修则新 scenario 无法成立。
- 为上述四节补断言（当前零覆盖），并把口径写成规范条目。

### 不做什么

- **不动 `patterns/` 层**：`test/invariants.test.ts:1034-1041` 明确记录格局判定层两种口径并存
  （「不限 major」用于三奇加会 / 双禄朝垣，「只 major」用于科权双会）。那是另一条既有取舍，
  独立成题，本次不一并翻转。
- **不动排盘内核与 `Star.mutagen` 字段**：`algorithm.ts:284/294/304` 原样落 iztro 值，
  `chart-kernel.md:130-133` 的「`mutagen` 直接取自 iztro、无四化时为空串」口径不变。
- **不改 `views/year-stem.ts` 的职责**：它仍是「全盘补漏网，减去三方已展示」，只随口径变化
  自然增减行数，不改算法形状。
- **不改飞星派相关口径**（宫干自化 / 来因宫仍禁用）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `interpretation-content`：新增「三方四正会照本命四化的星曜口径」条目，并修订「综合建议按盘推算」
  中「落主题三方四正内的本命四化」这一最小信号集的定义（明确含辅星四化）。

## Impact

- 代码：`scripts/analysis/palace-query.ts`、`context.ts`、`views/decadal.ts`、`views/yearly.ts`、
  `views/year-stem.ts`、`views/suggestions.ts`（均为知识内容层，不触及
  `test/kernel-contract.test.ts` 冻结的 `algorithm` / `palace-relations` / `mutagen` /
  `wenmo-brightness`，也不触及 `extensibility` 定义的内核面）。
- 输出：四节文案会变——「本命四化会照」（`views/mutagen.ts:29-32`、`report.ts:345-348`）、
  「大限三方四正会照的本命四化」（`decadal.ts:64-75`）、「流年三方四正会本命四化」（`yearly.ts:57-66`）、
  「年干四化·关键宫位影响」（`year-stem.ts:63-67`——实测该节**零变化**，见 tasks 4.1 的方向
  更正），以及依赖禄 / 忌信号的综合建议句（修复后新增「本命 X 化 Y」句）。
- 测试：需新增断言覆盖上述四节（当前零覆盖）；`test/topic-suggestions.test.ts` 的「信号缺失显式降级」
  场景依赖样本盘信号，需实测确认是否受影响。
- 验证义务：按**内核或依赖改动档**执行（`typecheck` + `selftest` + `npm test` 三件套），
  并先取 `--topic` / `--report` / `--view daxian|liunian` 的基线输出，以「预期内差异清单」形式交付
  （本改动会改行为，不适用纯重构的逐字节 diff=0 判据）。
