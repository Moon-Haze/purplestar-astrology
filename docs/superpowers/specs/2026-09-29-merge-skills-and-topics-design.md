# 设计：三 skill 合一 + astrology 命令融合（旗标英文化）+ 配置文件输入

- 日期：2026-09-29
- 状态：待评审
- 前置：2026-09-28 的「analyze 专题旗标族」已交付（d4c1194 / dfd37d8）

## 0. 背景与目标

用户对 2026-09-28 交付的专题旗标族不完全满意，并决定放弃「三 skill 集合」形态：

1. `--info` 的内容应默认可见，不该每次加旗标；
2. `--focus` 不够详细；
3. 命令入口收敛：四条直接调 iztro 的命令融合为一条 `astrology`（旗标融合，专题旗标换英文）；
3. 十二宫详表入口收敛为 `astrology --palaces`（原 `chart` 命令废）；
4. **三个 skill 合并成一个**：仓库根即 skill 根，一条 CLI 承载排盘 / 古籍 / 合盘；
5. 参数支持**JSON 配置文件**输入，并能生成配置模板。

## 1. `astrology` 命令：四条排盘命令融合 + 旗标英文化

analyze / insight / chart / topic 四条直接调 iztro 的命令（含规划中的 insight）融合为一条
**`astrology`**（旗标融合模式，用户指定）：不带功能旗标 = 概览；功能由旗标组合表达。
专题旗标名**全部换英文**（用户指定），大限 / 小限 / 四化锚定 iztro 原生术语：

| 功能 | 旧旗标 / 命令 | 新旗标 |
| --- | --- | --- |
| 基本信息（并入默认 + 只出面板） | `--info` | `--info`（不变） |
| 格局专题 | `--geju` | `--pattern` |
| 四化专题 | `--sihua` | `--mutagen`（iztro 术语） |
| 流年专题 | `--liunian [年]` | `--annual [年]`（避开 `--year` 出生年的编辑距离混淆） |
| 流月（配四化 / 流年视角） | `--liuyue 1-12` | `--monthly 1-12` |
| 大限专题 | `--daxian [虚岁]` | `--decadal [虚岁]`（iztro 术语） |
| 小限专题 | `--xiaoxian [虚岁]` | `--ages [虚岁]`（iztro 术语） |
| 宫盘聚焦 | `--focus <宫>` | `--focus`（不变） |
| 十二宫逐宫详表 | `chart` 命令 | `--palaces` |
| 主题论断 + 视角 | `topic` 命令 `--topic`/`--view` | `--topic <key>` / `--view`（不变） |
| 结构化输出 | `--json` | `--json`（不变） |

- **默认输出**（无功能旗标）：`【命盘总览】`三行 → `【基本信息】`12 行面板（无条件）→ 口径提示 → `【运限速览】` → 功能旗标指路。
- **`--info`**：只输出信息面板这一节。
- **`--focus` 深化**（四项全加）：三方四正逐宫全星曜（主星含亮度四化 + 吉煞杂曜）、对宫完整详表、涉及此宫的格局全列、小限岁数段 + 大限十年内引动年份 + 命主/身主星标记。
- 其余功能旗标行为同 2026-09-28 交付的各专题（渲染函数复用 `cli/yun.ts`，仅改名）。
- `--topic` 给了 `--view` 才有意义；不带 `--topic` 时列 13 主题清单（原 topic 命令行为）。
- 出生信息 15 个旗标不变（已英文）。

## 2. 仓库重组：整个仓库 = 一个 skill

### 2.1 形态

- **仓库根 = skill 根**：根 `SKILL.md` + 根 `scripts/` + 根 `references/` + 根 `package.json`。
- `skills/` 目录整体废弃删除；两个派生 skill 的 `package.json` 一并废弃（根级已有，它们零 npm 依赖）。
- 装进 `~/.claude/skills/` 时拷整个仓库。

### 2.2 目标目录树（根 `scripts/`）

```text
scripts/
├── purple-star.ts            引导层（不变：钩子 + 自检 + 分发）
├── boot-hooks.ts             引导机制（不变）
├── classics/                 古籍内核：data/（三部古籍）+ 检索逻辑（import 风格改为源钩子风格）
├── synastry/                 合盘内核：synastry-knowledge.ts + chart-view.ts + 合盘逻辑
├── ziwei/                    排盘内核（原样平移）
└── cli/
    ├── args.ts               参数面（FLAG_GROUPS + 解析）
    ├── flag-scope.ts         作用域（a-/b- 前缀正式启用）
    ├── config.ts             新增：--config / --template 的读取与合并
    ├── birth-info.ts / birth-info-defs.ts / render.ts / yun.ts
    ├── astrology.ts           cmdAstrology（排盘分析一条命令：概览默认 + 功能旗标分发）
    ├── classics.ts / synastry.ts / stars.ts   各命令拆分文件
    ├── help.ts                总览 help 与每命令 --help（命令 → 旗标归属表 + COMMAND_HELP）
    ├── commands.ts           只留 COMMAND_TABLE + COMMAND_DESC（注册薄层）
    └── selftest.ts           汇总执行；排盘 / 古籍 / 合盘断言分段报告
```

**cli/ 按命令一文件**：原本挤在 commands.ts 的各 `cmdXxx` 拆到各自文件，commands.ts 只做注册。

### 2.3 synastry 命令

- **保持 `--a-chart` / `--b-chart` 两个 JSON 文件输入**（吃 `astrology --json` 产物），**不做**出生信息直传。
- `a-` / `b-` 前缀旗标（`a-chart` / `b-chart`）进 `FLAG_GROUPS`；`flag-scope.ts` 的 `sidePrefixes: ["a-", "b-"]` + `prefixedCommands: ["synastry"]` 正式启用（从遗留物变真在用）。
- `synastry-guide.md` 从合盘 skill 的 references/ 搬到根 `references/`。

### 2.4 classics 命令

- `--search`（已有）/ `--limit` 进源作用域。
- data/ 三部古籍与检索逻辑整体平移进 `scripts/classics/`。

### 2.5 selftest 合并

- classics / synastry 的自检断言分别住 `scripts/classics/`、`scripts/synastry/`（导出断言数组），`cli/selftest.ts` 汇总执行，报告分三段（排盘 / 古籍 / 合盘），首行「通过 N/N」合计。
- 原「两份自有内核的断言只能在各自 skill 里跑」的作用域描述作废——现在只有一个 skill。

### 2.6 import 风格统一

搬入的 classics / synastry 代码从「全扩展名 import（无钩子）」改为源的风格（`@/` 别名 + 省扩展名）。仓库回到**一种**加载方式；「另两个 skill 怎么加载 .ts」一节与相关散文删除。

### 2.7 路径迁移牵动清单（改漏即崩）

| 位置                         | 改什么                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `tsconfig.json`              | `paths` 的 `@/*` 改映 `./scripts/*`；`include` 收窄（`skills` 目录 → `scripts` 与 `test` 等） |
| `test/lib/loader.ts`         | 内核根路径 `skills/purplestar-astrology/scripts` → `scripts`                                  |
| `test/lib/skills.ts`         | `ALL_SKILLS` / `SOURCE_SKILL` / `CHART_LIKE`：三 skill → 单 skill（根）                       |
| `test/lib/citation-guard.ts` | 扫描根：三个 skill 的 scripts/ → 根 scripts/                                                  |
| `test/repo.test.ts` 层 6     | 「三 skill 自包含 / 触发互斥」断言 → 「单 skill 自包含」                                      |
| `test/cli.test.ts`           | 三条 CLI 路径合一；synastry-guide.md 的引用路径改根 references/                               |
| `test/invariants.test.ts`    | `skills/purplestar-classics/scripts/index` 的类型引用路径改根                                 |
| `tools/db/db.ts`             | `TOPIC_KEYS` 的字面 import 路径 `../../skills/...` → `../../scripts/...`                      |
| `tools/bench/startup.ts`     | `CLI` 路径常量改根 `scripts/purple-star.ts`                                                   |
| `scripts/boot-hooks.ts`      | `pickRoot` 的调用方 probe 值随入口位置自适（机制不变）                                        |
| 引导层 REQUIRED_EXPORTS      | 补 classics / synastry 关键导出                                                               |

⚠️ `tools/` 不在 `npm test` 覆盖内（已知风险面）——迁移后必须**实跑** `tools/db` 的入口与 `tools/bench/startup.ts` 各一次验证，光靠测试套件发现不了它们的路径断裂。

## 3. 命令面调整与 help 强化

### 3.1 命令面（合并后 5 条 + help）

`astrology`（排盘分析，融合原 analyze / insight / chart / topic）/ `classics` / `synastry` / `stars` / `selftest`，外加强化的 `help`。

- **`cities` 命令删除**：`ziwei/cities.ts` 的数据表**保留**（`--city` 的容错解析与歧义提示仍查它），删的只是查询命令。`REQUIRED_EXPORTS` 里的 `PROVINCES` 随之退役（无命令消费者）。
- `chart` 保持十二宫逐宫详表职责（见 §1.3）。

### 3.2 `help` 强化 + 每命令 `--help`

- **`help`（总览）**：每条命令一段**详细说明**——功能、专属旗标、典型示例（含专题旗标组合）、注意事项（如「排盘四必问」「synastry 需先备两张 JSON」）。命令列表仍由 `COMMAND_DESC` 派生，详细文本新增 `COMMAND_HELP`（命令名 → 多行说明），HELP 逐命令展开。
- **`<命令> --help`（每命令）**：输出**该命令**的用法——专属旗标（从 `FLAG_GROUPS` 过滤出该命令实际读取的子集，**命令 → 旗标归属表**由此落地）、示例、口径警告。此前「旗标作用域是 skill 级不校验归属」的诚实边界顺势收窄：help 层面先给出正确的归属视图。
- 实现住 `cli/help.ts`：总览 help 与每命令 help 共用一张命令 → 旗标归属表 + `COMMAND_HELP` 文案表。

### 3.3 配置文件输入

- **`--config <file>`**：读 JSON 文件。键名与旗标的 camelCase 同名（`date` / `time` / `city` / `gender` / `pattern` / `mutagen` / `annual` …），出生信息与专题旗标都可写。
- **优先级：命令行旗标覆盖配置文件同名字段**（命令行更明确，必须赢；配置是基底）。
- **`--template`**：打印可直接使用的示例 JSON 模板到 stdout（含双方合盘示例与注释性字段说明），用户 `--template > my.json` 落盘。模板本身必须是合法可跑的配置。
- 校验：配置文件里的未知键、非法值与命令行同规则报错（不静默）。
- 实现住 `cli/config.ts`：读文件 → 键校验 → 与 argv 合并（argv 优先）→ 产出合成 `CliArgs`。

## 4. SKILL.md 重写

- **description**：合并三域触发词（排盘解读 / 合盘合婚 / 古籍检索），删除「用 xxx 技能」指路句（改为本技能命令）。
- 命令速查 5 条 + help：`astrology` / `classics` / `synastry` / `stars` / `selftest`（analyze / insight / chart / topic / cities 皆废）。
- 路径约定改写：命令一律 `node scripts/purple-star.ts`（仓库根 = skill 根，两重身份合一，原「仓库级文档写全路径」的区分作废）。
- 合盘工作流：先 `astrology --json` 两张 → `synastry --a-chart --b-chart`。

## 5. 测试策略

- TDD：selftest 断言先行（红→绿），沿用上一轮的模式。
- 迁移本身以「行为不变」为准：迁移提交前后 `selftest`（合并后的三段合计）与 `npm test` 必须全绿；`typecheck` 0 错。
- 层 6 守卫改写为单 skill 形态后，必须仍有「skill 自包含可拷走」的断言（对用户的承诺不变，只是承诺对象从三个变一个）。
- 新增断言：`astrology` 默认输出概览含信息面板、各功能旗标（英文名）产出对应专题、`--palaces` 出十二宫逐宫详表、`--annual` 缺省当前年、旧命令名（analyze / chart / topic / insight / cities）调用即报未知命令、每命令 `--help` 输出且含归属旗标、`--focus` 四项深化各自可锚定、`--config` 合并优先级（命令行赢）、`--template` 产物可被 `--config` 吃回。

## 6. 文档同步面

| 文档                  | 改动                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| 根 `SKILL.md`         | 全量重写（见 §4）                                                                                 |
| `references/`         | workflow / flags / output-contract 随命令面更新；并入 synastry-guide.md；troubleshooting 路径更新 |
| `CLAUDE.md`（仓库）   | 目录树、路径约定、skill 布局表、「另两个 skill」相关各节全删或改写、守卫表更新                    |
| `README.md`           | 三 skill 介绍 → 单 skill                                                                          |
| `docs/test/README.md` | 备案区追加「三 skill 合一」通告（报告正文不回改）                                                 |

## 7. 风险与不做的事

- **git 历史可追溯**：迁移用 `git mv`，diff 可追溯；不 squash 历史。
- **不做**：synastry 出生信息直传（用户明确否决）；不引 YAML/新依赖；不改排盘内核逻辑（ziwei/ 平移零改动）；不动 `tools/db/`（它引用的路径若受牵动单独核）。
- **依赖形态变化**：合并后只有根 `package.json` 一份，`iztro` + `lunar-typescript` 归它——原 classics / synastry「零 npm 依赖、拷走即跑」的优势消失，整个 skill 安装后需先 `npm install`（SKILL.md 安装说明要写明）。iztro 调用关系不变：astrology / selftest 排盘，synastry 吃 `astrology --json`（数据源头仍是 iztro），classics / stars / help 零排盘。
- **风险点**：路径迁移的「改漏即崩」清单（§2.7）——每项都有测试或 typecheck 兜着，迁移提交必须单独成笔、全绿才合。
- 分支策略：在 master 直接做（仓库惯例，无 PR 流程），但**迁移提交与功能提交分开**，出问题可单独 revert。
