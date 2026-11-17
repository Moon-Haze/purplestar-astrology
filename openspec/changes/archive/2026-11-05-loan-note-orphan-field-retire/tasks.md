# 任务 · loanNote 孤儿字段降局部量

判据形态标记：`[退出码]` / `[计数]` / `[逐字节]` / `[反向注入]`。
纯重构档：文本输出逐字节 diff=0 是总闸。⚠️ 依赖候选 3（projection-downgrade）先落地——
两者都触碰 `overview-material.ts` / `views/overview.ts`，按序执行避免冲突。

## 1. 基线

- [x] 1.1 固定样本盘（`--date 2005-05-05 --time 09:30 --city 北京 --gender male`）落盘
      `--topic` 全主题 + `--report` 全量输出到 `/tmp/loannot-baseline/`；记录 npm test
      分层项数。
      判据 `[退出码]`：命令退出码 0，基线非空。
- [x] 1.2 消费面复核：`grep -rn "loanNote" scripts/ test/ tools/` —— 除
      `overview-material.ts` 自身外必须零命中（若发现走查漏掉的消费方，停下补
      design 记录重评）。
      判据 `[计数]`：外部命中 = 0。

## 2. 字段降级

- [x] 2.1 `scripts/analysis/overview-material.ts`：`OverviewMaterial` 删 `loanNote`
      字段；两分支的拼行逻辑改用既有局部量（行为不变）；`OverviewMaterial` 头注写明
      「`mainStarLine` 是唯一成文形态；`mainBadge` / `loanTag` 仅供标题徽标与借宫标记，
      SHALL NOT 用部件重建拼式」。
      判据 `[计数]`：`grep -rn "loanNote" scripts/ test/ tools/` 零命中；
      `npx eslint scripts/analysis/overview-material.ts` 退出码 0。
- [x] 2.2 `npm run typecheck`。判据 `[退出码]`：0（字段删除若有隐性消费方此处即红）。

## 3. 零行为证明

- [x] 3.1 `ZIWEI_NO_CACHE=1 npm test`。判据 `[退出码]`：0；分层项数与 1.1 基线一致
      （对拍断言仍绿 = 成文形态未被触碰）。
- [x] 3.2 `--topic` 全主题 + `--report` 全量输出与 1.1 基线 diff。判据 `[逐字节]`：
      全部 diff = 0 行。
- [x] 3.3 `node scripts/purple-star.ts selftest` 全绿。判据 `[计数]`：项数与基线一致。
