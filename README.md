# 紫微斗数（purplestar-astrology）

倪海夏《天纪》**三合派**体系的紫微斗数排盘与解读 skill，供 Claude Code 使用。

排盘内核、知识库与 CLI 全部自包含在本目录内，拷到任何位置都能独立运行。

## 这是什么

一个 Claude Code skill：用户给出出生年月日时与性别，Claude 调用本 skill 完成排盘、格局识别、四化推演、大限流年与合盘解读，并可检索三部古籍原文与倪海夏三纪讲义。

排盘由 `iztro` + 本项目 `scripts/` 下内核的确定性算法产出，**不靠模型推算**——CLI 负责算，模型只负责解读。

体系立场：严格三合派，不使用飞星派的宫干自化、大限四化取宫干、来因宫。详见 [SKILL.md](SKILL.md)。

## 安装

```bash
# 项目级：只在该项目内可用
cp -r <本仓库> <项目>/.claude/skills/purplestar-astrology

# 个人级：所有项目可用
cp -r <本仓库> ~/.claude/skills/purplestar-astrology
```

目录名必须是 `purplestar-astrology`（与 SKILL.md frontmatter 的 `name` 一致），Claude Code 据此发现技能。

`node_modules/` 不必拷（已在 `.gitignore` 中），落位后补一次依赖：

```bash
cd ~/.claude/skills/purplestar-astrology && npm install
```

## 直接用 CLI

```bash
cd <本仓库>

# 排盘 + 格局 + 四化 + 大限，解读所需数据一次给全
node scripts/purple-star.mjs analyze --date 1990-05-15 --time 09:30 --city 北京 --gender male

node scripts/purple-star.mjs heming --a-date 1990-05-15 --a-time 09:30 --a-gender male \
                             --b-date 1993-08-22 --b-time 14:00 --b-gender female
node scripts/purple-star.mjs classics --search 机月同梁
node scripts/purple-star.mjs nihai --category tianji
node scripts/purple-star.mjs help        # 全部命令与参数
node scripts/purple-star.mjs selftest    # 回归自检（40 项断言）

npm test                                 # 排盘基准回归（300 条样本，约 8 秒）
```

## 目录结构

```text
.
├── SKILL.md              # 技能定义（Claude Code 入口）
├── README.md             # 本文件
├── LICENSE               # MIT
├── package.json          # 声明 iztro / lunar-javascript
├── package-lock.json     # 锁定精确版本
├── scripts/              # CLI 与排盘内核同处一层（内核根）
│   ├── purple-star.mjs   # CLI（排盘 / 合盘 / 知识检索 / 自检）
│   ├── ziwei/            # 排盘算法、格局库、四化、合盘、城市经纬度
│   ├── classics/         # 骨髓赋 / 紫微斗数全集 / 全书
│   └── nihai/            # 倪海夏天纪 / 地纪 / 人纪
├── test/                 # 排盘基准测试（见 test/README.md）
└── node_modules/         # npm install 生成（已 gitignore）
```

## 环境要求

- **Node ≥ 22.15** —— 依赖 `module.registerHooks` 与原生 TypeScript 类型擦除（开发环境为 v26）。
- 依赖 `iztro` 2.6.1、`lunar-javascript` 1.7.7，由 `package-lock.json` 锁定，保证排盘结果不因环境分叉。

## 数据来源

| 内容                                         | 位置                                |
| -------------------------------------------- | ----------------------------------- |
| 排盘算法、40+ 格局库（含古籍出处与破格条件） | `scripts/ziwei/patterns.ts`         |
| 四化体系、流年流月推法                       | `scripts/ziwei/sihua.ts`            |
| 合盘方法论、十四主星在夫妻宫断语             | `scripts/ziwei/heming-knowledge.ts` |
| 中国城市经纬度（真太阳时校正）               | `scripts/ziwei/cities.ts`           |
| 三部古籍原文                                 | `scripts/classics/data/`            |
| 倪海夏三纪知识                               | `scripts/nihai/`                    |

**不含**线上站点的 14 主星 × 13 主题论断库（`STAR_DB`）与 `lib/seo/`——它们未随 skill 分发，解读请依赖上表知识源。

## 来源

本项目的排盘内核（`scripts/`）提取自所参考的上游开源项目 [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu)（其 `package.json` 的 `name` 为 `ziwei-master`，是一个 Next.js 站点 + 完整 `lib/`）。

抽取时只保留了排盘与解读必需的部分——未含 `db-analysis.ts`（线上论断库）、`famous.ts`、`history.ts`、`share.ts` 以及整个 `lib/seo/`，那些是站点侧功能。

上游的 `lunar-javascript.d.ts` 类型声明则一并保留了下来（在 `scripts/ziwei/`）：`lunar-javascript` 这个包自身不带类型，缺了它 `tsc` 会报 TS7016。纯类型文件，运行时被忽略，不影响排盘。

内核在本项目内独立演化，日常改动直接改 `scripts/` 下的对应文件，不存在需要同步的副本。

## 开发

改完内核或升级依赖后，两层测试都要跑：

```bash
node scripts/purple-star.mjs selftest    # 第一层：代码逻辑自洽（40 项断言）
npm test                                 # 第二层：与 toolkit 样本的基准比对（约 8 秒）

npm run test:corpus -- --year 1960       # 可选：全量核验（8,640 条，约 2 分钟）
```

`selftest` 覆盖农历换算、真太阳时校正、晚子时等价性、城市名容错、排盘不变量、三合派体系约束与知识源可用性。`npm test` 则从 518,400 条 toolkit 样本中抽出 300 条，逐字段对标排盘结果——它与 `selftest` 分工不同：前者测「代码逻辑自洽」，后者是**外部基准比对**，能抓住固定样例漏掉的行为漂移。

测试的性质、效力边界，以及**升级 iztro 后该怎么办**，见 [test/README.md](test/README.md)。

## 许可证

MIT，见 [LICENSE](LICENSE)。Copyright (c) 2026 姚佚启态。
