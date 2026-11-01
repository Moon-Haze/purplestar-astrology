# Tasks

## 1. 检查器模块

- [x] 1.1 新增 `tools/code-style/long-comment-check.ts`：导出
      `checkLongComments(files: string[]): { file: string; line: number; lines: number }[]`。
      扫描传入清单里 `scripts/` 与 `tools/` 下（**排除 `test/`**）的 `.ts`；
      合并连续注释行（行内 `//`、块注释 `/*` 起手、块内 `*` 续行、`*/` 收尾）；
      块行长 > `MAX_COMMENT_LINES`(=10) 且（块起始行 > 5 且块不以 `/**` 起手）即收集
      `{ file, line:起始行, lines:行数 }`。
      **判据**：`npx tsc --noEmit` 0 错误；用一份含 11 行连续 `//` 注释（非头、非 JSDoc）的临时
      `.ts` 喂入 → 返回非空；含 `/**` 11 行 JSDoc 的 → 返回空；头注释（起始行 ≤ 5）的 → 返回空。

- [x] 1.2 在 `package.json` 加 `"code-style:check": "tsx tools/code-style/long-comment-check.ts"`；
      模块兼做 CLI：无参时扫描全仓 `scripts/`+`tools/`（排除 `test/`），打印违规并**非零退出**；
      被 `import` 用作库时不退出（由调用方决定）。
      **判据**：`npm run code-style:check` 在注入违规文件后退出码 ≠ 0；清理后 = 0。

## 2. 接入 review 面

- [x] 2.1 在 `tools/review-gate.ts` 的 `mechanical()` 内调用 `checkLongComments`（传入本次变更里
      属于 `scripts/`/`tools/` 且非 `test/`、非删除的文件**完整路径**），把命中转为 `🔴` 级
      finding（阻断退出码；原拟 💭 与本条判据「退出码 ≠ 0」及 proposal 验证义务矛盾，
      实现期按多数证据改为阻断级）：
      标题「新增/改动文件含 >10 行连续注释」，where 列 `file:起始行`，why 指向 code-style spec 与
      「外置到 `docs/code/`」的处置。
      **判据**：对一份含 11 行连续 `//` 注释的 `scripts/` 新文件跑 `npm run review`，报告出现该
      finding 且退出码 ≠ 0；纯文档 / `test/` 改动不触发。

- [x] 2.2 排查三类字符串：新文件 `tools/code-style/long-comment-check.ts` 的 import 一律用相对路径
      （`./`、`../`）；确认无 `load<>("@/…")` 字面量、`resolve(ctx.root, …)` 拼路径（纯 node:fs 扫描，
      理应不需要）。
      **判据**：`grep -nE 'load<>|@/|resolve\(ctx\.root' tools/code-style/long-comment-check.ts`
      无命中。

## 3. 验证与同步

- [x] 3.1 三件套全绿：`ZIWEI_NO_CACHE=1 node scripts/purple-star.ts selftest` →
      `ZIWEI_NO_CACHE=1 npm test` → `npx tsc --noEmit`。
      **判据**：退出码均 0。

- [x] 3.2 `openspec validate --all` 零警告。
      **判据**：退出码 0 且无 `WARNING`。

- [x] 3.3 自测评审链路：对一份临时 `scripts/` 文件注入 11 行连续 `//` 注释跑 `npm run review`，
      确认被拦下且退出码 ≠ 0；删注释重跑确认放行。
      **判据**：两跑结果符合预期；临时文件事后清理（不进提交）。

## Workflow follow-up

- 评审通过后 archive：本 change **不改 code-style spec 文本**（只落地其执行），故折回 specs 时无
  delta；`openspec validate --all` 零警告；AGENTS.md「项目约束」节若需补充「注释纪律由
  code-style:check 守」则同步、否则跳过并标注；一个逻辑变更一个 commit 一并提交。

## 4. 存量外置（2026-11-01 实现期追加，用户拍板）

- [x] 4.1 外置 8 处存量长注释（按检查器真实口径——排除头块/JSDoc——`scripts/`+`tools/`
      仅 8 块，远小于 proposal 审计的 296 粗口径）：`scripts/cli/selftest/render.ts:82`、
      `scripts/patterns/superior.ts:221`、`tools/db/db.ts:97/154/314`、
      `tools/db/sample-id.ts:49`、`tools/db/verify-duckdb.ts:559`、`tools/review-gate.ts:396`
      → 搬入 `docs/code/`（cli-selftest / patterns 追加条目；新建 db-tools / review-gate 两篇；
      README 导航表 15→17）。原文照搬，零行为变化。
      **判据**：`npm run code-style:check` 全仓扫描 0 违规、退出码 0。
