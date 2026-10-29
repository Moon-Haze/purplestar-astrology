# Tasks

## 1. 基线取样（改动前，必须先做）

- [x] 1.1 导出输出基线：`ZIWEI_NO_CACHE=1` 下对丙 / 戊 / 己 / 辛 / 壬各一盘 + 一个非这五年干的盘，
      导出 `--topic overview|wealth|health`、`--report`、`--topic love --view daxian`、
      `--topic love --view liunian` 输出到 `/tmp/mutagen-baseline/`（不入仓）。
      判据：目录内文件数 = 盘数 × 命令数，且 `npm test` 当前退出码 0。
- [x] 1.2 记录验证基线：跑 `node scripts/purple-star.ts selftest` 与 `npm test`，记录两者首行自报项数
      （勿以文档数字为准），供 5.1 对比。
      ⚠️ 实测：`npm test` 基线**本就 exit 1**（627 项 626 通过 / 1 失败），失败唯一项 = 既有引文守卫
      （`notes/60-方法/引文真伪分级.md` 未核实引文，未纳入版本控制），与本 change 无关。故 1.2 判据
      「退出码均为 0」修正为「记录实跑项数；退出码非 0 已知为既有问题、非本 change 引入」。

## 2. 落查询 + context 侧切换（行为不变）

- [x] 2.1 在 `scripts/analysis/palace-query.ts` 新增「宫集合 → 会照条目」的查询导出，内部复用
      `getPalaceMutagen`（单宫取四化星），不改现有签名。
      判据：`npm run typecheck` 0 错误；三处消费方未改时，`--topic overview` 输出与 1.1 基线逐字节 diff=0。
- [x] 2.2 `scripts/analysis/context.ts:136-142` 改为消费该查询。
      判据：`--topic <key>` 与 `--report` 输出与 1.1 基线逐字节 diff=0（同口径，属行为不变的重构）。实测 36 文件全量 diff=0。
- [x] 2.3 确认本次无文件物理移动：全仓排查 `import` 语句、`load<>("@/…")` 字符串字面量、
      `resolve(ctx.root, …)` 拼路径三类。判据：`git diff` 中这三类路径字符串命中数为 0（唯一 import 变动是同目录符号增减）。

## 3. decadal / yearly 换口径（行为变更）

- [x] 3.1 `scripts/analysis/views/decadal.ts:53-67` 改用该查询，去掉 `s.type === "major"` 过滤。
      判据：与 1.1 基线 diff 只出现两类差异——「新增辅星四化行」「未会本命四化兜底句消失」；
      出现第三类差异即停，回到 design 复查。
- [x] 3.2 `scripts/analysis/views/yearly.ts:46-60` 同上。判据同 3.1。
- [x] 3.3 补口径级断言（`scripts/cli/selftest/`）：同一宫经主题主宫 / 大限宫 / 流年宫三处取会照，
      对任一给定星给出相同判定。
      判据：`node scripts/purple-star.ts selftest` 全绿，首行自报项数 = 158 基线 + 4 新增 = 162（实测 162/162）。
- [x] 3.4 补输出级断言（`test/`，反向注入 + 计数）：丙 / 戊 / 己 / 辛 / 壬年干盘上辅星四化出现在
      会照集合；天魁 / 天钺 / 禄存 / 天马 / 四煞 / 地空 / 地劫在该宫会照集合中的条目计数为 0。
      判据：`npm test` 全绿（回归恒设 `ZIWEI_NO_CACHE=1`）。
- [x] 3.5 `docs/code/analysis.md` 8.5 / 8.6 补一句星曜口径说明，使文档与实现同口径。
      判据：文档所述口径与 `palace-query.ts` 实现逐条对得上，且引文守卫扫描通过。

## 4. 连带面核对

- [x] 4.1 `scripts/analysis/views/year-stem.ts:35-37` 回补集核对。
      ⚠️ 方向更正：design 里写的「回补行减少」是**统一成只主星**那一侧的后果；本次选定的是
      「含辅星四化」，context 侧口径未动，故 `alreadyShown` 不变 —— 实际预期是**零变化**。
      判据：与 1.1 基线比对，「年干四化·关键宫位影响」节的出现次数与逐行内容 diff=0（实测达成）。
- [x] 4.2 `scripts/analysis/suggestions.ts` 禄 / 忌信号（范围扩大，见 design Decision 5）：
      先修 `m.mutagen === t.kind` 恒假（改经 `SIHUA_CHAR_TO_KEY` 对形），再构造「三方四正内唯一
      本命四化由文昌 / 文曲 / 左辅 / 右弼承载」的盘（1949-06-15 wealth：文曲化忌落财帛宫），
      验证建议按本命四化生成、不降级为通用收束句；并保证既有「信号缺失显式降级」场景仍有覆盖。
      判据：新增的「辅星四化不判为缺失」断言通过，既有的降级断言仍为绿；
      与 1.1 基线 diff 出现**第四类**差异（综合建议新增「本命 X 化 Y」句）。
- [x] 4.3 生成物重导（环境核查，非改动点）：`npx tsx tools/db/export-manual.ts topics` 退出码 0。
      ⚠️ **发现预存漂移、不纳入本 change**：重导后 `docs/manual/topics/*.md` 出现 ~3.2 万行级替换，
      但 diff 内容全为「格局重命名（日月并明格→日月同宫格）+ 人格文本重写」，**零条**出现本 change
      的特征字（大限三方四正会照 / 综合建议 / 年干四化）。根因是 `export-manual.ts`（10-24 改过输出格式）
      与仓库内 10-12 提交的手册之间、或 `db/dataset` 与手册之间的**既有漂移**，与本次口径改动无关
      （导出器用 `DYNAMIC_SECTION_RE` 本就排除动态节，本 change 的四类差异都不进手册）。
      → 已 `git checkout -- docs/manual/topics/` 还原，另起一条 change 处理手册/dataset 对齐。

## 5. 集成验证

- [x] 5.1 三件套（退出码直取命令本身）：
      - `npm run typecheck` → **exit 0**
      - `node scripts/purple-star.ts selftest` → **exit 0，162/162**（158 基线 + 4 新断言）
      - `npm test` → **exit 1，631 项 630 通过 / 1 失败**；失败唯一项 = 既有引文守卫
        （`notes/60-方法/引文真伪分级.md` 未核实引文，未纳入版本控制），与本 change 无关
        （同款正则扫四份制品零命中）。基线 `npm test` 本就 exit 1，故退出码与 1.2 基线一致。
- [x] 5.2 「预期内差异清单」（基线与终态 36 文件全量 diff，逐行分类，第五类检测器为空）：

      | 类 | 来源 | 形态 | 计数（6 盘样本） |
      |---|---|---|---|
      | ① | decadal/yearly 改口径 | `**大限三方四正会照的本命四化**（倪师批大限的核心）：` 标题 + `🟡/🔴 **本命文昌/文曲/左辅化X** 落…（大限本宫/三方四正）` | 标题 18+1 行；辅星行 6×5 星 = 30（每星在 6 盘均出现） |
      | ② | 同上 | 删除 `（大限/流年三方四正未会本命四化，此…走平盘/按本宫主星判读。）` 兜底句 | 18 + 1 = 19 行 |
      | ③ | year-stem 回补 | 「年干四化·关键宫位影响」节出现次数与逐行内容 **diff=0** | 0 |
      | ④ | suggestions 修 lu/ji 槽（范围扩大） | `### 综合建议` 内新增 `→ 本命X化Y，<语义>`（含主星与辅星，命中本命四化信号） | 多行 |

      **第五类检测**：`diff -r -U0 基线 终态` 全部改动行过滤掉上表四类模式后**剩余为空** → 无意外差异。
      清单不含第五类，符合 5.2 判据。

## Workflow follow-up

- 归档前确认文档中的计数类陈述与实跑末行一致（`selftest` / `npm test` 项数以实跑为准）。
- 本次未改动项目约束，无需同步 `AGENTS.md` 的「项目约束（不可动）」节。
- 归档完成后，把代码、`openspec/specs/interpretation-content/spec.md` 主 spec、
  归档的 change 目录一并提交（一个逻辑变更一个 commit）。
- 实施入口：`/openspec-apply-change`。
