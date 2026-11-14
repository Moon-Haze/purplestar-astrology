# 任务 · 三处零消费 pass-through 删除

判据形态标记：`[退出码]` / `[计数]` / `[逐字节]` / `[反向注入]`。
纯删除、零行为变化；三处相互独立，可分 commit 落地。

## 1. 取证与基线

- [x] 1.1 消费面复核（三个符号各自全仓 grep，除定义文件外必须零命中；
      `descOverrides` 允许的唯一命中是其声明行本身）：
      `grep -rn "BirthInfoResult\|LongitudeHit\|TrueSolarOptions\|TrueSolarResult" scripts/ test/ tools/ | grep -v "birth-info"`、
      `grep -rn "descOverrides" scripts/ test/ tools/`、
      `grep -rn "TrueSolar" scripts/cli/birth/birth-info-defs.ts | head`（确认权威导出点健在）。
      判据 `[计数]`：外部消费 = 0；若发现消费方，停下补 design 记录重评。
- [x] 1.2 取基线：`knowledge --source tianji --search 紫微 --limit 3` 输出、
      `ZIWEI_NO_CACHE=1 npm test` 分层项数、selftest 首行项数。
      判据 `[退出码]`：可执行且记录完整。

## 2. 三处删除

- [x] 2.1 `scripts/cli/birth/birth-info.ts`：删 `:588-593` 兼容 re-export 块及注释。
      判据 `[计数]`：`grep -n "export type { BirthInfoResult" scripts/cli/birth/birth-info.ts`
      零命中；`birth-info-defs.ts` 导出面不变。
- [x] 2.2 `scripts/cli/args/scope.ts`：删 `descOverrides` 字段及 doc 注释。
      判据 `[计数]`：`grep -rn "descOverrides" scripts/ test/ tools/` 零命中。
- [x] 2.3 `scripts/knowledge/sources/tianji.ts:35`：`query.positional.join(" ")` 后的
      尾 `?? ""` 删除。
      判据 `[计数]`：该行无 `?? ""`；tianji 检索输出与 1.2 基线 `[逐字节]` diff = 0 行。
- [x] 2.4 `npx eslint` 三个 touched 文件 + `npm run typecheck`。
      判据 `[退出码]`：全 0（删除若有隐性消费方 typecheck 即红，停回 1.1）。

## 3. 三件套

- [x] 3.1 `node scripts/purple-star.ts selftest`。判据 `[计数]`：全绿，项数与基线一致。
- [x] 3.2 `ZIWEI_NO_CACHE=1 npm test`。判据 `[退出码]`：0；分层项数与基线一致。
- [x] 3.3 `openspec validate --all` 零警告。判据 `[退出码]`：0。
