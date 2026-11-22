# Tasks

## 1 闸门（apply 前，delta 就绪即可验）

- [x] 1.1 两条 delta 描述长度实测 ≤ 500 字符，与 proposal 报数一致（594→485 / 581→460）
- [x] 1.2 MODIFIED 完整性自查：delta 场景块与主 spec 对应 requirement 场景块逐字节一致；
      SHALL 义务逐条对照，只删场景已覆盖的形态枚举
- [x] 1.3 `openspec validate --all` 本 change delta 校验通过

## 2 归档折回（openspec-sync-specs）

- [x] 2.1 两个 MODIFIED 折回主 spec：描述替换、场景逐字保留；判据 `openspec validate --specs`
      全绿且两条警告消失
- [x] 2.2 `openspec validate --all` 全部通过、**零警告**（AGENTS 口径恢复可执行）；
      `npm test` 引文守卫绿（.md 面保险）

## Workflow follow-up

- 提交按仓惯例随归档收口（一个逻辑变更一个 commit）
