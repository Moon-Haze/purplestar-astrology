# Spec Delta

## MODIFIED Requirements

### Requirement: 生成物漂移探针

`docs/manual/`（md 归档）与 `scripts/corpus/data/manual/oracle.db`（断语手册库）是生成物
（由 `tools/db/export-manual.ts` 从 `db/dataset` 与内核表导出），其与当前内核表 / 导出工具的
一致性 SHALL 由漂移探针守住，不得只依赖人工重导：`export-manual --check` SHALL 在内存中
重导并与已提交产物对拍——md 产物逐字对拍，断语手册库按 sha256 对拍（库字节可复现是
对拍前提）；存在差异时以非零退出并报出漂移产物清单与差异样例。探针 SHALL 挂载为独立命令
（`npm run manual:check`）并纳入 review 闸门面，SHALL NOT 进入 `npm test` 日常回归
（重导对拍耗时，日常回归时长不受其拖累）。本机缺 `db/dataset` 或 DuckDB 依赖时 SHALL
显式跳过并标注原因（跳过必须可见），不得静默绿。

#### Scenario: 内核表改了、生成物未重导

- **WHEN** 内核数据表或导出工具改动后，`docs/manual/` 或 `oracle.db` 未重导
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

- **WHEN** 已提交 `oracle.db` 与内存重建库的 sha256 不一致
- **THEN** 探针非零退出并指认 `oracle.db` 漂移，无需逐字节 diff 二进制

### Requirement: 引文守卫

`test/citations.test.ts` SHALL 扫描**仓库 `.ts` 全树**（流派分派组之外另有仓库级组，
与 `.md` 侧的全仓扫描对称），比对 `corpus/data/annotations.ts` 的引文核对表，
拦截冒充倪师原话的文案。比对基准是权威语料，不是文案之间的相互一致性。
扫描面 SHALL 覆盖带引文代码的真实分布（含 `tools/` 与 `test/`），不因「属某流派声明的根」
而留盲区；`node_modules` / 点目录由收集器排除。

断语手册库（二进制，纯文本扫描读不到）的行文本 SHALL 同样纳入扫描：守卫 SHALL 从
`oracle.db` 抽取全部断语行文本执行同一比对；建库管线 SHALL 对将入库的行文本执行同一
校验——黑名单中的未核实引文（核对表 suspect / fabricated 条目的引文核心）以「倪师 +
引号句」形态出现时 SHALL NOT 入库。台账漏登记在建库期与测试期都会被拦下。

#### Scenario: 冒充原话

- **WHEN** 文案出现「倪师说 + 引号句」但核对表无此项
- **THEN** 守卫失败

#### Scenario: 声明根之外的引文

- **WHEN** `tools/` 或 `test/` 下的 `.ts` 文件出现核对表外的「倪师 / 倪海厦 + 引号句」形态
- **THEN** 仓库级扫描组失败——不因该目录不在任何流派的 `scanRoot` 内而静默放行

#### Scenario: 库内断语行受守卫

- **WHEN** 断语手册库中存在核对表黑名单引文仍冒充倪师原话的断语行
- **THEN** 从库抽取文本的扫描组失败；且该行在建库期即被校验拦截，本不应能入库
