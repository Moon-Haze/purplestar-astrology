# 紫微斗数（purplestar-astrology）

排盘、合盘、古籍检索三域合一的紫微斗数 **AI 助手技能**：出生信息进来，命盘与论断素材
出来——计算全部由确定性 CLI 完成，AI 只负责解读，不参与排盘推算。

## 能做什么

- **排盘分析**：给出出生年月日时、性别与出生地，得到十二宫命盘、星曜与亮度、格局
  识别、四化推演（生年 / 大限 / 流年 / 流月 / 流日 / 流时），以及大限、流年、小限
  运限速览与 14 个主题（事业、财帛、婚姻、健康……）的论断素材。
- **双人合盘**：对照两张命盘，给出十四主星入夫妻宫断语、四化互动与合盘评分。
- **知识检索**：关键词检索三部古籍原文（《紫微斗数全书》《全集》《骨髓赋》）、
  天纪判语与断语库，为解读提供可溯源的引文。

排盘引擎为确定性算法（[iztro](https://www.npmjs.com/package/iztro) + 本仓内核），
同一输入永远得到同一张盘——不靠大模型"算命"，可复核、可回归。

## 输出示例

排盘概览（示例为虚构出生信息）：

```text
【基本信息】
性别 : 男
公历生日 : 2011-06-24
地理经度 : 120.100
钟表时间 : 07:45
真太阳时 : 钟表 07:45 → 真太阳时校正 +0 分 → 辰时(07:00-09:00)
农历时间 : 辛卯年五月廿三日辰时
五行局数 : 木三局
命宫:寅 · 身宫:戌 · 紫微落:申
三方四正:命宫/官禄宫/财帛宫/迁移宫
身主:天同; 命主:禄存; 子年斗君:子

【运限速览】虚岁 16 · 大限 13-22岁 兄弟宫(丑) · 流年 2026 丙午 流年命宫午·官禄宫 · 小限辰·福德宫
【专题深入】--pattern 格局 · --mutagen 四化 · --decadal [虚岁] 大限 · --ages [虚岁] 小限 ·
--yearly [年] 流年 · --focus <宫> 宫盘深化 · --palaces 十二宫详表 · --topic <key> 主题论断
```

（节选自 `astrology` 默认概览，另可输出十二宫详表、全盘 Markdown 报告与 JSON。）

古籍检索：

```text
$ node scripts/purple-star.ts knowledge --search 机月同梁
古籍检索「机月同梁」命中 5 条：

  ▸ [紫微斗数全书 · 机月同梁格]
    天机太阴天同天梁四星齐入命三方四正，称『机月同梁』格。文质彬彬、聪慧善谋，最适合
    公职、学术、文艺、医疗、服务等需稳定累积的行业。
  ▸ [骨髓赋 · 机月同梁]
    『机月同梁』作吏人——古云此格者宜担任公职、行政文书工作，安稳一生。……
```

## 快速开始

**环境要求：Node ≥ 22.18**（依赖原生 TypeScript 类型擦除，直接运行、无需编译）；
依赖版本由 `package-lock.json` 锁定，保证排盘结果不因环境分叉。

### 装进 AI 助手

```bash
npm run pack        # 打出 dist/purplestar-astrology.zip
unzip dist/purplestar-astrology.zip -d ~/<技能目录>/
cd ~/<技能目录>/purplestar-astrology && npm install
node scripts/purple-star.ts selftest   # 装完自检，应全绿
```

同一份源码多次打包得到**完全相同的 sha256**，可据此校验包未被改动
（`npm run pack && sha256sum dist/purplestar-astrology.zip`）。
顶层目录名与 `SKILL.md` 声明的技能名一致，宿主按目录名发现技能。

不想用 zip 时手动拷贝——**只拷这 4 项**，不要 `cp -r` 整仓（工作区有数 GB 开发缓存）：

```bash
cp -r SKILL.md package.json references scripts ~/<技能目录>/purplestar-astrology/
```

### 直接用 CLI（仓库内）

```bash
git clone <本仓库> && cd purplestar-astrology && npm install
node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州
```

完整用法（安装、命令详解、输出认读、排障）见 [docs/user-guide/](docs/user-guide/)。

## 命令速览

| 命令        | 用途     | 最小示例                                                                |
| ----------- | -------- | ----------------------------------------------------------------------- |
| `astrology` | 排盘分析 | `astrology 2011-06-24 07:45 男 杭州`                                    |
| `synastry`  | 双人合盘 | `synastry --charts a.json,b.json`（甲乙两盘由 `astrology --json` 产出） |
| `knowledge` | 知识检索 | `knowledge --search 机月同梁`                                           |

完整参数面看内置帮助：`node scripts/purple-star.ts help`（总览）与
`node scripts/purple-star.ts <命令> --help`（每命令）。

## 仓库地图

| 路径          | 是什么                                               |
| ------------- | ---------------------------------------------------- |
| `SKILL.md`    | 技能行为规范：AI 助手触发技能后按它排盘与解读        |
| `references/` | 细则文档（工作流、输出契约、参数面、排障……按需加载） |
| `scripts/`    | CLI 与排盘 / 合盘 / 语料内核（TypeScript，直接运行） |
| `docs/`       | 使用手册 + 开发者文档：`user-guide/` 面向人的 CLI 手册、模块地图、评审报告、计划（不随技能分发） |
| `openspec/`   | 规范驱动开发的当前规范与变更提案（不随技能分发）     |
| `test/`       | 基准回归测试（不随技能分发）                         |

各模块的职责与依赖关系详见 [docs/code/](docs/code/) 的模块地图。

## 体系口径

排盘与运限四化以**文墨天机**为准，论断框架严格按**倪海厦《天纪》三合派**
（命宫为本、三方为用）；飞星派的宫干自化、来因宫等技法不实现。完整口径与
使用规约见 `SKILL.md` 及其 `references/`。

## 来源与授权

- 排盘内核提取自上游开源项目
  [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu)，
  在本仓独立演化（站点侧的论断库与 SEO 模块未纳入）。
- 天纪判语等倪海厦相关语料采用 **CC BY-NC-SA** 授权（非商业、署名、相同方式
  共享）；相关解读内容均注明来源，仅作传统文化研究参考，不构成任何现实建议。

## 给开发者

- 验证三件套：`node scripts/purple-star.ts selftest`（自检）· `npm test`
  （排盘基准回归）· `npm run typecheck`（类型检查，0 错误）；风格另有
  `npm run lint` / `npm run format`。
- 开发约定、架构决策与分发纪律见 `AGENTS.md`；模块地图见 [docs/code/](docs/code/)。
- 打包与分发口径（zip 可复现、`scripts/` 多层目录原样收包勿拍平等）见
  `npm run pack` 的自检输出与 `AGENTS.md` 的「分发」节。
