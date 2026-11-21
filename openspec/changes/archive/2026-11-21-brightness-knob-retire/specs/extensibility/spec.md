## ADDED Requirements

### Requirement: 内核无运行时流派旋钮

内核 SHALL NOT 暴露运行时可变的流派旋钮（set/get 类模块级可变状态）：默认亮度流派
（XD2）是内核侧**常量事实**，经 `wenmoStarBrightness` 的可选 `school` 入参显式表达。
唯一合法跨越该旋钮的调用者类（插件层）已被「SHALL NOT 修改内核模块状态」禁止，生产
消费恒走默认值——零消费旋钮是假想 seam 的机制半边，SHALL 按「镜像字段应删除而非零
消费保留」同一原则退役；多流派数据表与启动期维度自检保留，流派语义经数据与显式入参
表达。

#### Scenario: 内核导出面出现 set/get 旋钮

- **WHEN** 内核导出可变模块状态的 setter / getter（如亮度流派旋钮）
- **THEN** 视为假想 seam 的机制半边，SHALL 走契约变更流程退役（显式 change +
  `kernel-contract.test.ts` 同步）；`wenmoStarBrightness` 的可选 `school` 入参与四流派
  数据表是流派语义的唯一表达面

#### Scenario: 退役不得改变排盘行为

- **WHEN** 旋钮退役落地
- **THEN** 全输出与改动前基线逐字节 diff = 0（状态恒为默认值的证明）；
  `wenmoStarBrightness` 的契约签名断言（`length === 2`）原样成立，学理锚点与
  `validateWenmoBrightness` 启动期防线原样保留
