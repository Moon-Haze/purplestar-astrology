# 紫微斗数（purplestar-astrology）

倪海夏《天纪》**三合派**体系的紫微斗数排盘与解读 skill，供 AI 助手调用。

本仓**整体就是一个 skill**：排盘解读 / 合盘 / 古籍检索三域合一，仓库根 = skill 根，拷进宿主的技能目录后跑一次 `npm install` 即可。

## 这是什么

一个 AI 助手技能（skill）：用户给出出生年月日时与性别，助手调用本 skill 的 CLI 完成排盘、
格局识别、四化推演、大限流年与主题论断，并可做双人合盘、检索三部古籍原文。

排盘由 `iztro` + 本项目内核的确定性算法产出，**不靠模型推算**——CLI 负责算，模型只负责解读。

体系立场：严格三合派，不使用飞星派的宫干自化、大限四化取宫干、来因宫。详见 `SKILL.md`。

每个 skill 的 `SKILL.md` 是**骨架**——只放每次触发都要用的东西（路径约定、必须问清的输入、晚子时陷阱、
体系约束、已知口径、命令速查）。排障、输出契约全文、参数面细则、工作流详展开都在同目录的
`references/` 下，由 `SKILL.md` 写明「何时读它」——**没被读到就不占上下文**。这是渐进披露：
进上下文的只有 `SKILL.md` 本身，`scripts/` 下上万行内核一行都不进（它只在 Node 里执行）。

## 安装

把整个仓库拷贝到宿主环境的**技能目录**下（目录名 `purplestar-astrology`）：

```bash
# 项目级：只在该项目内可用
cp -r <本仓库> <项目>/<技能目录>/purplestar-astrology

# 个人级：所有项目可用
cp -r <本仓库> ~/<技能目录>/purplestar-astrology
```

目录名必须与 `SKILL.md` frontmatter 的 `name` 一致，宿主环境据此发现技能。

`node_modules/` 不必拷（已在 `.gitignore` 中），落位后补一次依赖：

```bash
cd ~/<技能目录>/purplestar-astrology && npm install
```

## 命令与验证

命令用法看 `node scripts/purple-star.ts help`（总览）与 `node scripts/purple-star.ts <命令> --help`
（每命令帮助）。开发验证三件套：`node scripts/purple-star.ts selftest`（回归自检）·
`npm test`（排盘基准回归）· `npm run typecheck`（类型检查，必须 0 错误）。

## 环境要求

**Node ≥ 22.18**（依赖 `module.registerHooks` 与原生 TypeScript 类型擦除，直接运行无需编译）；
依赖 iztro / lunar-typescript 由 `package-lock.json` 锁定，保证排盘结果不因环境分叉。

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
