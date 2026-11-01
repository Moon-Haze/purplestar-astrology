# Tasks

## 1. 运行时与数据面删除

- [x] 1.1 删除 `scripts/knowledge/sources/oracle.ts`，`knowledge/registry.ts` 去注册行并
      同步头注释。判据：`npx tsc --noEmit` 0 错误；`node scripts/purple-star.ts knowledge
      --source oracle` 报「未知 source」并指向最接近合法值；三域（books/stars/tianji）检索正常。
- [x] 1.2 删除 `scripts/corpus/data/manual/` 整目录（oracle.db / index.ts / types.ts）。
      判据：目录不存在；typecheck 0（1.1 已断开引用）。
- [x] 1.3 `tools/db/export-manual.ts`：删 `topics` / `db` 子命令与 `exportTopics` /
      `collectTopic` / `exportDb` / 库对拍通道（collectedDb / ORACLE_DB_PATH /
      SAMPLES_OUT / ShardRow / ShardChart），`--check` 回退纯 md 对拍；头注释同步。
      判据：typecheck 0；`npx tsx tools/db/export-manual.ts all` 只产 combo/geju；
      `npm run manual:check` 零退出（md 通道）。
- [x] 1.4 `tools/db/generate-shards.ts` 删 `items` 结构化字段（含 getTopicAnalysisItems
      import），回退纯文本直出；`getTopicAnalysisItems` 与 `scripts/analysis/items.ts`
      评估消费方——无外部消费则一并删除（`formatItems` 随 views 内部使用保留或删除按
      实际引用定）。判据：typecheck 0；`grep -rn "getTopicAnalysisItems\|AnalysisItem"
      scripts/ tools/` 无悬空引用；小样本直出（单年）行键不含 `items`。
- [x] 1.5 删除 `samples-out/` 直出产物（磁盘约 1GB，再生 artifacts，gitignore 内）。
      判据：目录不存在；`git status` 无变化（本就被忽略）。

## 2. 断言面与文档

- [x] 2.1 `test/citations.test.ts` 删库抽取扫描组与 DB_BODIES 抽取（`.ts` / `.md` 组保留）；
      `test/invariants.test.ts` 删 san-fang 宫名域断言、键集互证去 manual 项与
      MANUAL_INDEX 加载。判据：typecheck 0；`npm test` 全绿（计数自报回落）。
- [x] 2.2 `test/cli.test.ts` 与 `scripts/cli/selftest/` 删 oracle 断言（数据源可用性、
      单星展开结构等）。判据：`ZIWEI_NO_CACHE=1 node scripts/purple-star.ts selftest`
      全绿（首行自报数变化、无 ⏭）；`ZIWEI_NO_CACHE=1 npm test` 全绿。
- [x] 2.3 文档同步：`SKILL.md`（knowledge 四域→三域、oracle 描述删）、`references/`
      （output-contract / troubleshooting 涉 oracle 处）、`AGENTS.md`（corpus 数据流、
      引文纪律库描述、生成物清单、knowledge 命令行）、`docs/code/knowledge.md`、
      `docs/manual/README.md`（重写为格局基线与频率表说明，删断语手册与 db 模式节）。
      判据：`grep -rn "oracle\|断语手册" SKILL.md references/ AGENTS.md docs/` 无失效描述；
      selftest 的 SKILL.md↔references 双向一致断言全绿。
- [x] 2.4 specs 主干同步预检：确认 knowledge-retrieval / quality-gates / manual-store 的
      delta 与主 spec 现状锚定（structure-analysis-outputs 未归档，其 delta 与本 change
      的归档顺序在 Workflow follow-up 交代）。判据：`openspec validate --all` 通过。

## 3. 终验

- [x] 3.1 三件套：`npx tsc --noEmit` 0 错误 → `ZIWEI_NO_CACHE=1 node
      scripts/purple-star.ts selftest` 全绿 → `ZIWEI_NO_CACHE=1 npm test` 全绿
      （退出码直取）。判据：三者退出码 0。
- [x] 3.2 `npm run manual:check` 零退出（md 通道：combo/geju）；`npm run pack` +
      `unzip -t` + 分发态三域检索正常。判据：退出码 0；包内无 oracle.db / manual 目录。
- [x] 3.3 工作区清点：`git status` 变更面与本 change 任务一一对应、无 /tmp 残留、
      `openspec validate --all` 零警告。判据：validate 退出码 0 且无 WARNING。

## Workflow follow-up

- **归档顺序**：`structure-analysis-outputs` 与本 change 均含 quality-gates delta——
  先归档 structure（其探针 delta 描述库通道），再归档本 change（回退该通道），顺序颠倒
  会导致 MODIFIED 锚定失配；或评审后合并处置（弃 structure 归档、以本 change 为准折回）。
- 归档后 `openspec validate --all` 复验零警告；一个逻辑变更一个 commit（commit 需在用户
  终端执行——Mimosa 拦本会话 Bash hook）。
- git 历史清理为独立后续决策。
