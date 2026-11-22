# Tasks

> 实施口径：只补文件级 `@file`；既有有效正文与标签保留；普通解释性注释渐进整理。
> 不批量转写注释，不清理行内注释，不修改生成物或运行时代码。

## 1. 缺口清单与基线

- [x] 1.1 枚举 `scripts/` `test/` `tools/` 下全部 `.ts`，区分已有 `@file`、已有文件头但缺 `@file`、无文件头、生成物四类；仅将两类缺口文件纳入迁移清单，显式跳过 `scripts/data/wenmo-tables.ts` 与 `scripts/corpus/data/tianji.ts`。完成判据：输出带路径和分类的清单，四类计数之和等于磁盘 TS 总数，非空且可复核。
- [x] 1.2 在修改源码前冻结 HEAD 基线，校验器以 `git show HEAD:<file>` 读取基线，并记录当前工作树中与迁移无关的改动。完成判据：任一目标文件均可读取基线；基线缺失、路径越界或工作树状态无法确认时失败，不自动带入无关改动。

## 2. 校验器与有效性证明

- [x] 2.1 在 `/tmp` 编写校验器：使用 TypeScript 扫描器剥除注释 trivia，对基线与工作区逐文件比较；输出 `expected / changed / skipped` 路径及计数，任何解析失败、空扫描、未预期变更或跳过均失败。完成判据：未改文件正向自测通过，临时修改一个代码 token 反向自测失败，恢复后通过。
- [x] 2.2 校验器覆盖 `//`、普通 `/* */`、`/** */`、行尾注释及字符串中的注释样文本，并分别抽取归一化 `.md` 指针、命令指针、测试文件指针、引文及归属做多重集对拍。完成判据：删除一个指针、一条引文或其归属时分别失败；移动或换行不能绕过检查；恢复后通过。

## 3. scripts/ 文件头

- [x] 3.1 按 1.1 清单处理 `scripts/`：已有文件头只补 `@file`，无文件头才新增文档块；保留既有正文、`@packageDocumentation`、`@throws`、`{@link}`、shebang、普通注释和注释掉的代码。完成判据：该批变更全部属于冻结清单；逐文件代码与受保护内容对拍通过，两份 TS 生成物零 diff。
- [x] 3.2 阅读本批全部新增 `@file` 及相邻文件头，核对职责描述与技术事实；运行 `npx prettier --check scripts tools test`。完成判据：新增文件头无事实错误或额外成段散文，Prettier 退出码为 0；职责无法确认的文件已还原并记录，不带疑交付。

## 4. test/ 文件头

- [x] 4.1 按同一规则处理 `test/` 缺口文件，不改测试断言、期望值来源说明、注释掉的代码或工具指令。完成判据：该批变更全部属于冻结清单；代码、指针、引文及归属对拍通过，未预期文件零 diff。
- [x] 4.2 阅读本批全部新增 `@file` 及相邻文件头，运行校验器与 `npx prettier --check scripts tools test`。完成判据：校验器与 Prettier 退出码均为 0，文件头描述准确且没有夹带解释性注释整理。

## 5. tools/ 文件头

- [x] 5.1 按同一规则处理 `tools/` 缺口文件；`tools/cli-samples.ts` 是生成器而非生成物，是否修改只取决于它是否缺少 `@file`。完成判据：该批变更全部属于冻结清单；代码与受保护内容对拍通过，`docs/cli-samples.md` 零 diff。
- [x] 5.2 阅读本批全部新增 `@file` 及相邻文件头，运行校验器与 `npx prettier --check scripts tools test`。完成判据：校验器与 Prettier 退出码均为 0，生成器与产物的分类无误，未发生额外注释改写。

## 6. 集成验收

- [x] 6.1 汇总最终覆盖清单与全部新增 `@file`，确认普通解释性注释未被批量转换、既有有效标签未被删除；若出现一句话之外的新增成段散文，暂停并还原该部分。完成判据：最终变更文件集与迁移清单一致，例外均已还原并有记录；逐文件代码和受保护内容对拍全部通过。
- [x] 6.2 依次独立运行 `npm run typecheck`、`node scripts/purple-star.ts selftest`、`npm test`、`npm run lint`、`npx prettier --check scripts tools test`，直接读取各命令退出码，不用管道或 `&&` 串接。完成判据：五项均退出 0，selftest 与 npm test 自报全绿，Prettier 仅检查未写盘。
- [x] 6.3 运行 `npx --no-install openspec validate --all --strict`。完成判据：全部通过、零警告；proposal、design、tasks 与 spec delta 对实施范围的描述一致。

## 7. 符号级文档注释（用户追加范围：139 个导出符号 · 31 文件）

> 口径：紧邻符号上方一句话说明「是什么」；导出函数加 `@param <名> - <说明>` 与 `@returns`；
> 只写可从实现或既有注释确认的事实；生成物 `wenmo-tables.ts` / `tianji.ts` 跳过。
> 判据统一为：该批符号文档覆盖率 100%、`npx prettier --check` 退出 0、保真校验通过。

- [x] 7.1 `scripts/analysis/`（22 个：`data.ts` 19 + `grades.ts` 3）补符号文档；完成判据：该目录无文档导出符号数 = 0，抽读注释与实现一致。
- [x] 7.2 `scripts/` 侧重（boot-hooks 4 + cli 3）补符号文档；完成判据：同上，描述与实现一致。
- [x] 7.3 `scripts/` 插件层（corpus / patterns，10 个）补符号文档，跳过 `corpus/data/tianji.ts`；完成判据：同上且该生成物零 diff。
- [x] 7.4 `scripts/` 内核根生成物复核：`data/wenmo-tables.ts` 与 `corpus/data/tianji.ts` 保持零 diff（生成物豁免）。完成判据：两文件 `git diff` 为空。
- [x] 7.5 `test/lib/`（16 个）补符号文档；完成判据：同上，测试辅助函数描述与其实际前置条件一致。
- [x] 7.6 `tools/db/`（86 个）补符号文档；完成判据：同上，SQL 常量与函数描述不臆测行为。
- [x] 7.7 `tools/` 其余 2 个（`cli-samples.ts` 的 SAMPLES、`long-comment-check.ts` 的 LongCommentHit）补符号文档；完成判据：同上。
- [x] 7.8 全量复核：重新统计导出符号文档覆盖率 = 100%（生成物除外），抽读跨批 10 个文件核对事实准确性；运行 `npm run typecheck`、`node scripts/purple-star.ts selftest`、`npm test`、`npm run lint`、`npx prettier --check scripts tools test` 均退出 0。完成判据：五项全绿且覆盖率统计为 0 缺口。

## Workflow follow-up

- archive 前由用户确认提交口径；本任务清单不自动 commit。
- 使用 `openspec-archive-change` 折回主规范后，重跑 `npx --no-install openspec validate --all --strict`。
