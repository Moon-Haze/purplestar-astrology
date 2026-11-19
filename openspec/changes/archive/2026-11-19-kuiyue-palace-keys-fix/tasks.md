# Tasks

## 1. 守卫先红（活体证明）

- [x] 1.1 `test/invariants.test.ts`「宫名键域：三张分析表的每个宫名键都在
      PALACE_NAMES_ORDER 域内」：循环加第四张表 `KUI_YUE_GUIREN_MAP`（逐键
      `domain.has`，`bad.push` 报错带表名前缀），测试名「三张」改「四张」。
      完成判据：`ZIWEI_NO_CACHE=1 npm test` → invariants 当场红，
      报出 `兄弟 / 夫妻 / 子女 / 财帛 / 疾厄 / 迁移 / 仆役 / 官禄 / 田宅 / 福德 /
      父母` 全部超域键（`命宫` 不报）——期望值来自独立路径，先红是活体证明。
- [x] 1.2 「宫名键域：内容键表 12 宫齐、每颗次星 12 宫齐」：加
      `KUI_YUE_GUIREN_MAP` 键数对拍 `PALACE_NAMES_ORDER.length` 的完备性断言。
      完成判据：同上 npm test 仍红（改键前键数本就 12，此项绿——绿是预期，
      它防的是未来缩表）。

## 2. 改键（红转绿）

- [x] 2.1 `scripts/analysis/data.ts:2687-2706` 十二键按 design 决策 1 的映射表改
      展开形（`兄弟`→`兄弟宫` … `仆役`→`交友宫`、`官禄`→`官禄宫`；`命宫` 不变），
      **kui / yue 断语逐字不动**；表 docstring 补一行键域口径
      （「键为 PALACE_NAMES_ORDER 展开形，invariants 互证」）。完成判据：
      `ZIWEI_NO_CACHE=1 npm test` → invariants 全绿（1.1 的超域键清零）。
- [x] 2.2 断语逐字性复核：`git diff scripts/analysis/data.ts` 只含键名行与 docstring，
      断语字符串零改动（逐行目检 diff，出现任何断语文本行即违规）。

## 3. 三件套与行为验收（内容扩展档）

- [x] 3.1 `npm run typecheck` → 0 错误。
- [x] 3.2 `node scripts/purple-star.ts selftest` → 全绿（退出码直取命令本身）。
- [x] 3.3 `ZIWEI_NO_CACHE=1 npm test` → 全绿（含排盘基准 300 条对拍不变）。
- [x] 3.4 行为验收：挑一张天魁落迁移宫（或任一非命宫）的盘跑
      `node scripts/purple-star.ts astrology --date … --topic overview`，改前
      「贵人倾向·魁钺细分」段为空、改后出内容，文案与表逐字一致；再跑一张天魁
      落命宫的盘确认原文案不变。完成判据：两盘输出符合预期并留存对照记录。

## 4. 生成物与风格收尾

- [x] 4.1 `npm run cli-samples` 重导 `docs/cli-samples.md`；diff 仅预期条目
      （DEMO 盘天魁 / 天钺落宫若命中新分支则现新文案；落命宫则 diff = 0）——
      按实况记录，禁止手改产物。
- [x] 4.2 `npm run lint` 与 `npm run format` → 对本次改动行无新增告警 / 无待格式化。

## 5. 折回与归档前置

- [x] 5.1 实现完成后确认 spec delta 与实态一致（守卫覆盖四张表 + 完备性断言 +
      键集条款已去手册残留措辞），`openspec validate --all` 零警告后按 archive
      流程折回 `openspec/specs/quality-gates/spec.md`。
- [x] 5.2 归档前核对：AGENTS.md「键域口径」节的表清单若点名具体表名，确认与
      守卫实态一致；若 AGENTS.md 需补魁钺表点名，随 archive 提交一并落（单一
      真相源同步）。
