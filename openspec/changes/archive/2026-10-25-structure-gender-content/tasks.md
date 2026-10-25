# Tasks

## 1. 基线

- [x] 1.1 取性别过滤输出基线：遍历 `TOPIC_KEYS` 全主题 × `male`/`female` 两性别，跑 `node scripts/purple-star.ts astrology --date 2011-06-24 --time 07:45 --city 杭州 --gender {male|female} --topic <key>` 落盘到 `/tmp/gender-before/<key>.<gender>.txt`。判据：`TOPIC_KEYS.length × 2` 份文件齐备、非空

## 2. 投影基座

- [x] 2.1 在 `scripts/analysis/data.ts` 定义 `GenderField`（`common`/`male?`/`female?`/`suffix?`，`suffix` 收中置性别段的后缀），`StarContent` 各宫位字段类型改为 `string | GenderField`。判据：`npm run typecheck` 零错

- [x] 2.2 在 `scripts/analysis/lookups.ts` 加 `selectGender(field, gender)`（`common + (male|female) + suffix`，纯 string 原样返回），并在 `makeContext` 暴露 `ctx.gender`。判据：`npm run typecheck` 零错

## 3. 逐字段结构化（data.ts）

- [x] 3.1 逐星逐字段拆分 `STAR_CONTENT_MAP` 的内联性别标记（`；女命…` / `女命…。` / `（女命）…`）成 `common` / `male` / `female`（中置段用 `suffix`）；共享散文进 `common`、性别专属子句进对应段。判据：全主题 × 两性别输出与基线逐字节 diff=0

- [x] 3.2 确认 `summary`（已结构化）与无性别差异的字段不额外拆分；`ZIWU_LIUZHU` 的 `advice`（太阴，`；男命防肾阳不足` 是唯一非 StarContent 的可过滤内容）一并结构化。判据：`grep -nE "；(女命|男命)" scripts/analysis/data.ts` 仅剩已拆字段的 `male`/`female` 段，无未拆残留

## 4. views 投影 + 删过滤器

- [x] 4.1 `analysis/views/*.ts` 内 `profile.<字段>` 改 `selectGender(profile.<字段>, ctx.gender)`（overview-material / surround / personality / health / lookups.getMutagenNote）。判据：`npm run typecheck` 零错

- [x] 4.2 删 `filterGenderContent` 及其在 `analysis/index.ts`、`analysis/report.ts` 的两处调用，`analysis/index.ts` 公开面 re-export 清单同步。判据：`grep -rn "filterGenderContent" scripts/` 仅剩注释；`npm run typecheck` 零错

- [x] 4.3 `scripts/cli/selftest/render.ts` 的 `filterGenderContent` 三条规则直测断言改为结构化断言（断言 `selectGender` 投影）。判据：`node scripts/purple-star.ts selftest` 全绿

## 5. 引文纪律同步

- [x] 5.1 `scripts/analysis/grades.ts` 的 `NI_GRADES` 字段路径核对：引文守卫按文本扫描而非按字段路径查找，字段结构化后引句仍完整（未被跨段截断），无需改 `field` 路径。判据：`npm test` 引文守卫层 19 项全绿

- [x] 5.2 引文守卫（`test/lib/citation-guard.ts` / `test/citations.test.ts`）无需适配（文本扫描，不依赖字段结构）。判据：`npm test` 全绿，无「文案引句未登记 / quote 失配」

## 6. 验证

- [x] 6.1 逐字节对拍基线：全主题 × 两性别输出与 `/tmp/gender-before/` 逐字节 diff=0。判据：`cmp` 全部无差异、退出码 0

- [x] 6.2 五闸门：`npm run typecheck`（0 错）、`node scripts/purple-star.ts selftest`（全绿）、`npm test`（605/605）、`npm run lint`（0 errors）、`prettier --check` 干净。判据：各命令退出码 0

- [x] 6.3 确认 oracle 手册为下游生成镜像、源未改故逐字节不变：`--topic` 输出逐字节一致 ⇒ 手册（同源渲染的预计算快照）无需重建即不变。判据：`git status` 无 `scripts/corpus/data/manual/` 改动
