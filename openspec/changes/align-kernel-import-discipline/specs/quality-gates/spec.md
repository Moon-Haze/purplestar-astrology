## ADDED Requirements

### Requirement: 内核相对路径 import 纪律

排盘内核文件（`scripts/` 根散件与 `patterns/`、`data/` 子树）SHALL 只用相对路径 import
内部模块，SHALL NOT 使用 `@/` 别名：`@/` 运行期解析到「正在跑的 CLI 的内核根」，交叉根
加载（`ZIWEI_ROOT` / 测试 loader）时内核会拿到别的根下的数据表；同根部署下两种写法解析
到同一文件，纪律守的是内核根自洽。纪律由 lint 面机械执行（`no-restricted-imports`），
SHALL NOT 依赖人工对拍。引导层的 `load<>("@/…")` 动态字面量与 `cli/` 的静态别名不在
本条辖域。

#### Scenario: 内核文件出现 @/ import

- **WHEN** 任一内核文件新增或遗留 `@/` 静态 import
- **THEN** `npm run lint` 报错并点名文件与行（反向注入：内核文件临时写
  `@/data/ganzhi` → lint 红；改为相对路径后恢复全绿）

#### Scenario: 引导层与 cli 不受影响

- **WHEN** 引导层以 `load<>("@/…")` 动态加载模块，或 `cli/` / 插件层使用静态 `@/` 别名
- **THEN** lint 照常全绿——本条只辖内核文件面，别名机制的合法消费者不受约束
