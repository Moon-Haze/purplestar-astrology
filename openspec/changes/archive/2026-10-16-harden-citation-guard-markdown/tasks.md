# Tasks

> 全局前提：本 change **不动 `scripts/` 任何一行**，无文件物理位置变动，
> 故不涉及 import 语句 / `load<>("@/…")` 字面量 / `resolve(ctx.root, …)` 三类字符串的排查。
> 顺序遵循 design：先实现与元测试（机器先能干），再真扫描，最后改文档陈述
> （避免「文档说已硬化、机器还没干」的中间态）。

## 1. 守卫实现（`test/lib/citation-guard.ts`）

- [x] 1.1 抽出共用的 `buildBannedSet(checklist)` 与 `findViolations(chunks, banned)`，
  使 `scanCitations` 与新的 `scanMarkdownCitations` 共用同一份黑名单构造与同一套形态正则
  （正则逐字不改，含 `[^。\n]{0,10}` 的间隔上限与四组动词）
- [x] 1.2 新增 `collectMdFiles(root, dir)`：递归收 `.md`，跳过 `node_modules` / 点目录 /
  `dist`，并跳过 `docs/manual`（生成导出，理由与 `.ts` 侧跳过 `corpus/data/manual` 同源，
  注释写明「源头在 `.ts` 扫描范围内」）
- [x] 1.3 新增导出 `scanMarkdownCitations(root, checklist = ANNOTATIONS): CitationScan`，
  返回结构与 `scanCitations` 一致（`violations` / `checked` / `skipped`）；
  `scanCitations` 现有行为逐字不变
- [x] 1.4 模块头 `@packageDocumentation` 补一节「`.md` 侧扫描」：说明扫描根是仓库根、
  排除 `docs/manual` 的理由、与 `.ts` 侧的分工（D1/D2）
  验证：`npm run typecheck` 0 错误

## 2. 元测试（构造的临时目录树）

- [x] 2.1 `.md` 里的违例抓得到：临时树放一个 `notes.md`（内容为伪造倪师引文），
  `scanMarkdownCitations` 应报违例，且 `checked` 含该文件
- [x] 2.2 `docs/manual/` 下的违例**不**报、同内容放在 `docs/other.md` **要**报
  （反向验证，防排除范围扩大）；`node_modules` / 点目录 / `dist` 下的 `.md` 不进范围
- [x] 2.3 空目录得到零违例且 `checked` 为空 —— 与 `.ts` 侧同构的假绿指纹，
  供 3.2 的「`checked` 非空」断言引用
- [x] 2.4 细化现存那条「非 `.ts` 文件不进扫描范围」：措辞从「扫描卷进了不该扫的」
  改为「`scanCitations` 只扫 `.ts`（`.md` 由 `scanMarkdownCitations` 负责，见 2.1）」，
  断言本身不变（`notes.md` 仍不该被 `scanCitations` 扫到）
  验证：`npm test` 全绿，且新增用例条数在 `test/README.md` 层表已登记

## 3. 真扫描（对仓库根的 `.md` 树）

- [x] 3.1 `test/citations.test.ts` 新增第三个 describe「引文守卫：文档侧（仓库根 `.md`）」，
  按仓库根跑 `scanMarkdownCitations`，与流派分派组并列
- [x] 3.2 `checked` 非空且覆盖 `SKILL.md` / `docs/code/README.md` 等手写文档
  （空转防护：排除过头会让 `checked` 空掉）
- [x] 3.3 零违例（排除 `docs/manual/` 后的实测余量为 0；若变红，说明有新写的未核实
  引文挂倪师名下，应按守卫提示改归属或补核对记录，**不是**放宽判据）
  验证：`npm test` 全绿

## 4. 文档陈述同步（软纪律转硬）

- [x] 4.1 `docs/code/README.md`：「倪师引文软纪律」一节改写为「已硬化」，
  说明守卫现收 `.md`、排除 `docs/manual` 的理由，删掉「守这条纪律靠人」的过时表述
- [x] 4.2 `openspec/config.yaml` 的「引文纪律」context 补一句：`.md`（含 `docs/code/` 与
  `SKILL.md` / `references/`）同样在守卫扫描范围内；只改这一处，不借机改写别的段落
- [x] 4.3 `test/README.md`：层 7「引文守卫」的覆盖面描述补 `.md` 侧
  验证：`grep -rn "靠人" docs/code/README.md` 无结果；`npm test` 仍全绿

## 5. 全量收尾

- [x] 5.1 `npm run typecheck` + `npm run lint` + `npm run format`（`--check`）全绿
- [x] 5.2 `node scripts/purple-star.ts selftest` 全绿 + `npm test` 全绿
  （本变更不碰 `scripts/`，两层是防手滑的回归网）
- [x] 5.3 `npm run pack` 产物解压后 selftest 全绿（证明分发件行为不变）
- [x] 5.4 `git diff -- scripts/` 为空（证明产品代码零变动）

## Workflow follow-up

- 按仓库评审要求过审后，`/opsx:archive` 归档本 change。
- 归档后 `docs/code/README.md` 的硬化表述成为活文档；若将来 `docs/` 下新增**手写**
  子目录含倪师引文，它自动纳入扫描（收集面是推导的），无需改代码。
