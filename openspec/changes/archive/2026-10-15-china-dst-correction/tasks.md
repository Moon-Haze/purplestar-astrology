# Tasks: 1986–91 中国夏令时自动校正

- [x] 1. `scripts/cli/birth/birth-info.ts`：DST 六年表 + `isChinaDstClock` 判定 +
  `calcTrueSolar` 的 `dstMinutes` 选项与返回字段 + 调用点接线（`--no-dst` 读取、
  note 拼装含「夏令时 −60 分」项）
  - 完成判据：直调探针——`isChinaDstClock(1988,7,1,590) === true`、
    `(1990,1,7,*) === false`、`(1992,7,1,*) === false`、起始日 01:59 false / 02:00 true、
    结束日 01:59 true / 02:00 false；`calcTrueSolar` 不传 dstMinutes 的输出与改前
    逐字节一致
- [x] 2. args 表注册 `--no-dst`（出生时辰组，switch / noIntent，cmds 与 time 对齐）
  + `command-meta.ts` 帮助文案（time 条目附近说明夏令时与 `--no-dst`）
  - 完成判据：`astrology --help` 出现 `--no-dst`；拼 `--dst` 报未知参数并指向
    `--no-dst`；非 DST 日期加 `--no-dst` 排盘输出与不加逐字一致
- [x] 3. `test/cli.test.ts`：既有 DST 区间 `--time` 用例追加 `--no-dst`（语义保持）
  + 新增「夏令时自动回拨」describe（区间内默认回拨且与 `--branch` 手输等价、
  区间外零影响、`--no-dst` 复原、边界时刻两侧、`--branch` 不判定）
  - 完成判据：`npm test` 层 2（CLI 端到端）全绿；新增用例数自报进总数
- [x] 4. `scripts/cli/selftest/calc.ts` 加 `isChinaDstClock` 断言组
  （六年起止各取样 + 首尾年外 + 边界时刻 + 1992 后）
  - 完成判据：`node scripts/purple-star.ts selftest` 排盘段全绿、新断言计入
    自报计数
- [x] 5. `tools/cli-samples.ts` 加样例（1988 区间内一条 + `--no-dst` 对照一条）
  + 再生 `docs/cli-samples.md`
  - 完成判据：`npx tsx tools/cli-samples.ts` 全绿（57 → 59）
- [x] 6. 全量闸门（内核变更口径）
  - 完成判据：`node scripts/purple-star.ts selftest` 全绿（ZIWEI_NO_CACHE=1）；
    `npm test` 全绿；`npm run typecheck` 通过；`npx prettier --check` 改动文件全过
- [x] 7. 归档
  - 完成判据：`openspec archive china-dst-correction` 后 `openspec validate --all`
    全绿；主 spec 的真太阳时 Requirement 含 DST 表与边界口径
