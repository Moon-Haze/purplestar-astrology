# Tasks

## 1. 基线先行

- [x] 1.1 改动前取基线：固定样例盘的 `--topic` 13 主题与 `--report` 输出落档，标注各主题「综合建议」小节现状（静态三条）；判据：基线可复跑复现

## 2. 推算单点（D1 + D2 + D4）

- [x] 2.1 新增 `analysis/suggestions.ts` 推算单点：输入 `AnalysisContext` + topic，输出结构化建议条目（句子 + 依据信号标注），实现最小信号集（主宫主星及亮度 / 主题三方内本命四化 / 大限落宫与主题宫关系）与槽位模板填充；判据：`npm run typecheck` 0 错误，单点纯函数、零渲染逻辑
- [x] 2.2 每主题模板句 + 降级收束句文案入 `data.ts`（静态表退位为模板承载），降级条目带「无命中信号」标注；判据：13 主题 ×（2–3 模板句 + 1 降级句）登记齐、条目可数；不含「倪师 + 引号句」形态或已按引文纪律登记（`test/citations.test.ts` 全绿）
- [x] 2.3 推算单点断言：同盘同参数双跑逐字节 diff=0；主星 / 四化 / 大限不同的两盘同一主题建议至少一处提及不同；空宫借星盘降级句出现且无编造信号；判据：三条断言全绿并按新增测试文件登记 `test/README.md` 层表与 `test/lib/run.ts` 的 `LAYERS`

## 3. 渲染接入（两端同源）

- [x] 3.1 `getTopicReport` 的综合建议小节改为消费推算单点（`--topic` 与 `--report` 共用路径，「继续深度追问」交互尾巴机制不变）；判据：两端同盘同主题建议内容一致，其余小节与 1.1 基线 diff=0
- [x] 3.2 实测盘复核：`--report` 13 板块建议不再出现「重点关注三方四正的星曜组合与本命四化会照」类通用句（子串计数 0），建议提及的星 / 化 / 宫均可在该盘数据中指回；判据：`--report` 与 `--topic` 输出 grep 验证

## 4. 生成物与文档同步

- [x] 4.1 cli-samples 生成器口径同步并重导 `tools/samples/` 与 `docs/cli-samples.md`（改生成器 + 重导，禁止手改产物）；判据：重导后 `git diff` 逐块核对仅建议小节变化，直调与子进程 diff=0 守卫全绿
- [x] 4.2 `references/output-contract.md` 与 `docs/code/analysis.md` 的综合建议描述同步（按盘推算、降级显式、信号集口径）；判据：`npx prettier --check` 通过、selftest `SKILL.md` ↔ `references/` 一致断言全绿

## 5. 全量验证

- [x] 5.1 `npm run typecheck` 0 错误 + `node scripts/purple-star.ts selftest` 全绿 + `npm run lint` / `npx prettier --check` 改动行无告警
- [x] 5.2 终样复核：`--topic` 与 `--report` 的 13 主题建议全部可指回盘面信号、同盘双跑 diff=0、降级条目可数；与 1.1 基线对照变化仅建议小节

## Workflow follow-up

- 评审通过后 `openspec validate --all` 零警告 → `/opsx:apply` 实现 → archive 折回 `interpretation-content`。
- archive 后核对 `openspec/specs/interpretation-content/spec.md` 含三条需求（性别 / 条件分支 / 综合建议）。
