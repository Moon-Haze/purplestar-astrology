# Tasks

## 1. corpus 公开面收敛（候选 5）

- [x] 1.1 删 `scripts/corpus/index.ts` 的 `getBookBySlug` / `getChapter` /
      `getParagraphById` 三导出及各自 docstring（`:44-87` 区段）；文件头注 `:4`
      改实态「提供全文检索与书目/段落统计」。完成判据：
      `git grep -n "getBookBySlug\|getChapter\|getParagraphById" -- scripts/ test/ tools/ docs/` 归零。

## 2. CONFIG_OPTION_GROUPS 删除（候选 11）

- [x] 2.1 删 `scripts/cli/args/config-input.ts:110` 的 `CONFIG_OPTION_GROUPS` 导出
      连同其注释，文件其余不动。完成判据：
      `git grep -n "CONFIG_OPTION_GROUPS" -- scripts/ test/ tools/ docs/` 归零。
- [x] 2.2 `docs/code/cli-args.md` 的 `CONFIG_OPTION_GROUPS` 段（`:297-299`）随删除
      收敛。完成判据：同 2.1 的 grep（docs/ 含在内）。

## 3. citations / school 占位退役（候选 8 + 补验项）

- [x] 3.1 删 `scripts/knowledge/types.ts` 的 `KnowledgeSource.citations` 成员（`:58`）、
      `KnowledgeSource.school` 成员（`:54`）与 `CitationRef` interface（`:40-47`）；
      interface docstring「（未来的）引文核对表」措辞同步；文件头注 Phase 3 占位段
      改事实陈述，指向引文接缝真实落点（`SchoolAdapter.citationRoots`，见
      `scripts/school/types.ts` 与 `test/citations.test.ts`）。完成判据：
      `git grep -n "CitationRef\|\.citations\b" -- scripts/knowledge/` 归零（analysis
      层的 `options.citations` 是另一机制，不在扫描面）；typecheck 0 错误。
- [x] 3.2 `docs/code/knowledge.md` 两处 citations 占位描述（`:26-28` / `:87`）改为
      事实陈述（引文核对表按流派收在 SchoolAdapter.citationRoots）。完成判据：
      `git grep -n "占位" docs/code/knowledge.md` 归零。

## 4. 验证闸门（纯减法档：行为零变化）

- [x] 4.1 `npm run typecheck` → 0 错误（零消费由编译器兜底确认）。
- [x] 4.2 `node scripts/purple-star.ts selftest` → 全绿（古籍段断言组含 corpus 与
      knowledge 源行为，删除死面不得红）。
- [x] 4.3 `npm test` → 全绿（退出码直取命令本身，不接管道）。
- [x] 4.4 `npm run lint` 与 `npm run format` → 对本次改动行无新增告警 / 无待格式化。
- [x] 4.5 扩展点语义复核：`node scripts/purple-star.ts knowledge --source tianji
      --search 紫微` 行为不变（三域检索照常出结果），「新增域 = 写源 + 一行注册」
      的接缝未受影响。
