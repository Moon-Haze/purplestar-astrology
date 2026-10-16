# Tasks

## 1. 取材（只读）

- [x] 1.1 实跑 CLI 取示例素材：`node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州`
  截取基本信息面板与运限速览数行；`node scripts/purple-star.ts knowledge --search 机月同梁`
  取首数行。完成判据：选段内**无**「倪师 / 倪海厦 + 引号句」形态（引文守卫红线，
  `test/lib/citation-guard.ts` 扫 `.md`），若某段含引号句则换段，不删改输出原文。

## 2. 重写 README.md

- [x] 2.1 按 design 决策 1 的章节序整文重写 `README.md`。完成判据（逐项核对）：
  - **硬承诺八项全在**：只拷 4 项、不 `cp -r`（含 641 MB 坑）、zip 顶层名与
    frontmatter `name` 一致、Node ≥ 22.18、落位 `npm install` + selftest 自检、
    同源码多次构建 sha256 相同、上游 ziwei-doushu 致谢、天纪语料 CC BY-NC-SA；
  - **下沉六项各有去处**：SKILL.md 骨架/渐进披露论（收敛一句+指路）、不拍平的
    import 警告（一句承诺）、可复现的实现细节（一句承诺）、`⏭` 跳过机制、
    selftest/npm test/typecheck 三件套细节（「给开发者」短节）、数据来源模块地图
    （指路 `docs/code/`）——每项 README 内留指路或一句承诺，全文可 grep 到；
  - **计数零写死**：`grep -nE "[0-9]+/[0-9]+|131|1\.2 ?MB|641" README.md` 除
    641 MB 坑警告与 Node 版本外无会漂移的计数。
- [x] 2.2 接入任务 1.1 的示例素材：输出示例节选放入「输出示例」节，命令速览含
  astrology / synastry / knowledge 三命令最小示例各一条。完成判据：示例与实跑
  输出逐字一致（节选注明截取）。

## 3. 验证

- [x] 3.1 引文守卫：`npm test` 全绿（重点 `citations` 层扫到新 README 不报红）；
  完成判据：全量绿，或至少 `test/citations.test.ts` 对应层绿且无新增登记需求。
- [x] 3.2 风格闸门：`npx prettier --check README.md` 通过（不过则 `--write` 后复查
  内容未被改动语义）。
- [x] 3.3 范围确认：`git status --short` 仅 `README.md` 与本变更目录（`openspec/`）
  有变动，零代码改动——selftest / typecheck 无对象不跑（同 split-truesolar
  先例，该不跑是核对结论）。

## Workflow follow-up

- 归档：`openspec archive rewrite-readme`（skip_specs 变更，无 spec 折回，仅归档）。
- 提交：README 重写与归档一次 commit（等用户指示）。
