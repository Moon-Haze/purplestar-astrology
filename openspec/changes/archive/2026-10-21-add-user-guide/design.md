# Design

## Context

现有文档分三层，各有读者：`SKILL.md` + `references/` 是**给 AI 助手**的（骨架 + 按需加载的
细则，行文视角是「助手怎么排盘与解读」），根 `README.md` 是仓库门面（快速开始 + 命令速览），
`docs/` 是仓库级文档目录（模块地图、评审、计划）——`docs/README.md` 此前把整个 `docs/` 声明为
「给仓库协作者看的」。

CLI 的参数面有单一真相源：`scripts/cli/args/table.ts` 的 `OPTION_GROUPS`，help 的参数段由它
派生。分发形态（ADR-001）规定 zip 只含 `SKILL.md` / `package.json` / `references/` /
`scripts/` 四项，`docs/` 天然不入包。

## Goals / Non-Goals

**Goals:**

- 给「clone 仓库、直接敲 CLI」的人一份从安装到读输出到排障的完整手册
- 手册内容全部有事实源：命令与输出实跑复现，不臆造
- 与现有文档体系各就各位：手册补「人的使用视角」，不复制 AI 视角细则
- 拆除 `docs/` 的「协作者专属」定位，让目录定位与实际内容一致

**Non-Goals:**

- 不教斗数解读（解读契约留在 `references/output-contract.md`）
- 不改分发形态、不把手册塞进 zip
- 不动 `SKILL.md` / `references/`（那是 AI 助手的分发面，与本手册受众不同）
- 不改任何 `.ts`：纯内容扩展，不触发内核回归
- 不复制参数全表（真相源在 `table.ts` 与 `references/options.md`）

## Decisions

### D1 手册住 `docs/user-guide/`，不进 zip

受众是 clone 仓库的人，仓库内链接可达即可。备选：(a) 放 `references/` 随包分发——位置与
「AI 按需加载的细则」冲突，且要为它单独改分发纪律；(b) zip 内再放一份精简版——两份必然漂移。
取 (c)：手册只住仓库内，README 指路。

### D2 只管脚本使用，不教解读

手册停在「命令怎么写 / 输出字段什么意思 / 出错怎么办」。解读是模型的活（仓库哲学：排盘由
确定性 CLI 产出，模型只负责解读），解读契约在 `references/output-contract.md`。备选：加一章
「怎么读一张盘」——篇幅翻倍，且与 output-contract 形成两份解读指南、双份维护成本。取前者。

### D3 参数全表只链接不复制

手册里参数以「用途 + 常用组合」出现，穷举清单链到 `references/options.md` 与 CLI `help`。
复制即第二份真相源，必漂移。

### D4 四篇分文件，粒度按「读者在做什么」切

`README.md`（入口与三分钟跑通）/ `getting-started.md`（安装 + 第一张盘 + 输出认读）/
`commands.md`（三命令详解 + 任务食谱）/ `faq.md`（排障 + 口径白话）。
备选：单文件长文——排障时定位困难；与 `references/` 同名一一对应——会诱发读者把 AI 细则当
用户手册。

### D5 只联动两处文档

`docs/README.md`（拆定位声明、加目录行、声明活文档纪律）与根 `README.md`（仓库地图改口 +
快速开始指路）。`SKILL.md` 与 `references/` 一字不动——它们是分发面，改动会牵动 selftest 的
双向一致断言，而本变更与其读者无关。

### D6 不挂防漂移守卫

不在 `test/repo.test.ts` 加「手册提到的命令都存在」的断言：手册措辞自由，硬断言会逼出
「为了过测而写」的文本；且新增断言要同步 `test/README.md` 层表与 `test/lib/run.ts` 的
`LAYERS`，成本高于收益。漂移风险改用文档纪律兜（见 R1）。

## Risks / Trade-offs

- **R1 手册与 CLI 漂移**（CLI 改了参数或输出格式，手册没跟）→ 缓解：`docs/README.md` 把
  `user-guide/` 列为活文档并写明纪律（改 CLI 命令 / 输出格式时同步 `getting-started.md` 的
  认读段）；实施时逐条实跑手册示例命令、校验全部相对链接可达。代价：无机器守卫，靠人守。
- **R2 `docs/` 定位变宽，协作者文档被误当用户文档** → 缓解：目录表逐行标注内容与读者，
  `user-guide/README.md` 首行即声明受众；协作者文档仍在 `code/` `plans/` `reviews/`。
- **R3 与 `references/` 内容重叠** → 缓解：手册只写任务流与读输出，细则一律链接（D2/D3）。
- **R4 zip 用户读不到手册** → 接受：受众定为 clone 仓库的人；若日后要随包分发，需另起
  change 同时改 `tools/pack.ts` 的收集项与 AGENTS.md 的分发纪律（四条分发项是硬约束）。
