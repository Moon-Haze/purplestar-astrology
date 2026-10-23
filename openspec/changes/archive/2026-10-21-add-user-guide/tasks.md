# Tasks

## 1. 手册四篇（docs/user-guide/）

- [x] 1.1 写 `docs/user-guide/README.md`：入口页——给谁看（clone 仓库、直接敲 CLI 的人）、
  能做什么（三命令各一段话）、三分钟跑通第一张盘的指引（链到 `getting-started.md`）。
  验证：按页面指引从零跑通 `astrology` 默认概览；页内所有相对链接可达。
- [x] 1.2 写 `docs/user-guide/getting-started.md`：安装（Node ≥ 22.18、`npm install`、
  依赖锁定口径）→ 第一张盘（位置参数快捷形态 + 完整参数形态各一例）→ CLI 输出逐段认读
  （基本信息面板每行、运限速览、专题深入提示）。验证：实跑 `astrology` 默认概览，与文中
  认读逐字段比对一致；Node 版本口径与根 `README.md` 一致。
- [x] 1.3 写 `docs/user-guide/commands.md`：`astrology` / `synastry` / `knowledge` 三命令
  人话详解 + 任务食谱（`--json` 导盘喂合盘、合盘、知识检索、`--config` 输入）；参数全表
  只链接 `references/options.md` 与 CLI `help`，不复制。验证：每个示例命令实跑退出码 0；
  文中提到的参数名逐一比对 `cli/args/table.ts` 的声明存在。
- [x] 1.4 写 `docs/user-guide/faq.md`：排障（Node 版本不达标、未知参数报错与最近邻建议、
  城市名找不到的省名回退、缓存与 `--no-cache`）+ 已知口径白话（晚子时、真太阳时、虚岁、
  三合派边界）。验证：每条排障步骤实际复现并解决；口径陈述与 `SKILL.md` 无矛盾；全文
  不出现古籍/倪师引文（确需引用时只引 `corpus/data/` 已登记内容）。

## 2. 文档联动

- [x] 2.1 改 `docs/README.md`：拆除「给仓库协作者看的」表述（保留「不进分发件」的事实
  陈述）；目录表加 `user-guide/` 行；在活文档节声明 `user-guide/` 为活文档（改 CLI 命令 /
  输出格式时同步 `getting-started.md` 的认读段）。验证：通读无「协作者专属」残留；目录表
  各行与磁盘实际目录一一对应。
- [x] 2.2 改根 `README.md`：仓库地图 `docs/` 行从「开发者文档」改口为含用户手册；在
  「快速开始 → 直接用 CLI」处加一条指向 `docs/user-guide/` 的链接。验证：链接相对路径
  可达；改口后与 `docs/README.md`、`SKILL.md` 无口径矛盾。

## 3. 收尾核验

- [x] 3.1 一致性抽查：`node scripts/purple-star.ts help` 与三命令各自的 `--help` 输出，
  同手册提到的命令/参数逐一比对。验证：无「手册写有而 CLI 没有」的参数；参数全表在
  手册中为链接而非复制。
- [x] 3.2 引文守卫：`npm test` 全绿。验证：引文守卫对 `docs/user-guide/` 新增手写 md
  的扫描段通过，新增文档不触发任何引文断言。
- [x] 3.3 分发面不变：确认 zip 条目未变。验证：`npm run pack` 产物条目仍为
  `SKILL.md` / `package.json` / `references/` / `scripts/` 四项，`docs/` 不入包。
