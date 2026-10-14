# synastry Specification

## Purpose

对**两张已排好的命盘**做双人合盘，输出配对判断所需的确定性数据与方法论依据。
合盘不排盘——它消费 `astrology --json` 的产物，核心断法是双宫联参。
方法论与评分标准不在命令输出里，按需读 `references/synastry-guide.md`。

## Requirements

### Requirement: 合盘不排盘，消费 JSON 产物

系统 SHALL 由 `synastry --charts <a.json>,<b.json>` 消费两份 `astrology --json` 产物，
**甲先乙后**，不自行排盘。消费方契约 SHALL 只声明它真实读到的字段子集。

#### Scenario: 两份输入

- **WHEN** 用户传入两份 `astrology --json` 产物
- **THEN** 按给定顺序解读，甲为第一位

#### Scenario: 份数不符

- **WHEN** `--charts` 裸写未给值，或只给单路径
- **THEN** 由份数护栏拦下并报错

#### Scenario: 未知旗标

- **WHEN** 用户传入已退役的 `a-` / `b-` 前缀旗标（如 `--a-chart`）
- **THEN** 按未知参数报错，不静默接受

#### Scenario: 旗标拼错

- **WHEN** 用户传入拼错的旗标
- **THEN** 报错并指向最接近的合法参数名

### Requirement: 输出断语数据而非结论

系统 SHALL 输出排盘与断语：双宫联参、夫妻宫断语（十四主星各自一档）、四化入夫妻宫、
桃花孤克星。**不含**方法论与星级——那些在 `references/synastry-guide.md`，
由解读方按需读取后组织成文。

#### Scenario: 命令输出边界

- **WHEN** 用户运行 `synastry`
- **THEN** 输出限于断语数据，不含评分标准全文

### Requirement: 星级为裁量结论

系统 SHALL 由解读方依 `synastry-guide.md` 的五档标准给出星级，并**自标为裁量结论**——
星级不是命令输出的客观分。合盘形态结尾必须带边界声明。

#### Scenario: 输出星级

- **WHEN** 解读给出配对星级
- **THEN** 同句注明星级是依传统标准的裁量结论，不是对两人关系的判定

### Requirement: 方法论按需展开

系统 SHALL 提供完整的合盘方法论细则，覆盖：双宫联参原则、天作之合判断、完整合盘五步法
（命格基础 → 夫妻宫互参 → 太阳太阴 → 四化互参 → 大限同步）、缘分类型、婚期三层判断、
各宫位结婚情形、克夫克妻标志、事业合作合盘、感情相位速判。

事业合作合盘判定 SHALL 写明启用条件（用户明确问事业/合作）与输出形态（按聚焦形态）。

#### Scenario: 用户问事业合作

- **WHEN** 用户明确问两人事业或合作是否合得来
- **THEN** 启用事业合作合盘判定，并按聚焦形态输出

#### Scenario: 只判婚姻

- **WHEN** 用户只问婚姻配对
- **THEN** 不启用事业合作合盘判定

### Requirement: 宫名口径一致

系统 SHALL 统一使用「交友宫」而非「仆役宫」，宫名带「宫」字，与参数面口径一致。

#### Scenario: 第八宫

- **WHEN** 解读涉及第 8 宫
- **THEN** 称「交友宫」
