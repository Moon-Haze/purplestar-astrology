# Tasks

## 1. 规则与 spec 措辞（零代码）

- [x] 1.1 `openspec/config.yaml` 的 `rules.specs` 首条改双通道措辞：机器判据四形态优先，
      过程性纪律 SHALL 写明判定途径（评审对照 / 既有守卫 / 登记面）。完成判据：
      `npx openspec validate --all --strict` 全过零警告（config 不入校验面，以 spec 校验
      全绿为伴行证据）；`git diff openspec/config.yaml` 仅该一条变化。
- [x] 1.2 折回 code-style spec delta：「注释少而精（why 优先）」requirement 正文按
      `specs/code-style/spec.md` delta 落到 `openspec/specs/code-style/spec.md`（正文补
      判定途径句，三个场景逐字不变）。完成判据：`openspec validate --all --strict`
      全过；`git diff openspec/specs/code-style/spec.md` 仅 requirement 正文一句变化，
      场景区零 diff。

## 2. 验收

- [x] 2.1 规范面 + 守卫复测：`npx openspec validate --all --strict` 全过零警告；
      `npm test` 全绿（引文守卫层 7 扫 `.md` 全树，确认 spec 措辞不触引文纪律）；
      `node scripts/purple-star.ts selftest` 全绿。完成判据：三者 exit 0。
- [x] 2.2 零代码变更确认：`git status` 无任何 `.ts` 改动；`npm run code-style:ratio` 输出
      与落账基线一致（160 文件 · 12 存量 · 0 回归）。完成判据：两命令输出相符。
