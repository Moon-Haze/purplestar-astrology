# Proposal

## Why

`TOPIC_SUGGESTIONS`（`analysis/data.ts`）为每主题固定三条静态文案，`--topic` 终端输出与 `--report` 的 13 个板块「综合建议」共用——「重点关注三方四正的星曜组合与本命四化会照，格局好坏由此决定」对任何盘都成立，即对任何盘都零信息量。报告读者读到的结尾是通用模板尾巴，与全文「按本盘论断」的立场相悖。

## What Changes

- **建议按盘推算**：综合建议由本盘实际信号**确定性推算**——最小信号集：主题主宫主星及亮度、落主题三方四正内的本命四化、当前大限落宫与主题宫的关系；推算产出结构化建议条目（句子 + 依据），渲染层只装配。
- **建议句模板槽位化**：新写少量行动导向模板句（星名 / 宫名 / 化象为槽位），确定性填充；不引入任何模型生成。
- **两端同变**：`--topic` 与 `--report` 的综合建议同源同变（两者本就共用 `TOPIC_SUGGESTIONS`）；「继续深度追问」交互尾巴机制不变。
- **不做什么**：不做流年 / 大限**动态预测**（那是 `--view daxian|liunian` 的域，报告「本命盘静态论断」定位不变）；不改变 13 板块结构与建议小节位置；不修改前序板块的论断内容；在 `structure-content-branches` 落地后实施以复用其结构化信号，但不与其产生硬耦合（信号读取独立于分支承载形态）。
- **体系边界**：建议句不引入飞星派口径（仍按落宫与会照组织）；不虚构盘面没有的信号——信号缺失时建议句降级为该主题的通用收束句，降级**显式可查**（不得编造命中）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `interpretation-content`: 新增「综合建议按盘推算」需求——综合建议 SHALL 由本盘实际信号确定性推算生成，SHALL NOT 为与命盘无关的静态通用文案；同盘 SHALL 产出逐字节一致的建议，信号缺失 SHALL 显式降级。

## Impact

- **代码**：`scripts/analysis/data.ts`（`TOPIC_SUGGESTIONS` 静态表退位为降级收束句与模板句承载）、`scripts/analysis/` 新增建议推算单点（落位 design 裁决）、`scripts/analysis/report.ts` 与 `views/` 渲染点接入。
- **输出行为**：`--topic` 与 `--report` 的综合建议小节内容变化（13 主题全部）——内容行为变化，非重构；其余小节零变化。
- **生成物**：`docs/cli-samples.md` 与 `tools/samples/` 的 `--topic` 样例随重导变化（改生成器 + 重导，不手改）。
- **验证义务**：内容层改动，不触排盘内核——`npm run typecheck` + `node scripts/purple-star.ts selftest` 必跑；`npm test` 基准不受影响；确定性由同盘双跑 diff=0 断言钉住。
