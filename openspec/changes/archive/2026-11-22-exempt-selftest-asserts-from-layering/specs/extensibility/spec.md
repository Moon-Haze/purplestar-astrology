## MODIFIED Requirements

### Requirement: 内核与内容严格分层（ADR-003）

排盘内核（`algorithm.ts` / `mutagen.ts` / `patterns/` / `data/` / `wenmo-brightness.ts` /
`types.ts`）与知识内容（`analysis/` / `corpus/` / `synastry/`）SHALL 严格分层。

插件层 SHALL **禁止反向依赖 `cli/`**，SHALL **禁止修改内核模块状态**。
内核只暴露纯函数供插件消费。跨流派共享的底座数据（干支 / 四化 / 亮度）留在 `data/`，
**流派特有**内容归插件。

**唯一豁免边界**：corpus 与 synastry 的 selftest 断言组（`*/selftest-asserts.ts`）是
selftest 宿主的测试件，SHALL 允许引用 `cli/` 下的 kit（静态）与命令表 / 参数面模块
（动态 import 打断静态环）——静态仅 `cli/selftest/kit`，动态仅 `cli/commands` /
`cli/args` / `cli/args/scope`。豁免按文件具名，SHALL NOT 扩散到其他插件文件或其他
cli 模块。豁免边界 SHALL 由扫描守卫钉住：插件树的 cli 引用边集合与白名单逐边比对，
多边、少边或白名单文件消失 SHALL 当场红。

#### Scenario: 加内容不重跑内核回归

- **WHEN** 新增一个知识源或主题断语
- **THEN** 排盘内核回归（`selftest` 排盘段 / `npm test`）不必重跑

#### Scenario: 插件反向依赖

- **WHEN** 豁免白名单之外的插件文件 import 了 `cli/` 下的模块
- **THEN** 视为破坏分层，须改由内核暴露纯函数（层 6 扫描守卫当场红并点名文件与被引模块）

#### Scenario: 断言组豁免边界

- **WHEN** 断言组引用了白名单外的 cli 模块，或非豁免插件文件出现任何 cli 引用边，
  或白名单文件被改名 / 删除
- **THEN** 扫描守卫红并点名差异边——豁免有界、机器盯着，「测试件」名义不构成扩散通道
  （反向注入：在 corpus 任意非豁免文件临时加一条 cli 引用，或从白名单删一条既有边）
