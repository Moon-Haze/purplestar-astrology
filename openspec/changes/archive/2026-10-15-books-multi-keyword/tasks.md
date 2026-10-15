# Tasks: books 多关键词 AND 检索

- [x] 1. 改 `searchClassics`（`scripts/corpus/index.ts`）
  - trim 后按 `/\s+/` 分词；≤1 词走原路径；多词要求同段全命中
  - snippet 锚点取最早命中关键词，`<mark>` 恰一个
  - 完成判据：`node -e` 直调 `searchClassics("紫微 化权")` 返回非空且每条
    `text` 同时含两词；`searchClassics("紫微")` 输出与改前逐字节一致（改前先存一份对照）
- [x] 2. selftest 古籍段加多关键词断言（`scripts/corpus/selftest-asserts.ts`）
  - 断言：两词 AND 命中数 ≤ 单词命中数；每条命中 text 同时含两词；
    snippet 含 `<mark>` 且只含一个
  - 完成判据：`node scripts/purple-star.ts selftest` 古籍段新断言通过、
    既有断言全绿、报告输出 diff 与改前仅差新断言行
- [x] 3. 帮助文案与样例表
  - `scripts/cli/commands/command-meta.ts` books 行说明多关键词（空白分词、须全命中）
  - `tools/cli-samples.ts` 新增一条多关键词样例（选真实有命中的词对）
  - 完成判据：`node scripts/purple-star.ts knowledge --help` 文案含多关键词说明；
    样例表自检全绿（`npx tsx tools/cli-samples.ts`，49 → 50 条）
- [x] 4. 再生 `docs/cli-samples.md` 并跑全量闸门
  - 完成判据：`node scripts/purple-star.ts selftest` 全绿；
    `npm test` 全绿（重点：仓库自洽层盯样例表一致性）；`npm run typecheck` 通过
- [x] 5. 归档
  - 完成判据：`openspec archive books-multi-keyword` 后
    `openspec validate --all` 全绿；主 spec 的四域表 books 行已更新
