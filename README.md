# 紫微斗数（purplestar-astrology）

倪海夏《天纪》**三合派**体系的紫微斗数排盘与解读 skill，供 Claude Code 使用。

本仓是这些 skill 的**源仓库**：`skills/` 下每个子目录就是一个自包含 skill，各有自己的
`SKILL.md`、内核与 `package.json`，**可单独拷走安装**——只查古籍原文的人不必连排盘引擎一起装。
⚠️ 唯一的例外是合盘 skill：它不排盘，命盘由排盘 skill 产出，故两者要装在一起才能跑通。

## 这是什么

一个 Claude Code skill 集合：用户给出出生年月日时与性别，Claude 调用对应 skill 完成排盘、
格局识别、四化推演、大限流年与合盘解读，并可检索三部古籍原文。

排盘由 `iztro` + 本项目内核的确定性算法产出，**不靠模型推算**——CLI 负责算，模型只负责解读。

体系立场：严格三合派，不使用飞星派的宫干自化、大限四化取宫干、来因宫。详见各 skill 的 `SKILL.md`。

每个 skill 的 `SKILL.md` 是**骨架**——只放每次触发都要用的东西（路径约定、必须问清的输入、晚子时陷阱、
体系约束、已知口径、命令速查）。排障、输出契约全文、参数面细则、工作流详展开都在同目录的
`references/` 下，由 `SKILL.md` 写明「何时读它」——**没被读到就不占上下文**。这是 Claude Code 的渐进披露：
进上下文的只有 `SKILL.md` 本身，`scripts/` 下上万行内核一行都不进（它只在 Node 里执行）。

## skills/ 一览

| skill                                                | 做什么                               | 内核                                |
| ---------------------------------------------------- | ------------------------------------ | ----------------------------------- |
| [purplestar-astrology](skills/purplestar-astrology/) | 排盘与命盘解读（**源**）             | CLI + `ziwei/`，含排盘引擎          |
| [purplestar-synastry](skills/purplestar-synastry/)   | 合盘与合婚（双宫联参）               | 合盘断语（自有），零排盘引擎        |
| [purplestar-classics](skills/purplestar-classics/)   | 古籍原文检索（骨髓赋 / 全集 / 全书） | 原文数据 + 检索（自有），零排盘引擎 |

「自有」= 那份内核**只住在这一个 skill 里**，源仓库里没有第二份，因此没有「改源再同步」这回事。

## 安装

```bash
# 项目级：只在该项目内可用
cp -r <本仓库>/skills/<skill-name> <项目>/.claude/skills/<skill-name>

# 个人级：所有项目可用
cp -r <本仓库>/skills/<skill-name> ~/.claude/skills/<skill-name>
```

目录名必须与 `SKILL.md` frontmatter 的 `name` 一致，Claude Code 据此发现技能。

`node_modules/` 不必拷（已在 `.gitignore` 中），落位后补一次依赖：

```bash
cd ~/.claude/skills/<skill-name> && npm install
```

## 直接用 CLI

以下命令均在**仓库根**执行（装到 `~/.claude/skills/` 之后，把 `skills/<skill-name>/` 前缀去掉
即可——skill 内部一律以 skill 根为基准）：

```bash
# 排盘 + 格局 + 四化 + 大限，解读所需数据一次给全
node skills/purplestar-astrology/scripts/purple-star.ts analyze \
     --date 1990-05-15 --time 09:30 --city 北京 --gender male

# 合盘：本 skill 不排盘，命盘先由上面那个 skill 各排一张（数据解耦，契约只有 JSON）
node skills/purplestar-astrology/scripts/purple-star.ts analyze \
     --date 1990-05-15 --time 09:30 --city 北京 --gender male --json > /tmp/a.json
node skills/purplestar-astrology/scripts/purple-star.ts analyze \
     --date 1993-08-22 --time 14:00 --city 上海 --gender female --json > /tmp/b.json
# 再把两份 JSON 交给合盘 skill（必须来自 analyze 而非 chart：后者没有四化落宫与排盘依据）
node skills/purplestar-synastry/scripts/purple-star.ts synastry \
     --a-chart /tmp/a.json --b-chart /tmp/b.json
# 合盘方法论与评分标准：读 skills/purplestar-synastry/references/synastry-guide.md（静态参考）

node skills/purplestar-classics/scripts/purple-star.ts classics --search 机月同梁
node skills/purplestar-astrology/scripts/purple-star.ts help        # 本技能的命令与参数
node skills/purplestar-astrology/scripts/purple-star.ts selftest    # 回归自检

npm test                                 # 排盘基准回归（300 条样本，约 8 秒）
npm run typecheck                        # 类型检查（必须 0 错误）
```

每个 skill 的 CLI 都可从**任意 cwd** 用绝对路径跑，不依赖当前目录。

## 目录结构

```text
.
├── skills/               # 每个子目录 = 一个自包含 skill（可单独安装）
│   ├── purplestar-astrology/   排盘解读，**唯一排盘**
│   │   ├── SKILL.md            技能定义（Claude Code 入口，骨架）
│   │   ├── references/         骨架的延伸：工作流 / 输出契约 / 参数面 / 排障，按需加载
│   │   ├── package.json        该 skill 自己的依赖
│   │   └── scripts/            CLI 与排盘内核同处一层（内核根）
│   │       ├── purple-star.ts  引导层：定位内核根 → 注册 TS 钩子 → 分发命令
│   │       ├── cli/            参数解析 / 旗标作用域 / 渲染 / 出生信息 / 命令 / 自检
│   │       └── ziwei/          排盘算法、格局库、四化、城市经纬度
│   ├── purplestar-synastry/    合盘：断语库与 references/ 自有，零排盘引擎（命盘读自源）
│   │                           scripts/ 平铺，无 cli/ 一层，import 写全 .ts（无解析钩子）
│   └── purplestar-classics/    古籍检索：原文数据与检索自有，零排盘内核（同上）
├── tools/                # 开发工具（DuckDB 语料、基准），不进任何 skill
├── test/                 # 基准测试（见 test/README.md），不进任何 skill
├── tsconfig.json         # 仅供 npm run typecheck，不参与运行
├── package.json          # 仓库级：测试与工具的依赖
└── node_modules/         # npm install 生成（已 gitignore）
```

## 环境要求

- **Node ≥ 22.15** —— 依赖 `module.registerHooks` 与原生 TypeScript 类型擦除（开发环境为 v26）。**直接运行不需要编译**，`.ts` 由 Node 自己擦类型。
- 依赖 `iztro` 2.6.1、`lunar-typescript` 1.8.6，由 `package-lock.json` 锁定，保证排盘结果不因环境分叉。
- 开发依赖 `typescript` / `@types/node`，只服务 `npm run typecheck`；不装也照样排盘。

## 数据来源

下表列的是每份知识的**归属地**（权威那一份）——归属已唯一化，不再用 `skills/*/` 通配：
一份内核只住在一个 skill 里，排盘归 `purplestar-astrology`，合盘断语归 `purplestar-synastry`，
古籍归 `purplestar-classics`。

| 内容                                     | 位置                                                       |
| ---------------------------------------- | ---------------------------------------------------------- |
| 排盘算法、格局库（含古籍出处与破格条件） | `skills/purplestar-astrology/scripts/ziwei/patterns/`      |
| 四化体系、流年流月推法                   | `skills/purplestar-astrology/scripts/ziwei/sihua.ts`       |
| 十四主星在夫妻宫断语、四化入夫妻宫       | `skills/purplestar-synastry/scripts/synastry-knowledge.ts` |
| 合盘方法论与评分标准                     | `skills/purplestar-synastry/references/synastry-guide.md`  |
| 中国城市经纬度（真太阳时校正）           | `skills/purplestar-astrology/scripts/ziwei/cities.ts`      |
| 三部古籍原文                             | `skills/purplestar-classics/scripts/data/`                 |

**不含**线上站点的 14 主星 × 13 主题论断库（`STAR_DB`）与 `lib/seo/`——它们未随 skill 分发，解读请依赖上表知识源。

## 来源

本项目的排盘内核提取自所参考的上游开源项目 [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu)（其 `package.json` 的 `name` 为 `ziwei-master`，是一个 Next.js 站点 + 完整 `lib/`）。

抽取时只保留了排盘与解读必需的部分——未含 `db-analysis.ts`（线上论断库）、`famous.ts`、`history.ts`、`share.ts` 以及整个 `lib/seo/`，那些是站点侧功能。

上游曾一并带上手写的 `lunar-javascript.d.ts` 类型声明（`lunar-javascript` 包自身不带类型，缺了它 `tsc` 会报 TS7016）。本项目现已改用同作者的 TypeScript 移植版 `lunar-typescript`，该声明随之删除——`lunar-typescript` 自带 `dist/index.d.ts`，`tsc` 直接取得到类型，无需手写。

## 三个 skill 互相独立

**没有任何一份内核住在两个 skill 里。** 每个 skill 的 `scripts/` 就是它自己的全部实现，
可单独拷进 `~/.claude/skills/` 直接跑。

三份内核的归属：

| 内核                                                    | 住在哪                 |
| ------------------------------------------------------- | ---------------------- |
| 排盘引擎、格局库、分析数据库、四化、城市经纬度          | `purplestar-astrology` |
| 合盘断语 `synastry-knowledge.ts` + 方法论 `references/` | `purplestar-synastry`  |
| 三部古籍原文 `scripts/data/`                            | `purplestar-classics`  |

2026-09-27 之前不是这样：`purplestar-classics` 与 `purplestar-synastry` 是排盘解读的**派生
skill**，共用的那些文件与源**逐字节相同**，靠 `tools/skills.ts` 声明切片、`npm run sync:skills`
复制、`test/repo.test.ts` 的层 6 守卫。断开来之后，整套同步机制（那两个工具文件与那条 npm
script）与层 6 里为此建的断言一并删除 —— **`npm run sync:skills` 已经不存在了**，别照着旧
文档去找它。

**唯一还成立的那句话**：排盘引擎只有一处实现，在 `purplestar-astrology/scripts/`。**改排盘
逻辑一律改那里**，改完跑 `npm test`，没有第二步。

另两个 skill **不排盘**：合盘消费源排好的 `analyze --json`（两个 skill 之间的契约只有那份
JSON，见 `purplestar-synastry/scripts/chart-view.ts` 自带的消费方类型契约），古籍检索压根没有
排盘内核。两者**零 npm 依赖**，`npm install` 都不需要。

仍然保留、且与派生关系无关的守卫在 `test/repo.test.ts`：每个 skill 自包含（可单独拷走）、
`package.json` 的 `type: module`、`SKILL.md` ↔ `references/` 双向一致、源的解析钩子候选序。
引文守卫（扫全仓每个 skill 的 `scripts/`）在 `test/citations.test.ts`。

## 开发

改完内核或升级依赖后，两层测试都要跑：

```bash
node skills/purplestar-astrology/scripts/purple-star.ts selftest   # 第一层：代码逻辑自洽
npm test                                 # 第二层：与 toolkit 样本的基准比对（约 8 秒）
node skills/purplestar-synastry/scripts/purple-star.ts selftest    # 另两个 skill 各测各的
node skills/purplestar-classics/scripts/purple-star.ts selftest

npm run test:corpus -- --year 1960       # 可选：全量核验（8,640 条，约 2 分钟）
npm run typecheck                        # 改过类型标注就该跑（必须 0 错误）
```

`selftest` 覆盖农历换算、真太阳时校正、晚子时等价性、城市名容错、排盘不变量、三合派体系约束与知识源可用性。`npm test` 则从 518,400 条 toolkit 样本中抽出 300 条，逐字段对标排盘结果——它与 `selftest` 分工不同：前者测「代码逻辑自洽」，后者是**外部基准比对**，能抓住固定样例漏掉的行为漂移。

`typecheck` 是第三类：只保证类型**自洽**，不保证类型**标得对**——用 `any` 绕过报错它一样全绿。所以内核里不使用 `any`。

测试的性质、效力边界，以及**升级 iztro 后该怎么办**，见 [test/README.md](test/README.md)。

## 许可证

MIT，见 [LICENSE](LICENSE)。Copyright (c) 2026 姚佚启态。
