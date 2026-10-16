# Tasks

## 1. Delta 语义完整性核对

- [x] 1.1 逐条比对拆分前后的 SHALL 条款与 scenario：以
  `openspec show chart-casting --type spec` 的现行需求文本为左值、本变更
  `specs/chart-casting/spec.md` 为右值，确认每个 SHALL 动词条款（经度校正 /
  `--eot` / 出生地回退 / DST 回拨 / `--no-dst` / 起止真相源 / 边界口径 /
  输出说明项 / `--branch` 豁免 / 跨午夜取时轴）在 delta 中都有着落且措辞未放宽；
  完成判据：MODIFIED 块场景数 = 现行 9、两条 ADDED 的六个场景与现行场景
  逐字一致（复述零改写），核对结论记一句工作笔记。
  （2026-10-16 核对：脚本逐字比对 MODIFIED 9 场景 + ADDED 6 场景全部与主 spec
  一致；SHALL 十项全部着落——校正/默认口径/`--eot`/出生地在 MODIFIED，
  回拨/`--no-dst`/IANA 真相源/输出说明项/`--branch` 在 DST 需求，
  跨午夜取时轴在跨午夜需求；边界口径压缩为「02:00 为界 + 保守按拨回前」，
  语义由「边界时刻」scenario 的 01:59/02:00 逐时刻钉锚定。）
- [x] 1.2 结构校验：`openspec validate split-truesolar-requirement` 通过
  （exit 0、无 ERROR）；`openspec status --change split-truesolar-requirement`
  四工件全 done。（2026-10-16 实跑：valid + 4/4。）
- [x] 1.3 零代码改动确认：`git status --short` 中除 `openspec/` 外无任何变更；
  由此本变更**不跑** selftest / npm test / typecheck（无代码路径可影响），
  该不跑本身是核对结论，须在工作笔记记一句。
  （2026-10-16 实跑：工作区仅 `?? openspec/changes/split-truesolar-requirement/`
  一项，无任何代码/测试/文档变更，回归三件套无对象，不跑成立。）

## 2. 归档折回核查

- [x] 2.1 折回后抽查主 spec：
  `openspec show chart-casting --type spec` 输出含「中国夏令时自动回拨」
  「校正后跨午夜改期」两条新需求及各自场景，且「真太阳时校正与跨午夜改期」
  需求的 9 个场景一个不少（整块替换不丢场景）。
  （2026-10-16 实跑：新需求各带 5/1 场景在位；原需求 9 场景全数保留。）
- [x] 2.2 警告清零达标：`openspec validate --all` 输出 7 项全过且
  **无任何 WARNING 行**（本变更的立项动机即此）；同时确认没有别的需求
  被 500 字符阈值新点亮。
  （2026-10-16 实跑：`Totals: 7 passed, 0 failed`，grep WARNING/⚠/✗ 零命中。）

## Workflow follow-up

- 归档：`openspec archive split-truesolar-requirement`（折回主 spec）；
  归档前确认 `docs/` 与 `AGENTS.md` 没有把「真太阳时校正与跨午夜改期」
  当单一需求引用的文案需要同步（侦察结论：全仓仅主 spec 一处该标题引用）。
- 提交：折回与归档一次 commit，message 注明「规范重组，零代码」。
- 可选核查（不在本变更范围，发现异常另立变更）：其余六个 capability 的
  归档 delta ↔ 主 spec 全量 scenario 比对，确认无第二处折回丢失。
