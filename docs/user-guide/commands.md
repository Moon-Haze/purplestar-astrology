# 三条命令详解与任务食谱

> exhaustive 参数面以 CLI 自带帮助为准：`node scripts/purple-star.ts help`（总览）、
> `node scripts/purple-star.ts <命令> --help`（每命令）；逐参数细则见
> [references/options.md](../../references/options.md)。本篇只讲人话与常用组合。

## astrology —— 排盘分析

一条命令承载全部排盘形态（2026-09-30 起原 analyze / chart / topic 已并入参数）。
**默认出概览**（基本信息 + 运限速览 + 指路行，见 [getting-started.md](getting-started.md)
的认读表）；深入内容全靠功能参数。

### 功能参数：给了哪个就追加哪段

| 参数               | 得到什么                                                             |
| ------------------ | -------------------------------------------------------------------- |
| `--pattern`        | 格局识别（判词 + 成立 / 加分 / 破格三层条件 + 古籍出处）              |
| `--mutagen`        | 四化专题：生年 / 大限宫干 / 流年（可再叠流月 / 流日 / 流时）落宫       |
| `--yearly [年]`    | 流年专题：流年命宫详表 + 三方四正会照 + 四化落点（缺省 = 今年）        |
| `--decadal [虚岁]` | 大限专题：大运时间轴 + 指定限三方四正 + 限内逐年对照（缺省 = 当前虚岁） |
| `--ages [虚岁]`    | 小限专题：小限宫 + 十二宫岁数分布（缺省 = 当前虚岁）                  |
| `--focus <宫名>`   | 单宫四项深化：三方四正全星曜 + 对宫详表 + 涉及格局 + 引动年份          |

可自由叠加（`--monthly` / `--daily` / `--hourly` 是流月 / 流日 / 流时的逐级深入，须配合
`--mutagen`）。

### 独占分支：给出即接管输出

| 参数           | 得到什么                                                             |
| -------------- | -------------------------------------------------------------------- |
| `--info`       | 只输出基本信息面板这一节                                             |
| `--palaces`    | 十二宫逐宫详表（配 `--json` 时顶层即命盘本身）                        |
| `--topic <key>` | 主题论断；不带值时列出全部主题；配 `--view` 换本命 / 大限 / 流年 / 流月视角 |
| `--report`     | 全盘主题报告（Markdown 文档，本命静态口径，不与运限参数同用）         |

独占分支之间静默组合会报错指路；优先级 `--palaces` > `--topic` > `--report`。

### 输出控制（所有命令通用）

| 参数         | 作用                                                                 |
| ------------ | -------------------------------------------------------------------- |
| `--json`     | 输出原始 JSON（供程序消费 / 喂合盘）                                 |
| `--out <路径>` | 正文写入文件（覆盖写）；stdout 不再打印正文，一行「已写入」提示走 stderr |
| `--no-cache` | 跳过排盘缓存强制现排（默认同一农历年内复用缓存，见 [faq.md](faq.md)） |
| `--config <my.json>` | 读 JSON 配置文件（键 = 参数 camelCase 主名；命令行同名参数覆盖配置） |

## knowledge —— 知识检索（四域合一）

`--source` 选域，缺省 `books`：

| 域       | 内容                       | 专用参数              |
| -------- | -------------------------- | --------------------- |
| `books`  | 三部古籍全文（默认）       | `--limit <15>`        |
| `stars`  | 星曜释义（关键词/星性/五行） | `--search <星名>`     |
| `tianji` | 天纪判语（含秒级回放溯源） | `--book <册>`         |
| `oracle` | 断语手册（主题 × 十四主星） | `--topic <key> [--star <星名>]` |

多关键词是 **AND** 语义：须全部出现在同一段才命中。检索词既可走 `--search` 也可走位置
参数（`knowledge 机月同梁` 等价于 `--search 机月同梁`）。

## synastry —— 双人合盘

**本命令不排盘**：输入必须是两份 `astrology --json` 的产物（逗号分隔，甲先乙后）。
看两口子不能只看夫妻宫，本命令按倪师口径同时取命宫 / 夫妻宫 / 福德宫联参。

## 任务食谱

```bash
# 1. 只想确认出生信息解析对不对（只看基本信息面板）
node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州 --info

# 2. 全盘深入一次拿齐：格局 + 四化 + 大限（可叠加，顺序无关）
node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州 --pattern --mutagen --decadal

# 3. 看某一年的流年（可再接 --focus 财帛 看重点宫位）
node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州 --yearly 2027 --focus 财帛

# 4. 结构化数据喂自己的程序（JSON 走 stdout 或 --out 落盘）
node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州 --json --out /tmp/a.json

# 5. 双人合盘：先各排一盘存 JSON，再交给 synastry（甲先乙后）
node scripts/purple-star.ts astrology --date 2011-06-24 --time 07:45 --city 杭州 --gender male --json --out /tmp/a.json
node scripts/purple-star.ts astrology --date 1999-11-03 --time 15:20 --city 成都 --gender female --json --out /tmp/b.json
node scripts/purple-star.ts synastry --charts /tmp/a.json,/tmp/b.json

# 6. 检索佐证：古籍原文 / 星曜释义 / 天纪判语 / 断语手册
node scripts/purple-star.ts knowledge --search 机月同梁
node scripts/purple-star.ts knowledge --source stars --search 紫微
node scripts/purple-star.ts knowledge --source tianji 半空折翅
node scripts/purple-star.ts knowledge --source oracle --topic career --star 七杀

# 7. 批量 / 复用同一组输入：先生成配置模板，改完用它
node scripts/purple-star.ts astrology --template > my.json
# 编辑 my.json 后：
node scripts/purple-star.ts astrology --config my.json
```

（以上示例数据均为虚构。）

## 拼音别名

以下拼音别名仍被识别（解析层归一到英文主名，帮助与文档一律用主名）：

`--geju → --pattern` · `--sihua → --mutagen` · `--liunian → --yearly` ·
`--liuyue → --monthly` · `--liuri → --daily` · `--liushi → --hourly` ·
`--daxian → --decadal` · `--xiaoxian → --ages`

## 顺带一提：selftest

`node scripts/purple-star.ts selftest` 是内置回归自检（农历换算 / 真太阳时 / 晚子时 /
排盘不变量 / 三合派约束 / 古籍 / 合盘三段断言）。**升级过依赖或改过排盘结果后跑一遍**，
全绿才算装对了；日常使用不需要跑。
