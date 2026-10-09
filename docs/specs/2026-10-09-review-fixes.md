# Spec：docs/doubao 六份评审的落地修复（A–G 批次）

> 来源：`docs/doubao/` 六份评估（2026-10-09 按 master `ddbb95a` 实机复核后的「⏳ 未解决」项）。
> F1（db/ 出 git）已拆至独立项目 `../purplestar-db-slim/`，不在本 spec 范围。
> 对应 plans：`docs/plans/2026-10-09-{a-docs-fixes,b-cli-output,c-selftest-perf,d-code-structure,e-synastry-hook,f-skillmd-polish}.md`。

## Problem Statement

六份评审确认了若干仍未解决的问题，分四类伤害用户体验或维护性：
1. **文档实锤错误**：合盘排障文档与实现矛盾（环境变量口径）、自检项数漂移（120 vs 实跑 128）、术语与体系立场冲突（「飞化」）、SKILL.md 缺首次安装指引导致 agent 首跑必失败。
2. **CLI 输出体验**：四柱两口径相同仍并列两行、面板与运限速览之间无空行、缺项报错顺序不自然（先报缺性别、跳过同样缺的时辰）。
3. **性能**：selftest 剩余 15+ 个子进程冷启动（约 75 秒）；`help` 也要 3.3 秒（入口无条件加载 iztro）。
4. **代码结构与文档挂点**：同函数内重复计算、package.json 残留已下线数据路线脚本、事业合作合盘判定无输出形态挂点、SKILL.md 正文密度过高与别名双写。

## Solution

按依赖关系分六批一次通过（每批独立可交付、独立提交、独立回归）：
- **A 文档实锤**：修 `references/synastry-troubleshooting.md` 两处（D1/D2）、`references/synastry-guide.md` 术语（D3）、`SKILL.md` 安装指引（D5/F2）。
- **B CLI 输出**：四柱去重（O3）、面板后补空行（O6）、缺项校验顺序改为 日期→时辰→性别（P3）。
- **C selftest 性能**：runCli 子进程改进程内直调、仅留 2 个冒烟（方案 A 续）；入口懒加载内核让 help 近瞬时（方案 B）。
- **D 代码结构**：`buildAnalyzeJson` 与 `yearlySection` 的重复计算收敛（P1）；删数据路线 npm scripts（F6）。
- **E 合盘挂点**：`synastry-guide` 第八节注明事业合作启用条件与输出形态（D4）。
- **F SKILL.md 打磨**：「其他已知事实」拆小标题（R1）、别名收敛到 options.md（R2）、知识源优先 CLI 命令（R3）。
- **G 收尾**：更新 `docs/doubao/` 各文档状态标注（含 O4 的「实测已基本解决」改标）。

## User Stories

1. 作为合盘排障的 agent，我希望 synastry-troubleshooting 对内核来源的描述与实现一致，以免误判「只有一份内核、无环境变量可覆盖」。
2. 作为回归验收的 agent，我希望排障文档不再写死过期的自检项数，或写明以实跑末行为准。
3. 作为遵循三合派立场的解读 agent，我希望方法论文档不再用「四化飞化互参」这类与「飞星已下线」警示相冲突的标题。
4. 作为首次使用本 skill 的 agent，我希望 SKILL.md 告诉我先 `npm install` 且需要 Node ≥ 22.18，而不是第一次运行报错后再排查。
5. 作为 CLI 用户，我希望四柱两口径相同时只看到一行，不再并列两行相同值产生「是不是 bug」的困惑。
6. 作为 CLI 用户，我希望基本信息面板与运限速览之间有空行，阅读节奏与其他分节一致。
7. 作为 CLI 用户，我只给日期时希望先被告知缺时辰（自然顺序：日期→时辰→性别），而不是跳过时辰直接报缺性别。
8. 作为本仓维护者，我希望 selftest 在 10 秒内跑完（当前约 75 秒），同时仍保留子进程冒烟守住「入口→分发」链路。
9. 作为 `help` 的调用者（agent 或人），我希望 help 近瞬时返回，不为看用法付出 3.3 秒的 iztro 加载。
10. 作为后续读代码的维护者，我希望 `buildAnalyzeJson` 里流年地支只算一次，`yearlySection` 里大限三方名只查一次。
11. 作为仓库维护者，我希望 package.json 不再保留已下线数据路线的 `build:db`/`verify:db`/`query` 脚本。
12. 作为被问「事业合作」的解读 agent，我希望 synastry-guide 第八节告诉我何时启用这套判定、按什么形态输出。
13. 作为按需读 SKILL.md 的 agent，我希望「其他已知事实」按主题分小标题、拼音别名只在 options.md 出现一份清单、知识源指引优先 CLI 命令而非读源码。
14. 作为仓库维护者，我希望 docs/doubao 评审文档的状态标注反映真实修复情况（含 O4 实测已基本解决的改标）。

## Implementation Decisions

- **D1**：`synastry-troubleshooting.md` 的「确认跑的是哪一份内核」节改为与 `troubleshooting.md` 同口径——`ZIWEI_ROOT` 环境变量第一候选、未设则技能自带内核；两篇排障文档不再互相矛盾。
- **D2**：自检项数改为「以 selftest 输出末行自报为准」的动态表述，附注最近一次实跑值（128/128，2026-10-09）；不再写死会漂移的裸数字。
- **D3**：`synastry-guide.md` 第四步标题与正文统一改「四化互参」；顶部 ⚠️（「读到飞化不要找飞星工具」）保留——它防的是误用，不冲突。
- **D5/F2**：SKILL.md「路径约定」节补一行首次使用指引（`npm install` + Node ≥ 22.18）。措辞避开旗标名（`--eot` 等），不触发 selftest 的文档-代码旗标断言。
- **O3**：`infoSection` 中节气与非节气四柱相同 → 合并为一行 `四柱(节气与非节气同) : …`；不同 → 保持两行。同步修改 selftest:1191 断言组（样例 2000-4-6 两口径恰相同），并新增一个两口径不同的样例断言（立春后、正月初一前，年柱分叉）。
- **O6**：`cmdAstrology` 默认输出在 `infoSection` 之后、`overviewSection` 之前补一个空行。
- **P3**：把性别校验块移到时辰校验之后（`birth-info.ts` 内顺序调整），使缺项报错顺序为 日期→时辰→性别。不改为「一次列全」（改动面大，且逐项报错文案已含指引，顺序修正即满足评审建议）。
- **方案 A 续**：selftest 的 `runCli` 输出形态断言改进程内直调（`parseArgs` + `COMMANDS[cmd]`，错误路径断言 throw message）；仅保留 2 个真子进程冒烟（1 个成功链路 + 1 个「错误：… + exit 1」链路）。classics/synastry 断言组同法收敛。
- **方案 B**：新建 `scripts/cli/command-meta.ts` 收纳 `CommandName`/`COMMAND_DESC`/`COMMAND_HELP`（无命令实现依赖）；`purple-star.ts` 把内核模块加载与启动自检包进惰性函数，help/未知命令路径只加载 args + command-meta + help。启动导出自检仅在真正加载内核时执行。
- **P1**：`buildAnalyzeJson` 提 `lnBranch` 局部变量；`yearlySection` 的大限三方 `surroundNames(chart, dx.palaceBranch)` 两次调用提一次。
- **F6**：package.json 删 `build:db`/`verify:db`/`query` 三个 scripts；保留 `@duckdb/node-api` devDep（tools/db 脚本仍在仓内、typecheck 仍需其类型），数据路线脚本入口由 tools/db/README 记录。
- **D4**：`synastry-guide.md` 第八节顶部加启用条件与输出形态说明（用户明确问事业/合作时启用；按聚焦形态输出，重点宫位官禄/兄弟/交友）。
- **R1**：「其他已知事实」按 知识库来源 / 亮度口径 / 年龄与运限 / 数据面布局 拆四个小标题，内容不改。
- **R2**：SKILL.md 高频参数段删拼音别名列举，改一句「拼音别名仍被识别，全表见 options.md」。
- **R3**：工作流第 2 步补「能用 CLI 命令查的优先用命令（如古籍原文用 `classics`），查不到再读 scripts/ 源码」。

## Testing Decisions

- 每批完成后跑 `node scripts/purple-star.ts selftest`（全绿，项数以报告自报为准）与 `npm test`（cli / 排盘不变量 / 三合派约束 / 引文核对）。
- 输出形态变化（O3/O6/P3/方案 B 的 help）属于用户可见契约：O3/O6/P3 在 selftest 输出形态断言组同步校准；help 懒加载用 `test/cli.test.ts` 既有 help 断言兜底，另跑 `bench:startup` 对比。
- SKILL.md/文档改动依赖 selftest 的文档-代码旗标断言（旗标名与声明表对拍）防漂移。
- 批次 C 改断言执行方式后，断言语义必须与子进程版等价（输出关键词、报错文案逐字保留），冒烟用例做交叉验证。

## Out of Scope

- **F1 db/ 出 git**：独立项目 `../purplestar-db-slim/`。
- **F3 分发 zip 策略**：`--omit=dev` 打包脚本随 F1 项目给参考，不在本仓执行。
- **git filter-repo 历史改写**：需团队共识，评审已列为「仅公开分发时再评估」。
- **R4 触发词精简**：评审自评「可接受，触发面广也有好处」，不动 frontmatter。
- **functional-review P2（palaceByBranch Map 索引）**：重构任务改动面大，本批不做，留待后续单独立项。
- **方案 C（子路径导入/打包 iztro）**：评审已定「A/B 后仍不达标再评估」。

## Further Notes

- 执行顺序 A→B→C→D→E→F→G：A 是纯文档先行（无代码风险）；B/C 改输出契约须先于 D 的纯重构；G 收尾统一改状态标注。
- 每批一个 commit，消息格式沿用仓内惯例（`fix(...)`/`perf(...)`/`docs(...)`）。
- 用户未要求 push，全部只 commit 不 push。
