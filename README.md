# 紫微斗数（ziwei-doushu）

倪海夏《天纪》**三合派**体系的紫微斗数排盘与解读 skill，供 Claude Code 使用。

排盘内核、知识库与 CLI 全部自包含在本目录内，拷到任何位置都能独立运行。

## 这是什么

一个 Claude Code skill：用户给出出生年月日时与性别，Claude 调用本 skill 完成排盘、格局识别、四化推演、大限流年与合盘解读，并可检索三部古籍原文与倪海夏三纪讲义。

排盘由 `iztro` + 本项目 `lib/` 的确定性算法产出，**不靠模型推算**——CLI 负责算，模型只负责解读。

体系立场：严格三合派，不使用飞星派的宫干自化、大限四化取宫干、来因宫。详见 [SKILL.md](SKILL.md)。

## 安装

```bash
# 项目级：只在该项目内可用
cp -r <本仓库> <项目>/.claude/skills/ziwei-doushu

# 个人级：所有项目可用
cp -r <本仓库> ~/.claude/skills/ziwei-doushu
```

目录名必须是 `ziwei-doushu`（与 SKILL.md frontmatter 的 `name` 一致），Claude Code 据此发现技能。

`node_modules/` 不必拷（已在 `.gitignore` 中），落位后补一次依赖：

```bash
cd ~/.claude/skills/ziwei-doushu && npm install
```

## 直接用 CLI

```bash
cd <本仓库>

# 排盘 + 格局 + 四化 + 大限，解读所需数据一次给全
node scripts/ziwei.mjs analyze --date 1990-05-15 --time 09:30 --city 北京 --gender male

node scripts/ziwei.mjs heming --a-date 1990-05-15 --a-time 09:30 --a-gender male \
                             --b-date 1993-08-22 --b-time 14:00 --b-gender female
node scripts/ziwei.mjs classics --search 紫微居午
node scripts/ziwei.mjs nihai --category tianji
node scripts/ziwei.mjs help        # 全部命令与参数
node scripts/ziwei.mjs selftest    # 回归自检（33 项断言）
```

## 目录结构

```text
.
├── SKILL.md              # 技能定义（Claude Code 入口）
├── README.md             # 本文件
├── LICENSE               # MIT
├── package.json          # 声明 iztro / lunar-javascript
├── package-lock.json     # 锁定精确版本
├── scripts/ziwei.mjs     # CLI（排盘 / 合盘 / 知识检索 / 自检）
├── lib/                  # 排盘内核（17 个文件），唯一数据源
│   ├── ziwei/            # 排盘算法、格局库、四化、合盘、城市经纬度
│   ├── classics/         # 骨髓赋 / 紫微斗数全集 / 全书
│   └── nihai/            # 倪海夏天纪 / 地纪 / 人纪
├── reference/            # 所参考的上游开源项目（已 gitignore，见下）
└── node_modules/         # npm install 生成（已 gitignore）
```

## 环境要求

- **Node ≥ 22.15** —— 依赖 `module.registerHooks` 与原生 TypeScript 类型擦除（开发环境为 v26）。
- 依赖 `iztro` 2.6.1、`lunar-javascript` 1.7.7，由 `package-lock.json` 锁定，保证排盘结果不因环境分叉。

## 数据来源

| 内容 | 位置 |
| --- | --- |
| 排盘算法、40+ 格局库（含古籍出处与破格条件） | `lib/ziwei/patterns.ts` |
| 四化体系、流年流月推法 | `lib/ziwei/sihua.ts` |
| 合盘方法论、十四主星在夫妻宫断语 | `lib/ziwei/heming-knowledge.ts` |
| 中国城市经纬度（真太阳时校正） | `lib/ziwei/cities.ts` |
| 三部古籍原文 | `lib/classics/data/` |
| 倪海夏三纪知识 | `lib/nihai/` |

**不含**线上站点的 14 主星 × 13 主题论断库（`STAR_DB`）与 `lib/seo/`——它们未随 skill 分发，解读请依赖上表知识源。

## reference/ —— 所参考的上游开源项目

`reference/ziwei-doushu/` 是**本项目所参考的上游开源项目** [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu)（其 `package.json` 的 `name` 为 `ziwei-master`，是一个 Next.js 站点 + 完整 `lib/`）的只读快照。

它**已被 gitignore、不参与运行、不参与分发**，用途是：

- 对照上游实现，排查本 skill 的排盘差异；
- 上游更新时，比对 `reference/ziwei-doushu/lib/` 与本项目 `lib/`，决定是否跟进。

本项目的 `lib/` 是从上游提取的内核，抽出时只保留了排盘与解读必需的部分——未含 `db-analysis.ts`（线上论断库）、`famous.ts`、`history.ts`、`share.ts`、`lunar-javascript.d.ts` 以及整个 `lib/seo/`，那些是站点侧功能。

日常改内核直接改 `lib/`，**不需要任何同步动作**；只有想跟进上游时，才需要手工比对这两处。

## 开发

改完内核或升级依赖后，务必跑一次自检再交付解读：

```bash
node scripts/ziwei.mjs selftest
```

它覆盖农历换算、真太阳时校正、晚子时等价性、城市名容错、排盘不变量、三合派体系约束与知识源可用性。

## 许可证

MIT，见 [LICENSE](LICENSE)。Copyright (c) 2026 紫微研究。
