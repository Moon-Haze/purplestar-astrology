# Design

## Context

现状与动机见 proposal.md「Why」。实施要面对的既成事实：

- 整理逻辑（`staticLines` 节过滤 + `classifyOracle` 分类）**已在工具侧**（`tools/db/export-manual.ts`），不在内核——迁移是「同一整理逻辑换产物通道」，不涉及把逻辑搬进 `scripts/`。
- 样本库读取、`classifyOracle`、`manual:check` 对拍机制（`emit()` 落盘/内存双形态）均可复用。
- 渲染端 `knowledge/sources/oracle.ts` 消费 `OracleStar`（`types.ts` 定义），该类型与渲染逻辑零改动是本设计的目标约束。
- `node:sqlite` 在 Node ≥ 22.13 免 flag（本仓门槛 ≥ 22.18 成立；本机 26.12.1 实测可用），只读打开走 `DatabaseSync` 的 `readOnly` 选项。

## Goals / Non-Goals

**Goals:**

- 198 MB 生成 TS → 字节可复现的只读库（实况 41.6 MB，规划期 5–10 MB 预估错因：v4 静态内容本身即 v3 的数倍，且 SQLite 明文不压缩——texts 明文 ~28 MB 是去重后静态断语的真实体量）；oracle 域检索输出逐字不变。
- 过滤纪律修复（动态节黑名单）与数据形态切换一步到位，不留中间态。
- 引文守卫、键域互证、漂移探针三个守卫面在库形态下不降级。

**Non-Goals:**

- 不设计跨库事务、写路径或增量更新——库是纯构建产物，唯一写方是建库管线。
- 不做 FTS 全文索引或分词——`LIKE` 子串匹配已满足「跨主题查一句断语」的检索需求，与 books 域的子串匹配同口径。
- 不动 `docs/manual/` md 归档的生成逻辑。

## Decisions

### D1: 表结构——单断语行表 + section 编码，配两张结构表

```sql
-- 维表
CREATE TABLE topics (id INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE);   -- 13 实体主题
CREATE TABLE stars  (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);  -- 十四主星
CREATE TABLE texts  (id INTEGER PRIMARY KEY, body TEXT NOT NULL UNIQUE);  -- 行文本字典

-- 断语行表：mods/summary/main_palace/kui_yue/other/extras/三方四正 统一承载
CREATE TABLE lines (
  topic_id INTEGER NOT NULL, star_id INTEGER NOT NULL,
  section  TEXT NOT NULL,    -- 'mods'|'summary'|'main_palace'|'kui_yue'|'other'|'extra:<节名>'|'san_fang:<宫名>'
  ord      INTEGER NOT NULL, -- 首现序
  text_id  INTEGER NOT NULL REFERENCES texts(id),
  PRIMARY KEY (topic_id, star_id, section, ord)
);

-- 结构表：带附属字段的形态单独成表
CREATE TABLE patterns (topic_id, star_id, ord, name, text_id REFERENCES texts(id),
                       PRIMARY KEY (topic_id, star_id, ord));
CREATE TABLE sihua    (topic_id, star_id, ord, text_id, note_id REFERENCES texts(id),
                       PRIMARY KEY (topic_id, star_id, ord));   -- note_id 可 NULL
```

三方四正的宫名与主题专属节名是**开放集**，用 section 前缀编码而非物理分表：
加一个节形态 = 分类器多识别一种行，零 DDL、零组装层分支——接缝判据成立
（对照：物理分表 `san_fang_stars`/`san_fang_items` 要为开放集宫名建动态表族，
组装层 SQL 数量随形态增长，是耦合换位置）。`san_fang` 的星曜概览变体行
（`▍` 头下的星名行）编码为 `san_fang_stars:<宫名>`，与断语行区分，组装层由此重建
`SanFangEntry.stars`。

备选「整星 JSON payload」被 proposal 否决（失去行级查询）；「全规范化到
`san_fang_items` 物理表」在此否决：deletion test 不通过——删掉 section 编码换成
物理分表，`classifyOracle` 与组装层都要跟着表结构长，复杂度搬家而非集中。

**索引只建查询要用的**：`lines(topic_id, star_id)` 组合与 `texts(body)` 唯一索引，
`patterns`/`sihua` 的主键即索引。多建索引既变大库又增加插入序敏感面。

### D2: 建库工具归属——扩展 `export-manual.ts`，新增 `db` 子命令、删除 `code`

`export-manual.ts` 已持有样本库读取、`compactPalaceKey` 归一、`staticLines`、
`classifyOracle`、`emit()` 双通道（写盘/内存对拍）。新开脚本会把这五件复制或导出，
deletion test 不过。`code` 模式与其渲染函数随迁移删除，`--check` 机制沿用：
check 模式下建库产物收进内存、对已提交 `oracle.db` 做 sha256 对拍。

### D3: 字节可复现的手段清单

SQLite 的自由度（隐式 rowid、freelist、页分配）都会破坏同输入同字节。手段：

- 全表显式 `INTEGER PRIMARY KEY`（不用隐式 rowid 分配），不用 `AUTOINCREMENT`；
- 插入序完全固定：topic → star → 分类槽 → 首现序（`classifyOracle` 的数组序即源）；
- 固定 `PRAGMA page_size`；建库连接关 journal（`journal_mode=OFF` + `synchronous=OFF`，
  纯构建产物无崩溃恢复需求）；写完 `VACUUM` 收掉 freelist；
- 验收：连续两次建库 sha256 相同（进 tasks，亦为 `manual:check` 的前提）。

### D4: 运行时组装——薄函数层，不引 Repository 抽象

`corpus/data/manual/index.ts` 保留 `loadTopicOracle(topic)` 签名（消费端零改动），实现改为：
模块级懒初始化的 `DatabaseSync`（readonly 单例）+ 三条参数绑定查询（lines / patterns / sihua）
+ 一个组装函数把行流重建为 `OracleStar`。**不引入** Repository/DAO 类——`node:sqlite` 的
同步 API 已经够薄，再封一层是「删掉会少写几行」答不出的抽象。

组装函数是「库结构 → `OracleStar`」的唯一映射点（复杂度集中而非搬家：TS 形态下
`loadTopicOracle` 承担同一角色）。`study` 别名在查询入口映射到 `career`（`TOPIC_CONTENT_SOURCE`
现有映射复用），库内无 study 行。库缺失/损坏抛带重建指引的错误，不兜底。

### D5: 引文守卫双层——建库期拦截 + 测试期抽取扫描

- **建库期**：入库前对每行文本跑引文校验（复用 `test/lib/citation-guard` 的比对逻辑，
  该逻辑随迁移下沉到 `tools/` 或独立共享模块，test 与建库工具共同 import——避免 test/lib
  被 tools 反向依赖的层次倒置）。核对表外的引文形态直接建库失败。
- **测试期**：`citations.test.ts` 的 `.ts` 扫描组保留；新增「从 oracle.db 抽取全部行文本」
  的扫描组跑同一比对。库是二进制，不抽取则守卫对最大的一片引文面失明。
- 台账（`annotations.ts`）双向：漏登记在建库期拦住（进不了库）、在测试期拦住（已入库的
  报红），两道闸的判据同一处代码。

### D6: 13 个主题 TS 文件删除 + `types.ts` 归宿

`types.ts`（`OracleStar`/`SanFangEntry`/`SihuaEntry`）是渲染端与组装层的共享契约，
**保留**（从生成文件转正为手写契约文件，删去生成头注释）。`combo-frequency.ts` 保留 TS。
13 个主题文件与 `code` 模式渲染器删除。`.gitattributes` 给 `*.db` 标二进制，避免 diff 噪声。

## 不可逾越的约束

- 分层红线：`corpus/` 数据层 SHALL NOT import `cli/`；组装层只依赖 `node:sqlite` 与 `analysis/data` 的类型。
- 断语内容唯一源头是 `analysis` 内核：库内行文本 SHALL 逐字来自样本库预计算文本，建库管线不产新断语、不拼装改写。
- 「报错 + 指路」纪律：库缺失不兜底；SQL 纪律同 `query.ts`（固定字面量 + 参数绑定）。
- 生成物纪律：`oracle.db` 不手改，修订链 = 改内核 → `build:db` → 重建库。
- 「跳过必须可见」「计数类事实不写死」照常适用（探针跳过标注、条数自报）。

## Risks / Trade-offs

- **[22.x–24.x 环境可能输出 `ExperimentalWarning` 到 stderr]** → 不影响退出码与 stdout 产物；
  README/SKILL.md 环境要求处注明；26.x 实测无警告。
- **[库为二进制，git diff 不可读]** → `manual:check` sha256 对拍 + `docs/manual/` md 归档承担
  人读与引文抽验；`.gitattributes` 二进制标记防伪 diff。
- **[重导即换整库 blob（实况约 41.6 MB）]** → 相比现状每次重导 200 MB 级文本 blob 已降近一个数量级
  以上；历史 blob 清理是独立决策（proposal 已排除）。
- **[黑名单甄别不全 → 动态节残留]** → 实施第一步先产出全主题 extras 节名实跑分布清单，
  按第二人称/按盘枚举特征逐节定案；探针与库体积（重建后回 40 MB 量级、动态节零残留）是残留的
  双重报警器。
- **[断言面迁移遗漏 → 假绿]** → 640bfb2 曾把结构断言锚到 v4 TS 实态，本次断言改读库后
  必须重新锚定并复核「断言盯的是行为还是数据快照」；`selftest` 三段合计数自报变化须
  与文档陈述同步（计数不写死）。

## Migration Plan

1. 产出全主题节名分布清单 → 定黑名单增补（公共前缀，独立可验证）。
2. `export-manual.ts` 增 `db` 子命令（含 D3 复现手段 + 建库期引文校验），跑出 `oracle.db`。
3. 运行时通道切换（D4）+ 删 13 个 TS 与 `code` 模式——同一提交原子落地，不留「库与 TS 并存」的中间态。
4. 守卫与断言迁移（D5 + invariants/cli.test/selftest 重锚）。
5. 文档同步（AGENTS.md、SKILL.md/references、漂移注释、`.gitattributes`）。
6. 回归：`typecheck` + `selftest` + `npm test` 三件套、`manual:check`、`npm run pack`（解压自检含分发形态 oracle 域可用）。

回滚：单 commit（步骤 3 的原子切换）可 `git revert` 整体回退；建库管线与黑名单修复独立成 commit，回滚不影响过滤纪律的正确性。

## Open Questions

- 全主题动态节甄别清单的完整枚举（除「针对你的命盘」「四化路径 · 你这盘」外是否还有散见的
  第二人称节）——不影响 spec 与表结构，实施步骤 1 以实跑分布定案。
