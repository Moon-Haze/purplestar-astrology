# Tasks

## 1. 基线先行

- [x] 1.1 改动前取 `--topic` 全 13 主题基线输出（`node scripts/purple-star.ts astrology <样例盘> --topic <key>` 逐主题落档），供后续逐字节 diff=0 对拍；判据：基线文件齐 13 份且可复跑复现
- [x] 1.2 改动前取 `--report` 全盘基线（如本次实测的 74 KB 样本）并记录「当前大限」出现次数（=13）与全文复现次数，作为 spec 反例基线；判据：基线报告与两项计数可复跑复现

## 2. 大限节唯一（D2）

- [x] 2.1 `buildReport` 把「当前大限」抽为文档头区独立小节（口径提示后、首板块前，含未起运童限说明），13 板块节内移除该小节；判据：对样例盘跑 `--report`，「当前大限」内容全报告恰出现 1 次，`node scripts/purple-star.ts astrology <样例盘> --report | grep -c "当前大限"` 计数=1
- [x] 2.2 同步更新 `test/astrology-sections.test.ts` 报告结构断言（板块数、大限计数、未起运分支）；判据：相关测试全绿且含「已起运计数=1 / 未起运只一处说明」两用例

## 3. 论断全文首现去重（D1 + D4）

- [x] 3.1 `ReportOptions` 增可选去重状态（已见全文集合 + 首现板块映射，缺省缺省即现状行为），`analysis/index.ts` 门面类型同步；判据：`npm run typecheck` 0 错误，`--topic` 与既有调用点零改动
- [x] 3.2 `buildReport` 维护去重状态逐节递入；三方四正联动中已见全文降级为「星曜徽标 + 指引回首现板块」一行；判据：对样例盘跑 `--report`，任意星曜 × 宫位论断全文出现次数 ≤ 1（脚本计数验证）
- [x] 3.3 单主题零变化验证：改后 13 主题 `--topic` 输出与 1.1 基线逐字节 `diff` 全为 0；判据：13 份 diff 输出全空

## 4. 引文语境过滤（D3）

- [x] 4.1 新增语境词数据表（宫名键 → 宫名 + 主管领域关键词，单一角色），`topicCitations` 全局检索加双通道过滤（主题星判定：星名出现 ≥2 次；或语境词共现），专章命中免滤；判据：反向注入用例——罗列段（星名仅 1 次且无语境词）不收录、主题星段（星名 ≥2 次无语境词）收录、无候选时整节省略，断言全绿
- [x] 4.2 用本次实测盘（疾厄宫天同）复核：健康节不再挂「机月同梁格」职业适配引文；判据：`--report` 健康节经典出处无该引文或整节省略，grep 验证

## 5. 文档与生成物同步

- [x] 5.1 `references/output-contract.md` 报告形态小节流描述同步（文档头区含大限一览、全文首现原则、引文相关性口径）；判据：selftest 的 `SKILL.md` ↔ `references/` 双向一致断言全绿，`npx prettier --check references/output-contract.md` 通过
- [x] 5.2 cli-samples 生成物按生成器重导（改生成器口径 + `npm run cli-samples` 重导 `tools/samples/` 与 `docs/cli-samples.md`，禁止手改产物）；判据：重导后 `git diff` 逐块核对只含预期变化（大限 13→1、复现全文降级、引文删减），无排版噪声
- [x] 5.3 selftest 增补报告装配断言组条目（如适用），同步 `test/README.md` 层表与 `test/lib/run.ts` 的 `LAYERS` 登记；判据：`node scripts/purple-star.ts selftest` 首行计数与登记一致、全绿

## 6. 全量验证

- [x] 6.1 `npm run typecheck` 0 错误 + `node scripts/purple-star.ts selftest` 全绿 + `npm run lint` 与 `npx prettier --check` 对本次改动行无告警
- [x] 6.2 生成实测盘 `--report` 终样：大限 1 处、无复现全文、健康节引文不挂错关联、板块序与文档头与尾注不变；与 1.2 基线对照确认体量下降且信息不缺失

## Workflow follow-up

- 评审通过后按 `openspec validate --all` 零警告 → `/opsx:apply` 实现 → archive 折回 specs（`report-assembly` 落为正式 capability）。
- archive 后核对 `openspec/specs/report-assembly/spec.md` 生成正确、旧 changes 目录移除。
