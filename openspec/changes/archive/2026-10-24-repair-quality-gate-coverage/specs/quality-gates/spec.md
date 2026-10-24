# Spec Delta

## MODIFIED Requirements

### Requirement: 跳过必须可见

跳过断言 SHALL 只走 `kit.skipUnlessRepo`，判据取「包根有没有 `AGENTS.md`」
（分发件只含四项，仓库级文档一律不带——`AGENTS.md` 与 README / test/ 同进退，
是「我在不在仓库里」的现存探针）。跳过 SHALL 记 pass 但 `skipped: true`，
报告渲染时**前置 `⏭`**。

**不得给不需要的断言加跳过**：若断言读的文件都在 `scripts/` 或 `references/` 内，
它会被打包带上，跳过只是白白丢覆盖。

**仓库态 SHALL 零跳过**：判据锚点必须是现存文件——锚点失效（探针指向已删除文件）
会使守卫在仓库态恒真降级，比没有守卫更坏；仓库级回归 SHALL 有断言钉住
「selftest 报告不出现 ⏭」，锚点再失效时当场变红。

#### Scenario: 恒真守卫

- **WHEN** 断言被跳过
- **THEN** 报告上看得见 `⏭`，不与「跑过了」不可区分

#### Scenario: 多余的跳过

- **WHEN** 给一条只读 `scripts/` 内文件的断言加跳过
- **THEN** 视为白白丢覆盖，应移除

#### Scenario: 仓库态零跳过

- **WHEN** 在仓库形态（非分发包）跑 selftest
- **THEN** 报告全文不出现 `⏭`；判据锚点被删或改名时，钉住此事实的断言变红，而非静默恒真

### Requirement: 引文守卫

`test/citations.test.ts` SHALL 扫描**仓库 `.ts` 全树**（流派分派组之外另有仓库级组，
与 `.md` 侧的全仓扫描对称），比对 `corpus/data/annotations.ts` 的引文核对表，
拦截冒充倪师原话的文案。比对基准是权威语料，不是文案之间的相互一致性。
扫描面 SHALL 覆盖带引文代码的真实分布（含 `tools/` 与 `test/`），不因「属某流派声明的根」
而留盲区；`node_modules` / 点目录由收集器排除。

#### Scenario: 冒充原话

- **WHEN** 文案出现「倪师说 + 引号句」但核对表无此项
- **THEN** 守卫失败

#### Scenario: 声明根之外的引文

- **WHEN** `tools/` 或 `test/` 下的 `.ts` 文件出现核对表外的「倪师 / 倪海厦 + 引号句」形态
- **THEN** 仓库级扫描组失败——不因该目录不在任何流派的 `scanRoot` 内而静默放行
