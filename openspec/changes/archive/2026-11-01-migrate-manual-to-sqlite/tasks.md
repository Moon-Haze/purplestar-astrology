# Tasks

## 1. 甄别准备与共享件

- [x] 1.1 以 /tmp 一次性脚本对当前样本库导出**全主题 extras 节名分布清单**（行数 + 样例行），
      按「第二人称 / 按盘枚举」特征逐节定案黑名单增补集（至少含「针对你的命盘」「四化路径 ·
      你这盘」）。判据：清单落 /tmp 并在 change 内留定案结论；脚本跑完即删（一次性任务不进
      tools/）。
- [x] 1.2 引文比对核心下沉：从 `test/lib/citation-guard.ts` 提取比对逻辑至 test 与建库工具
      可共同引用的单一处（候选 `scripts/corpus/` 下，不触排盘内核），test 侧改为引用，**零断言
      删改、零副本**。判据：`npx tsx test/lib/run.ts` 引文层全绿且断言数与迁移前一致；
      `grep -rn "annotation" test/ tools/` 无第二份比对实现。
- [x] 1.3 新增 `.gitattributes`：`*.db binary`。判据：`git check-attr binary -- \
      scripts/corpus/data/manual/oracle.db` 输出 binary: set。

## 2. 建库管线与库产物

- [x] 2.1 `tools/db/export-manual.ts` 新增 `db` 子命令：规范化建表（topics / stars / texts /
      lines / patterns / sihua，design D1）+ 固定插入序 + `PRAGMA page_size` 固定、
      `journal_mode=OFF`、`synchronous=OFF`、收尾 `VACUUM`；入库走参数绑定。判据：
      `npx tsx tools/db/export-manual.ts db` 产出 `scripts/corpus/data/manual/oracle.db`；
      连续重建两次 `sha256sum` 一致。
- [x] 2.2 建库期引文校验挂载：每行入库前过 1.2 的共享比对核心，核对表外引文形态非零退出。
      判据：以 /tmp 临时手段注入一条核对表外「倪师说+引号句」行（验证后即删），建库报错并
      指出台账缺项；移除后建库成功。
- [x] 2.3 黑名单增补落地（1.1 定案集进 `DYNAMIC_SECTION_RE`），重建库。判据：sqlite 查询
      sections 值域不含「针对你的命盘」「四化路径」「风险提醒」编码（实测 46 节名零残留）；
      库体积回落至 40 MB 量级（实测 41.6 MB，规划期预估按实况修正）；docs/manual md 同步
      重导后 diff 仅黑名单节内容消失（随切换前全量重导统一验证）。
- [x] 2.4 study 别名视图：库内 topics 只收 13 实体主题（`STORAGE_TOPIC_KEYS`），无 study 行。
      判据：sqlite 查询 topics 表无 `study`；组装层映射后 `study` 与 `career` 同星检索输出
      逐字一致。

## 3. 运行时通道切换（原子）

- [x] 3.1 **先取基线**：当前 TS 形态下三形态输出（裸列 / `--topic career` 概览 /
      `--topic career --star 七杀` 单星展开）各存 /tmp 基线。随后改造
      `corpus/data/manual/index.ts`：`loadTopicOracle` 改为 `DatabaseSync` readonly 模块级
      单例 + 参数绑定三查询 + 组装函数重建 `OracleStar`（design D4）；库路径经 `ctx.root`
      定位（不写上溯层级）；库缺失抛带重建指引的错误。`types.ts` 转正（删生成头注释，契约
      不变）。判据：三形态输出与基线**逐字节 diff=0**；`ZIWEI_NO_CACHE=1` 下
      `node scripts/purple-star.ts knowledge --source oracle --topic health --star 七杀`
      正常返回且 stderr 无 SQL 错误。
- [x] 3.2 删除 13 个主题 TS 生成文件与 `export-manual.ts` 的 `code` 模式及其渲染函数；排查
      三类字符串：`index.ts` 的 `LOADERS` 动态 import 字面量全清、无残留 `@/corpus/data/manual/
      <主题>` 引用、库文件定位无 `ROOT/../..` 上溯。判据：`du -sh
      scripts/corpus/data/manual/` 只剩 oracle.db + types.ts + index.ts +
      combo-frequency.ts；`npx tsc --noEmit` 0 错误（无悬空引用）。
- [x] 3.3 oracle 断言面重锚：`test/cli.test.ts` 与 `scripts/cli/selftest/` 中锚定 v4 TS 实态
      的结构断言改读库组装结果（锚「行为 + 独立路径期望值」，不复抄库内容）。判据：
      `ZIWEI_NO_CACHE=1 node scripts/purple-star.ts selftest` 排盘/古籍/合盘三段全绿，首行
      自报合计数与报告一致（文档不残留旧数）。

## 4. 守卫迁移

- [x] 4.1 `test/invariants.test.ts` 键域互证改读库：主星键集 = 内核星表（`data/stars.ts`）；
      `san_fang:<宫名>` 的宫名域与运行时宫名域互证。判据：`ZIWEI_NO_CACHE=1 npm test`
      invariants 层全绿；超域键仍会被报出（临时注入验证或代码审查留痕，验证手段不入库）。
- [x] 4.2 `test/citations.test.ts` 新增「从 oracle.db 抽取全部行文本」扫描组，跑 1.2 共享比对
      核心；原有 `.ts` 扫描组不动。判据：引文层全绿，抽取组对库内全部断语行完成比对
      （条数自报）；库中零未登记引文。
- [x] 4.3 `export-manual --check` 探针改双通道对拍：md 产物逐字 + `oracle.db` sha256
      （design D2）；`npm run manual:check` 命令名与挂载面不变。判据：人为制造差异（改库内
      一行后不重导）探针非零退出并指认漂移；重导后零退出；模拟缺 db/dataset 时输出 ⏭ 跳过
      标注；`npm test` 不触发重导对拍（时长不受拖累）。

## 5. 文档与分发面同步

- [x] 5.1 `AGENTS.md` 同步：`corpus/` 数据流描述（manual 形态 = oracle.db 库）、zip 体积
      表述改「实跑自报」口径、「生成文件不手改」清单增 `oracle.db`、维护链补「改内核 →
      build:db → 重建库」。判据：全文 grep 无「13 个主题 TS 生成文件」「约 1.2 MB」旧口径
      残留。
- [x] 5.2 漂移注释修正：`tools/pack.ts`（「overview.ts 约 500 KB」→ oracle.db 实况）、
      `scripts/knowledge/sources/oracle.ts`（「4.4MB 分类断语」→ 库形态）、其余 grep
      `data/manual` 命中处。判据：`grep -rn "data/manual" scripts/ tools/` 命中的注释与
      库形态一致。
- [x] 5.3 `SKILL.md` 与 `references/`（knowledge 域、output-contract、troubleshooting 中提及
      断语手册数据形态 / oracle 检索行为处）同步。判据：`selftest` 的 SKILL.md↔references
      双向一致断言与参数面断言全绿；SKILL.md 所述 oracle 行为与 3.1 实跑一致。
- [x] 5.4 README / `docs/user-guide/` / `docs/code/` 涉 manual 数据形态与 zip 体积处同步。
      判据：`grep -rn "corpus/data/manual\|断语手册" README.md docs/` 命中处与实态一致。

## 6. 终验

- [x] 6.1 三件套按序全绿（退出码直取，不接管道）：`ZIWEI_NO_CACHE=1 node
      scripts/purple-star.ts selftest` → `ZIWEI_NO_CACHE=1 npm test` → `npx tsc --noEmit`。
      判据：三者退出码均 0；npm test 计数自报与报告一致（含新增库抽取扫描组）。
- [x] 6.2 `npm run manual:check` 零退出（库 + md 均与当前内核/工具一致）。判据：退出码 0，
      输出一行确认。
- [x] 6.3 `npm run pack`：zip 体积记录进 AGENTS.md（实跑值）；解压自检全绿且分发态跳过
      标注可见（⏭）；另用 `unzip -t` 交叉验；分发包内直接跑
      `knowledge --source oracle --topic career --star 七杀` 可用。判据：pack 退出码 0、
      selftest 分发态全绿、`unzip -t` OK。
- [x] 6.4 工作区清点：oracle.db 已纳管（非 .gitignore 误伤）、无 /tmp 验证残留入库、
      `git status` 变更面与 design Migration Plan 步骤一一对应。判据：`git status --short`
      清单可逐条对应本 change 任务，无计划外文件。

## Workflow follow-up

- 评审通过后 archive：折回 specs（manual-store 新建 + 两处 MODIFIED）、
  `openspec validate --all` 零警告、AGENTS.md「项目约束」节若受影响先同步、
  一个逻辑变更一个 commit 一并提交。
- git 历史清理（filter-repo / LFS，处置 394 MiB pack 中的历史大 blob）为**独立后续决策**，
  不入本 change。
