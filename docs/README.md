# docs/ —— 仓库级文档

**整个 `docs/` 不进分发件**（分发件只含 `SKILL.md` / `package.json` / `references/` / `scripts/` 四项），
本目录是给仓库协作者看的。

## 目录

| 路径 | 内容 | 产生方式 |
| --- | --- | --- |
| `勘误.md` | 天纪语料三处勘误注记的汇总（语料内逐字注记为准） | 手写 |
| `cli-samples.md` | 全部 CLI 样例的实跑输出文档 | `npx tsx tools/cli-samples.ts --out docs/cli-samples.md` 再生 |
| `manual/` | 断语手册导出产物（topics/ + 组合频率 + 格局对拍） | `tools/db/export-manual.ts` 导出 |
| `plans/` | 设计/实施计划 | 手写 |
| `reviews/` | 评审与审计报告（架构 / 结构 / 代码评审 / skill 审计） | 手写 |
| `superpowers/` | 2026-10-09 一批修复的 plans/specs 历史归档 | 手写 |

文件名里的日期是报告的时点标识（内容快照，不随实现演进追改）；
活文档（`cli-samples.md` / `manual/`）由工具再生，勿手改。
