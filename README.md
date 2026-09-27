# 紫微斗数（purplestar-astrology）

倪海夏《天纪》**三合派**体系的紫微斗数排盘与解读 skill，供 Claude Code 使用。

本仓是这些 skill 的**源仓库**：`skills/` 下每个子目录就是一个自包含 skill，各有自己的
`SKILL.md`、内核与 `package.json`，**可单独拷走安装**——只查古籍原文的人不必连排盘引擎一起装。

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

| skill                                                | 做什么                               | 内核                               |
| ---------------------------------------------------- | ------------------------------------ | ---------------------------------- |
| [purplestar-astrology](skills/purplestar-astrology/) | 排盘与命盘解读（**源**）             | CLI + `ziwei/`，含排盘引擎         |
| [purplestar-synastry](skills/purplestar-synastry/)   | 合盘与合婚（双宫联参）               | 排盘底座（副本）+ 合盘断语（自有） |
| [purplestar-classics](skills/purplestar-classics/)   | 古籍原文检索（骨髓赋 / 全集 / 全书） | `classics/`（自有），零排盘引擎    |

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

# 合盘（注意 a- / b- 前缀：漏了不会报错，会静默排出错盘）
node skills/purplestar-synastry/scripts/purple-star.ts synastry \
     --a-date 1990-05-15 --a-time 09:30 --a-gender male \
     --b-date 1993-08-22 --b-time 14:00 --b-gender female
# 合盘方法论与评分标准：读 skills/purplestar-synastry/references/synastry-guide.md（静态参考，不排盘）

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
│   ├── purplestar-astrology/   排盘解读，**源**
│   │   ├── SKILL.md            技能定义（Claude Code 入口，骨架）
│   │   ├── references/         骨架的延伸：工作流 / 输出契约 / 参数面 / 排障，按需加载
│   │   ├── package.json        该 skill 自己的依赖
│   │   └── scripts/            CLI 与排盘内核同处一层（内核根）
│   │       ├── purple-star.ts  引导层：定位内核根 → 注册 TS 钩子 → 分发命令
│   │       ├── cli/            参数解析 / 旗标作用域 / 渲染 / 出生信息 / 命令 / 自检
│   │       └── ziwei/          排盘算法、格局库、四化、城市经纬度
│   ├── purplestar-synastry/    合盘：排盘底座由上面派生，合盘断语与 references/ 自有
│   └── purplestar-classics/    古籍检索：`classics/` 与该命令自有，零排盘内核
├── tools/skills.ts       # 派生 skill 的切片声明（唯一源）
├── tools/sync-skills.ts  # 按声明同步副本
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
合盘与古籍的内核各只住在一个 skill 里，排盘内核则源是权威、派生 skill 里的是副本。

| 内容                                     | 位置                                                             |
| ---------------------------------------- | ---------------------------------------------------------------- |
| 排盘算法、格局库（含古籍出处与破格条件） | `skills/purplestar-astrology/scripts/ziwei/patterns/`            |
| 四化体系、流年流月推法                   | `skills/purplestar-astrology/scripts/ziwei/sihua.ts`             |
| 十四主星在夫妻宫断语、四化入夫妻宫       | `skills/purplestar-synastry/scripts/ziwei/synastry-knowledge.ts` |
| 合盘方法论与评分标准                     | `skills/purplestar-synastry/references/synastry-guide.md`        |
| 中国城市经纬度（真太阳时校正）           | `skills/purplestar-astrology/scripts/ziwei/cities.ts`            |
| 三部古籍原文                             | `skills/purplestar-classics/scripts/classics/data/`              |

**不含**线上站点的 14 主星 × 13 主题论断库（`STAR_DB`）与 `lib/seo/`——它们未随 skill 分发，解读请依赖上表知识源。

## 来源

本项目的排盘内核提取自所参考的上游开源项目 [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu)（其 `package.json` 的 `name` 为 `ziwei-master`，是一个 Next.js 站点 + 完整 `lib/`）。

抽取时只保留了排盘与解读必需的部分——未含 `db-analysis.ts`（线上论断库）、`famous.ts`、`history.ts`、`share.ts` 以及整个 `lib/seo/`，那些是站点侧功能。

上游曾一并带上手写的 `lunar-javascript.d.ts` 类型声明（`lunar-javascript` 包自身不带类型，缺了它 `tsc` 会报 TS7016）。本项目现已改用同作者的 TypeScript 移植版 `lunar-typescript`，该声明随之删除——`lunar-typescript` 自带 `dist/index.d.ts`，`tsc` 直接取得到类型，无需手写。

## 副本关系与同步

`skills/purplestar-astrology` 是**排盘内核的源**，派生 skill 的排盘底座是它的副本：

```bash
npm run sync:skills             # 把源同步到各派生 skill
npm run sync:skills -- --check  # 只比对不写（提交前 / 想知道有没有漂移时）
```

切片不是写死的文件清单，而是由 `tools/skills.ts` 的入口清单算出 **import 闭包**——
日后往内核加一个文件，它会自动落进正确的 skill。**改排盘内核一律改源**，改完跑一次同步。

副本与源**逐字节相同**，由 `test/repo.test.ts` 的层 6 断言守卫；不一致时 `npm test` 变红并
指名是哪个文件。

三类文件不在此列，各有各的守卫：

- **各 skill 自写**：`purple-star.ts` / `cli/commands.ts` / `cli/selftest.ts` / `cli/flag-scope.ts` /
  `SKILL.md` / `references/`——按 skill 裁开，无法逐字节比对。
- **自有内核**：`purplestar-synastry` 的 `ziwei/synastry-knowledge.ts`、`purplestar-classics` 的
  `classics/`——源里根本没有对应文件，也就没有可比的对象，由各自 skill 的 `selftest` 接手。
  合盘的方法论正文 `purplestar-synastry/references/synastry-guide.md` 同属这一类（它是文档而非
  模块，同样只在合盘 skill 里、由该 skill 的 `selftest` 与层 2 读文件核对）。
- **旗标作用域**：`cli/flag-scope.ts` 声明本 skill 认哪些旗标，决定 `help` 里列出哪些——
  加了新旗标要记得决定它归谁，层 6 有四条双向断言盯着这件事。

## 开发

改完内核或升级依赖后，两层测试都要跑：

```bash
npm run sync:skills -- --check          # 副本没漂移
node skills/purplestar-astrology/scripts/purple-star.ts selftest   # 第一层：代码逻辑自洽
npm test                                 # 第二层：与 toolkit 样本的基准比对（约 8 秒）

npm run test:corpus -- --year 1960       # 可选：全量核验（8,640 条，约 2 分钟）
npm run typecheck                        # 改过类型标注就该跑（必须 0 错误）
```

`selftest` 覆盖农历换算、真太阳时校正、晚子时等价性、城市名容错、排盘不变量、三合派体系约束与知识源可用性。`npm test` 则从 518,400 条 toolkit 样本中抽出 300 条，逐字段对标排盘结果——它与 `selftest` 分工不同：前者测「代码逻辑自洽」，后者是**外部基准比对**，能抓住固定样例漏掉的行为漂移。

`typecheck` 是第三类：只保证类型**自洽**，不保证类型**标得对**——用 `any` 绕过报错它一样全绿。所以内核里不使用 `any`。

测试的性质、效力边界，以及**升级 iztro 后该怎么办**，见 [test/README.md](test/README.md)。

## 许可证

MIT，见 [LICENSE](LICENSE)。Copyright (c) 2026 姚佚启态。
