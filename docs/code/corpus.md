# corpus —— 古籍语料

本篇覆盖 `scripts/corpus/`：`index.ts`（入口）· `types.ts`（形状）·
`data/gusuifu.ts`（《骨髓赋》）· `data/quanji.ts`（《紫微斗数全集》精选）·
`data/quanshu.ts`（《紫微斗数全书》精选）· `data/tianji.ts`（倪师《天纪》判语快照）·
`data/annotations.ts`（倪师引用核对表）· `data/patterns.ts`（格局判词表）·
`data/manual/index.ts`（断语手册懒加载入口）· `selftest-asserts.ts`（古籍检索自检断言组）。

收录的是这些文件里 **B 类模块头论文**与 **C 类 ⚠️ 防呆警告**的原文；A 类 TSDoc 契约与
D 类口径锁留在源码。分类判据见 [README.md](README.md)。

---

## 一、`index.ts`：入口与「顺序即语义」

> 古籍原典查询库 — 入口
>
> 汇总三部古籍数据 + 提供「按 slug / 章节序号 / 段落 id 取用」与「全文检索」两组 API。
> 数据以 TS 模块静态打包进代码（见 `data/`），零 DB 依赖、零网络请求。

### 1.1 `ALL_BOOKS` 的数组顺序

> 数组顺序即 {@link searchClassics} 的命中顺序（按书 → 章节 → 段落逐层遍历），
> 也是 `classics` 命令默认列出的顺序；调整顺序会改变检索结果的排列。

### 1.2 `TOTAL_PARAGRAPHS`：哨兵

> 模块加载时一次性算出。用于首页统计与 `classics` 命令的概览输出
> （`selftest` 也拿它当「数据源可用」的哨兵）。

---

## 二、`types.ts`：静态数据设计

> 古籍原典查询库 — 类型定义
>
> 设计：所有古籍以静态数据打包进代码（`data/*.ts`，是 TS 模块而非外部 JSON 文件；
> 收录的都是公版古籍，无版权风险）。线上站点（Next.js）启动时一次性加载到内存，
> 零 DB 依赖。

---

## 三、`data/annotations.ts`：防回流禁语清单

> 「倪师引用」文献核对记录 —— 本仓内核中所有「倪师/倪海厦」引用的文献核对表。
>
> 数据源：reference/ziwei-samples-toolkit/corpus/annotations.json
> 本仓的 v3 已清掉全部 fabricated，存活 suspect 的强归属也已
> 清修为「古诀云 / 紫微斗数有云 / 一说」—— 本模块因此转为**防回流禁语清单**，
> 由 `scripts/cli/selftest/index.ts` 的「未核实引文不得冒充倪师原话」断言消费。

⚠️ 表内 `note` 字段记录的是核对时发现的方法论偏离（如「倪师疾厄论断以宫位地支为主轴，
非按星曜五行」「疑似北派钦天体系，非倪师原话」「北派飞星核心方法与三合派立场冲突」），
它们是**判据**不是文案 —— 新增引文前先读这里。

---

## 四、`data/patterns.ts`：格局判词表

> 格局层的**数据**：常量、名字裁决表与判词表（自 `patterns/data.ts` 迁入语料域）。
>
> 本模块只放「有什么」，既不放形状也不放判定 —— 结构体与识别器入参在
> `patterns/types.ts`，识别器按分组散在 `patterns/superior.ts` /
> `medium.ts` / `enhancing.ts` / `basic.ts` / `converged.ts`，装配在 `index.ts`。
> 分工是形状 / **数据** / 判定，改哪一层就只需读哪个文件。
>
> 判词表（{@link PATTERN_VERDICTS}）住在本文末尾，表键口径见该分区上方的注释。
> 判词里 `{星}` / `{宫}` 这类占位符，由 `helpers.ts` 的 `fillVerdict` 在调用点填。
>
> ⚠️ 本文件里的 `{@link}` 只指向**本文档内**的符号 —— 跨文件 TSDoc 解析不到，
> 提到 `helpers.ts` 的函数（`hasShaInPalace` 等）时直呼其名，不加链接。

---

## 五、三部古籍数据：`wordCount` 是全书口径

### 5.1 《紫微斗数全书》（`data/quanshu.ts`）

> 《紫微斗数全书》数据 —— 核心精选。
>
> 明代罗洪先编。本文件收录 7 章：十二宫论·命宫、十二宫论·财帛宫、十二宫论·官禄宫、
> 十二宫论·夫妻宫、四化论、机月同梁格、双禄朝垣格。
>
> ⚠️ 同《全集》：`wordCount: 100000` 是文件顶部说明里「全本约 10 万字」的**全书**
> 粗略字数，不是本文件节选部分的字数。
>
> 段落 id 前缀为 `qs-<章号>-<段号>`（如 `qs-1-1`）；{@link ALL_BOOKS} 以
> `slug` = `"quanshu"` 收录本对象。
>
> 「四化论」一章（`qs-5-2`）写明生年四化永远固定、倪师不主张北派飞星派的自化 /
> 宫干飞化 / 来因宫 —— 与本项目「三合派」体系立场一致，可作解读时的原文依据。

### 5.2 《紫微斗数全集》（`data/quanji.ts`）

> 《紫微斗数全集》数据 —— 精选章节。
>
> 明代刊本，相传由陈抟祖师传授。本文件收录 5 章核心论述：卷一·总论、卷二·紫微星论、
> 卷三·南斗六星论、卷四·北斗六星论、卷五·四化与格局论。
>
> ⚠️ `wordCount: 80000` 是文件顶部说明里「全本约 8 万字」的**全书**粗略字数，
> 不是本文件节选部分的字数 —— 本文件是节选，未来可续补。
> 段落 id 前缀为 `qj-<卷号>-<段号>`（如 `qj-1-1`）；{@link ALL_BOOKS} 以
> `slug` = `"quanji"` 收录本对象。

### 5.3 《骨髓赋》（`data/gusuifu.ts`）

> 《骨髓赋》数据。
>
> 公版（明代刊本）。是紫微斗数最权威、最浓缩的口诀，长约 1500 字。
> 倪师在《天纪》中多次援引此赋。

---

## 六、`data/tianji.ts`：倪师《天纪》判语快照

> 倪海厦《天纪》紫微斗数判语（生成快照）—— 由 tools/corpus 下的导入工具从
> nihai-tianji-corpus（倪海厦《天纪》结构化语料库）导入。
>
> ⚠️ 来源与许可：语料 **CC BY-NC-SA 4.0**（署名—非商业—相同方式共享）；
> 本文件只收录紫微斗数相关五册（主星 / 十二宫 / 格局 / 四化 / 疾厄）。
> 每条带 [part §section @时:分:秒] 溯源，回放 URL 见 `replayUrl`。
>
> ⚠️ 生成文件 —— 重导命令：npx tsx tools/corpus/import-tianji.ts，**不要手改**。

---

## 七、`data/manual/index.ts`：断语手册的懒加载入口

> 断语手册数据（analysis/manual/）的查询入口 —— 按主题懒加载。
>
> ⚠️ 本目录是**生成数据**（内核域 analysis/manual，不在 analysis/index.ts 公开面）：CLI 主链路不
> import 这些文件（零启动开销），需要消费时经本入口动态引入。
>
> ⚠️ 生成文件 —— 由 `npx tsx tools/db/export-manual.ts code` 生成，**不要手改**。

⚠️ `LOADERS` 的 14 个键与 `TOPIC_KEYS` 一一对应（含别名视图主题 `study`）；
`loadTopicOracle` 在文件缺失（未导出）时抛**带指引**的错误，提示先跑
`npx tsx tools/db/export-manual.ts code`（前置：`npm run build:db`）。

---

## 八、`selftest-asserts.ts`：古籍检索自检断言组

> 古籍检索自检断言组 —— 从 classics 自带的 selftest.ts 抽出。
>
> 断言体基本原样；适配点只有一类：**参数面断言改跑合并后的根 CLI**
> （`node scripts/purple-star.ts knowledge …`，命令原名 classics、四域合并时改名），
> 因为它不再有独立入口。
>
> 合并引擎（cac 底座）在 `--limit -3` 贪婪取值与取值参数裸写拒收上与 classics
> 原自研解析器不同 —— 那两条断言按 `util.parseArgs` 引擎的真实行为钉死
> （见各断言注释）。
>
> 与 `cli/selftest/index.ts` 的接口：导出 {@link asserts}（收主 selftest 注入的
> {@link SelftestDeps} —— call / runCli / ctx / ok 与排盘段同一套，不再本地手搓），
> 逐条结果由主 selftest 汇总（报告分三段：排盘 / 古籍 / 合盘）。

### 8.1 判据是逐部点名，不是数长度

> 判据是**逐部点名**而不是「数组长度等于 3」：长度断言在「少了一部、多了一部」
> 两种故障上都只能给出一句「不等于 3」，指不到缺的是哪一部。

### 8.2 动态 import 打断静态环

> 命令表与作用域键集：动态 import 打断「commands → selftest → 本文件」静态环
> （Cmd 已放宽为可返回 Promise），取代旧的「读源码文本做正则匹配」——
> 那会让 commands.ts 与 option-scope.ts 的物理排版成为契约。
