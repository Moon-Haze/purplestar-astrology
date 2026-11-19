# 候选 6 · 建议行投影规则双写：basis → 括注住在两个编排器（2026-11-18 第五轮）

**档位**：Worth exploring ｜ **分层**：analysis 知识内容层（不碰排盘内核）｜ **规范面**：无需 openspec change（analysis-structured 主 spec 下的收敛，属实现细节）｜ **与已定决策冲突**：0

## 涉及文件

| 位置                                          | 角色                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| `scripts/analysis/report.ts:358-367`          | `--report` 路径的建议行装配（Markdown 版式）                                  |
| `scripts/analysis/views/suggestions.ts:24-40` | `--topic` 路径的建议行装配（`【】` 版式）                                     |
| `scripts/analysis/suggestions.ts:24-27`       | `SuggestionLine`（text/basis 的语义属主 `buildTopicSuggestions` 所在 module） |
| `test/topic-suggestions.test.ts:80-88`        | 第三处：同一括注字面量的正则（strip 用）                                      |

## 问题（file:line 实据）

「综合建议」行的成文规则**逐字双写**在两个编排器里：

```ts
// report.ts:361-365 与 views/suggestions.ts:30-35 逐字同串
s.basis === "无命中信号" ? `→ ${s.text}（本盘无此主题的直接信号，此为通用收束）` : `→ ${s.text}`;
```

`SuggestionLine` 的 text/basis 语义由 `buildTopicSuggestions` 单点负责，但「basis → 括注」这条**投影规则**漏在了属主之外。改措辞要动两处，漏一处即 `--topic` 与 `--report` 输出漂移——与 e417115 修掉的「--view 值域文案手抄」同型，当时收敛五处，此处漏网。

测试侧 `test/topic-suggestions.test.ts:81,87` 还有第三份拷贝：strip 正则 `/（本盘无此主题的直接信号，此为通用收束）$/`。该测试的 `deepEqual(reportLines, viewLines)` 目前能抓两侧**单侧**漂移（一侧换措辞后 strip 正则只剥得掉旧措辞那侧，剩余后缀让两侧行不等——红）；但若两侧**同步**换措辞，strip 正则双双失配、断言退化为「原始行相等」，守卫力静默减弱而无任何信号。

附带（同型更轻）：童限提示句 `"（尚未起运 —— 虚岁小于五行局数时不入大限，按命宫论，见 SKILL「童限」口径。）"` 在 `report.ts:166` 与 `:294` 同文件两处逐字同串。

## 为什么是摩擦（词汇口径）

「无命中信号该长什么样」是 basis 字段的语义，属主是 `buildTopicSuggestions` 所在的 module；两个编排器（`--report` / `--topic`）理应只拥有各自的**版式**（`###` 头 vs `【】` 头）。现在版式与成文混在同一个三元表达式里——规则改一处必须记得改两处 + 一处测试正则，locality 三点分散。

## 方案方向

把成文收进属主：`buildTopicSuggestions` 出口直接给成文行（`SuggestionLine` 加只读的 `line` 派生字段，或 suggestions.ts 导出 `suggestionLine(s)` 单点），两个编排器只拼自己的版式头尾；测试 strip 正则随之删除（断言直接比 `line`，或两侧比对不再需要剥后缀）。童限句提为模块级常量（同文件内收口即可）。

## deletion test

两处调用点的三元条件被删掉、规则集中到拥有 basis 语义的 module——是深化不是搬家（版式装配各留约 3 行，与 10-16 轮候选 1 的「规则 × 1 + 版式 × 2」同一形态）。测试正则第三份拷贝同时湮灭。

## Before / After

```text
Before: 规则 × 2 + 测试正则 × 1               After: 规则 × 1（属主）+ 版式 × 2
report.ts    三元 + 括注字面量                 suggestions.ts: suggestionLine(s) ── basis→括注 单点
views/sugg.  三元 + 括注字面量（漂移风险）        report.ts    ── 消费 line，只管 ### 版式
test         strip 正则第三份                   views/sugg.  ── 消费 line，只管 【】 版式
                                                test         ── 正则删除，直接对拍
```

## 验收

- `--topic` 与 `--report` 输出**逐字节 diff = 0**（成文规则等值上提，两侧措辞本就一致）。
- `test/topic-suggestions.test.ts` 断言改后语义不变（建议行一致）。
- 三件套全绿；`npm test` 300 条对拍不受影响（基准只管排盘）。

## 落地注意

- 10-16 轮候选 1（overview-material 抽取）的先例形态完全可套：规则归属主、版式留编排器、文案统一拍板一次。
- 括注措辞若将来要改，改 `suggestions.ts` 一处 + 重导 `docs/manual`（如涉及）即可，不再有第二份。
