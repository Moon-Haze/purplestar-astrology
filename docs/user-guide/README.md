# 使用手册（user-guide）

**这份手册给谁看**：clone 了本仓库、要直接敲命令行用这个工具的人——不是给 AI 助手看的
（助手的行为规范在 [SKILL.md](../../SKILL.md) 与 [references/](../../references/)）。

一条命令，三个领域：

```bash
node scripts/purple-star.ts <command> [options]
```

| 命令        | 干什么           | 最小示例                                       |
| ----------- | ---------------- | ---------------------------------------------- |
| `astrology` | 排盘分析         | `astrology 2011-06-24 07:45 男 杭州`           |
| `knowledge` | 知识检索（四域） | `knowledge --search 机月同梁`                  |
| `synastry`  | 双人合盘         | `synastry --charts a.json,b.json`（先各排一盘） |

## 环境要求

**Node ≥ 22.18**（脚本靠 Node 原生的 TypeScript 类型擦除直接运行，没有构建步骤）。
依赖只有两个（`iztro` / `lunar-typescript`），版本由 `package-lock.json` 锁定。

```bash
git clone <本仓库> && cd purplestar-astrology
npm install
node scripts/purple-star.ts help    # 装好了：应打印总览帮助
```

## 三分钟跑通

```bash
# 1. 排一张盘（位置参数按形态归类，顺序无关；示例数据为虚构）
node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州

# 2. 深入：格局 + 四化 + 大限，一次拿齐
node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州 --pattern --mutagen --decadal

# 3. 检索古籍原文
node scripts/purple-star.ts knowledge --search 机月同梁
```

第一步的输出怎么读、每行什么意思，看 [getting-started.md](getting-started.md)。

## 手册地图

| 文件                                              | 讲什么                                           |
| ------------------------------------------------- | ------------------------------------------------ |
| [getting-started.md](getting-started.md)          | 安装 → 第一张盘 → 输出逐段认读 → 换着花样给输入  |
| [commands.md](commands.md)                        | 三条命令的人话详解 + 七个任务食谱                 |
| [faq.md](faq.md)                                  | 排障（报错对照）+ 已知口径白话（晚子时 / 真太阳时） |

**完整参数面不在这里**：本手册只覆盖常用形态，exhaustive 清单以 CLI 自带帮助为准——
`node scripts/purple-star.ts help`（总览）与 `node scripts/purple-star.ts <命令> --help`
（每命令）。细则见 [references/options.md](../../references/options.md)。

## 边界（先说清楚）

- **只管到「怎么用脚本」**：命令怎么写、输出每个字段什么意思、出错了怎么办。
  命盘本身的解读方法（AI 助手的输出契约）见
  [references/output-contract.md](../../references/output-contract.md)，本手册不教斗数。
- **本手册不随技能包分发**：它服务 clone 仓库的人；装进 AI 助手的 zip 包里没有它。
- **示例数据全部虚构**：手册里的出生信息均无真实人物。
