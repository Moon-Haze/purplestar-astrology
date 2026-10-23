# Proposal

## Why

CLI 的现有文档分两层，都不面向「直接敲命令的人」：`references/` 是 AI 助手按需加载的细则
（行文视角是「助手怎么排盘与解读」），根 `README.md` 只有快速开始与命令速览。clone 仓库的
人想要一份以人为主体的使用手册——怎么装、怎么跑、输出每个字段什么意思、出错了怎么办——
今天无处可读。同时 `docs/README.md` 把整个 `docs/` 声明为「给仓库协作者看的」，与「用户
手册住 `docs/`」直接冲突，需拆除。

## What Changes

- 新增 `docs/user-guide/`，四篇人话手册：
  - `README.md`：入口——给谁看、能做什么、三分钟跑通第一张盘
  - `getting-started.md`：安装（Node ≥ 22.18 / `npm install`）→ 第一张盘 → CLI 输出逐段认读
  - `commands.md`：`astrology` / `synastry` / `knowledge` 三命令详解 + 任务食谱
    （导 JSON / 合盘 / 检索 / `--config` 输入）
  - `faq.md`：排障（Node 版本、参数报错与最近邻建议、城市名找不到）+ 已知口径白话
    （晚子时 / 真太阳时 / 三合派边界）
- `docs/README.md`：拆除「本目录是给仓库协作者看的」声明；目录表加 `user-guide/` 行；
  声明其为**活文档**（改 CLI 输出格式时同步 `getting-started` 的认读段）
- 根 `README.md`：仓库地图中 `docs/` 一行从「开发者文档」改口；「快速开始」处加一条
  指向手册的链接

**明确不做**：

- **不进 zip**：分发件仍只含 `SKILL.md` / `package.json` / `references/` / `scripts/`
  四项（ADR-001 不动）
- **不教解读**：手册只到「怎么用脚本 + 输出字段什么意思」为止；斗数解读契约指向
  `references/output-contract.md`，不复制、不重写
- **不复制参数全表**：参数面一律链接 `references/options.md` 与 CLI 自带 `help`，
  单一真相源不新增副本
- **不动内核与 CLI**：纯内容扩展，零 `.ts` 改动，不触发内核回归；`typecheck` /
  `selftest` / `npm test` 均无新增面

## Capabilities

### New Capabilities

无。纯文档变更（docs-only），在 `.openspec.yaml` 置 `skip_specs: true`。

### Modified Capabilities

无。不触及任何 spec 的需求面：分发形态（ADR-001）、引文守卫、参数面单点声明均不变。

## Impact

- **新增**：`docs/user-guide/`（4 个 md）
- **修改**：`docs/README.md`（声明与目录表）、`README.md`（仓库地图 + 快速开始链接）
- **不改**：`scripts/`、`references/`、`SKILL.md`、`package.json`、`test/`、zip 分发面
- **内容正确性**：手册提到的命令与参数须与 CLI 实际行为一致——CLI 侧由现有 `selftest`
  的参数面契约兜底，手册侧靠人读；`faq.md` 引用排障内容时链接 `references/troubleshooting.md`
- **引文纪律**：`npm test` 引文守卫的扫描面覆盖 `docs/` 下手写 `.md`——本手册按「只用
  脚本」定位不写古籍 / 倪师引文；若示例确需引用，只可引 `corpus/data/` 已登记内容
- **计数纪律**：手册不写死断言数 / 测试项数等计数，能自报的自报、能派生的派生
