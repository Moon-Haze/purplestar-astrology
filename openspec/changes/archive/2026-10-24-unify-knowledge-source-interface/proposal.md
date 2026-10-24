# Proposal

## Why

架构评审 2026-10-24（候选 S2 + W2，行为漂移已实锤）：`KnowledgeSource.search(args: CliArgs)` 把原始参数面整只递给四个域实现，「boolean 三态判定 + 位置参数回退 + limit 校验」样板逐字抄了四份并已分叉——books 域缺 `--search` 值时 `return`（错误进 stdout、exit 0），其余三域 `throw`（stderr、exit 1）；selftest 把两种行为都固化成了「正确」。books.ts 自己的注释写着「return 会把报错当正常输出打 stdout 且 exit 0，机器路径无法感知」——它的 `--search` 分支仍在 return。另：mutagen 六层四化中「生年层」的 chart 适配住在 cli/fortune（`sihua-helpers.ts` 的 `nativeSiHuaOf`），与「1–2 月出生必须用 `lunarInfo.yearStem`」的红线警告隔着一层目录；六层可空语义分两档、只散在各自 `@returns` 注释。

## What Changes

- 命令入口归一层：cli/knowledge 侧单点做三态归一、位置参数回退、limit 数值校验；四域实现只收解码后的字符串/数字
- 错误语义统一：参数缺值/非法一律 throw（exit 1、stderr）——修复 books 域 exit 0 漂移（**BREAKING**：机器路径可感知的错误行为变化）；selftest 相应断言从「stdout 含文案」改为「非零退出」
- 删三个纯转发壳（`knowledge/sources/{stars,tianji,oracle}.ts`，均为 `search(args){ return renderXxx(args); }` 的 pass-through），books 实现挪 `cli/knowledge/books.ts` 与其余三域同层；registry 清单注册一行不变（ADR-002），各域实现自带 `{id, label, search}` 直注册
- 生年层归位：内核 `mutagen.ts` 补 `getNativeMutagen(chart)`（chart → 年干 → 生年四化的适配收进内核），六层可空性统一为一个结果类型；`test/kernel-contract.test.ts` 同步（新增内核导出属冻结面变化，design 显式说明）

## What Doesn't Change

- **参数声明单点不变**：参数有哪些仍以 `cli/args/table.ts` 的 `OPTION_GROUPS` 为唯一来源，归一层只消费它，不另立声明点
- **注册纪律不变**：registry.ts 清单注册（ADR-002）；新增域仍是「写源 + 加一行」
- **六层四化返回形状 `{stemIndex, stemName, transforms}` 不变**；大限宫干四化继续走纯函数层（体系立场不动，types.ts 绊线字段不动）
- **检索行为不变**：books 多关键词 AND、高亮位置、默认 limit 等既有需求行为零变化（变化的只有错误路径的退出码与文案统一）
- **knowledge/ ↔ cli/ 的动态 import 既存模式不动**（ADR-003 禁的是静态反向依赖；断环的 `await import` 模式与 corpus / synastry 断言组同款，是否进一步分层留待 design 讨论，不在本变更强推）

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `knowledge-retrieval`: 「四域统一检索」需求补统一错误语义——参数缺值/非法时四域一致报错（非零退出、stderr），不再有域间差异；该需求既有 scenario 全部保留，不得减少

## Impact

- 代码：`scripts/cli/knowledge/`（index.ts 归一层、四域实现、books 挪入）、`scripts/knowledge/`（registry / types 接口签名收窄 `CliArgs` → 解码值、删三壳）、`scripts/mutagen.ts`（getNativeMutagen）、`scripts/cli/fortune/sihua-helpers.ts`（改引内核）、`test/kernel-contract.test.ts`（同步冻结面）、`scripts/cli/selftest/commands.ts`（books 缺值断言修正）
- 行为：books 域缺值报错从 exit 0 变 exit 1；若 cli-samples 收录了该错误样例，期望值同步
