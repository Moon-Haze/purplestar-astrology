# Skill 资产体检报告 · purplestar-astrology

- 体检日期：2026-10-13
- 体检器：`audit.py` v1.4.1
- 体检范围：仓库全树（211 个 git 跟踪文件）+ `SKILL.md` 全文 + `references/` + `CLAUDE.md`
- 真实执行：`audit.py --profile full` → FAIL（BLOCKER 6 / MAJOR 1 / MINOR 3，等级 F）；`node scripts/purple-star.ts selftest` → **151/151 通过，退出码 0**

---

## ✅ 执行结果

| 对象 | 改前 | 改后 |
| --- | --- | --- |
| 仓库形态 | 等级 **F**，0 分，BLOCKER 6 | 等级 **B**，80 分，BLOCKER 1（仅 `.history/` 本地缓存） |

改后门禁全绿（逐条单独跑，未用 `&&` 串联）：

```
typecheck 0 · lint 0（0 error，9 存量 warning）· selftest 151/151 · npm test 588/588
分发形态（拷 4 项）selftest 151/151，EXIT 0，其中 1 条标 ⏭ 跳过
```

**未按用户指示处理**：`package-lock.json`（用户答「不管」，README:50 / CLAUDE.md:180
的旧表述原样保留，该落差仍在）。

### ⚠️ 报告第二节的分发方案建议已作废

原 §2 建议「方案 B：加 pack 脚本拍平到两级目录」，**已撤回**。该建议错在把
**平台上架的两级目录约束**套到了**本地拷贝分发**上——两者无关。

实测（`cp -r` 四项到干净目录后真跑）：

```
selftest 151/151 · EXIT 0 · astrology / knowledge 等命令全部正常
```

`scripts/` 的多层子目录（`cli/` `corpus/data/` `analysis/views/` …）**原样拷贝即可**，
因为内核定位走 `boot-hooks` 的 `pickRoot`（脚本自身所在目录），**与目录层级无关**。
拍平收益为零、代价是重写 371 处 import 与动态 `load()` 字面量 —— 纯风险。

---

## 〇、先说结论

**这个 skill 的内核质量在同类里属于上游，包元信息质量接近零。**

它做到了一件绝大多数 skill 做不到的事——**把命理逻辑从模型的自由发挥区彻底赶了出去**：排盘由 `iztro` + 6万行确定性内核产出，模型只负责解读；151 项自检 + 七层基准回归 + 引文守卫 + 体系口径断言，把「不能编造」这件事钉在了代码层而不是提示词层。

但作为一个**可分发的 skill 包**看，它缺的不是能力，是外壳：`frontmatter` 只有两个字段，**没有版本、没有作者、没有中英简介、没有执行权限声明**——其中「没有 `allowed-tools`」这一条最致命：本 skill 的全部价值在 `scripts/` 里，宿主不放行执行权限 = 脚本变死代码。

还有一个结构性问题必须提前决策：**当前形态是「开发者仓库」，不是「可分发 skill 包」**。这两者在目录深度上不可兼得，详见 §2。

---

## 一、包元信息（上传闸门 BLOCKER ×6 + MAJOR ×1）

`SKILL.md` 的 frontmatter 全文只有两行：`name` + `description`。

| 缺失项 | 级别 | 为什么是问题 |
| --- | --- | --- |
| `version` | **BLOCKER** | 无法版本迭代，无法声明兼容性。package.json 里有 `1.0.0`，但 skill 侧看不到 |
| `author` | **BLOCKER ×2** | 既是必填项，且当前为空值（占位/空 = F7 二次判错） |
| `description_zh` | **BLOCKER** | 现有 `description` 是中英混排，无独立中/英简介 |
| `description_en` | **BLOCKER** | 同上；实证口径：27/27 已制作技能包中英简介均填写 |
| `allowed-tools` | **MAJOR (P3)** | **本skill 的能力全在 `scripts/`。不声明执行权限，宿主视其为死代码** |
| `display_name` / `display_name_en` / `category` | MINOR | 展示与类目归属 |

### 建议的 frontmatter 补丁

```yaml
---
name: purplestar-astrology
version: 1.0.0
author: <真实署名，不要用 your-name>
display_name: 紫微斗数排盘解读
display_name_en: Zi Wei Dou Shu chart reading
category: coding
description: "紫微斗数一条龙……（保持现文，去掉重复词）"
description_zh: "紫微斗数排盘解读、合盘与古籍检索……"
description_en: "Zi Wei Dou Shu (Purple Star) chart casting, interpretation, synastry and classical-text retrieval. Deterministic engine, no model guessing."
allowed-tools:
  - scripts/bash
  - scripts/python
---
```

⚠️ 三条格式硬约束：
1. `description*` 值含中文冒号，**必须整体加双引号**（平台用 Go-YAML 解析，未加引号会报 `mapping values are not allowed in this context`）
2. `version` 严格三段数字，不加 `v` 前缀
3. `allowed-tools` 写成**数组**，且**写了就必须填值**（空值等于没写）；实证写法为 `scripts/` 前缀数组，不是逗号分隔串

### 顺带：description 里的重复词

现文「……倪海厦、倪海厦、天纪」中 `倪海厦` **写了两遍**（去重后23 个触发词）。

---

## ~~二、分发形态：开发者仓库 ≠ 可分发 skill 包~~ 【本节结论已作废，保留作返工记录】

> **作废原因**：本节把**平台上架的两级目录约束**套到了**本地拷贝分发**上，两者无关。
> 用户实际只拷 `SKILL.md` `package.json` `references/` `scripts/` 四项，
> 而 `scripts/` 的多层子目录**原样拷贝即可**——内核定位走 `boot-hooks` 的 `pickRoot`
> （脚本自身所在目录），与目录层级无关。实测拷完 `selftest` 151/151、EXIT 0。
>
> 曾按本节实现过 pack 脚本（拍平 + 重写 371 处 import），已**全部回退**。
> 下面的统计与「三条出路」保留，仅作记录，**不要再照它做**。

<details>
<summary>（已作废内容，点击展开）</summary>

**平台仅支持两级目录：`根 / 一级子目录 / 文件`—— 这是「平台上架」的约束，不是「拷贝分发」的。**

按 git 跟踪文件统计：**211 个文件中 164 个层级超限**。

| 超限目录 | 文件数 | 典型 |
| --- | --- | --- |
| `scripts/cli/` | 32 | `scripts/cli/astrology.ts` |
| `scripts/corpus/` | 26 | `scripts/corpus/data/manual/career.ts` |
| `scripts/analysis/` | 17 | `scripts/analysis/views/*.ts` |
| `docs/manual/` | 16 | `docs/manual/topics/overview.md` |
| `tools/db/` | 11 | |
| `scripts/patterns/` | 10 | |
| `test/lib/` `docs/superpowers/` `scripts/data/` … | 余下 | |

### 三条出路（若将来真要上架平台）

| 方案 | 做法 | 代价 | 适合 |
| --- | --- | --- | --- |
| **A. 不上架**（**当前状态，正确**） | 不动目录，只补 frontmatter + `allowed-tools` | 最小 | 拷进本地技能目录自用 |
| **B. 加 pack 脚本** | 保留仓库结构，另拍平出 `dist/` | 中等 | 仅当要上架时 |
| **C. 真按平台约束重构** | 全量拍平到两级 | 大，打穿七层测试的目录假设 | 长期 |

</details>

### 换来的两条真结论（仍然有效）

1. **不要在代码里写死目录层级** —— 要定位包内文件走 `ctx.root`（= `scripts/`），
   不写 `ROOT/../..` 这类上溯。层数一变就静默找错文件。
2. **仓库级文档不在分发件里** —— `CLAUDE.md` / `test/` / `docs/` / `db/` 都不拷，
   依赖它们的断言用 `skipUnlessRepo` 显式跳过（判据：包根有没有 `CLAUDE.md`）。
   现状：仓库 0 跳过 / 分发 **1** 跳过（唯一那条要读 `CLAUDE.md` + `test/README.md`）。

---

## 三、包体积：26 MB 里有 15.5 MB 对使用者零价值

`git ls-files` 总计 **26 MB**，其中：

| 文件 | 体积 | 对skill 使用者的价值 |
| --- | --- | --- |
| `db/dataset/palaces.parquet` | **13 MB** | 零 —— 只被 `tools/db/` 的基准工具读 |
| `db/dataset/samples.parquet` | 808 KB | 零 —— 同上 |
| `test/fixtures/charts.jsonl` | 1.7 MB | 零 —— 只被 `npm test` 读 |
| `docs/`（30 个文件） | 4.3 MB | 零 —— 内部设计/评审文档 |
| `scripts/` + `references/` | ~6 MB | **全部价值在这里** |

⚠️ 附带一个现实风险：README 明写「**把整个仓库拷到技能目录**」。工作区里 `db/ziwei.duckdb` **641 MB**、`.mimosa/` 30 MB、`.codegraph/` 6 MB —— 它们在 `.gitignore` 里所以 `git clone` 不会带，但 **`cp -r` 会**。照 README 抄走一次就是 700 MB。

**修法（一行）**：README 与 CLAUDE.md 的拷贝说明改为「拷贝 `SKILL.md` `references/` `scripts/` `package.json` `LICENSE`」，并把测试基准移出分发范围。

---

## 四、文档一致性（我逐条核实过的真实漂移）

这一节全是我实跑核对的，不是推测。

### 4.1 README 承诺了一个不存在的保障 ★最该修

- `README.md:50`：「依赖 iztro / lunar-typescript 由 **`package-lock.json` 锁定**，保证排盘结果不因环境分叉」
- `CLAUDE.md:180`：「**`package-lock.json` 已提交**以锁定精确版本」

**实际**：`.gitignore:61` 明确忽略 `package-lock.json`；`git ls-files | grep -c package-lock` → **0**。

这不是措辞瑕疵。`iztro` 是排盘引擎，**升级它就会改变排盘结果**（CLAUDE.md 自己承认），而排盘结果是本 skill 唯一的交付物。文档承诺的确定性保障**不存在**——别人 clone 后 `npm install` 装到的可能不是2.6.1。

**二选一**：把 `package-lock.json` 移出 `.gitignore` 并入库（推荐，且它只有 84 KB）；或改文档承认「依赖版本靠package.json 的精确版本号约束，传递依赖不锁」。**不能两边都留着。**

### 4.2 CLAUDE.md 说没有 lint，但有

- `CLAUDE.md:19`：「没有构建、**没有 lint**（`typecheck` 是类型检查，不是 lint）」
- 实际 `package.json` 有 `lint` / `lint:fix` / `format` 三个脚本，根目录有 `eslint.config.mjs`（ESLint v10 flat config）+ `.prettierrc`

**修法**：把这句改成「无构建步骤；`typecheck` 是类型闸门，`lint`/`format` 是代码风格闸门，三者与 `selftest`/`npm test` 互不替代」。

### 4.3 排障文档残留已删除的目录与旧口径

| 位置 | 现状 | 事实 |
| --- | --- | --- |
| `references/troubleshooting.md:42` | 「另外两个 skill 不排盘」 | 2026-09-30 已三合一，`skills/` 目录已删 |
| `references/troubleshooting.md:9` | 「排盘 `ziwei/`、古籍 `corpus/`、合盘 `synastry/` 都在这里」+ `ZIWEI_ROOT=<含 ziwei/ 的目录>` | `ziwei/` 已于 2026-10-12 拆平 |
| `docs/cli-samples.md:36` | 「内核住 `scripts/ziwei\|corpus\|synastry/`」 | 同上 |

`troubleshooting.md` 是**助手遇障时会真的去读的文件**，写错会直接误导排障动作——这条的优先级应该提到 §2 之前。

### 4.4 一个反例：做对了的

`references/troubleshooting.md` 明确写了「本机 `ls` 是 `eza` 别名、不要用 `ls` 查语料目录」，这类**只有作者本人才踩过的坑**被留在了文档里。这是排障文档该有的密度。§4.3 那几条恰恰说明**新增的坑没被同样地补回去**。

---

## 五、合规边界（上架必被驳回，当前全仓为零）

全仓 grep「仅供参考 / 不构成 / 免责 / 就医 / 投资建议 / 迷信」—— **零命中**。

但这个 skill 明确产出以下内容：

- `references/output-contract.md:106` health 主题 →「疾厄宫主星 / 主要风险 / **预防建议**」
- 同文件:105 wealth →「**理财建议**」
- 同文件:158 合盘 →「**星级定档**」
- 同文件:156 →「天作之合 / 次级良配 / 无对应」

**这三条贴着功能红线**：不得输出确定性诊断结论、不得给出具体投资标的建议。疾厄宫解读本质接近健康建议，理财建议接近投资建议，「星级定档」是确定性结论。

**修法**：在 `output-contract.md` 加一节「边界声明」，固定三条：
1. 解读是传统命理体系内的静态论断，**不是医疗 / 法律 / 投资意见**
2. health 主题输出**只做体质与倾向的传统描述**，出现具体症状一律转「建议就医」，不给诊断
3. wealth 主题不给具体标的、不给收益预测
4. 「星级定档」须同句标注「这是模型依传统标准的裁量结论」

⚠️ 这不只是上架要求。它现在是**交付给用户的文本里没有任何边界声明**——这属于内容合规问题，与是否上架无关。

### 另需你核实的一项

`description` 与 `SKILL.md` 正文多处使用「**倪海厦**」作为体系归属标识。上架时技能描述带第三方真实人物名，**需要确认授权口径**。若无法确认，建议改为中性的体系描述（如「三合派传统体系」）——`description` 里保留人名对触发词召回无实质帮助。

---

## 六、无A/B 增益对照记录

全仓 grep「A/B / 对照组 / 裸模型 / 增益」只命中 1 个文件（`docs/superpowers/specs/2026-10-09-review-fixes.md`），且是别的语境。

上架口径要求**H3 · A/B 增益 ≥ 20%**：同题、同模型、同rubric，A 组挂本 `SKILL.md`，B 组无任何 system（模拟用户直接问通用模型）。

**我的预判是增益会远超20%**（排盘确定性、古籍原文、三千行断语、格式契约，裸模型一条都做不到），但**预判不是证据**。若要上架，这项必须真跑并留档。

---

## 七、建议：补一条填好的 golden sample

`SKILL.md` 与 `references/output-contract.md` 给了**模板骨架**（章节、顺序、篇幅、槽位），方向正确——但**全仓没有一条填好的完整解读样例**。

模板的已知副作用是诱导模型产出占位符。一条 **filled golden sample**（一份真实的 800–1500 字解读全文）对齐输出质量，比再增加 100 行规则更有效。

放在 `references/example-reading.md`，由 `SKILL.md` 一句「首次解读前先看一眼样例的粒度」指路即可，不进常驻上下文。

---

## 八、触发词质量：整体良好，两处可改

**做对的**：description 末尾写了**负向边界**——「不要用于八字/四柱/子平（不排八字）、塔罗、占星」。这是防误触发最有效的一手，比堆正面触发词重要，值得保留。

**可改**：

1. 「倪海厦」重复一次（见§1）
2. 建议补几个高召回词：`紫微斗数盘`、`十二宫`、`三方四正`、`财帛宫`、`命盘怎么看`
3. 23 个触发词全部塞在 `description` 正文字段里。按实证口径，触发词应分布在一段自然的能力描述中，而非列表堆叠——当前的写法召回没问题，但与平台对 `description` 的「说清能做什么」预期有偏差

---

## 九、变更清单（执行状态）

已按用户决策落地。「倪海厦」**保留并补来源与免责**；`package-lock` **按用户指示不动**。
分发形态 = **只拷 4 项，`scripts/` 不拍平**（见 §2 的作废说明）。

| # | 优先级 | 改什么 | 状态 |
| --- | --- | --- | --- |
| 1 | P0 | `references/troubleshooting.md` 第 9/42 行：删掉 `ziwei/` 与「另外两个 skill」旧口径 | ✅ 已改 |
| 2 | P0 | `README.md:50` + `CLAUDE.md:180` 依赖锁口径 | ⏸ 按用户指示不管 |
| 3 | P0 | `output-contract.md` 加「边界声明」一节（5 形态对照表 + 3 条硬约束） | ✅ 已改 |
| 4 | P1 | frontmatter 补 5 必填 + 4 建议 + `allowed-tools`；`version` 1.0.0 → **1.1.0** | ✅ 已改 |
| 5 | P1 | ~~新增 `tools/pack.ts` 拍平分发层~~ | ❌ **已回退**（原建议错误，见 §2） |
| 6 | P1 | README 拷贝说明改为「只拷 4 项」，并标注 `db/ziwei.duckdb` 641 MB 的坑 | ✅ 已改 |
| 7 | P1 | `CLAUDE.md:19` 修正 lint 口径 | ✅ 已改 |
| 8 | P2 | 新增 `references/example-reading.md`（数据全部真跑 CLI 取得） | ✅ 已改 |
| 9 | P2 | 「倪海厦」保留 + 补「非官方出品」与引语纪律 | ✅ 已改 |
| 10 | P2 | 触发词去重（`倪海厦` 写两遍）+ 补 6 个高召回词 | ✅ 已改 |
| 11 | — | `synastry` 断言定位包内文件改走 `ctx.root`，不再数目录层级 | ✅ 已改 |
| 12 | — | `selftest-kit` 新增 `skipUnlessRepo`（仓库级文档断言显式跳过）+ **harness 支持 async 断言体** | ✅ 已改（真 bug，见下） |

### #12 是一次真跑才暴露的缺陷（**与 pack 无关，是仓库既有 bug**）

`createHarness` 声明 `ok(name, fn: () => unknown)`，但 `commands.ts` 的断言体是 **async**
（要 await 动态 import 拿命令表）。harness 的 `try/catch` **捕不到 async 体内的抛错**，
症状是「前面全绿 → 最后一行 stack trace → 退出码 1」，看不出是哪条断言坏了。

已修为：

- `ok` 遇 Promise 走 `.then/.catch` 登记（失败转成一条失败断言，不冒泡）
- harness 新增 `settled()`，主 selftest 渲染报告前 `await settled()` ——
  **不等的话那几条会凭空消失**，项数变少却全绿，是最坏的一种假绿。
  synastry / corpus 两个断言组也要在 `return results` 前 `await settled()`。
- 「跳过」记为 pass 但 detail 前置 `⏭`，报告上**看得见「这条没跑」**

验证：改后仓库形态与分发形态**项数都是 151**（证明 async 处理没丢断言），
仓库 0 跳过 / 分发 1 跳过。

---

## 十、不建议动的部分（明确划出来，避免误伤）

这几处是本skill 真正的护城河，任何「优化」都别碰：

- **`selftest` 151 项 + `npm test` 七层基准**：三层守卫（代码逻辑自洽 / 外部基准比对 / 类型自洽）分工清晰，`CLAUDE.md` 自己写了「机器已经查了的人不要重复查」——这条原则很对，继续保持
- **体系口径在代码层钉死**：`Palace.selfMutagen` 等绊线字段**刻意保留**并由断言盯着不被填回。这是「存在不等于该用」的正确工程表达，比写在提示词里可靠一个量级
- **引文守卫 + 知识来源四级分级**（verified / traditional / methodology / suspect）：反编造机制落在断言而非提示词
- **渐进披露三级结构**：`SKILL.md` 只 11.5 KB，`references/` 6 份 688 行，`scripts/` 6 万行一行不进上下文。骨架/细则的切分是干净的，`repo.test.ts` 层 6 还双向断言它不腐化
- **计数类事实一律不写死**：selftest 项数、测试层数都自报或派生

**唯一值得讨论的是**：§五 的边界声明要加在哪一层。我的建议是**只加在 `output-contract.md`**（交付形态层），不要加进 `SKILL.md` 骨架——骨架已经很满了，而边界声明只在真正组织输出文本时才需要，正好属于「按需加载」的细则。

---

## 附：本次走了哪几关

| 关 | 是否执行 | 结论 |
| --- | --- | --- |
| 关 1 · 规范与流程 | **不适用** | 本次是**评估请求**（C 类体检 + 咨询），未要求产出新技能实物，故不走「需求对齐 → 目录分工 → 实现 → 验证集」 |
| 关 2 · 静态闸门 | ✅ **已真跑** | `audit.py --profile upload` → FAIL，退出码 1，BLOCKER 6 / MAJOR 1 / MINOR 3 / 等级 F。另跑 `selftest` 确认内核健康：151/151，退出码 0 |
| 关 3 · 行为层压测 | **不适用（本次）** | 本次只做静态评估，未修改任何行为。但**建议在执行 §5边界声明、§7样例之后走一次**——本 skill 的质量高度依赖「模型判断准不准」（解读质量、边界遵守、模板填充），属关3 的适用区|

另说明：§四 的每一条都经实跑核对（`.gitignore` 内容、`git ls-files` 计数、`package.json` 脚本、`grep` 残留目录名），未凭印象断言。