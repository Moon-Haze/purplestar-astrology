# 规格：评估收口修复——文档承诺对齐、独占分支不静默、知识分级落地

- 日期：2026-10-03
- 状态：待评审
- 前置：2026-10-01 至 10-03 的两轮评估（架构评审 8 候选已交付；六项专项评估：领域内容质量 / 盲测 skill 执行 / 参数组合矩阵 / 可移植性演练 / 依赖健康 / iztro 升级演练）

## 0. 背景与目标

六项专项评估发现三类问题，本 spec 收拢其修复需求：

1. **文档承诺与实际行为脱节**：README 的 Node 下限承诺（≥22.15）实测不成立；「功能参数可叠加」对三个独占分支不成立；`--json` 的接管范围内部不一致；`--monthly` 的配合声明不准；`--late-zi` 与 `--branch 12` 的互斥未写。
2. **独占分支静默吞参数**：`--palaces` / `--topic` 给出后，其余功能参数被静默忽略（exit 0）——违反「宁可启动失败，也不静默产出错盘」纪律；`--json --info` 输出文本，下游 `synastry --charts` 消费方解析失败。
3. **领域内容缺口**：四级知识分级（verified/traditional/methodology/suspect）宣称了但数据层零落地（28 条倪师引句无一标注）；同一引句在两库标注口径打架；一条飞星派断语（「自化禄」）漏进用户可见输出；武曲晚婚门槛与廉贞五行两库不一致。
4. **升级流程漏洞**：`npm install iztro@latest` 会把精确 pin 改写为 `^`，锁版本形同虚设。

## 1. 测试接缝（沿用现有，不新增）

全部修复通过**两条既有接缝**验证，不引入新接缝：

- **CLI 端到端接缝**：`node scripts/purple-star.ts <命令> [参数]` 的 stdout/stderr/exit code——独占分支、文档行为、`--json` 接管边界都从这条缝断言（先例：test/cli.test.ts 的参数校验用例、selftest 的 runCli 探针）。
- **文档一致性接缝**：selftest 读 SKILL.md / references 文本断言关键句（先例：SKILL.md 命令速查断言、references 合并遗留漂移断言）。

## 2. Solution（从用户视角）

- 排盘用户加多个功能参数时，要么得到全部叠加结果，要么得到明确的中文报错——不再有参数被静默吞掉。
- 脚本调用方以退出码即可区分成功与失败；`--json` 承诺在任何分支语义下都成立或明确报错。
- AI 助手读到文档承诺（可叠加 / Node 版本 / 知识分级）时，承诺与实际一致。
- 引用一句「倪师说」时，能从输出中看出它的口径档位，不再无从分辨原话 / 口诀 / 传闻。

## 3. User Stories

1. 作为排盘用户，当我给 `--palaces` 又同时给 `--pattern` 时，我要么得到两者叠加、要么得到指路报错，so that 我不会在不知情的情况下丢失格局信息。
2. 作为排盘用户，当我给 `--topic love --pattern --mutagen` 时，我要被告知 `--topic` 是独占分支、其他参数未生效，so that 我能修正调用。
3. 作为脚本调用方，当命令因参数组合被拒时，我要拿到**非零退出码**与 stderr 上的中文指路，so that 编排层能用退出码感知失败。
4. 作为脚本调用方，当我给 `--json` 时，我要么拿到合法 JSON、要么拿到非零退出的报错，so that 下游解析永不遇到「以为是 JSON 的文本」。
5. 作为合盘用户，当上游排盘命令因参数组合产出非 JSON 时，我要在 synastry 的报错里看到成因指路，so that 我能自查上游调用。
6. 作为 AI 助手，我读到「功能参数可叠加」时，它的含义要与实测一致（哪些叠加、哪些独占、优先级如何），so that 我按文档编排命令不会走偏。
7. 作为 AI 助手，我在合盘工作流里要能直接拿到双盘四化互参所需的数据，so that 不必自己排两份详表手工对星。
8. 作为 AI 助手，我在交付解读时要能按 output-contract 的模板选择形态（全盘 / 聚焦 / 流年 / 合盘），so that 同类请求产出形态一致。
9. 作为 README 读者，我看到的 Node 版本要求要与实测一致（实际可用下限），so that 我按文档装环境不会开箱即报错。
10. 作为引用古籍或倪师断语的用户，我要在输出里看到该句的口径档位（verified / traditional / suspect 等），so that 我引用时能如实注明。
11. 作为 skill 维护者，我要让数据层的分级标注成为**结构**（字段）而非散文，so that 分级缺失能被 selftest 机检。
12. 作为 skill 维护者，同一句引句在主题论断库与合盘断语库的标注口径必须唯一，so that 两库不再打架。
13. 作为体系把关者，用户可见输出里不得出现飞星派概念的**肯定性**断语，so that「严格三合派」的立场贯穿到最后一公里。
14. 作为 skill 维护者，升级 iztro 的操作指引要包含「保持精确 pin」的警告，so that 锁版本策略不被 `npm install iztro@latest` 破坏。
15. 作为维护者，`--monthly` 文档要如实写「强制要求 `--mutagen`」，so that 用户按文档组合不会踩 exit 1。
16. 作为排盘用户，`--late-zi` 与 `--branch 12` 的互斥关系要写进晚子时说明，so that 两种晚子时入口的选择有据。
17. 作为脚本调用方，`--info`/`--palaces`/`--topic` 与 `--json` 组合时的生效规则要有唯一且文档化的优先级，so that 三个分支参数与 `--json` 的组合行为可预期。
18. 作为 AI 助手，流年解读与合盘交付要有 output-contract 模板，so that 我不必对「该写多长、按什么结构」自行裁量。

## 4. Implementation Decisions

### 4.1 独占分支不静默（优先级链文档化 + 违规报错）

- 实测确立的分支优先级链 **`--palaces` > `--topic` > 其余功能参数**（`--info` 属「其余」，被更高优先级分支接管）予以**保留**（四命令合一的分支语义），但两处收紧：
  - 高优先级独占分支（palaces / topic）激活时，若检测到**其他功能参数**（info/pattern/mutagen/yearly/monthly/decadal/ages/focus）也在参数表里 → `throw` 指路：「--palaces 是独占分支，参数 --pattern 未生效。独占分支请单独使用（优先级：--palaces > --topic > 其他功能参数）。」（检测点放在 cmdAstrology 分发入口，按声明表判断「功能参数」集合，不硬编码名单。）
  - `--json` 与 `--info`/`--topic` 组合 → 同样 `throw`（`--json` 与 `--palaces` 的既有组合保留——它是 synastry 契约的一部分）。
- options.md / SKILL.md 同步：「可叠加」措辞收窄为「专题参数（pattern/mutagen/yearly/monthly/decadal/ages/focus）可叠加」；新增「独占分支与优先级」小节（palaces > topic > 其余；`--json` 的组合边界）；`--monthly` 改为「强制要求 `--mutagen`（流年缺省取当年，可用 `--yearly` 指定）」；晚子时节补「`--late-zi` 须配合 `--time`，直接指定时辰用 `--branch 12`」。

### 4.2 Node 下限修正

- README 与 CLAUDE.md 的「Node ≥ 22.15」改为「**Node ≥ 22.18**」（22.18 是 22.x 中 type stripping 默认开启的首版；22.15–22.17 裸跑报 `ERR_UNKNOWN_FILE_EXTENSION`，加 `NODE_OPTIONS=--experimental-strip-types` 可用但子进程链路不可靠——不作为承诺形态）。CLAUDE.md 的「为什么能直接跑 TypeScript」一节同步。

### 4.3 知识分级落地（数据层结构化）

- 分级以**字段**落到引句上：`analysis/data.ts` 的引句数据结构增加可选 `grade` 字段（枚举 verified / traditional / suspect / methodology，与 index.ts 头注释宣称的四级一致）；28 条倪师引句逐条标注（判定依据：带《天纪》集数出处的标 verified；「古诀云/古书云/口诀」标 traditional；现有「未核实/来源存疑/一说非原话」散注标 suspect；方法论描述标 methodology）。
- **两库口径统一**（以更谨慎的一侧为准）：
  - 七杀「娶妻毁一半」：synastry 的 `ni_quote` 降级——该句标注口径改为「坊间流传（未核实）」，输出时以 suspect 口径披露，不再以原话名义呈现；
  - 太阳「三不见」：两库统一标 traditional 且删除「必有」的绝对化强化，恢复「需格外注意」原语气；
  - 武曲晚婚门槛统一为 30 岁（synastry 口径）；廉贞五行统一为丁火（data.ts:409 的「丙火」按笔误修正，422/429 的「火木」改丁火）。
- **飞星派断语清除**：synastry-knowledge 的「自化禄则财来财去」删除或改写为生年四化语境的等价表述（该情形体系不计算，改写后不得残留「自化」概念）。
- **机检**：selftest 新增断言——凡含「倪师说/倪海夏说/倪师言」等引句标记的文案条目，`grade` 字段必须存在且在枚举内（缺失即红）；synastry-knowledge 与 classics/data 的用户可见文案中，「自化」「来因宫」「飞化」只允许出现在否定/辨析语境（白名单文件与行，新出现即红）。
- CLI 披露语（topic 末尾的知识来源分级提示）保持不变——落地后它从「宣称」变成如实描述。

### 4.4 合盘数据缺口（盲测走偏点，最小改动）

- `synastry` 输出补充「双盘四化互参」小节：甲方四化星落乙方何宫、乙方落甲方何宫（数据在两份 JSON 里已齐备，纯渲染增补，不改 chart-view 契约的既有键、只增不删）；output-contract 补「流年解读」与「合盘」两种交付模板（结构 + 篇幅基线），workflow.md 的「`--json` 落盘方式」（stdout 重定向）写明。

### 4.5 升级流程补丁

- test/README 的「升级 iztro 的流程」一节补警告：**禁止 `npm install iztro@latest`**（实测会把精确 pin 改写为 `^`，锁版本失效）；正确姿势是显式改 package.json 版本号后 install，并 diff 检查 pin 形态。

## 5. Testing Decisions

- 只测外部行为：exit code、stdout/stderr 文案、输出节的出现与顺序、JSON 顶层键——不测内部分支实现。
- 独占分支：进程内（selftest 直调 parseArgs + cmdAstrology）与端到端（runCli / test/cli.test.ts 子进程）各覆盖一组；先例为 selftest 的「--monthly 不带 --mutagen 必须指路」断言与 cli.test.ts 的参数校验用例。
- 分级落地：selftest 读 data.ts 的结构化断言（引句 ↔ grade 双向盯，先例为 SKILL.md 参数面断言与 references 漂移断言）；「自化禄」回归断言盯 synastry 输出不再含该概念。
- Node 下限：验收性手工核验记录于 test/README（22.15 裸跑失败现象 + 22.18 通过），不进自动化（无 CI 多版本矩阵）。
- 每批交付跑三层：selftest 全绿 · `npm test` 全绿 · `npm run typecheck` 0 错误。

## 6. Out of Scope

- 合盘评分的**程序化计算**（guide 明言「不计算分数，由助手裁量」——维持）。
- 「时辰交界紧邻」的量化分钟数判据（需领域决策，另行讨论）。
- 空宫借双主星的合并结论规则（同上）。
- 古籍原文的校勘与增补（quanshu.ts:115 的辨析条目是合规示范，不动）。
- iztro 实际升级（演练结论：当前即 latest，无动作）。
- `docs/superpowers/` 历史备案与 `docs/test/` 测试备案的日期标注（历史快照不改）。

## 7. Further Notes

- 盲测总评为「能做对」——防错设计（铁律追问、口径转达、出处分级）被确认为最有效部分；本 spec 修的是承诺与实施的三处脱节，不动已被盲测确认有效的骨架。
- 演练数据支撑：参数矩阵 16 行（12 ✅ / 1 ⚠️ / 3 ❌）；盲测 11 条走偏点；分级统计 747 条文案 / 28 条引句 / 0 标注；Node 22.15.0 裸跑 `ERR_UNKNOWN_FILE_EXTENSION`、22.18.0 全绿；`npm install iztro@latest` pin 改写实测复现。
- 实施顺序建议：4.1 + 4.2（文档与分支收紧）→ 4.3（分级落地，改动面最大）→ 4.4 → 4.5；每批独立可交付、三层验证。
