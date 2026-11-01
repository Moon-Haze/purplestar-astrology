# Spec Delta

## MODIFIED Requirements

### Requirement: 生成物漂移探针

`docs/manual/`（md 归档）与 `scripts/corpus/data/manual/oracle.db`（断语手册库）是生成物，
由 `tools/db/export-manual.ts` 从**内核结构化直出产物**（`generate-shards` 链产出的结构化
条目，替代外部数据源 tar 的渲染文本）与内核表导出，其与当前内核表 / 导出工具的一致性 SHALL
由漂移探针守住，不得只依赖人工重导：`export-manual --check` SHALL 在内存中重导并与已提交
产物对拍——md 产物逐字对拍，断语手册库按 sha256 对拍（库字节可复现是对拍前提）；存在差异时
以非零退出并报出漂移产物清单与差异样例。探针 SHALL 挂载为独立命令（`npm run manual:check`）
并纳入 review 闸门面，SHALL NOT 进入 `npm test` 日常回归（重导对拍耗时，日常回归时长不受其
拖累）。本机缺直出产物或 DuckDB 依赖时 SHALL 显式跳过并标注原因（跳过必须可见），不得静默绿。

#### Scenario: 内核表改了、生成物未重导

- **WHEN** 内核数据表或导出工具改动后，`docs/manual/` 或 `oracle.db` 未重导
- **THEN** `npm run manual:check` 非零退出，报出漂移产物清单与差异样例

#### Scenario: 环境缺失时可见跳过

- **WHEN** 本机无直出产物或 DuckDB 依赖不可用
- **THEN** 探针输出显式的跳过标注与原因，不以全绿掩盖未检查

#### Scenario: 不进日常回归

- **WHEN** 运行 `npm test`
- **THEN** 不触发重导对拍（探针只在独立命令与 review 面执行），日常回归时长不受影响

#### Scenario: 生成物与内核一致

- **WHEN** 生成物刚按当前内核表与导出工具重导提交
- **THEN** `npm run manual:check` 零退出，输出一行确认（无差异）

#### Scenario: 库漂移以哈希报出

- **WHEN** 已提交 `oracle.db` 与内存重建库的 sha256 不一致
- **THEN** 探针非零退出并指认 `oracle.db` 漂移，无需逐字节 diff 二进制
