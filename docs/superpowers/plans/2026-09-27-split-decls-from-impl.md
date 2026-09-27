# 实现与声明分离：`db-analysis.ts` / `birth-info.ts` 拆分的实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把两个混杂了「函数实现」与「模块级声明」的内核文件按纯搬移方式拆开，使改判定逻辑的人不必先翻过数据表。

**Architecture:** 先更名（纯路径改动，可独立审查），再拆分（建新文件 → 搬声明 → 瘦身原文件 → 同批修守卫）。全过程**不改变任何行为**，正确性由「搬前存基线 → 搬后逐字节 diff」一次性作证；公开面由 re-export 逐名保持。

**Tech Stack:** TypeScript（Node ≥ 22.15 的 `module.registerHooks` 直接运行，无构建步骤）、`iztro`、`lunar-typescript`。

**Spec:** [docs/superpowers/specs/2026-09-27-split-defs-from-impl-design.md](../specs/2026-09-27-split-defs-from-impl-design.md)

## Global Constraints

以下约束适用于**每一个** task，不再逐条重复：

- **纯搬移**：不改变任何行为、不调整任何常量取值、不调整任何判定逻辑。搬移判据只有一条——**只搬模块级声明，函数体内的局部常量一律不动**（`getTopicAnalysis` 体内那 3 处引文、`buildBirthInfo` 体内的局部表都留在原处）。
- **公开面逐名不变**：拆分前从模块导出的名字，拆分后**逐名仍可在原模块 import**（靠 re-export）。
- **不用 `any` 绕过类型报错**。`npm run typecheck` 必须 0 错误。
- **三合派硬约束**：本项目严格遵循倪海夏《天纪》三合派。`sihua.ts` 虽仍导出 `detectSelfSihua` / `findIncomingPalaces` / `getDaXianSiHua`，但那是历史遗留——**存在不等于该用**，本次改动不得引入它们。
- **import 写法**：`scripts/ziwei/*` 内部一律相对路径不带扩展名（`./analysis-meta`）；`scripts/cli/*` 引内核用 `@/ziwei/...`、引同层兄弟用相对路径不带扩展名（`./birth-info-defs`）。
- **引导层禁令**：`scripts/purple-star.ts` 里除 `node:` 内置模块外**不允许任何普通静态 import**（钩子必须在模块求值前注册）。改它时只改注释，不要动 import 结构。
- **不登记内核行数**：活文档（`SKILL.md`、`test/README.md`、`docs/test/README.md`）里不写内核行数，这是 `docs/test/05`「后续修正（十二）」已定的方向，本次不重新引入。
- **基线目录必须先清空**：`rm -rf "$BASE" && mkdir -p "$BASE"`。若目录已存在，shell 重定向会被拒绝、整条命令不执行，而 `diff` 会拿**旧文件**比出**假通过**——这是本仓库踩过的坑。
- **变更日志只追加**：`docs/test/05-corpus-and-blindspots.md` 只在末尾追加新节，历史节一律不动。

## Review Focus

以下是本次改动最可能出问题、而任何自动化测试都**不会**替你发现的地方，按可能性排序。每一条都已在其所属 task 里配了对应的核对步骤：

1. **同文件内混杂的引用被整文件替换**——`patterns.ts`（7 处中 4 改 3 不改）与 `annotations.json`（2 处中 1 改 1 不改）里，「收敛自 db-analysis」这类**历史陈述**与「取 db-analysis 的 detectGeJu 口径」这类**当前指代**混在一起。整文件 `sed` 会把历史陈述也改掉，那是伪造记录（Task 2）。
2. **`scripts/cli/commands.ts:36` 是运行时 import 路径**，不是注释。漏改直接崩，且崩在 CLI 启动而非测试（Task 2）。
3. **`selftest` 的引文扫描清单漏改**——`STAR_DB` 含 26 处引文命中里的 23 处，搬走后清单若不同步，该断言会漏扫 23/26 却**照旧变绿**。这是静默的安全退化，比测试变红危险（Task 5）。
4. **`STAR_DB` 的边界切错**（行 196–1010）：切多了会带走 `filterGenderContent` 的依赖，切少了会留下半个常量。typecheck 与基线 diff 各能抓住一部分（Task 4）。
5. **`re-export` 漏名**——5 个公开名漏掉任何一个，下游 `commands.ts` 的 import 会断。typecheck 能抓，但只在 `commands.ts` 真的用了那个名字时才抓得到（Task 5）。

---

## Task 1: 存基线（搬移前的现场）

**Files:**

- Create: `/tmp/ziwei-split-baseline/`（**不入库**，是一次性证据）

**Interfaces:**

- Consumes: 无（这是本次改动的起点）
- Produces: `$BASE/` 下的基线文件、`$BASE/exports-*.txt` 导出名单、终端记下的引文命中数 `26`——Task 2 / 5 / 6 / 8 的每一步都要拿它们比对

**为什么基线不入库**：它是**一次性证据**，证明「这次搬移没改变输出」，不是常驻防线。入库反而会让人误以为它还在持续把关。

- [ ] **Step 1: 建基线目录（必须先清空）**

```bash
BASE=/tmp/ziwei-split-baseline
rm -rf "$BASE" && mkdir -p "$BASE"
ls -la "$BASE"
```

Expected: 空目录。⚠️ 若跳过 `rm -rf`，后面的 `>` 重定向会被拒绝且**整条命令不执行**，而 `diff` 会拿上一轮的旧文件比出假通过。

- [ ] **Step 2: 存 `analyze` 基线（1990-05-15 × 5 个时辰 × 男女 = 10 份）**

```bash
BASE=/tmp/ziwei-split-baseline
for h in 00 03 05 09 11; do
  for g in male female; do
    node scripts/purple-star.ts analyze --date 1990-05-15 --time "$h:30" --city 北京 --gender "$g" \
      > "$BASE/analyze-$h-$g.txt"
  done
done
ls "$BASE"/analyze-*.txt | wc -l
```

Expected: `10`。这 10 份同时覆盖排盘（`algorithm.ts`）与格局短判词（`patterns.ts`），是本计划最宽的一张网。

- [ ] **Step 3: 存 `topic` 基线（长判词的唯一产出口）**

```bash
BASE=/tmp/ziwei-split-baseline
for t in overview personality; do
  node scripts/purple-star.ts topic --date 1990-05-15 --time 09:30 --city 北京 --gender male \
    --topic "$t" > "$BASE/topic-$t.txt"
done
wc -c "$BASE"/topic-*.txt
```

Expected: 两份，各数千字节。长判词**只在这两个主题产出**，`getTopicAnalysis` 是唯一入口。

- [ ] **Step 4: 存 `synastry` 基线（合盘走 `buildBirthInfo`）**

```bash
BASE=/tmp/ziwei-split-baseline
node scripts/purple-star.ts synastry \
  --a-date 1990-05-15 --a-time 09:30 --a-gender male --a-city 北京 \
  --b-date 1993-08-22 --b-time 14:00 --b-gender female --b-city 上海 \
  > "$BASE/synastry.txt"
wc -c "$BASE/synastry.txt"
```

Expected: 非空。

- [ ] **Step 5: 存 `--eot` 分支基线（`equationOfTime` 只在开了这个开关时才被调用）**

```bash
BASE=/tmp/ziwei-split-baseline
node scripts/purple-star.ts analyze --date 1990-05-15 --time 09:30 --city 北京 --gender male --eot \
  > "$BASE/analyze-eot.txt"
grep -c '均时差' "$BASE/analyze-eot.txt"
```

Expected: `≥ 1`。若为 0，说明 `--eot` 没生效，先查参数拼写再继续。

- [ ] **Step 6: 存城市名容错基线（`findLongitude` 的归一分支）**

```bash
BASE=/tmp/ziwei-split-baseline
for c in 石家庄 石家庄市 石家庄地区; do
  node scripts/purple-star.ts analyze --date 1990-05-15 --time 09:30 --city "$c" --gender male \
    > "$BASE/city-$c.txt"
done
md5sum "$BASE"/city-*.txt
```

Expected: **三个 md5 完全相同**——三种写法应归一到同一个经度，输出理应逐字节一致。若不同，说明容错分支的行为需要先查清楚，不要在没搞懂的情况下继续。

- [ ] **Step 7: 存两个模块的公开导出名单**

```bash
BASE=/tmp/ziwei-split-baseline
for m in db-analysis birth-info; do
  grep -oE '^export (type|interface|const|function) [A-Za-z_]+' "scripts/ziwei/$m.ts" 2>/dev/null \
    || grep -oE '^export (type|interface|const|function) [A-Za-z_]+' "scripts/cli/$m.ts" \
    | awk '{print $3}' | sort > "$BASE/exports-$m.txt"
done
cat "$BASE/exports-db-analysis.txt" "$BASE/exports-birth-info.txt"
```

Expected:

- `exports-db-analysis.txt` 恰好 5 行：`AnalysisOptions`、`AnalysisView`、`TOPIC_LABEL`、`TOPIC_PALACE_NAME`、`TopicKey`
- `exports-birth-info.txt` 恰好 4 行：`BirthInfoResult`、`LongitudeHit`、`TrueSolarOptions`、`TrueSolarResult`

若数量不符，先停下来核对——这两个数字是 Task 5 / 6 的验收依据。

- [ ] **Step 8: 记下引文扫描命中数**

```bash
node -e '
const fs = require("fs");
const re = /倪(?:海夏|师)[^。\n]{0,10}(?:说|言|称|警示|警告|明言|强调|描述|提醒)[：:]?\s*[「"『]([^」"』]{4,})[」"』]/g;
let total = 0;
for (const f of ["scripts/ziwei/db-analysis.ts", "scripts/ziwei/patterns.ts"]) {
  const n = [...fs.readFileSync(f, "utf8").matchAll(re)].length;
  console.log(`${f}: ${n} 处`);
  total += n;
}
console.log(`合计: ${total} 处`);
'
```

Expected: `db-analysis.ts: 26 处`、`patterns.ts: 0 处`、`合计: 26 处`。

⚠️ **把 `26` 记在便签上**。Task 5 改完扫描清单后要再跑一次，**必须仍是 26**——这是证明清单改对了的唯一手段。

- [ ] **Step 9: 确认起点是绿的**

```bash
npm run typecheck && node scripts/purple-star.ts selftest && npm test
```

Expected: typecheck 0 错误；`selftest` 通过 49/49；`npm test` 300 条基准全绿。

起点不绿就先查清楚，不要带着红的基线往下走——那样后面的 diff 无法归因。

- [ ] **Step 10: 提交**

本 task 不改仓库里的任何文件（基线在 `/tmp`），**无需提交**。直接进入 Task 2。

---

## Task 2: 更名 `db-analysis.ts` → `analysis.ts` 并修「指代当前」的引用

**Files:**

- Rename: `scripts/ziwei/db-analysis.ts` → `scripts/ziwei/analysis.ts`
- Modify: `scripts/cli/commands.ts:36`、`scripts/cli/selftest.ts`、`scripts/ziwei/patterns.ts`（4 处，**不是全部 7 处**）、`scripts/ziwei/annotations.json:2`、`scripts/purple-star.ts:18`、`test/invariants.test.ts:721`、`test/cli.test.ts:75`、`SKILL.md`、`.claude/CLAUDE.md`

**Interfaces:**

- Consumes: Task 1 的基线（本 task 后要拿它比对）
- Produces: 模块路径 `@/ziwei/analysis`，供 Task 3–5 引用；`db-analysis` 这个名字从此只出现在「历史陈述」与「指向上游同名文件」的场合

**这一步为什么单独成 task**：它是**纯路径改动**，与搬移混在一起会让 diff 无法审查。更名先行，Task 3–5 新建的文件就能直接叫新名。

⚠️ **本 task 最容易出错之处**：`patterns.ts` 7 处中只有 4 处要改，`annotations.json` 2 处中只有 1 处要改。**不要整文件替换**。

- [ ] **Step 1: 更名（用 `git mv` 保留历史）**

```bash
git mv scripts/ziwei/db-analysis.ts scripts/ziwei/analysis.ts
git status --short
```

Expected: 显示 `R  scripts/ziwei/db-analysis.ts -> scripts/ziwei/analysis.ts`（`R` = renamed）。

- [ ] **Step 2: 改 `commands.ts` 的 import（漏改直接崩）**

`scripts/cli/commands.ts:36` 把 `} from "@/ziwei/db-analysis";` 改为：

```ts
} from "@/ziwei/analysis";
```

这是**真实 import 语句**，不是注释。改完立刻验证：

```bash
grep -n 'ziwei/analysis' scripts/cli/commands.ts
node scripts/purple-star.ts topic --date 1990-05-15 --time 09:30 --city 北京 --gender male 2>&1 | head -3
```

Expected: grep 命中 `@/ziwei/analysis`；命令正常输出 13 个主题清单（若报模块找不到，就是这一步没改对）。

- [ ] **Step 3: 改 `selftest.ts` 的扫描清单路径**

`scripts/cli/selftest.ts:599` 把 `"ziwei/db-analysis.ts"` 改为 `"ziwei/analysis.ts"`：

```ts
const src = ["ziwei/analysis.ts", "ziwei/patterns.ts"]
```

⚠️ 本步**只改路径**。把新文件加进清单是 Task 5 的事（那时新文件才存在）。

- [ ] **Step 4: 改 `patterns.ts` 的 4 处当前指代（跳过 3 处历史陈述）**

逐行改这 4 处（行号是改动前的）：

| 行   | 改什么                                                                                 |
| ---- | -------------------------------------------------------------------------------------- |
| 81   | `使 \`db-analysis.ts\`（\`type Pattern\`）` → `使 \`analysis.ts\`（\`type Pattern\`）` |
| 419  | `（db-analysis.ts 的 detectGeJu）` → `（analysis.ts 的 detectGeJu）`                   |
| 514  | 同上                                                                                   |
| 1396 | `与 db-analysis 的取值一致` → `与 analysis.ts 的取值一致`                              |

**以下 3 处一律不动**——它们陈述的是历史事实：

| 行   | 内容                                                     | 为什么不动         |
| ---- | -------------------------------------------------------- | ------------------ |
| 1319 | 「收敛自 db-analysis 的格局（2026-09-27）」              | 记录那次收敛这件事 |
| 1320 | 「原先**只**存在于 `db-analysis.ts` 的 `detectGeJu` 里」 | 「原先」= 历史     |
| 1616 | 「2026-09-27 由 db-analysis 侧收敛进来的判定」           | 记录历史           |

改完核对：

```bash
grep -n 'db-analysis' scripts/ziwei/patterns.ts
```

Expected: **恰好 3 行**（1319、1320、1616 附近），且每行都含「收敛」「原先」「2026-09-27」这类历史标记。

- [ ] **Step 5: 改 `annotations.json` 第 2 行的 `_repo_note`**

第 2 行 `_repo_note` 里的「不得以『倪海夏/倪师…说』的强归属形式出现在 db-analysis.ts 中」改为 `analysis.ts`。

⚠️ **第 339 行不动**——那是上游 v2 的核对笔记，描述当时状态。

```bash
grep -n 'db-analysis' scripts/ziwei/annotations.json
```

Expected: **恰好 1 行**（339 行附近，含「北派飞星」「当前 db-analysis 混合了」）。若第 2 行还在，说明漏改。

- [ ] **Step 6: 改其余四处的当前指代**

| 文件                      | 位置                  | 改什么                                                             |
| ------------------------- | --------------------- | ------------------------------------------------------------------ |
| `scripts/purple-star.ts`  | 18                    | 顶部注释目录树里的路径                                             |
| `test/invariants.test.ts` | 721                   | 「取 topic 侧（`db-analysis.ts` 的 `detectGeJu`）」→ `analysis.ts` |
| `test/cli.test.ts`        | 75                    | 「含 iztro/db-analysis/classics/nihai」→ `analysis`                |
| `SKILL.md`                | 107、188（2 处）、334 | 分析数据库 v3 的位置描述                                           |

⚠️ `test/invariants.test.ts` 的 **634 / 847 / 1091 行不动**（历史事件记录），`SKILL.md` 的 **342 行不动**（指上游同名文件）。

```bash
grep -n 'db-analysis' test/invariants.test.ts SKILL.md
```

Expected: `test/invariants.test.ts` 剩 3 行（634/847/1091）；`SKILL.md` 剩 1 行（342）。

- [ ] **Step 7: 改 `.claude/CLAUDE.md` 的架构图**

`scripts/ziwei/db-analysis.ts      分析数据库 v3（主题论断动态推算，topic 命令用）` 里的路径改为 `analysis.ts`。

- [ ] **Step 8: 全仓复查——剩余命中必须逐条有据**

```bash
grep -rn 'db-analysis' --include='*.ts' --include='*.md' --include='*.json' . 2>/dev/null \
  | grep -v node_modules | grep -v '^\./docs/test/0[1-5]' | grep -v '^\./docs/superpowers/'
```

Expected: 每一行都落在下面两类里，**没有一条例外**：

- 代码注释里的历史陈述（`patterns.ts` 3 处、`patterns-defs.ts:735`、`test/invariants.test.ts` 3 处）
- 指上游同名文件（`README.md:95`、`SKILL.md:342`、`test/README.md:316`、`test/tools/verify-source.ts:73`、`test/tools/build-fixtures.ts:133`、`annotations.json:339`）

若有第三种，说明改漏了或改多了。

- [ ] **Step 9: 跑验证网**

```bash
npm run typecheck && node scripts/purple-star.ts selftest
BASE=/tmp/ziwei-split-baseline
for h in 00 03 05 09 11; do
  for g in male female; do
    node scripts/purple-star.ts analyze --date 1990-05-15 --time "$h:30" --city 北京 --gender "$g" \
      | diff -q "$BASE/analyze-$h-$g.txt" - || echo "❌ 差异：analyze-$h-$g"
  done
done
echo "更名后 diff 完成"
```

Expected: typecheck 0 错误；selftest 49/49；10 份 diff **全部无输出**（`diff -q` 静默即一致）。

- [ ] **Step 10: 提交**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(ziwei): db-analysis.ts 更名为 analysis.ts，同步当前指代的引用

纯路径改动，与后续的声明搬移分开以便审查。

- 20 个文件提到 db-analysis，但只有一部分是「指代本仓当前文件」：
  commands.ts 的 import 语句、selftest 的扫描清单、patterns.ts 的 4 处、
  annotations.json 第 2 行 _repo_note、以及几处目录树注释。
- 其余一律不动，因为它们陈述的是历史事实或指向上游同名文件：
  patterns.ts 的「收敛自 db-analysis」3 处、annotations.json:339 的上游 v2
  核对笔记、README/SKILL.md 里「未含站点侧 db-analysis.ts」（指上游那个）。
  改名后本仓再无同名文件，这层歧义自动消解。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 建 `analysis-meta.ts`（类型 + 元数据表）

**Files:**

- Create: `scripts/ziwei/analysis-meta.ts`
- Read: `scripts/ziwei/analysis.ts`（只读，本 task 不修改它）

**Interfaces:**

- Consumes: 无外部依赖（实测声明区不引用 `BRANCHES` / `STEMS`）
- Produces: `analysis-meta.ts`，导出 `TopicKey`、`TOPIC_PALACE_NAME`、`TOPIC_LABEL`、`AnalysisView`、`AnalysisOptions` 及后续 typecheck 要求的若干私有表——Task 4 / 5 从这里 import

**本 task 结束时新文件是「死代码」**（还没有人 import 它），这是**有意的**：搬移分两半——先让新文件孤立地存在并通过 typecheck，再在 Task 5 把它接上。这样任何一步出错都能独立定位。

- [ ] **Step 1: 提取四段声明内容**

`analysis-meta.ts` 要装的内容在 `analysis.ts` 里分处四段（行号是**改动前**的）：

| 段  | 行范围    | 装什么                                                                                                                                              |
| --- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| ①   | 42–195    | `TopicKey`、`TOPIC_PALACE_NAME`、`TOPIC_LABEL`、`TOPIC_SANFANG_LABELS`、`STAR_BRIEF`、`StarSummaryGender`、`StarSummary`、`TopicMod`、`StarContent` |
| ②   | 1135–1476 | `PALACE_BRANCH_ORGAN`、`ZIWU_LIUZHU`、`KUI_YUE_GUIREN_MAP`、`MINOR_STAR_PALACE_CONTENT`                                                             |
| ③   | 1482–1694 | `PALACE_TO_CONTENT_KEY`、`TOPIC_KEY_PALACES`                                                                                                        |
| ④   | 1718–1729 | `AnalysisView`、`AnalysisOptions`                                                                                                                   |

⚠️ ②③ 之间夹着 `getMinorStarNote`（1477–1481）、③ 与 ④ 之间夹着 `detectGeJu`（1695–1717）——那两段是**函数，不搬**，所以四段不能合并成一个大范围。

先建骨架与头部注释：

```bash
cat > scripts/ziwei/analysis-meta.ts <<'HEADER'
/**
 * 分析数据库的元数据层 —— 类型与映射表。
 *
 * 本模块只放「是什么」，不放「怎么算」：主题键与标签、星曜简述、宫位与脏腑的对应、
 * 紫微诸星安放表、魁钺贵人表、十四主星以外的星曜落宫文案、主题与宫位的对应关系。
 * 它们改结构才动；会持续增删的论断**文案**在 `./analysis-content`，推算逻辑在 `./analysis`。
 *
 * 依赖：无（内部不引用 BRANCHES / STEMS，故本模块可独立成型）
 */
HEADER
echo "骨架已建：$(wc -l < scripts/ziwei/analysis-meta.ts) 行"
```

Expected: `7` 行左右。

- [ ] **Step 2: 追加四段内容**

```bash
{
  sed -n '42,195p'   scripts/ziwei/analysis.ts
  echo
  sed -n '1135,1476p' scripts/ziwei/analysis.ts
  echo
  sed -n '1482,1694p' scripts/ziwei/analysis.ts
  echo
  sed -n '1718,1729p' scripts/ziwei/analysis.ts
} >> scripts/ziwei/analysis-meta.ts
wc -l scripts/ziwei/analysis-meta.ts
```

Expected: 约 `7 + 154 + 342 + 213 + 12 + 3 ≈ 731` 行。（与 spec 估的 ~700 行吻合。）

- [ ] **Step 3: 给 `StarContent` 加 `export`（已知必要的一个）**

spec §4.4 只预先确定了一个：`StarContent`——`analysis-content.ts` 与 `analysis.ts` 都要引用它。

```bash
sed -i 's/^interface StarContent {/export interface StarContent {/' scripts/ziwei/analysis-meta.ts
grep -n 'StarContent' scripts/ziwei/analysis-meta.ts | head -3
```

Expected: 出现 `export interface StarContent {`。

其余的符号**暂时不加 export**——等 Task 5 接上后由 typecheck 逐个报出来，这是 spec §4.4 定的尺度（只给跨文件引用的加）。

- [ ] **Step 4: 确认新文件能独立通过类型检查**

```bash
npm run typecheck
```

Expected: 0 错误。

⚠️ 若报「找不到名称 X」，说明 Step 2 的行范围切错了（多半是某段少了开头几行）。**不要用 `any` 或补声明绕过去**——回去核对行号。

- [ ] **Step 5: 不提交**

本 task 的产物是**孤立的新文件**，单独提交会让仓库短暂存在一个无人引用的模块。**与 Task 4、5 合并成一次提交**——Task 5 结束时一起提交。

---

## Task 4: 建 `analysis-content.ts`（`STAR_DB`）

**Files:**

- Create: `scripts/ziwei/analysis-content.ts`
- Read: `scripts/ziwei/analysis.ts`（只读）

**Interfaces:**

- Consumes: `import type { StarContent } from "./analysis-meta"`（Task 3 已导出）
- Produces: `analysis-content.ts`，导出 `STAR_DB: Record<string, StarContent>`——Task 5 从实现文件 import 它

**这是全次拆分最危险的一处**：`STAR_DB` 含 26 处引文命中里的 **23 处**（详见 Task 5）。

- [ ] **Step 1: 提取 `STAR_DB`**

它独占 `analysis.ts` 的 **196–1010** 行（下一个符号 `filterGenderContent` 在 1011）。

```bash
cat > scripts/ziwei/analysis-content.ts <<'HEADER'
/**
 * 分析数据库的**内容**层 —— 十四主星 × 13 主题的论断文案。
 *
 * 与 `./analysis-meta` 的分工：那边是改结构才动的映射表与类型，这里是会持续增删的文案。
 * 两者增长曲线不同，故分处两个文件。
 *
 * ⚠️ 本文件含大量「倪师/倪海夏…说」形式的引文，是 `selftest` 引文核对断言的
 *    扫描对象之一（见 `cli/selftest.ts` 的扫描清单）。**新增带引文的段落时，
 *    不要把它拆到清单之外的文件里**，否则该断言会静默失效。
 *
 * 依赖：./analysis-meta（只为取 StarContent 类型）
 */
import type { StarContent } from "./analysis-meta";

HEADER
sed -n '196,1010p' scripts/ziwei/analysis.ts >> scripts/ziwei/analysis-content.ts
wc -l scripts/ziwei/analysis-content.ts
```

Expected: `约 15 + 815 = 830` 行。

- [ ] **Step 2: 给 `STAR_DB` 加 `export`**

```bash
sed -i 's/^const STAR_DB: Record<string, StarContent> = {/export const STAR_DB: Record<string, StarContent> = {/' \
  scripts/ziwei/analysis-content.ts
head -20 scripts/ziwei/analysis-content.ts | grep -n 'STAR_DB'
```

Expected: 出现 `export const STAR_DB: Record<string, StarContent> = {`。

- [ ] **Step 3: 核对边界——首尾必须是完整符号**

```bash
FIN=$(wc -l < scripts/ziwei/analysis-content.ts)
echo "--- 尾部 5 行 ---"; tail -5 scripts/ziwei/analysis-content.ts
echo "--- 原文件 1010-1012 行（应紧接 STAR_DB 的收尾）---"; sed -n '1008,1013p' scripts/ziwei/analysis.ts
```

Expected: `analysis-content.ts` 的最后一行是 `};`（`STAR_DB` 的收尾）。若末尾出现 `function filterGenderContent` 之类，说明多切了行——**把它删掉**（那是函数，要留在实现文件里）。

- [ ] **Step 4: 独立通过类型检查**

```bash
npm run typecheck
```

Expected: 0 错误。

⚠️ 若报 `StarContent` 找不到，说明 Task 3 的 Step 3 没做。

- [ ] **Step 5: 不提交**

同 Task 3——与 Task 5 合并提交。

---

## Task 5: 瘦身 `analysis.ts` + 同批修两处守卫

**Files:**

- Modify: `scripts/ziwei/analysis.ts`（删掉四段声明 + `STAR_DB`，加 import 与 re-export）
- Modify: `scripts/cli/selftest.ts:599`（扫描清单加 `analysis-content.ts`）
- Modify: `scripts/ziwei/annotations.json:2`（`_repo_note` 适用范围扩到三个文件）
- Modify: `scripts/cli/commands.ts`（若需要 re-export 补名）

**Interfaces:**

- Consumes: Task 3 的 `analysis-meta.ts`、Task 4 的 `analysis-content.ts`
- Produces: 拆分完成的三个文件；`analysis.ts` 的公开面 re-export 保持 5 个名字不变

⚠️ **本 task 的两处守卫必须与搬移同批完成**，不能留作后续跟进——`STAR_DB` 一搬走，引文核对断言的扫描面就少 23/26，而它**仍然会变绿**。这正是 `docs/test/05` 记录过的同一陷阱的上一次发作。

- [ ] **Step 1: 删掉搬走的五段（按原始行号，从后往前写以免自己数错）**

```bash
cd /home/swix/Code/TypeScriptProjects/purplestar-astrology
cp scripts/ziwei/analysis.ts /tmp/analysis-before-trim.ts
sed -i '1718,1729d; 1482,1694d; 1135,1476d; 196,1010d; 42,195d' scripts/ziwei/analysis.ts
wc -l scripts/ziwei/analysis.ts
```

Expected: 约 `2407 - 12 - 213 - 342 - 815 - 154 = 871` 行。

`sed` 的多个 `d` 地址按**输入行号**匹配，删除不影响后续地址的计算，故可一次写完。`cp` 那行是留个后悔药，方便比对。

- [ ] **Step 2: 加 import 段**

在文件顶部现有的 import 之后追加（`ziwei/*` 内部用**相对路径不带扩展名**）：

```ts
import type { StarContent } from "./analysis-meta";
import { STAR_DB } from "./analysis-content";
```

再按 Step 4 的 typecheck 报错，从这里补上其余实际用到的符号，例如：

```ts
import {
	PALACE_BRANCH_ORGAN,
	ZIWU_LIUZHU,
	KUI_YUE_GUIREN_MAP,
	MINOR_STAR_PALACE_CONTENT,
	PALACE_TO_CONTENT_KEY,
	TOPIC_KEY_PALACES,
	type StarSummary,
	type TopicMod,
} from "./analysis-meta";
```

⚠️ 具体是哪些符号，**以 typecheck 的实际报错为准**，不要照抄上面这个列表——它只是形态示例。

- [ ] **Step 3: 加 re-export 段（保住公开面）**

原公开面 5 个名字，现在定义在 `analysis-meta.ts`，但调用方（`commands.ts`）仍从 `analysis.ts` import。加：

```ts
// ── 公开面 re-export ──
// 拆分前从本模块导出的名字，拆分后**逐名仍可从这里 import**。
// `analysis-meta.ts` 是这些声明的实际归属地；此处只做转发，调用方一行不用改。
export type { TopicKey, AnalysisView, AnalysisOptions } from "./analysis-meta";
export { TOPIC_PALACE_NAME, TOPIC_LABEL } from "./analysis-meta";
```

⚠️ 5 个名字一个都不能少。漏掉的后果见 Review Focus 第 5 条。

⚠️ 这 5 个名字**只应出现在这段 re-export 里**。Step 2 的 `import` 若也引了它们，会与本段构成重复标识符——typecheck 会报错，届时把 import 那侧去掉即可（re-export 已使它们在本模块可见）。

- [ ] **Step 4: 用 typecheck 补齐 export 与 import**

```bash
npm run typecheck
```

Expected: 0 错误。

**逐个处理报错**，每次只做最小改动：

- 报 `Module "./analysis-meta" has no exported member 'X'` → 去 `analysis-meta.ts` 给 `X` 加 `export`
- 报 `Cannot find name 'X'` → 在本文件补 import

反复跑到 0 错误。**不要用 `any` 绕过去**（项目硬约束）。

- [ ] **Step 5: ⚠️ 修 selftest 的引文扫描清单（本次最危险的一步）**

`scripts/cli/selftest.ts:599` 改为三个元素：

```ts
const src = ["ziwei/analysis.ts", "ziwei/analysis-content.ts", "ziwei/patterns.ts"]
```

同时把该断言上方注释里的扫描范围说明补一句，指向新文件（注释在 595–598 行）：

```ts
// ⚠️ 扫描范围必须覆盖**所有**带倪师引文的源码。判词原先全在 db-analysis.ts，
//    2026-09-27 起 25 段倪师口吻长判词搬到了 patterns.ts（各识别器的
//    `topicDescription`），另 23 处引文随 STAR_DB 搬到了 analysis-content.ts。
//    只读一个文件会让本断言**静默失效**——它仍会绿，却再扫不到判词所在的文件。
//    新增带引文的模块时，记得加进这个列表。
```

- [ ] **Step 6: 验证扫描清单改对了（本计划唯一的硬证据）**

```bash
node -e '
const fs = require("fs");
const re = /倪(?:海夏|师)[^。\n]{0,10}(?:说|言|称|警示|警告|明言|强调|描述|提醒)[：:]?\s*[「"『]([^」"』]{4,})[」"』]/g;
let total = 0;
for (const f of ["scripts/ziwei/analysis.ts", "scripts/ziwei/analysis-content.ts", "scripts/ziwei/patterns.ts"]) {
  const n = [...fs.readFileSync(f, "utf8").matchAll(re)].length;
  console.log(`${f}: ${n} 处`);
  total += n;
}
console.log(`合计: ${total} 处`);
'
```

Expected: **合计仍是 26 处**，且分布为 `analysis.ts: 3`、`analysis-content.ts: 23`、`patterns.ts: 0`。

⚠️ 若合计 < 26，说明清单漏了文件或搬移掉了内容——**停下来查清楚**，不要接受一个变小的数字。

- [ ] **Step 7: 修 `annotations.json` 的 `_repo_note` 适用范围**

第 2 行的 `_repo_note` 里，把「不得以『倪海夏/倪师…说』的强归属形式出现在 `analysis.ts` 中」扩成覆盖三个文件：

```json
"不得以「倪海夏/倪师…说」的强归属形式出现在 analysis.ts / analysis-content.ts / analysis-meta.ts 中"
```

⚠️ 只改这一句的适用范围，**不要动该行的其余文字**（它记录了来源与 v3 清修史）。

- [ ] **Step 8: 保存证据并跑全套验证**

```bash
BASE=/tmp/ziwei-split-baseline
grep -oE '^export (type|interface|const|function) [A-Za-z_]+' scripts/ziwei/analysis.ts \
  | awk '{print $3}' | sort > "$BASE/exports-analysis-after.txt"
diff "$BASE/exports-db-analysis.txt" "$BASE/exports-analysis-after.txt" && echo "✅ 公开面逐名一致"

npm run typecheck && node scripts/purple-star.ts selftest && npm test
```

Expected:

- `diff` 无输出 + `✅ 公开面逐名一致`（5 个名字一个不少）
- typecheck 0 错误；selftest 49/49；`npm test` 300 条全绿

- [ ] **Step 9: 搬后逐字节 diff（本次改动正确性的要害）**

```bash
BASE=/tmp/ziwei-split-baseline
fail=0
for h in 00 03 05 09 11; do
  for g in male female; do
    node scripts/purple-star.ts analyze --date 1990-05-15 --time "$h:30" --city 北京 --gender "$g" \
      | diff -q "$BASE/analyze-$h-$g.txt" - >/dev/null || { echo "❌ analyze-$h-$g"; fail=1; }
  done
done
for t in overview personality; do
  node scripts/purple-star.ts topic --date 1990-05-15 --time 09:30 --city 北京 --gender male --topic "$t" \
    | diff -q "$BASE/topic-$t.txt" - >/dev/null || { echo "❌ topic-$t"; fail=1; }
done
node scripts/purple-star.ts synastry \
  --a-date 1990-05-15 --a-time 09:30 --a-gender male --a-city 北京 \
  --b-date 1993-08-22 --b-time 14:00 --b-gender female --b-city 上海 \
  | diff -q "$BASE/synastry.txt" - >/dev/null || { echo "❌ synastry"; fail=1; }
node scripts/purple-star.ts analyze --date 1990-05-15 --time 09:30 --city 北京 --gender male --eot \
  | diff -q "$BASE/analyze-eot.txt" - >/dev/null || { echo "❌ analyze-eot"; fail=1; }
for c in 石家庄 石家庄市 石家庄地区; do
  node scripts/purple-star.ts analyze --date 1990-05-15 --time 09:30 --city "$c" --gender male \
    | diff -q "$BASE/city-$c.txt" - >/dev/null || { echo "❌ city-$c"; fail=1; }
done
[ "$fail" = 0 ] && echo "✅ 全部输出与基线逐字节一致" || echo "❌ 有差异，逐条查上表"
```

Expected: 只打印 `✅ 全部输出与基线逐字节一致`。

⚠️ 任何一条 `❌` 都意味着**行为被改变了**——这不是「测试该修的 bug」，是搬移出了错。回到 Step 1 用 `/tmp/analysis-before-trim.ts` 逐段比对。

- [ ] **Step 10: 提交**

```bash
git add scripts/ziwei/analysis.ts scripts/ziwei/analysis-meta.ts scripts/ziwei/analysis-content.ts \
  scripts/cli/selftest.ts scripts/ziwei/annotations.json scripts/cli/commands.ts
git commit -m "$(cat <<'EOF'
refactor(ziwei): analysis.ts 拆出声明层，STAR_DB 与元数据表各自独立

纯搬移：2407 行 → 约 880 行，声明侧 1530 行分入两个新文件。
公开面 5 个名字原处 re-export，调用方一行未改。

- analysis-content.ts：只放 STAR_DB（会持续增删的论断文案，~830 行）
- analysis-meta.ts：类型 + 10 张映射表（改结构才动，~700 行）
- analysis.ts：只剩函数实现与 re-export

同批修两处会静默失效的守卫（漏了就是安全退化，不是测试变红）：
- selftest 的引文扫描清单补 analysis-content.ts —— STAR_DB 含 26 处引文
  命中里的 23 处，不同步改则断言漏扫 23/26 却照旧变绿。
- annotations.json 的 _repo_note 适用范围扩到三个文件，否则防回流禁语
  清单只盯住一个空壳。

证据：全仓公开导出名单拆前后逐名相等；14 份输出与基线逐字节一致；
引文命中数拆前 26 → 拆后仍 26。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 拆 `birth-info.ts`（`cli/` 侧，与 Task 3–5 无依赖）

**Files:**

- Create: `scripts/cli/birth-info-defs.ts`
- Modify: `scripts/cli/birth-info.ts`

**Interfaces:**

- Consumes: `CliArgs`（`./args`）、`BirthInfo`（`@/ziwei/types`）、`CityInfo` + `PROVINCES`（`@/ziwei/cities`）
- Produces: `birth-info-defs.ts`，导出 `TrueSolarOptions`、`TrueSolarResult`、`LongitudeHit`、`BirthInfoResult`（4 个公开名）及 `ADMIN_SUFFIX`、`ALL_CITIES`

⚠️ 本 task 与 Task 3–5 **没有依赖**，可以独立完成、独立提交。

- [ ] **Step 1: 建 `birth-info-defs.ts`**

要搬的是 4 段（行号是**改动前**的）：

| 段  | 行范围  | 装什么                                |
| --- | ------- | ------------------------------------- |
| ①   | 72–140  | `TrueSolarOptions`、`TrueSolarResult` |
| ②   | 207–214 | `ADMIN_SUFFIX`                        |
| ③   | 220–254 | `LongitudeHit`、`ALL_CITIES`          |
| ④   | 292–337 | `BirthInfoResult`                     |

⚠️ ① 与 ② 之间夹着 `calcTrueSolar`（141–191）与 `shiftDate`（192–206）、③ 与 ④ 之间夹着 `findLongitude`（255–291）——**都是函数，不搬**。

```bash
cat > scripts/cli/birth-info-defs.ts <<'HEADER'
/**
 * 出生信息解析层的**声明**部分 —— 接口与常量。
 *
 * 与 `./birth-info` 的分工：那边是「怎么算」（真太阳时、农历换算、城市名归一），
 * 这里是「长什么样」（`CliArgs` → `BirthInfoResult` 的中间结构）。
 *
 * 依赖：./args（CliArgs）、@/ziwei/types（BirthInfo）、@/ziwei/cities（CityInfo / PROVINCES）
 *
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 内核。
 */

import type { CliArgs } from "./args";
import type { BirthInfo } from "@/ziwei/types";
import { PROVINCES, type CityInfo } from "@/ziwei/cities";

HEADER
{
  sed -n '72,140p'  scripts/cli/birth-info.ts; echo
  sed -n '207,214p' scripts/cli/birth-info.ts; echo
  sed -n '220,254p' scripts/cli/birth-info.ts; echo
  sed -n '292,337p' scripts/cli/birth-info.ts
} >> scripts/cli/birth-info-defs.ts
wc -l scripts/cli/birth-info-defs.ts
```

Expected: 约 `17 + 69 + 8 + 35 + 46 = 175` 行（与 spec 估的 ~170 吻合）。

- [ ] **Step 2: 给跨文件引用的符号加 `export`**

`ADMIN_SUFFIX` 被 `stripSuffix` 用、`ALL_CITIES` 被 `findLongitude` 用，两者都要 export；4 个公开 interface 原本就是 `export`。

```bash
sed -i 's/^const ADMIN_SUFFIX =/export const ADMIN_SUFFIX =/; s/^const ALL_CITIES: CityInfo\[\] =/export const ALL_CITIES: CityInfo[] =/' \
  scripts/cli/birth-info-defs.ts
grep -n '^export' scripts/cli/birth-info-defs.ts
```

Expected: 至少 6 行 export（4 个 interface + 2 个常量）。

- [ ] **Step 3: 从 `birth-info.ts` 删掉这四段**

```bash
cd /home/swix/Code/TypeScriptProjects/purplestar-astrology
cp scripts/cli/birth-info.ts /tmp/birth-info-before-trim.ts
sed -i '292,337d; 220,254d; 207,214d; 72,140d' scripts/cli/birth-info.ts
wc -l scripts/cli/birth-info.ts
```

Expected: 约 `532 - 46 - 35 - 8 - 69 = 374` 行。

- [ ] **Step 4: 加 import 与 re-export**

在 `birth-info.ts` 现有 import 之后追加（`cli/*` 引同层兄弟用**相对路径不带扩展名**）：

```ts
import {
	ADMIN_SUFFIX,
	ALL_CITIES,
	type TrueSolarOptions,
	type TrueSolarResult,
	type LongitudeHit,
	type BirthInfoResult,
} from "./birth-info-defs";
```

⚠️ 具体哪些符号**以 typecheck 报错为准**。

并在文件末尾（或 import 段之后）加 re-export，保住 4 个公开名：

```ts
// ── 公开面 re-export ──
// 拆分前从本模块导出的 4 个名字，拆分后**逐名仍可从这里 import**。
// 实际归属地在 `./birth-info-defs`；此处只做转发。
export type {
	TrueSolarOptions,
	TrueSolarResult,
	LongitudeHit,
	BirthInfoResult,
} from "./birth-info-defs";
```

⚠️ 若同名的 `import type` 与 `export type` 并存导致重复标识符，把 import 那侧的这几个名字去掉（re-export 已使它们在本模块可见）。以 typecheck 为准。

- [ ] **Step 5: 跑验证**

```bash
npm run typecheck
BASE=/tmp/ziwei-split-baseline
grep -oE '^export (type|interface|const|function) [A-Za-z_]+' scripts/cli/birth-info.ts \
  | awk '{print $3}' | sort > "$BASE/exports-birth-info-after.txt"
diff "$BASE/exports-birth-info.txt" "$BASE/exports-birth-info-after.txt" && echo "✅ 4 个公开名逐名一致"

node scripts/purple-star.ts analyze --date 1990-05-15 --time 09:30 --city 北京 --gender male --eot \
  | diff -q "$BASE/analyze-eot.txt" - && echo "✅ --eot 分支一致"
node scripts/purple-star.ts analyze --date 1990-05-15 --time 09:30 --city 石家庄地区 --gender male \
  | diff -q "$BASE/city-石家庄地区.txt" - && echo "✅ 城市容错分支一致"
node scripts/purple-star.ts synastry \
  --a-date 1990-05-15 --a-time 09:30 --a-gender male --a-city 北京 \
  --b-date 1993-08-22 --b-time 14:00 --b-gender female --b-city 上海 \
  | diff -q "$BASE/synastry.txt" - && echo "✅ synastry 一致"
```

Expected: typecheck 0 错误；三个 `✅`；`diff` 全部静默。

- [ ] **Step 6: 提交**

```bash
git add scripts/cli/birth-info.ts scripts/cli/birth-info-defs.ts
git commit -m "$(cat <<'EOF'
refactor(cli): birth-info.ts 拆出声明层 birth-info-defs.ts

纯搬移：532 行 → 约 380 行。4 个 interface 与 2 个常量搬入新文件，
4 个公开名原处 re-export，调用方一行未改。

函数体内的局部表（buildBirthInfo 的）留在原处——搬移判据是「只搬
模块级声明」，那些表的读者是函数本身，不是翻文件的人。

证据：公开导出名单拆前后逐名相等；--eot / 城市容错 / synastry 三条
路径的输出与基线逐字节一致。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 文档同步（活文档改，快照不改）

**Files:**

- Modify: `SKILL.md`、`.claude/CLAUDE.md`（若 Task 2 已改过路径，这里补齐文件清单）
- Modify: `docs/test/05-corpus-and-blindspots.md`（**只在末尾追加**）

**Interfaces:**

- Consumes: Task 3–6 的最终文件结构
- Produces: 活文档与代码一致；变更日志多一节「后续修正（十三）」

⚠️ 改之前先分清**活文档**与**时点快照**——改错了就是伪造记录：

| 文件                                                                     | 性质         | 改法           |
| ------------------------------------------------------------------------ | ------------ | -------------- |
| `SKILL.md`、`.claude/CLAUDE.md`、`test/README.md`、`docs/test/README.md` | 活           | 直接改         |
| `docs/test/05-corpus-and-blindspots.md`                                  | 变更日志     | **只追加新节** |
| `docs/test/01~04-*.md`                                                   | 带日期的快照 | **不改**       |

- [ ] **Step 1: `SKILL.md` 补全新增文件**

Task 2 已改过第 107、188、334 行的路径。本步在其基础上做两件事：

**① 补第 103 行表格**——那里讲格局判定规则与两套判词分处 `patterns.ts`（判定）与 `patterns-defs.ts`（判词表）。这是**上次拆分遗留的漏改**（`patterns-defs.ts` 当时没被写进文档），本次一并补上，与本 spec §7.1 一致。

**② 让第 188 行那段「分析数据库 v3」的描述提到拆分后的三个文件**：

- 论断**文案**在 `analysis-content.ts`
- 类型与映射表在 `analysis-meta.ts`
- 推算逻辑在 `analysis.ts`

```bash
grep -n 'analysis' SKILL.md | head -20
```

Expected: 出现的应是 `analysis.ts` / `analysis-content.ts` / `analysis-meta.ts`，无 `db-analysis`（342 行的上游引用除外）。

- [ ] **Step 2: `.claude/CLAUDE.md` 补全目录树四个新文件**

`scripts/ziwei/` 的目录树补上 `analysis-meta.ts` 与 `analysis-content.ts`；`scripts/cli/` 补上 `birth-info-defs.ts`。同时补 `patterns-defs.ts`——**上次拆分后就已经漏了**，一并补上。

```bash
grep -n 'patterns-defs\|analysis-\|birth-info' .claude/CLAUDE.md
```

Expected: 四个新文件都出现在目录树里。

- [ ] **Step 3: `docs/test/05` 末尾追加一节**

**只追加，不回改任何历史节**。按该文件既有体例（`### 后续修正（N）（日期）：标题`）：

```markdown
### 后续修正（十三）（2026-09-27）：声明与实现分离，第二次落地

`db-analysis.ts`（2407 行）与 `birth-info.ts`（532 行）按（十一）同一套分法拆开。本次
比（十一）多了一件事：**内核文件更名**（`db-analysis.ts` → `analysis.ts`），因此多了一类
只在更名时才会遇到的判断——同一个旧名，有些地方是「指代当前文件」，有些是「陈述历史
事实」，前者必须改、后者绝不能改，`patterns.ts` 与 `annotations.json` 里两者还混在
同一个文件中（详见 `docs/superpowers/specs/2026-09-27-split-defs-from-impl-design.md`
§7.1.1 的逐处判定表）。

**引文扫描清单的第二次修复**：（十一）记过判词从 `db-analysis.ts` 搬到 `patterns.ts`
时漏改扫描清单、断言静默失效的教训。本次 `STAR_DB` 搬入 `analysis-content.ts`，带走了
26 处引文命中里的 23 处，同一处清单再次需要同批修改。修复后实测命中数 26 → 26 不变。

**证据**（均为一次性，非常驻防线）：

| 手段                                  | 结果                                                               |
| ------------------------------------- | ------------------------------------------------------------------ |
| 公开导出名单拆前后比对                | `analysis.ts` 5 个、`birth-info.ts` 4 个，逐名相等                 |
| 14 份命令输出逐字节 diff              | 全部一致（analyze × 10、topic × 2、synastry、--eot、城市容错 × 3） |
| 引文扫描命中数                        | 26 → 26                                                            |
| `typecheck` / `selftest` / `npm test` | 0 错误 / 49-49 / 300 条全绿                                        |

**更名后有意残留的旧名**：仓库里仍有若干处写着 `db-analysis`，它们分别是历史陈述
（如「收敛自 db-analysis 的格局」）或指向**上游 toolkit 的同名文件**（如 `README.md`
的「未含站点下的 `db-analysis.ts`」）。**见到不必当漏改**——判定表在 spec §7.1.1。

**附带收益**：本仓曾与上游存在同名文件 `db-analysis.ts`，读者看到「未含 db-analysis.ts」
无从分辨指哪一个。本仓更名后这层歧义自动消解。
```

⚠️ 上述内容里的数字（49-49、300）**必须在 Step 4 实测后回填真实值**，不要照抄。

- [ ] **Step 4: 实测并把数字填进上一节**

```bash
npm test 2>&1 | tail -5
node scripts/purple-star.ts selftest 2>&1 | head -3
```

Expected: 记下真实的断言数与基准条数，回填 Step 3 的表格与正文。

- [ ] **Step 5: 提交**

```bash
git add SKILL.md .claude/CLAUDE.md docs/test/05-corpus-and-blindspots.md
git commit -m "$(cat <<'EOF'
docs: 同步声明分离拆分的文件结构，并按体例追加变更日志（十三）

- SKILL.md / .claude/CLAUDE.md 补全新增文件（含上次拆分漏掉的 patterns-defs.ts）
- docs/test/05 只在末尾追加「后续修正（十三）」，历史节一律不动
- 活文档不登记新增文件的行数，沿用「后续修正（十二）」已定的方向

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 终验（全仓复查 + 三层验证网）

**Files:**

- 不修改任何文件，只读

**Interfaces:**

- Consumes: Task 1 的全部基线
- Produces: 一份「可以交付」的判断

- [ ] **Step 1: 全仓复查两个旧名**

```bash
echo "=== db-analysis ==="
grep -rn 'db-analysis' --include='*.ts' --include='*.md' --include='*.json' . 2>/dev/null \
  | grep -v node_modules | grep -v '^\./docs/'
echo "=== star-db ==="
grep -rn 'star-db' --include='*.ts' --include='*.md' --include='*.json' . 2>/dev/null \
  | grep -v node_modules | grep -v '^\./docs/'
```

Expected:

- `db-analysis` 的命中**逐条**落在 spec §7.1.1「不改」清单内（历史陈述 / 指上游同名文件）
- `star-db` **零命中**（这个旧名从未进过仓库，只存在于设计文档里）

任何一条不在清单内的命中，都要么改掉，要么回去更新 spec 的判定表并说明理由。

- [ ] **Step 2: 三层验证网**

```bash
npm run typecheck && node scripts/purple-star.ts selftest && npm test
```

Expected: 0 错误 / 49-49 / 300 条全绿。

- [ ] **Step 3: 最终基线 diff（全部 16 份）**

```bash
BASE=/tmp/ziwei-split-baseline
fail=0
for h in 00 03 05 09 11; do for g in male female; do
  node scripts/purple-star.ts analyze --date 1990-05-15 --time "$h:30" --city 北京 --gender "$g" \
    | diff -q "$BASE/analyze-$h-$g.txt" - >/dev/null || { echo "❌ analyze-$h-$g"; fail=1; }
done; done
for t in overview personality; do
  node scripts/purple-star.ts topic --date 1990-05-15 --time 09:30 --city 北京 --gender male --topic "$t" \
    | diff -q "$BASE/topic-$t.txt" - >/dev/null || { echo "❌ topic-$t"; fail=1; }
done
node scripts/purple-star.ts synastry --a-date 1990-05-15 --a-time 09:30 --a-gender male --a-city 北京 \
  --b-date 1993-08-22 --b-time 14:00 --b-gender female --b-city 上海 \
  | diff -q "$BASE/synastry.txt" - >/dev/null || { echo "❌ synastry"; fail=1; }
node scripts/purple-star.ts analyze --date 1990-05-15 --time 09:30 --city 北京 --gender male --eot \
  | diff -q "$BASE/analyze-eot.txt" - >/dev/null || { echo "❌ analyze-eot"; fail=1; }
for c in 石家庄 石家庄市 石家庄地区; do
  node scripts/purple-star.ts analyze --date 1990-05-15 --time 09:30 --city "$c" --gender male \
    | diff -q "$BASE/city-$c.txt" - >/dev/null || { echo "❌ city-$c"; fail=1; }
done
[ "$fail" = 0 ] && echo "✅ 16 份输出全部与基线逐字节一致" || echo "❌ 有差异"
```

Expected: `✅ 16 份输出全部与基线逐字节一致`。

- [ ] **Step 4: 核对最终文件规模**

```bash
wc -l scripts/ziwei/analysis.ts scripts/ziwei/analysis-meta.ts scripts/ziwei/analysis-content.ts \
      scripts/cli/birth-info.ts scripts/cli/birth-info-defs.ts
```

Expected: 三个 ziwei 文件合计约 2400 行（≈ 拆分前的 2407），两个 cli 文件合计约 550 行（≈ 拆分前的 532）。

⚠️ **这是唯一一次核对行数**——结果**不写进任何活文档**（见 Global Constraints）。

- [ ] **Step 5: 确认没有遗留临时文件**

```bash
git status --short
git log --oneline -6
```

Expected: 工作区干净；6 条新提交（Task 2 / 5 / 6 / 7 各一条，Task 3–4 并入 Task 5）。

⚠️ 不要用 `git status --porcelain && echo 干净` 这种写法——那个 `&&` 恒真，会把未报告的删除说成干净。要看 `git status --short` 的**输出本身**。

- [ ] **Step 6: 交付**

无提交（本 task 只读）。向用户报告：三层验证网结果、16 份基线 diff 结果、公开面比对结果，以及 `db-analysis` 的残留清单（说明每一处的性质）。
