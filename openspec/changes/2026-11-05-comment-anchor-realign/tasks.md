# 任务 · 注释锚点批改 + 指针有效性守卫

判据形态标记：`[退出码]` / `[计数]` / `[逐字节]` / `[反向注入]`。
批改本体是纯文案（零逻辑）；唯一行为变化是 help 总览 DESCRIPTION 一行。

## 1. 基线

- [x] 1.1 取基线：`help` 总览输出、`ZIWEI_NO_CACHE=1 npm test` 末行分层项数、
      `node scripts/purple-star.ts selftest` 首行项数，落盘备查。
      判据 `[退出码]`：三者均可执行且记录完整。
- [x] 1.2 存量取证：`grep -rn "CLAUDE.md" scripts/ test/ tools/` 与
      `grep -rn "scripts/ziwei" scripts/ test/ tools/` 全命中清单落盘（批改后归零用）。
      判据 `[计数]`：两清单非空（12 处 + help.ts:180）。

## 2. 纯文案批改（零逻辑）

- [x] 2.1 `scripts/cli/commands/help.ts:179-180`：DESCRIPTION 内核布局行改为实际布局
      （排盘内核住 `scripts/` 根，知识内容住 `scripts/corpus|synastry|knowledge/`；
      措辞与 AGENTS.md「数据流」节一致）。
      判据 `[计数]`：`help` 输出不含 `scripts/ziwei`；除该行外输出与基线逐字节一致
      （`[逐字节]` diff 仅 1 行）。
- [x] 2.2 CLAUDE.md 引用 ×12（11 文件）逐处语义核对后改指 AGENTS.md（或「仓库根
      AGENTS.md」），不机械替换（如「见 CLAUDE.md〈体系口径〉」→「见 AGENTS.md
      〈体系口径〉」）。
      判据 `[计数]`：`grep -rn "CLAUDE.md" scripts/ test/ tools/` 零命中。
- [x] 2.3 性别过滤契约：`scripts/analysis/report.ts:5` 与 `scripts/analysis/index.ts:60-62`
      改为「性别已在各 view 经 selectGender 投影，编排层仅拼接」口径（与
      `index.ts:89` 一致）；`docs/code/analysis.md` 若描述旧口径同步。
      判据 `[计数]`：`grep -rn "整篇.*性别过滤\|性别过滤" scripts/analysis/report.ts
      scripts/analysis/index.ts docs/code/analysis.md` 无「编排层整篇过滤」的活性陈述。
- [x] 2.4 `scripts/corpus/citation-core.ts:6-9`：放置理由改为现状陈述（唯一现行消费者
      是测试侧 citation-guard；建库消费方随断语手册退役 2026-11-01；直出链/建库回归时
      须共引本模块）。
      判据 `[计数]`：`grep -n "export-manual" scripts/corpus/citation-core.ts` 零命中。
- [x] 2.5 三个改名残留：`fortune/primitives.ts:58`（parseLiuNianArg → parseYearlyArg，
      现住 `cli/commands/astrology-context.ts:41`）；`fortune/mutagen.ts:16`（旧路径
      cli/astrology.ts → cli/commands/astrology.ts）；`commands/index.ts:4`（cmdXxx
      清单去掉 fortune 或改述 re-export 壳）。
      判据 `[计数]`：`grep -rn "parseLiuNianArg" scripts/` 零命中；
      `grep -n "cli/astrology" scripts/cli/fortune/mutagen.ts` 零命中。
- [x] 2.6 本节全部 touched 文件跑 `npx eslint` + prettier 对改动行（不整跑 format）。
      判据 `[退出码]`：eslint 全 0。

## 3. 轻守卫（repo 层）

- [x] 3.1 `test/repo.test.ts` 新增注释指针有效性扫描：正则提取 `scripts/` `test/`
      `tools/` 的 `.ts` 注释中 `.md` 引用词元，逐一核对仓库内存在；白名单显式登记带
      理由；断言登记 `test/README.md` 层表与 `test/lib/run.ts` 的 LAYERS（新断言入
      repo 层）。
      判据 `[计数]`：`ZIWEI_NO_CACHE=1 npm test` repo 层项数 = 基线 + 1，全绿。
- [x] 3.2 反向注入：临时在任一被扫描文件加注释「见 docs/code/not-exist.md」→ repo 层
      必须失败并报文件行；还原后恢复。
      判据 `[反向注入]`：注入态 npm test 非零退出且失败信息指向新守卫；还原后退出码 0。

## 4. 三件套与收尾

- [x] 4.1 `npm run typecheck`。判据 `[退出码]`：0。
- [x] 4.2 `node scripts/purple-star.ts selftest`。判据 `[计数]`：全绿，项数与基线一致。
- [x] 4.3 `ZIWEI_NO_CACHE=1 npm test`。判据 `[退出码]`：0；repo 层 = 基线 + 1，其余层
      项数与基线一致。
- [x] 4.4 `openspec validate --all` 零警告。判据 `[退出码]`：0。
