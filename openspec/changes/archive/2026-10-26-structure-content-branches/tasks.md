# Tasks

## 1. 基线先行

- [x] 1.1 改动前取基线：`--topic` 13 主题输出 + `--report` 全盘输出各一份落档（用固定样例盘），并统计当前文本中四化 / 亮度全分支句式的出现位置清单；判据：基线可复跑复现、句式清单条目可数

## 2. 类型与投影层（D1 + D2）

- [x] 2.1 `data.ts` 定义 `BranchedContent` 类型（`common` + `sihua` 四键 + `brightness` 两键），语境值联合类型扩展为 `string | GenderField | BranchedContent`；判据：`npm run typecheck` 0 错误且消费点收窄清单随编译产出
- [x] 2.2 新增 `selectBranches` 投影并与 `selectGender` 组合成单一投影入口（先结构后性别），`overview-material` 与 `views/surround.ts` 两消费点接入，未迁移数据走旧形态；判据：改后 13 主题 `--topic` 输出与 1.1 基线逐字节 diff=0（未迁移条目零行为变化）

## 3. 首批语料迁移（D3）

- [x] 3.1 迁移 `--report` 实测高曝光条目（武曲 · 财帛、太阳 · 子女、太阴 · 子女、廉贞 · 官禄、贪狼 · 夫妻、天同 · 疾厄等，以 1.1 句式清单为准），分支子句逐字拆入结构字段；判据：命中分支与原子句逐字节 diff=0，`test/citations.test.ts` 全绿（引文守卫不红）
- [x] 3.2 首批断言：武曲仅化权盘面渲染不含「化禄则 / 化科则 / 化忌时」子串（计数 0）、太阳落陷盘面不含「入庙则」子串；登记 `test/README.md` 层表与 `test/lib/run.ts` 的 `LAYERS`（如新增测试文件）；判据：断言全绿且登记一致

## 4. 剩余批次迁移与收敛守卫（D3 + D4）

- [x] 4.1 按批次迁移剩余条目，每批重复 3.1–3.2 的验证（迁移 → diff=0 → 断言）；判据：逐批全绿，批次间无耦合回滚点
- [x] 4.2 `test/invariants.test.ts` 增残留句式扫描不变式 + 显式豁免清单（自由条件句条目可数）；判据：已迁移条目残留计数 0、豁免清单登记与实际散文件一致

## 5. 文档同步

- [x] 5.1 `docs/code/analysis.md`（数据模型描述）补 `BranchedContent` 形态与投影次序；`AGENTS.md` 键域口径节如有涉及同步；判据：`npx prettier --check` 通过、文档与实现一致（抽查一条迁移条目照文档能对上）

## 6. 全量验证

- [x] 6.1 `npm run typecheck` 0 错误 + `node scripts/purple-star.ts selftest` 全绿 + `npm run lint` / `npx prettier --check` 改动行无告警
- [x] 6.2 实测盘终样复核：`--report` 与 `--topic` 中武曲 · 财帛只出化权分支、太阳 · 子女只出落陷分支，全报告无未命中分支句式；与 1.1 基线对照输出变化均为「未命中分支消失」

## Workflow follow-up

- 评审通过后 `openspec validate --all` 零警告 → `/opsx:apply` 实现 → archive 折回 `interpretation-content`（新需求并入正式 spec）。
- archive 后核对 `openspec/specs/interpretation-content/spec.md` 含两条需求（性别 + 条件分支）。
