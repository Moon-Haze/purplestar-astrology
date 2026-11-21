# Design

## Context

豁免边实况（已核验）：`scripts/corpus/selftest-asserts.ts` 静态 `../cli/selftest/kit`（:24）+ 动态 `../cli/commands`、`../cli/args`（:40-41）；`scripts/synastry/selftest-asserts.ts` 静态 `../cli/selftest/kit`（:28）+ 动态 `../cli/commands`、`../cli/args`、`../cli/args/scope`（:158-160）。动态 import 的意图注释在两个文件里都自证（打断「commands → selftest → 本文件」静态环）。

## Goals / Non-Goals

- Goals：豁免入 spec（有界、具名）；边界有扫描守卫；AGENTS.md 与 spec 同源。
- Non-Goals：不动断言组代码；不扩豁免面；不做全仓依赖图（只扫插件树）。

## Decisions

1. **守卫落 `test/repo.test.ts` 既有「仓库自洽」describe 内新增 `it`，不新增 describe。**
   `test/lib/run.ts` 的 LAYERS `suites` 与 describe 名逐字对应，新增 describe 要同步登记；
   并入既有 describe 零登记协同——deletion test：新 describe 只是登记面搬家。

2. **文本扫描抓双形态：静态 `from "<spec>"` + 动态 `import("<spec>")`。**
   判据：spec 以 `../cli` / `./cli` 起或含 `/cli/`。本仓 import 形态受 prettier 约束，
   单行 from 占绝对主导；与 repo.test.ts 既有源码扫描断言（注释指针守卫）同形态、同轻量。

3. **白名单是单点常量：文件 → { 静态集, 动态集 }，并校验白名单文件真实存在。**
   白名单文件消失（改名 / 删除）即红——反恒真：锚点失效不得静默降级为「扫描零命中即绿」。
   spec 豁免措辞与白名单常量同源（同一组具名文件与模块集）。

4. **扫描面 = `scripts/corpus/**` 与 `scripts/synastry/**` 全树。**
   生成物（`corpus/data/tianji.ts`）无 cli 边，扫入无碍；knowledge / school 侧对 cli 的
   引用纪律由 ADR-003 本体覆盖，不在本豁免面内——若未来那里出现 cli 边，本守卫不红，
   由评审与 spec 本体语义管（豁免边界与本守卫的管辖面一致，不假扮全仓依赖闸门）。

## 不可逾越的约束

- ADR-003 本体措辞不动；豁免只在具名文件 + 具名模块集内成立。
- 断言组代码零改动（本变更纯护栏 + 文档）。
- 层 6 项数 +1 属护栏扩展的预期变动。

## Risks / Trade-offs

- [正则漏抓非典型 import 形态（多行 from、export … from 之外的 re-export 语法）] →
  扫描含 `export … from` 形态；format 闸门保证单行形态；反向注入演练验证常规形态必红。
- [豁免可能被未来人当先例扩散] → spec 明写「SHALL NOT 扩散」，守卫按边具名比对，
  新文件任何 cli 边都红——扩散通道被机器封死，只剩显式改 spec 一条路（正是想要的摩擦）。

## Open Questions

（无）
