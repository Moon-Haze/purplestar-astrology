# Design: 落地 code-style 注释规范（仅预防检查器）

## 三问

- **deletion test**：删掉这个检查，长注释会静默回到源码、且无任何门禁拦——复杂度是「集中一处看守」
  而非搬家，值得保留。
- **接缝判据**：检查器是 `tools/code-style/long-comment-check.ts` 一个纯函数（输入变更文件清单，
  输出违规列表），`review-gate.ts` 一行 `import` 接入；零侵入排盘内核。
- **抽象 justify**：它只做「扫描 `.ts` 连续注释行数」一件事，没有可删的抽象；阈值作为模块内单一
  常量 `MAX_COMMENT_LINES`，与 code-style spec 同值。

## 不可逾越的约束

- 阈值 **10 行** 是 code-style spec 的单一登记值；检查器硬编码同一常量，不得各文件各自为政。
- 排除范围硬约束：**头/许可证块（起始行 ≤ 5）**、**`/**` JSDoc 块**、**`test/` 目录** 一律不报。

## 决策后果

- **收益**：新增/改动文件里的超长注释在 review 面被拦下，规范真正可执行；存量零扰动。
- **代价**：`tools/code-style/` 新增一个文件 + `review-gate` 多一处调用 + `package.json` 多一条
  script；review 报告多一类 💭/🟡 finding（量级很小，只针对违规文件）。

## 为何接 review-gate 而非独立跑

`review-gate.ts` 顶部明言「刻意不做风格判断」——但本检查器不是「风格品味」判断，而是 code-style
spec 的**硬条款执行**（该 spec 已是 openspec 验收项）。把它作为机检 finding 接入，与「机检只报事实、
不下判断」的定位一致；且 review 是每次收尾必跑的门，强制力最强。独立 `npm run code-style:check`
仅作为补充入口，不替代 review 面的接入。

## 扫描算法（要点）

逐文件读行，维护「是否在块注释内」状态与「当前连续注释运行」计数：

- 行去缩进后以 `//` 起手 → 行内注释行。
- 以 `/*` 起手（非 `/**`）→ 块注释开始；以 `/**` 起手 → 视为 JSDoc，整块跳过（不计入运行）。
- 块内以 `*` 续行或 `*/` 收尾的行 → 块注释续行。
- 上述三类连续成「运行」；运行结束（遇到非注释行）时，若行数 > `MAX_COMMENT_LINES` 且
  （块起始行 > 5 且非 JSDoc） → 记为违规 `{file, line:起始行, lines:行数}`。
- 仅对 `scripts/` + `tools/`（排除 `test/`）下的 `.ts` 跑；传入完整文件路径（非 diff 行），
  因为要判定「块起始行 ≤ 5」与整块长度，diff 行号不够用。
