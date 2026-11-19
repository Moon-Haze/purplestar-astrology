# Design · 魁钺贵人表键域漂移修复 + 守卫登记

## Context

- 表：`KUI_YUE_GUIREN_MAP`（`scripts/analysis/data.ts:2687-2706`），类型
  `Record<string, { kui: string; yue: string }>`，十二键 `命宫 / 兄弟 / 夫妻 / 子女 /
  财帛 / 疾厄 / 迁移 / 仆役 / 官禄 / 田宅 / 福德 / 父母`（紧凑形 + 第 8 宫旧口径
  `仆役`）。
- 消费点：`scripts/analysis/views/patron.ts:38 / :48`，`KUI_YUE_GUIREN_MAP[palace.name]`
  直查 + `map?.kui` / `map?.yue` 可选链。运行时 `Palace.name` 属展开形域
  `PALACE_NAMES_ORDER`（`scripts/data/ganzhi.ts:66-79`，`命宫 / 兄弟宫 / … /
  交友宫 / 官禄宫 / …`，**无 `as const`**）。
- 守卫网：`test/invariants.test.ts:1631-1693` 两个相关 `it`——「宫名键域：三张分析表
  的每个宫名键都在 PALACE_NAMES_ORDER 域内」（循环 `MINOR_STAR_PALACE_CONTENT` /
  `PALACE_TO_CONTENT_KEY` / `TOPIC_KEY_PALACES`）与「宫名键域：内容键表 12 宫齐、
  每颗次星 12 宫齐」（完备性）。本表未登记。
- 该表语义：天魁 / 天钺落**任何一宫**都有贵人倾向断语（全十二宫覆盖），仅由主题
  清单（overview / personality / career / wealth）决定出与不出。

## Goals / Non-Goals

**Goals**

1. 十二键与运行时宫名域同域，直查 12/12 命中（功能面恢复）。
2. 本表进键域互证守卫网：超域键红 + 十二宫齐完备性红（复发即当场红）。
3. quality-gates spec 与守卫实态一致（delta 折回后）。

**Non-Goals**

- 不做候选 9（soul-summary / synastry 键集补网）；不动 `patron.ts`；不动断语内容；
  不动 `PALACE_NAMES_ORDER` 本身。

## 决策记录

### 决策 1：改键方案——逐键展开形映射，断语逐字不动

十二键映射（与 `PALACE_NAMES_ORDER` 一一对应）：

| 旧键（紧凑/旧口径） | 新键（展开形） |
| --- | --- |
| `命宫` | `命宫`（不变） |
| `兄弟` | `兄弟宫` |
| `夫妻` | `夫妻宫` |
| `子女` | `子女宫` |
| `财帛` | `财帛宫` |
| `疾厄` | `疾厄宫` |
| `迁移` | `迁移宫` |
| `仆役` | `交友宫`（**旧口径归位**，第 8 宫运行时已改名） |
| `官禄` | `官禄宫` |
| `田宅` | `田宅宫` |
| `福德` | `福德宫` |
| `父母` | `父母宫` |

表 docstring 补一行键域口径（「键为 PALACE_NAMES_ORDER 展开形，invariants 互证」），
与守卫自证。**后果两面**：收益是功能面恢复 + 键域单点；代价是 DEMO 盘若命中新
分支，cli-samples 快照与 selftest 相关快照按实态更新（预期内容扩展，非遗漏）。

### 决策 2：守卫登记并入现有两个 `it`，不新增测试项

- 键域 `it`（「三张分析表…域内」）的循环加第四张表（`Object.keys(KUI_YUE_GUIREN_MAP)`
  逐键 `domain.has`），测试名「三张」改「四张」。
- 完备性 `it` 加本表 `Object.keys(...).length === PALACE_NAMES_ORDER.length` 对拍
  （该表语义即全十二宫，一条 assert，与 `PALACE_TO_CONTENT_KEY` 的对拍同形态）。

后果两面：测试项数不变 → 「内核层测试项数」报警器零扰动、`test/README.md` 层表
无需动；代价是单个 `it` 失败时报错信息需带表名前缀（沿用现有 `bad.push` 报键模式，
可读性不降）。接缝判据复核：本 change 不新增接缝，只是既有键域互证网的条目延长。

### 决策 3（否决留档）：`as const` + `Record<(typeof PALACE_NAMES_ORDER)[number], …>` 类型化

- **收益**：miss 从「npm test 红」升「typecheck 红」，反馈更早。
- **否决理由**：① `PALACE_NAMES_ORDER` 现无 `as const`，加它改的是公共数据模块的
  类型形状（`string[]` → readonly tuple），消费面（主要是测试侧互证）需全量核对
  readonly 兼容性，blast radius 与本缺陷不成比例；② 守卫登记 + 完备性断言已把
  「写错键」「漏键」两类风险都钉红，typecheck 增量属重复保险；③ deletion test：
  加类型不消灭复杂度，只把键域事实在类型层再抄一份（与守卫双写）。若未来
  `PALACE_NAMES_ORDER` 因其他 change 自然获得字面量类型，可零成本跟进，挂账。

### 决策 4（否决留档）：消费点做归一映射

见 proposal「被否决的备选方案」第二条——为坏数据在消费点加换算层是复杂度搬家，
且旧口径 `仆役` 在运行时域中无对应物，映射本身写不全。

## 不可逾越的约束

- **断语内容逐字不动**（引文纪律；既有内容迁移不新增引语形态，不动 grades 登记表）。
- **ADR-003 分层红线**：analysis 知识内容层改动不触排盘内核（`algorithm.ts` /
  `mutagen.ts` / `patterns/` / `data/ganzhi.ts` 等内核数据模块零改动）；`npm test`
  排盘基准 300 条对拍不受影响。
- **「内核层测试项数」报警器**：守卫并入现有 `it`，项数不变（决策 2）。
- **生成物纪律**：`docs/cli-samples.md` 只能经 `npm run cli-samples` 重导，不手改。

## Open Questions

（无——键映射、守卫形态、验收口径均已定。）
