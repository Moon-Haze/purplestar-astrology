# Proposal

## Why

`openspec/config.yaml` 的 `rules.specs` 要求「每条 requirement 的 scenario 必须可验证，能落到
断言 / 逐字节 diff / 计数 / 反向注入四形态之一」，但 `code-style` spec 的过程性纪律场景
（「注释少而精」的冗余/保留属编辑判断、「humanizer-zh 润色」属流程要求）天然落不进任何
机器形态——工作流的规格质量规则与它自己管住的产品 spec 自相矛盾（2026-11-24 规范面体检
发现 2）。规则若不改，这两条 requirement 永远是「违规存量」；规则若硬执行（删场景或伪造
机器判据），过程纪律就没有落脚处。

## What Changes

- **config.yaml `rules.specs` 首条改双通道**：机器判据四形态（断言 / 逐字节 diff / 计数 /
  反向注入）**优先**；机器不可判定的**过程性纪律**（编辑取舍、行文润色等），其场景 SHALL
  写明判定途径（评审对照 / 既有守卫 / 登记面），不得留成不可判定的空场景。
- **code-style spec「注释少而精（why 优先）」requirement 正文补一句判定途径**：冗余与否属
  编辑判断，不由机器判据判定，由评审对照把关。（「humanizer-zh 润色」的场景已自带
  「评审对照可验」标记，无须改动。）
- 纯规范措辞与工作流配置修订：**零代码变更**，不触碰任何 `.ts`。

### 不做什么

- 不删任何既有 scenario、不为凑机器判据伪造场景（如把「评审对照可验」包装成假断言）。
- 不改四形态本身的定义，不引入第三通道。
- 不动 `config.yaml` 的 `context` 指针纪律与其他 rules / operations 条目。

### 被否决的备选方案

- **给过程性场景伪造机器判据**（如「数一下注释里是否含模板措辞词表」）：词表法把编辑判断
  降格为字面匹配，漏判误判双输，且制造维护负担——否决。
- **删掉过程性场景让 spec 全部机器可验**：过程纪律（润色、编辑取舍）是规范的真实约束面，
  删场景等于删纪律——否决。
- **只改 spec 不改 config 规则**：矛盾根源在规则的单通道措辞，不动它则下一次写 spec 还会
  撞同一堵墙——否决。

### 验证义务申报（三档制）

规范措辞 + 工作流配置修订，**零代码变更**：不重跑内核基准回归三件套的内核部分；执行
`openspec validate --all --strict`（规范面）+ `npm test` 一次（引文守卫层 7 扫 `.md` 全树，
确认 spec 措辞改动不触引文纪律）+ selftest（确认工作区自洽）。度量器
`npm run code-style:ratio` 不受影响（无 `.ts` 改动）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `code-style`: 「注释少而精（why 优先）」requirement 正文补判定途径声明（场景不变），
  使其符合 config.yaml specs 规则修订后的「过程纪律判定途径」通道。

## Impact

- **`openspec/config.yaml`**：`rules.specs` 首条措辞（唯一配置面改动）。
- **`openspec/specs/code-style/spec.md`**：「注释少而精（why 优先）」requirement 正文一句
  （经本变更 delta 折回）。
- **无代码面影响**：不触碰 `.ts`、CLI、内核；不影响 `npm run code-style:ratio` /
  `code-style:check` 的任何行为。
