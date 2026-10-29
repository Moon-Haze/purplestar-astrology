# Design

## Context

见 `proposal.md` 的 Why。当前三处消费方的**宫范围本就不同**，这一点决定了收敛的形状：

- `context.ts:128-142` → `getSanFangSiZheng(chart, TOPIC_PALACE_NAME[topic])` = **主题主宫**三方四正，
  经 `getPalaceMutagen`（`palace-query.ts:65-66`，不限主星）填 `mutagenInSanFang`；
- `views/decadal.ts:54-57` → **大限宫**（`currentDx.palaceBranch`）三方四正，只取 `major`；
- `views/yearly.ts:47-54` → **流年宫**（`lnYearBranch`）三方四正，只取 `major`。

所以可共享的只有「**给定宫集合 → 取其中会照的本命四化**」这一步，三处各自的宫集合与渲染文案不合并。

连带面（改口径会牵动的另外两处，非本次新增规则）：
`views/year-stem.ts:35-37` 的 `alreadyShown`（键 = `星名-四化-宫名`）与 `views/suggestions.ts:70-82`
的禄 / 忌槽都直接消费 `mutagenInSanFang`。

## Goals / Non-Goals

**Goals:**

- 「三方四正会照本命四化」只有一个星曜口径，且该口径写在规范里。
- 三处消费方从同一处取数，口径差异从「三处各写一遍」变为「一处可断言」。
- 为四节输出补上当前为零的断言覆盖。

**Non-Goals:**

- 不合并三处的宫范围（主题 / 大限 / 流年三方四正是三条不同的问题）。
- 不动 `patterns/` 层的两种既有口径（见 Decision 1 的代价）。
- 不新增扩展点 / 注册表（本次不是扩展点，是一条既有规则的收敛）。
- 不给辅星补语义注句（`getMutagenNote` 只对 14 主星有注，辅星行仍无注；补注属内容扩展，另行提案）。

## Decisions

### Decision 1 · 口径 = 会照集合含辅星四化（文昌 / 文曲 / 左辅 / 右弼）

**选它的理由**：`scripts/data/sihua.ts:22-33` 的 `SI_HUA_TABLE` 就是古典生年四化表，丙 / 戊 / 己 / 辛 /
壬五年干本就化到这四颗辅星，与 iztro 同源；「本命四化会照」节（`views/mutagen.ts:29-32`）当前已在输出
辅星四化行（`docs/manual/topics/wealth.md` 可见「文昌化科」「左辅化科」）；而 decadal / yearly 的
`type === "major"` 过滤**找不到任何命理依据**——倪师原法说的是「四化星永远固定在那个宫上面不要动」，
讲宫位移动，不是讲只算主星。

**否决的备选 B（统一成只主星）**：唯一支撑是「与 `patterns/basic.ts` 的科权双会口径一致」。否决理由：
`test/invariants.test.ts:1038` 已把那处注释为「**实现限定** `type === "major"`」，是格局判定的实现取舍，
不是命理口径；拿实现限定去反推论断口径，等于把偶然当依据。

**后果两面**：
- 收益：口径与 `Star.mutagen` 字段、古典四化表、既有节三输出三者一致；综合建议的信号集更全，
  不会因「只算主星」在辅星为唯一信号时误降级。
- 代价：大限 / 流年两节新增辅星四化行，部分盘的「未会本命四化」兜底句不再出现；`year-stem` 的
  回补行相应减少；与 `patterns/` 层的口径不一致仍然保留（本次刻意不动，见 Non-Goals）。

### Decision 2 · 抽出「宫集合 → 会照条目」一个查询，落在既有 `palace-query.ts`

**为什么是它**：`palace-query.ts` 已经是宫位查询的聚集地（`getPalaceStars` / `getPalaceMutagen` /
`getSanFangSiZheng`），新增一个导出即可，不新增模块、不改现有签名；新查询内部复用 `getPalaceMutagen`
（单宫取四化星），层级保持「单宫 → 宫集合」两跳。

**三问**：
- **deletion test**：删掉这个查询，三处各自要重写遍历 + 星曜过滤 + 结构化拼装，复杂度**分散回三处**
  ——是集中，不是搬家。
- **接缝判据**：不适用（本次不加扩展点）；落点判据是「一个既有文件 + 一个新增导出」。
- **抽象 justify**：删掉它，三处各多写约 6 行遍历与过滤，且口径会再次分叉——这正是本次要治的病。

### Decision 3 · 口径不做成入参

若做成「是否只算主星」的开关，等于把命理判断推回每个调用方，口径会再次分叉（就是现状病因）。
代价：`patterns/` 层若要别的口径需自己写（它本来就自己写，不受影响）。

### Decision 5 · 顺带修「本命四化」槽（范围扩大，用户拍板）

`scripts/analysis/suggestions.ts` 里那句 `ctx.mutagenInSanFang.find(m => m.mutagen === t.kind)`
两侧不同形（中文四化字 vs `lu` / `ji`），**该槽从未命中过**——实测 2011-06-24 与 1949-06-15 两张盘的
wealth 主题，`mutagenInSanFang` 都有条目（文昌化忌 / 文曲化忌），建议里却只有「主星亮度」与「当前大限」。
修法：改经既有的 `SIHUA_CHAR_TO_KEY`（`data.ts:2902`）对形，不新立映射表。

**后果两面**：
- 收益：`interpretation-content` 的「综合建议按盘推算」承诺的本命四化信号名副其实；口径统一后
  辅星四化能真正成为建议信号，新增的「辅星四化不判为缺失」scenario 才立得住。
- 代价：**输出面扩大**——所有三方四正内有四化的盘、13 个主题都会多一句建议，即基线差异清单
  从三类变四类（第 4 类 = 综合建议新增「本命 X 化 Y」句）。

**否决的备选**：拆成独立 change，保持本次行为面干净。否决理由：口径与建议信号属同一条链路
（辅星四化 → 会照集合 → 禄 / 忌槽），分两次做会让「辅星到底算不算信号」这个判断在两个 change
里各答一次。

### Decision 4 · 断言分两层放

- **口径级**（会照集合的成员与边界）进 `scripts/cli/selftest/`——它是分发包内唯一能跑的自检，
  `npm run pack` 的解压自检会带上它。
- **输出级**（四节文案计数、反向注入特定年干盘）进 `test/`——那里有语料与外部对拍能力。
- 判据形态遵循 `config.yaml` 的 specs 规则：断言 / 逐字节 diff / 计数 / 反向注入四选一。

## Risks / Trade-offs

- **[口径判断有误]** 若倪师实批大限只看主星 → 缓解：单点化后翻转口径只改查询内一处；
  且口径已写进规范，推翻需走 openspec 提案而非顺手改代码。
- **[输出变了没人知道]** 现有四节零断言覆盖 → 缓解：先取基线，交付「预期内差异清单」，
  只应出现三类变化（新增辅星四化行 / 兜底句消失 / 回补行减少）；出现第四类即停下来复查。
- **[降级场景失去覆盖]** 信号变全后 `test/topic-suggestions.test.ts` 的「信号缺失显式降级」
  可能不再自然触发 → 缓解：另造一盘反向注入，保证该 scenario 仍有覆盖。
- **[生成物漂移]** `docs/manual/topics/*.md` 是 `tools/db/export-manual.ts` 的生成物 → 缓解：
  改生成器 + 重导，禁止手改产物。
- **[读者误以为全仓已统一]** `patterns/` 层仍两种口径 → 缓解：本文件与 spec 都显式记录不在本次范围。

## Migration Plan

1. **取基线**（`ZIWEI_NO_CACHE=1`）：覆盖丙 / 戊 / 己 / 辛 / 壬五个年干各一盘 + 一个非这五年干的盘，
   导出 `--topic <若干主题>`、`--report`、`--view daxian|liunian` 输出至临时目录（不入仓）。
2. 在 `palace-query.ts` 落查询，`context.ts` / `views/decadal.ts` / `views/yearly.ts` 改为消费它。
3. 与基线 diff，产出「预期内差异清单」，逐条确认属于上述三类。
4. 补断言（口径级 + 输出级各至少一条，含反向注入）。
5. 三件套：`npm run typecheck` → `node scripts/purple-star.ts selftest` → `npm test`
   （回归恒设 `ZIWEI_NO_CACHE=1`，退出码直取命令本身，不接管道）。
6. `docs/code/analysis.md` 8.5 / 8.6 补一句口径说明，使文档与代码同口径。

**回滚**：本改动为单 commit，`git revert` 即可；若口径被推翻为 B，只需改查询内一处过滤——
这正是本次深化换来的东西（改前要动三处，且三处都不在测试视野内）。

## 不可逾越的约束（不可动项）

- 排盘与运限四化以文墨天机为准，论断严格按倪海厦《天纪》三合派；飞星派（宫干自化、来因宫）禁用。
- `test/kernel-contract.test.ts` 冻结面（`algorithm` / `palace-relations` / `mutagen` /
  `wenmo-brightness`）不破；`extensibility` 定义的内核面不碰。
- `Star.mutagen` 字段口径不变（`chart-kernel.md:130-133`：直接取自 iztro，无四化时为空串）。
- `report-assembly` 的「四化注首现原则」（注句全报告一次、落点行恒出）在口径变化后仍需成立。
- 「宁可启动失败，也不静默产出错盘 / 错论断」——口径变更必须**可见**：差异清单 + 新断言，缺一不做。
