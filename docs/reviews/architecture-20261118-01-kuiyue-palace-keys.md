# 候选 1 · 魁钺贵人表键域漂移：十二键十一键运行时死键（2026-11-18 第五轮）

**档位**：Strong ｜ **分层**：analysis 知识内容层（不碰排盘内核）｜ **规范面**：内容修订 + 守卫补网，触及 quality-gates 须走 openspec change ｜ **与已定决策冲突**：0（正是 AGENTS.md「键域口径」点名的缺陷类，修它是对口径的归位而非翻案）

## 涉及文件

| 位置                                     | 角色                                                |
| ---------------------------------------- | --------------------------------------------------- |
| `scripts/analysis/data.ts:2687-2706`     | 表定义 `KUI_YUE_GUIREN_MAP`                         |
| `scripts/analysis/views/patron.ts:34-56` | 唯一消费点（`renderKuiYueItems`）                   |
| `scripts/data/ganzhi.ts:66-79`           | 运行时宫名键域真相源 `PALACE_NAMES_ORDER`（展开形） |
| `test/invariants.test.ts:1624-1692`      | 宫名键域互证守卫网（**本表漏在网外**）              |

## 问题（file:line 实据）

表键是**紧凑形 + 旧口径**宫名：`命宫` `兄弟` `夫妻` `子女` `财帛` `疾厄` `迁移` `仆役` `官禄` `田宅` `福德` `父母`（`data.ts:2688-2705`，仅 `命宫` 带宫字；第 8 宫用旧口径 `仆役`——运行时它早已改名 `交友宫`）。

消费点拿的是 `chart.palaces[].name` 直查：

```ts
// patron.ts:38 / :48 —— palace.name 是展开形（PALACE_NAMES_ORDER 同域）
const map = KUI_YUE_GUIREN_MAP[kuiPalaceForTopic.name];
if (map?.kui) { ... }
```

运行时十二键**只有 `命宫` 能命中**：天魁/天钺落进其余 11 宫中的任何一宫，`map?.kui` 静默为 `undefined`，「五点六、魁钺贵人倾向细分」整段缩水——不是文案瑕疵，是**功能面几乎全盲**（12 分之 11 的分支空间不出内容）。

三个放大器让它在三层防线眼皮底下存活：

1. **可选链吞 miss**（`map?.kui` / `map?.yue`）——正是键域口径「消费点不得用 `?? ""` 掩盖 miss」点名的形态；
2. **表类型是 `Record<string, …>`**——键不进类型域，typecheck 永远全绿；
3. **守卫网缺口**——invariants 的宫名键域互证盯的是 `MINOR_STAR_PALACE_CONTENT` / `PALACE_TO_CONTENT_KEY` / `TOPIC_KEY_PALACES` 三张表，本表没有登记。同一缺陷类（「内容键表 12 键仅 1 命中」）在 2026-10-24 评审 S1 已发生过一次并修复，这是**漏网的同型复发**。

## 为什么是摩擦（词汇口径）

`KUI_YUE_GUIREN_MAP` 作为一个数据 module，其 interface 的一部分（键域）与运行时宫名域不同域——调用方必须「碰巧知道」键是紧凑形才用得对，而唯一调用方恰恰用错且无感。interface 没有把「十二宫全覆盖」这一语义承诺编码进去，depth 假象背后是 11 条永远走不到的实现路径。修键 + 补守卫后，「魁钺在哪宫→断语」这条链第一次有了完整可测的 interface。

## 方案方向

1. **改键**：十二键改展开形，与 `PALACE_NAMES_ORDER` 同域（`兄弟`→`兄弟宫` …；`仆役`→`交友宫`；`官禄`→`官禄宫`）。断语内容逐字不动。
2. **补网**：把 `KUI_YUE_GUIREN_MAP` 登记进 invariants 的宫名键域互证，并加「十二宫齐」完备性断言（该表语义本就全十二宫，一条循环即可）。
3. 顺手：键改展开形后 `Record<string, …>` 可收成 `Record<PalaceName, …>`（若 `PALACE_NAMES_ORDER` 的字面量类型已在 types 侧可用），让 miss 从「守卫红」升级为「typecheck 红」；不可用则守卫足够。

## deletion test

删掉 11 条死键路径是**纯消灭**（没有任何调用方需要重写）；补的守卫把「漂移不可见」变「漂移即红」——复杂度集中而非搬家，深化信号成立。

## Before / After

```text
Before: 键域 × 2（紧凑形已死 11/12）          After: 键域 × 1 + 守卫登记
KUI_YUE_GUIREN_MAP                            KUI_YUE_GUIREN_MAP
  键: 兄弟/夫妻/…/仆役/官禄（紧凑旧口径）        键: 兄弟宫/夫妻宫/…/交友宫（展开形）
        │ 命宫命中 ✗ 其余 11 键永远 miss          │ 与 PALACE_NAMES_ORDER 同域
        ▼ 可选链静默吞                            ▼ patron.ts 直查命中
  patron.ts map?.kui ── 内容静默缩水            invariants: 键域互证 + 12 宫齐 ── miss 即红
```

## 验收

- 行为变化是**预期的内容扩展**：魁钺落其余 11 宫的盘开始出细分文案（本候选是缺陷修复，不是逐字节等价收敛，验收改为「新增文案逐条有表可溯」）。
- DEMO 样例盘若命中新分支，selftest / cli-samples 快照随之更新（cli-samples 产物重导）。
- 三件套：typecheck 0 错误、selftest 全绿（断言组如有快照断言按实态锚定）、`npm test` 300 条对拍不受影响（基准只管排盘字段）。
- invariants 新断言当场抓改键前的旧表（先写断言看它红，再改键看它绿——期望值来自独立路径）。

## 落地注意

- 「内核层测试项数」纪律：invariants 若归属内核层，登记键域互证会动该项数——按 AGENTS.md 约定先查 `test/README.md` 层表确认归属，若属内核层，在 change 里显式说明项数变动理由（守卫补网是内容键域扩展，非插件越界）。
- 规范面：键域口径已在 AGENTS.md 项目约束节，本次是使实态归位；invariants 守卫面变化触及 quality-gates，走 openspec change。
- 引文纪律：魁钺断语是既有内容逐字保留，不新增「倪师 + 引号句」形态，不动 grades 登记表。
