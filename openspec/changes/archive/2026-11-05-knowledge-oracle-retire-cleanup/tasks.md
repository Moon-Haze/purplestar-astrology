# 任务 · knowledge oracle 退役收尾

判据形态标记：`[退出码]` / `[计数]` / `[逐字节]` / `[反向注入]`。
基线必须**先于**任何代码改动；验收命令的退出码直接取命令本身（不接管道、不 `&&` 串接）。

## 1. 基线与取证

- [x] 1.1 取基线落盘 `/tmp/oracle-cleanup-baseline/`：`knowledge --help` 全量输出；
      三域各一条检索（`--source books --search 紫微`、`--source stars --search 紫微`、
      `--source tianji --search 紫微 --limit 3`）的 stdout 与退出码；`--topic career`
      现状取证（预期：exit 0 静默吞参的证据）。
      判据 `[退出码]`：各命令退出码符合上表取证预期；基线文件非空。

## 2. interface 面收窄

- [x] 2.1 `scripts/knowledge/types.ts`：`KnowledgeQuery` 删 `topic` / `star` 字段；头注
      docstring「四域（books/stars/tianji/oracle）」改三域口径，删「oracle 回退为
      topic/star」句。
      判据 `[计数]`：`grep -n "topic\|star" scripts/knowledge/types.ts` 仅剩无关命中
      （如 `stars` 域名）；typecheck 通过。
- [x] 2.2 `scripts/cli/knowledge/index.ts`：`decodeKnowledgeQuery` 删 topic/star 解码
      分支与裸开关守卫；新增靶向守卫——`args.topic !== undefined` 时报错并指路
      （「--topic 是 astrology 的主题论断参数；knowledge 检索用 --search 或位置参数，
      --source 选域」），走既有中文报错风格。
      判据 `[退出码]`：`knowledge --topic career` 非零退出、stderr 含指路、stdout 无
      检索结果；`knowledge --topic`（裸开关）同为非零退出。
- [x] 2.3 `scripts/cli/args/table.ts`：`--topic` 的 `cmds` 由
      `["astrology", "knowledge"]` 收为 `["astrology"]`。
      判据 `[计数]`：`knowledge --help` 的 OPTIONS 节不含 `--topic`；`astrology --help`
      的 OPTIONS 节仍含 `--topic`（astrology 侧零变化）。
- [x] 2.4 `scripts/cli/commands/command-meta.ts`：COMMAND_HELP.knowledge 删 oracle 段、
      「四域合一」改「三域合一」；:57-58 迁移注改为与实态一致（stars 已并入、oracle 已
      下线——主题论断改由 astrology 按盘现场推算）。
      判据 `[计数]`：`knowledge --help` 不含 oracle 域说明段（`grep -c "^oracle\|oracle："`
      零命中；迁移提示中的「oracle 已下线」字样保留，同 dispatch.ts:63 先例）；
      `knowledge --help` 全文不含 `--topic` 字面量；`grep -n "四域"
      scripts/cli/commands/command-meta.ts` 零命中；`COMMAND_DESC`（:82-93）不动。

## 3. selftest 钉子

- [x] 3.1 `scripts/cli/selftest/commands.ts`：「（四域）」措辞改「（三域）」；新增两条
      断言：knowledge help 不含 oracle 域说明段（`oracle：` 开头的域介绍行；迁移提示
      字样不计）、不含 `--topic` 字面量。
      判据 `[计数]`：`node scripts/purple-star.ts selftest` 全绿，项数 = 基线 + 2
      （基线项数以改动前首行自报为准，先记录）。
- [x] 3.2 反向注入：临时在 COMMAND_HELP.knowledge 加回「oracle：断语手册…」域说明段，
      3.1 新断言必须失败；还原后恢复全绿。
      判据 `[反向注入]`：注入态 selftest 非零退出且失败信息指向新断言；还原后退出码回 0。

## 4. 三件套

- [x] 4.1 `npm run typecheck`。判据 `[退出码]`：0 错误（不用 `any` / `@ts-ignore` 绕过）。
- [x] 4.2 `node scripts/purple-star.ts selftest`。判据 `[计数]`：全绿，项数与 3.1 记录
      一致。
- [x] 4.3 `ZIWEI_NO_CACHE=1 npm test`。判据 `[退出码]`：退出码 0；分层项数与基线一致
      （本 change 不新增 npm test 断言，项数不应变动）。
- [x] 4.4 三域检索输出与基线对拍：`--source books --search 紫微`、`--source stars
      --search 紫微`、`--source tianji --search 紫微 --limit 3` 的 stdout 与基线逐字节
      diff。判据 `[逐字节]`：三份 diff 均为 0 行。

## 5. 文档与收尾

- [x] 5.1 排查文档残留：`grep -rn "oracle" docs/ references/ SKILL.md`（SKILL.md:147
      已正确预期不动）；`docs/code/knowledge.md` 若描述 KnowledgeQuery 字段面或四域，
      同步为三域与新字段清单。
      判据 `[计数]`：docs/ 与 references/ 中不再有把 `--topic`/`--star` 描述为
      knowledge 参数、或把 knowledge 称为四域的活性陈述（历史沿革记录类陈述可留，
      须能从上下文辨认为「已下线」）。
- [x] 5.2 spec 折回后核对：`openspec validate --all` 零警告。判据 `[退出码]`：退出码 0。
