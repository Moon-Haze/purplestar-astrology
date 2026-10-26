# Tasks

## 1. 基线先行

- [x] 1.1 改动前取基线：固定样例盘（1990-05-15 男与 2000-04-06 盘）的 `--report` 全文、`--topic overview` / `--topic personality` 输出落档 `/tmp`；记录三处分号残留行、四条指引落空（天相/天府/巨门/太阴）、化权注 ×5 与化忌注 ×4 计数，供逐项对拍；判据：基线可复跑复现、计数可核

## 2. 尾分号清洗（D1）

- [x] 2.1 存量清洗：扫描全部已迁移 `BranchedContent` 条目的 `common` 尾部孤立分号并清洗为句号（量小可手工或脚本+diff 审查），豁免与纯散文条目不动；判据：改后 `--report` 全文行尾分号计数 0（基线 3 处），未迁移条目 diff=0
- [x] 2.2 投影防线：`selectBranches` 对分支条目的 common 投影结果做尾部「；→。」清洗，注释与数据侧互指；判据：`npm run typecheck` 0 错误，单测构造「X；」尾 common 断言输出「X。」

## 3. 双主星主场展开（D2）

- [x] 3.1 `buildOverviewMaterial` 增产 `secondStarContent`（第二主星同一 contentKey 的自己 profile 全文，无数据 `undefined`），核心论断节第二主星行升级为简述+全文，`renderOverview` 同享；`getTopicMainContentText` 预扫描同登记第二主星文本；判据：命宫双主星盘 `--report` 中紫微与天相的 mingGong 全文均在命格总览板块展开、天相全文全报告恰一次
- [x] 3.2 指引落空断言扩展：astrology-sections 测试组新增用例——天相指引指「命格总览」、巨门指引指「兄弟合伙」（基线分别指「财富运势」「健康状况」）；判据：断言全绿，指引落空计数 0（基线 4 条错位）

## 4. 性格板块去重与四化注首现（D3 + D4）

- [x] 4.1 `getTopicReport` 对 personality 主题跳过 mods/geju 注入与「性格深描」小节；判据：`--report` 性格板块无与命格总览逐字相同的总览行、无「### 性格深描」小节（grep 计数 0），核心论断保留
- [x] 4.2 `renderMutagen(ctx, dedupe?)` 注句入去重表、落点行恒出，`getTopicReport` 传 `options.dedupe`；判据：`--report` 中「化权，掌财有道」计数 1（基线 5）、「福德受损，感情多波折」计数 1（基线 4），落点行计数不变；`--topic` 四化节带注与基线一致
- [x] 4.3 `--topic` 零变化验证：`--topic overview` / `--topic personality` 与 1.1 基线对拍，唯一差异为第二主星全文增强段，其余逐字节 diff=0；判据：diff 逐块核对通过

## 5. 文档与生成物同步

- [x] 5.1 `references/output-contract.md` 报告形态描述同步（双主星展开、四化注首现、性格板块总览唯一、分号口径）；`docs/code/analysis.md` 的 overview-material / suggestions 相关段落同步；判据：selftest `SKILL.md` ↔ `references/` 一致断言全绿、`npx prettier --check` 通过
- [x] 5.2 cli-samples 重导（`npm run cli-samples -- --out docs/cli-samples.md`，禁止手改产物）；判据：63 样例全绿，diff 逐块核对仅预期变化

## 6. 全量验证

- [x] 6.1 `npm run typecheck` 0 错误 + `node scripts/purple-star.ts selftest` 全绿 + `npm test` 全绿（报告相关断言同步后）+ `npm run lint` / `npx prettier --check` 改动行无告警
- [x] 6.2 终样复核：实测盘 `--report` 四项残余全部清零（分号 0、指引落空 0、性格板块无重复、化权注 1 次），与 1.1 基线对照变化均为预期项

## Workflow follow-up

- 评审通过后 `openspec validate --all` 零警告 → `/opsx:apply` 实现 → archive 折回 `report-assembly` 与 `interpretation-content`。
- 注意 archive 顺序：`refine-report-dedup-citations` 先行（report-assembly 主 spec 由它建立），本 change 随后折回。
