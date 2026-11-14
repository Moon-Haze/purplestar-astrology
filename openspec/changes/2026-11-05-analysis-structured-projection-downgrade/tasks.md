# 任务 · analysis 第二投影降级

判据形态标记：`[退出码]` / `[计数]` / `[逐字节]` / `[反向注入]`。
基线必须**先于**任何代码改动；本 change 是纯重构档，文本输出逐字节 diff=0 是总闸。

## 1. 基线

- [x] 1.1 取基线：固定样本盘（`--date 2005-05-05 --time 09:30 --city 北京 --gender male`）
      落盘 `--topic` 全部主题输出与 `--report` 全量输出到 `/tmp/items-downgrade-baseline/`。
      判据 `[退出码]`：两条命令退出码 0，基线文件非空、行数 > 0。
- [x] 1.2 记录 `ZIWEI_NO_CACHE=1 npm test` 基线项数（末行分层项数）。
      判据 `[计数]`：记录层 1 / 层 2 / 内核层各项数备查。

## 2. 导出面收敛

- [x] 2.1 `scripts/analysis/views/` 十个 `renderXxxItems`（overview / sanfang / mutagen /
      decadal / health / patron / yearly / personality / suggestions / year-stem）去
      `export`（同文件 `renderXxx` 内部调用不动）。
      判据 `[计数]`：`grep -rn "export function render.*Items" scripts/analysis/` 零命中。
- [x] 2.2 `scripts/analysis/index.ts`：删 `:28-37` 九个 `renderXxxItems` 死 import（各行
      只留文本投影函数）；`:74-75` 注释改「条目化是 views 的内部实现形态」。
      判据 `[计数]`：`grep -n "Items" scripts/analysis/index.ts` 零命中；
      `npx eslint scripts/analysis/index.ts` 退出码 0。
- [x] 2.3 `npm run typecheck` 中途闸（确认去导出未打破任何隐性消费方）。
      判据 `[退出码]`：0 错误。若此处报错，说明存在走查漏掉的消费方——停下来把消费方
      实据补进本 change 的 design 记录，重新评估，不得 `any` 绕过。

## 3. 平行元数据与 write-only 字段

- [x] 3.1 `scripts/analysis/overview-material.ts`：删 `modsMeta` / `gejuMeta` 平行数组
      （`:44-47`）与 `:119-141` 构建逻辑；`scripts/analysis/views/overview.ts` 删对应
      写入点（`:43-47,57-64`）与条目上的 write-only 字段。
      判据 `[计数]`：`grep -rn "modsMeta\|gejuMeta" scripts/ test/ tools/` 零命中。
- [x] 3.2 `scripts/analysis/items.ts`：docstring 锚点修正——`:9-15` 删「断语手册库 v2
      的数据源」、`:53` 删「直出链 SHALL…」，改为内部实现口径；`clockDependent` 消费面
      核验：`grep -rn "clockDependent" scripts/ test/ tools/`——若除写入点外零读取，
      删字段与全部写入点；若有读取，保留并在完成注记录实据。
      判据 `[计数]`：grep 结果与所做决策一致；`views/overview.ts:23` 等「断语手册库」
      注释锚点同步修正。
- [x] 3.3 中途逐字节对拍：`--topic` 与 `--report` 输出与 1.1 基线 diff。
      判据 `[逐字节]`：全部 diff = 0 行（本节改动不得触碰任何文本）。

## 4. spec 折回与三件套

- [x] 4.1 `npm run typecheck`。判据 `[退出码]`：0 错误。
- [x] 4.2 `node scripts/purple-star.ts selftest`。判据 `[计数]`：全绿，项数与基线一致
      （本 change 不动 selftest）。
- [x] 4.3 `ZIWEI_NO_CACHE=1 npm test`。判据 `[退出码]`：0；分层项数与 1.2 基线一致
      （内核层项数不得变动）。
- [x] 4.4 终局逐字节对拍：`--topic` 全主题 + `--report` 全量输出与 1.1 基线 diff。
      判据 `[逐字节]`：全部 diff = 0 行。
- [x] 4.5 `openspec validate --all` 零警告。判据 `[退出码]`：0。

## 5. 收尾

- [x] 5.1 `docs/code/analysis.md`（及其他 docs/code 文档）若描述「一源双投影 / renderXxxItems
      导出面 / 直出链」，同步为「条目 = views 内部实现形态」口径。
      判据 `[计数]`：`grep -rn "renderXxxItems\|直出" docs/` 无活性陈述（历史沿革类
      陈述须能辨认为已退役）。
