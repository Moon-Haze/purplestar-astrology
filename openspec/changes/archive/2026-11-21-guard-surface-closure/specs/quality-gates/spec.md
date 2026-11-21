## MODIFIED Requirements

### Requirement: 注释指针有效性守卫

`scripts/` `test/` `tools/` 下 `.ts` 源码**注释**中出现的 `.md` 引用词元（根级文件名如
`AGENTS.md` / `SKILL.md`，及 `docs/…` / `references/…` 相对路径）SHALL 指向仓库内实际
存在的文件。注释与字符串字面量中出现的 `npm run <name>` SHALL 指向 `package.json`
scripts 里真实存在的命令；字符串字面量中 `references/…​.md` 形态的路径 SHALL 指向仓库
内实际存在的文件；注释中出现的裸 `*.test.ts` 文件名 SHALL 指向 `test/` 下实际存在的
文件。守卫 SHALL 以文本扫描实现、纳入 `npm test` 的 repo 层；命中不存在的指针 SHALL
报出文件与行。守卫只查指针对象**存在性**，SHALL NOT 审查内容的技术正确性。确属误报
的引用 SHALL 在守卫内显式登记白名单并带理由（跳过必须看得见），SHALL NOT 静默豁免。

#### Scenario: 注入断锚即红灯

- **WHEN** 任一被扫描文件的注释出现指向不存在 `.md` 的引用（如临时写入
  「见 docs/code/not-exist.md」）
- **THEN** `ZIWEI_NO_CACHE=1 npm test` repo 层失败，报出文件与行；还原后恢复全绿

#### Scenario: npm run 断针红灯

- **WHEN** 注释或用户可见字符串写入 `npm run <不存在>`（如历史 `build:db` 腐烂）
- **THEN** repo 层失败，报出文件、行与缺失的 script 名；补别名或改指向后恢复全绿

#### Scenario: 字符串路径断针红灯

- **WHEN** 字符串字面量（如运行时提示「已移至 references/x.md」）指向不存在的文件
- **THEN** repo 层失败——指针写在哪种语法里不再决定受不受保护

#### Scenario: 断言覆盖者断针红灯

- **WHEN** 注释承诺某覆盖由某 `xxx.test.ts` 承担而该文件不存在
- **THEN** repo 层失败，报出断针位置

#### Scenario: 存量清零

- **WHEN** 守卫落地并在存量批改完成后运行
- **THEN** 扫描零命中（或命中项全部在带理由的白名单内），npm test 全绿

#### Scenario: 改名防复发

- **WHEN** 未来再次发生仓库级改名（如根级 `.md` 或 docs/ 子目录更名）
- **THEN** 遗留断锚使 npm test repo 层变红，不等人工比对发现

### Requirement: 生成物漂移探针

`docs/manual/`（`combo-frequency.md` / `geju-audit.md`——主星 × 辅煞同宫频率表与格局
名目对拍，格局完备性基线）是生成物（由 `tools/db/export-manual.ts` 从 `db/dataset` 与
内核表导出），其与当前内核表 / 导出工具的一致性 SHALL 由漂移探针守住，不得只依赖人工
重导：`export-manual --check` SHALL 在内存中重导并与已提交产物逐字对拍，存在差异时以
非零退出并报出漂移产物清单与差异样例。探针 SHALL 挂载为独立命令（`npm run manual:check`）
并纳入 review 闸门面，SHALL NOT 进入 `npm test` 日常回归（重导对拍耗时，日常回归时长
不受其拖累）。本机缺 `db/dataset` 或 DuckDB 依赖时 SHALL 显式跳过并标注原因
（跳过必须可见），不得静默绿。

review 闸门的生成物清单（GENERATED）SHALL 由各生成器**自报**的托管面派生：
`export-manual` / `tools/notes/export-notes.ts` / `tools/corpus/import-tianji.ts` 各
export 自己托管的路径；无本地生成器的生成物（如 `data/wenmo-tables.ts`，提取脚本在
上游仓）以带理由的登记常量入册。清单 SHALL NOT 手抄第二份；手写文件（如
`docs/manual/README.md`）SHALL NOT 被当成生成物拦截。

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

#### Scenario: 手写文件不再被误伤

- **WHEN** 手改 `docs/manual/README.md`（自述文件，非生成物）
- **THEN** review 闸门不再按「改了已入库的生成文件」拦截

#### Scenario: 新增托管面即入册

- **WHEN** 某生成器新增托管路径或托管分区
- **THEN** 其自报清单随之演化，review 闸门自动覆盖——「生成器加了托管面、闸门不知道」
  的 miss 类从结构上消失

## ADDED Requirements

### Requirement: 样例表参数覆盖随回归守卫

cli-samples 的样例表（SAMPLES）对参数面（`OPTION_GROUPS`）的覆盖 SHALL 由 `npm test`
的派生断言守住（样例覆盖的参数 ⊇ 声明表全部参数），SHALL NOT 只依赖生成文档时的低频
自检——`main()` 内的覆盖检查 SHALL 保留（双保险同源）。样例表的演示出生串 SHALL 消费
`scripts/cli/selftest/sample.ts` 的单点常量（组件值或 argv 形态派生），SHALL NOT 手抄
同款串（确属其他样例组的生辰除外，须可数）。

#### Scenario: 新增参数忘补样例

- **WHEN** `OPTION_GROUPS` 新增参数而 SAMPLES 未补样例
- **THEN** `npm test` 当场失败，报出缺样例的参数清单；补样例后恢复全绿

#### Scenario: 换样例组只动一处

- **WHEN** 演示出生信息更换（如换生辰）
- **THEN** `sample.ts` 单点一处修改，SAMPLES 经引用自动跟上；漏改的散落字面量由
  存在性对拍暴露
