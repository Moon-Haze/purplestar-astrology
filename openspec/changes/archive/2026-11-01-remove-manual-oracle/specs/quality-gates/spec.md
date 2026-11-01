# Spec Delta

## MODIFIED Requirements

### Requirement: 引文守卫

`test/citations.test.ts` SHALL 扫描**仓库 `.ts` 全树**（流派分派组之外另有仓库级组，
与 `.md` 侧的全仓扫描对称），比对 `corpus/data/annotations.ts` 的引文核对表，
拦截冒充倪师原话的文案。比对基准是权威语料，不是文案之间的相互一致性。
扫描面 SHALL 覆盖带引文代码的真实分布（含 `tools/` 与 `test/`），不因「属某流派声明的根」
而留盲区；`node_modules` / 点目录由收集器排除。

（断语手册库已随 remove-manual-oracle 下线：库抽取扫描组与建库期校验随之移除，
比对核心 `corpus/citation-core.ts` 保留供 `.ts` / `.md` 两侧扫描共用。）

#### Scenario: 冒充原话

- **WHEN** 文案出现「倪师说 + 引号句」但核对表无此项
- **THEN** 守卫失败

#### Scenario: 声明根之外的引文

- **WHEN** `tools/` 或 `test/` 下的 `.ts` 文件出现核对表外的「倪师 / 倪海厦 + 引号句」形态
- **THEN** 仓库级扫描组失败——不因该目录不在任何流派的 `scanRoot` 内而静默放行

#### Scenario: 库内断语行受守卫

- **WHEN** 断语手册库删除后运行引文守卫
- **THEN** 扫描组为 `.ts` 全树 + `.md` 全仓两组（库抽取组不存在），守卫覆盖面回退为
  纯文本面且不因库下线出现空转（`checked` 非空）

### Requirement: 生成物漂移探针

`docs/manual/`（`combo-frequency.md` / `geju-audit.md`——主星 × 辅煞同宫频率表与格局
名目对拍，格局完备性基线）是生成物（由 `tools/db/export-manual.ts` 从 `db/dataset` 与
内核表导出），其与当前内核表 / 导出工具的一致性 SHALL 由漂移探针守住，不得只依赖人工
重导：`export-manual --check` SHALL 在内存中重导并与已提交产物逐字对拍，存在差异时以
非零退出并报出漂移产物清单与差异样例。探针 SHALL 挂载为独立命令（`npm run manual:check`）
并纳入 review 闸门面，SHALL NOT 进入 `npm test` 日常回归（重导对拍耗时，日常回归时长
不受其拖累）。本机缺 `db/dataset` 或 DuckDB 依赖时 SHALL 显式跳过并标注原因
（跳过必须可见），不得静默绿。

#### Scenario: 内核表改了、生成物未重导

- **WHEN** 内核数据表或导出工具改动后，`docs/manual/` 生成物未重导
- **THEN** `npm run manual:check` 非零退出，报出漂移产物清单与差异样例

#### Scenario: 环境缺失时可见跳过

- **WHEN** 本机无 `db/dataset` 或 DuckDB 依赖不可用
- **THEN** 探针输出显式的跳过标注与原因，不以全绿掩盖未检查

#### Scenario: 不进日常回归

- **WHEN** 运行 `npm test`
- **THEN** 不触发重导对拍（探针只在独立命令与 review 面执行），日常回归时长不受影响

#### Scenario: 生成物与内核一致

- **WHEN** 生成物刚按当前内核表与导出工具重导提交
- **THEN** `npm run manual:check` 零退出，输出一行确认（无差异）

#### Scenario: 库漂移以哈希报出

- **WHEN** 盘上残留 `scripts/corpus/data/manual/oracle.db` 或 `docs/manual/topics/`
  （下线产物未清理）
- **THEN** 探针报盘上孤儿（重导不再生成，应删除），非零退出
