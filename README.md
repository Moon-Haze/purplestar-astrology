# 紫微斗数（purplestar-astrology）

倪海夏《天纪》**三合派**体系的紫微斗数排盘与解读 skill，供 AI 助手调用。

本仓**整体就是一个 skill**（2026-09-30 三 skill 合一：排盘解读 / 合盘 / 古籍检索三域，
仓库根 = skill 根），拷进 `~/.claude/skills/` 后跑一次 `npm install` 即可。

## 这是什么

一个 AI 助手技能（skill）：用户给出出生年月日时与性别，助手调用本 skill 的 CLI 完成排盘、
格局识别、四化推演、大限流年与主题论断，并可做双人合盘、检索三部古籍原文。

排盘由 `iztro` + 本项目内核的确定性算法产出，**不靠模型推算**——CLI 负责算，模型只负责解读。

体系立场：严格三合派，不使用飞星派的宫干自化、大限四化取宫干、来因宫。详见各 skill 的 `SKILL.md`。

每个 skill 的 `SKILL.md` 是**骨架**——只放每次触发都要用的东西（路径约定、必须问清的输入、晚子时陷阱、
体系约束、已知口径、命令速查）。排障、输出契约全文、参数面细则、工作流详展开都在同目录的
`references/` 下，由 `SKILL.md` 写明「何时读它」——**没被读到就不占上下文**。这是渐进披露：
进上下文的只有 `SKILL.md` 本身，`scripts/` 下上万行内核一行都不进（它只在 Node 里执行）。

## 安装

```bash
# 项目级：只在该项目内可用
cp -r <本仓库> <项目>/.claude/skills/purplestar-astrology

# 个人级：所有项目可用
cp -r <本仓库> ~/.claude/skills/purplestar-astrology
```

目录名必须与 `SKILL.md` frontmatter 的 `name` 一致，宿主环境据此发现技能。

`node_modules/` 不必拷（已在 `.gitignore` 中），落位后补一次依赖：

```bash
cd ~/.claude/skills/purplestar-astrology && npm install
```

## 目录结构

```text
.
├── SKILL.md             # 技能定义（技能入口，骨架）
├── references/          # 骨架的延伸：工作流 / 参数面 / 输出契约 / 排障 / 合盘指南，按需加载
├── scripts/             # CLI 与三个域的内核同处一层（内核根）
│   ├── purple-star.ts   # 引导层：定位内核根 → 注册 TS 钩子 → 启动自检 → 分发命令
│   ├── boot-hooks.ts    # 引导机制（CLI 与 test/ 共用）
│   ├── cli/             # 参数面 / 渲染 / 出生信息 / 各命令文件 / config / help / 自检
│   ├── ziwei/           # 排盘内核：算法、格局库、四化、主题论断、城市经纬度
│   ├── classics/        # 古籍内核：三部原文 + 检索纯函数
│   └── synastry/        # 合盘内核：断语库 + JSON 消费方契约
├── tools/               # 开发工具（DuckDB 语料、基准），不进 skill
├── test/                # 基准测试（见 test/README.md），不进 skill
├── tsconfig.json        # 仅供 npm run typecheck，不参与运行
├── package.json         # 仓库级依赖（= skill 依赖：iztro / lunar-typescript）
└── node_modules/        # npm install 生成（已 gitignore）
```

## 直接用 CLI

以下命令均在**仓库根**执行（装到 `~/.claude/skills/` 之后同理；脚本可从任意 cwd 用绝对路径跑）。
示例数据为虚构：

```bash
# 排盘：默认概览（总览三行 + 基本信息 12 行面板 + 运限速览）
# 位置参数快捷形态（按形态归类：日期 / 时刻 / 性别 / 城市，顺序无关）
node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州
# 完整参数形态；功能参数可叠加（--pattern 格局 --mutagen 四化 --yearly 流年
#   --monthly 流月 --decadal 大限 --ages 小限 --focus <宫> 四项深化
#   --palaces 十二宫详表 --topic <key> 主题论断）
node scripts/purple-star.ts astrology \
     --date 2011-06-24 --time 07:45 --city 杭州 --gender male --pattern --mutagen --decadal
# 拼音别名仍被识别：--geju→--pattern、--sihua→--mutagen、--liunian→--yearly、
#   --liuyue→--monthly、--daxian→--decadal、--xiaoxian→--ages

# 批量排盘：配置文件（命令行同名参数覆盖配置；--template 生成模板）
node scripts/purple-star.ts astrology --template > my.json
node scripts/purple-star.ts astrology --config my.json

# 合盘：本命令不排盘，命盘先由 astrology 各排一张（--json，勿带 --palaces）
node scripts/purple-star.ts astrology \
     --date 2011-06-24 --time 07:45 --city 杭州 --gender male --json > /tmp/a.json
node scripts/purple-star.ts astrology \
     --date 1999-11-03 --time 15:20 --city 成都 --gender female --json > /tmp/b.json
node scripts/purple-star.ts synastry --charts /tmp/a.json,/tmp/b.json
# 合盘方法论与评分标准：读 references/synastry-guide.md（静态参考）

# 古籍原文检索与星曜释义
node scripts/purple-star.ts classics --search 机月同梁
node scripts/purple-star.ts stars --search 紫微

node scripts/purple-star.ts help             # 总览（man 八节结构）
node scripts/purple-star.ts astrology --help # 每命令（归属参数子集）
node scripts/purple-star.ts selftest         # 回归自检（三段合一）

npm test                                     # 排盘基准回归（300 条样本，约 8 秒）
npm run typecheck                            # 类型检查（必须 0 错误）
```

## 环境要求

- **Node ≥ 22.15** —— 依赖 `module.registerHooks` 与原生 TypeScript 类型擦除（开发环境为 v26）。**直接运行不需要编译**，`.ts` 由 Node 自己擦类型。
- 依赖 `iztro` 2.6.1、`lunar-typescript` 1.8.6，由 `package-lock.json` 锁定，保证排盘结果不因环境分叉。
- 开发依赖 `typescript` / `@types/node`，只服务 `npm run typecheck`；不装也照样排盘。
- 合并后整个 skill 依赖一份根 `package.json`（iztro + lunar-typescript），**装好后需先 `npm install`**。

## 数据来源

每份知识的**归属地**（权威那一份）：

| 内容                                     | 位置                                    |
| ---------------------------------------- | --------------------------------------- |
| 排盘算法、格局库（含古籍出处与破格条件） | `scripts/ziwei/patterns/`               |
| 四化体系、流年流月推法                   | `scripts/ziwei/mutagen.ts`              |
| 主题论断（十四主星 × 13 主题动态推算）   | `scripts/ziwei/analysis/`               |
| 中国城市经纬度（真太阳时校正）           | `scripts/ziwei/cities.ts`               |
| 十四主星在夫妻宫断语、四化入夫妻宫       | `scripts/synastry/synastry-knowledge.ts`|
| 合盘方法论与评分标准                     | `references/synastry-guide.md`          |
| 三部古籍原文                             | `scripts/classics/data/`                |

**不含**线上站点的 14 主星 × 13 主题论断库（`STAR_DB`）与 `lib/seo/`——它们未随 skill 分发，解读请依赖上表知识源。

## 来源

本项目的排盘内核提取自所参考的上游开源项目 [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu)（其 `package.json` 的 `name` 为 `ziwei-master`，是一个 Next.js 站点 + 完整 `lib/`）。

抽取时只保留了排盘与解读必需的部分——未含 `db-analysis.ts`（线上论断库）、`famous.ts`、`history.ts`、`share.ts` 以及整个 `lib/seo/`，那些是站点侧功能。

上游曾一并带上手写的 `lunar-javascript.d.ts` 类型声明（`lunar-javascript` 包自身不带类型，缺了它 `tsc` 会报 TS7016）。本项目现已改用同作者的 TypeScript 移植版 `lunar-typescript`，该声明随之删除——`lunar-typescript` 自带 `dist/index.d.ts`，`tsc` 直接取得到类型，无需手写。

## 开发

改完内核或升级依赖后，两层测试都要跑：

```bash
node scripts/purple-star.ts selftest   # 第一层：代码逻辑自洽（排盘 / 古籍 / 合盘三段合一）
npm test                               # 第二层：与 toolkit 样本的基准比对（约 8 秒）
npm run test:corpus -- --year 1960     # 可选：全量核验（8,640 条，约 2 分钟）
npm run typecheck                      # 改过类型标注就该跑（必须 0 错误）
```

`selftest` 覆盖农历换算、真太阳时校正、晚子时等价性、城市名容错、排盘不变量、三合派体系约束、知识源可用性、古籍检索行为与合盘护栏。`npm test` 则从 518,400 条 toolkit 样本中抽出 300 条，逐字段对标排盘结果——它与 `selftest` 分工不同：前者测「代码逻辑自洽」，后者是**外部基准比对**，能抓住固定样例漏掉的行为漂移。

`typecheck` 是第三类：只保证类型**自洽**，不保证类型**标得对**——用 `any` 绕过报错它一样全绿。所以内核里不使用 `any`。

测试的性质、效力边界，以及**升级 iztro 后该怎么办**，见 [test/README.md](test/README.md)。

## 许可证

MIT，见 [LICENSE](LICENSE)。Copyright (c) 2026 姚佚启态。
