# Proposal

## Why

「排盘输出通过 db 数据回归验证」目前的覆盖止于**内核盘面层**（层 1 日常 300 条 + `test:corpus` 全量 518,400 条，均以 `db/dataset` 为基准源），但三处缺口真实存在：

1. **CLI `--json` 13 键产物的装配路径没有语料级对拍**——层 2 仅一条单例断言（内核直调 ≡ CLI `--json` 子进程输出）钉进程边界；`nativeSiHua` 的 stem → 四化星 → 落宫定位整条装配链，从未与 db 基准的四化真值（`palaces.sihua_stars`，即基准 `star.mutagen` 标记）逐条对过。
2. **大样本回归两档断层**——日常 300 条（约 8 秒）与全量 518,400 条（约 2.3 小时）之间没有中间档，行为漂移的发现粒度跳跃过大。
3. **文墨 SB 亮度表覆写后缺抄写审计**——层 3 学理锚点能防整表装错（83 行 × 13 列维度、日午庙/子陷等锚点），防不了**个别单元格抄错**；探索阶段实测 300 条基准：文墨 vs iztro 基准亮度分歧 19.3%（811/4200），89.7% 的盘有分歧——分歧普查可行且廉价，但没有正式工具。

## What Changes

- **新增 JSON 契约语料级回归测试**（层 1 族，进程内直调 `buildAnalyzeJson` + `generateChart`，不走 CLI 子进程 / 缓存链路）：
  - 顶层键集 === 冻结 13 键（结构断言）；
  - `.chart` 与 db 基准逐字段比对（复用 `compareChart` 全套归一化与 `KNOWN_DIVERGENCES` 白名单，把装配路径覆盖从 1 条单例扩到语料规模）；
  - `.nativeSiHua` 与基准四化标记**双向核对**（每个化曜星落在基准标了同四化的宫 ∧ 基准每个 mutagen 标记都被四化覆盖）+ `.nativeSiHua.stem === 基准农历年干`；
  - 运限层语义断言：流月/流日/流时未配置恒 null（显式 null 非缺键）；**大限层按盘派生**
    （童限未起运为 null，起运后 stem 与基准大限宫干互证——基准 palaces.stem 是外部真值；
    规划期曾误判为「未配置恒 null」，实现期探针实证起运样本非 null，语义已修正）；
    `liuNianYear` 注入固定值 + 同盘双跑逐字节一致保确定性。
  - **纯 fixtures 驱动**（charts.jsonl 已含基准 mutagen 标记），不依赖 parquet。
- **新增 parquet 中档快测入口**（双档并行）：`npm test` 保持 fixtures 管路不动；新增手动 / CI 可选命令，流式读 `db/dataset`（约 3,000 条量级）跑与层 1 同源的比对组；本机缺 `db/dataset` 或 DuckDB 依赖时**显式跳过并标注原因**（沿用 `manual:check` 的先例：独立命令、不进 `npm test`、跳过可见）。
- **新增亮度分歧普查工具**（信息级）：文墨 SB 表 vs db 基准亮度的分歧分布表（哪颗星、基准几档 → 文墨几档、多少盘命中）；**不设 pass/fail、不进任何闸门**，产出报告供审计。
- **登记面**：新测试文件同时登记 `test/README.md` 层表与 `test/lib/run.ts` 的 `LAYERS`；新工具登记 `test/README.md` 的「验证手段分工」表与文件清单。

### 不做什么

- **不改排盘内核与依赖**——文墨 SB 亮度覆写维持不动，db 亮度对拍继续跳过（2026-10 口径决定不变）；本变更不触 `scripts/` 内核任何导出，不触 `iztro` / `lunar-typescript` 版本。
- **`npm test` 不改数据管路**——fixtures 保留为日常层输入；「彻底直读 parquet、fixtures 退役」被否决（理由留档 design.md）。
- **亮度不回到 db 对拍、普查不进闸门**——「推翻文墨口径回 iztro」与「普查做成 pass/fail」均被否决（理由留档 design.md）：19.3% 分歧是预期中的学派差异，做成闸门后红灯无信号。
- **JSON 契约测试不对 patterns / 运限五层 / `liuNianPalace` / `xiaoXian` 做值比对**——db 基准无这些字段的独立真值（toolkit 为静态盘、解读库私有）；值面保障仍由层 3 预言机承担，本测试只做键集结构与 null 语义断言。
- **不新增能力 spec**——三个交付物全部落 `quality-gates` 既有能力的修订（验证基建域）。

## Capabilities

### New Capabilities

（无——三个交付物都是验证基建行为，归既有 `quality-gates` 能力，不另立门户。）

### Modified Capabilities

- `quality-gates`：
  - **新增** Requirement「JSON 契约语料级回归」（13 键冻结集 / chart 逐字段 / nativeSiHua 双向 / null 语义，纯 fixtures 驱动）；
  - **新增** Requirement「parquet 中档快测」（双档并行 / 独立命令不进日常回归 / 环境缺失可见跳过 / 与层 1 同源比对器）;
  - **新增** Requirement「亮度分歧普查」（信息级工具 / 显式不进闸门 / 口径冲突下的审计定位）;
  - **修订** Requirement「基准回归的分层与登记」——测试文件数与分层描述随新增测试文件更新；
  - **修订** Requirement「生成物漂移探针」（**顺手修订**，与 db 回归无行为关联）：该 requirement 描述超 500 字符，触发「OpenSpec 校验零警告」requirement 的当场修复义务（历史遗留警告）。修复 = 描述压缩至 400 字符（两条 SHALL 行为均在，文件名与生成器清单等例证细节**移进**对应 scenario）+ 全部 7 条 scenario 保留，语义零变化；主 spec 盘面**当场直修**（零警告闸门在归档前的检查点即须绿），change delta 的 MODIFIED 块与之同文、归档时等价替换。曾按「拆分」形态起草（MODIFIED 探针行为 + ADDED 托管清单自报），被验证器拒绝：MODIFIED 块归档时整体替换、必须含全部 scenario，强行拆分会使 2 条 scenario 归档后重复——故改为压缩描述。

## Impact

- **新增** `test/` 下一个测试文件（JSON 契约回归；文件名与层号 design 定）、`test/tools/` 下两个手动脚本（parquet 中档快测、亮度普查）。
- **修改** `test/lib/run.ts`（`LAYERS` 登记）、`test/README.md`（层表 / 验证手段分工表 / 文件清单）、`package.json`（中档快测入口 script；普查工具按 `test/tools` 惯例直接 `node` 调用或同样挂 script，design 定）。
- **修改** `openspec/specs/quality-gates/spec.md`（归档时折回上述 requirement 变更）。
- **不触** `scripts/` 内核导出、依赖版本、CLI 行为面——`test/kernel-contract.test.ts` 无协同改动。

## 验证义务申报

按三档申报：**内容扩展档**（不触排盘内核与依赖，不涉重构 diff=0）——`npm run typecheck` + `node scripts/purple-star.ts selftest` + `npm test` 三件套照跑全绿（`npm test` 行为面本身在扩，新增断言全绿是交付判据本身）；中档快测与普查工具各实跑一次并记录实测耗时；`openspec validate --all` 零警告。
