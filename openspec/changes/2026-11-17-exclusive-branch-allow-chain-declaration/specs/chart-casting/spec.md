# Spec Delta

## MODIFIED Requirements

### Requirement: 独占分支不静默吞功能参数

独占分支（`--palaces` / `--topic` / `--report` / `--info`）激活时，系统 SHALL 对同给的
其他功能参数**非零退出并点名**（「以下功能参数不会生效」），绝不静默丢弃后照常产出。
被吞检测域 SHALL 由参数声明表单一派生（`shadow` 标志入选、`noShadow` 排除、独占参数自身
在内），不得在命令侧维护第二份清单；运限四化层级族（`--monthly` / `--daily` / `--hourly`）
SHALL 全员在检测域内。判定链的 allow 半边与优先级链 SHALL 由声明表同一份**按优先序
排列的独占分支清单**单一派生：每分支放行自身消费的参数集合（`consumes`）、`--info`
分支的上级判定、独占分支优先级指路文案均 SHALL 从该清单派生，命令侧不得各持手写
副本；分支特有的 bespoke 拒收（如 `--report` 对 `--view` 的指路）SHALL 作为统一检测
入口的前置段由清单数据驱动，不得依赖调用点先后顺序。「缺上级」的逐级依赖报错
（如 `--daily` 需要 `--monthly`）仍由默认路径守卫负责，不并入本需求。

#### Scenario: 独占分支吞运限层级参数

- **WHEN** 用户在任一独占分支（`--info` / `--palaces` / `--topic` / `--report`）同给
  `--monthly` / `--daily` / `--hourly`（如 `--topic love --daily 10`）
- **THEN** 命令非零退出、不产出该独占分支的输出，stderr 点名被吞参数并附独占分支
  优先级指路

#### Scenario: --topic 放行自身消费的运限参数

- **WHEN** 用户给 `--topic love --yearly 2027` 或 `--topic love --monthly 5`
- **THEN** 命令正常产出主题论断、退出码为 0，不报「不会生效」（两参数被 `--topic`
  消费，属合法组合）

#### Scenario: 检测域与声明表保持单一派生

- **WHEN** 声明表中任一运限四化层级参数（monthly / daily / hourly）的 `shadow` 标志
  被增删
- **THEN** 独占守卫检测域随之增减——selftest 的等价快照断言与声明表派生保持一致，
  不存在落在「命令侧守卫 ∪ 声明侧集合」并集缺口外的运限层级参数

#### Scenario: 消费白名单由清单派生

- **WHEN** 独占分支的放行集合需要增删（如未来新增被 `--topic` 消费的参数）
- **THEN** 只改声明表该分支条目的放行集合一处：命令侧检测随之放行或吞掉，
  report.test 组合矩阵的跳过条件同源派生——命令侧不存在内联白名单（反向注入：
  命令侧改回内联副本而清单不动时，声明完整性断言变红）

#### Scenario: 优先级链单点编码

- **WHEN** 调整独占分支优先级（如对调 `--topic` 与 `--report` 的先后）
- **THEN** 改声明表清单顺序一处即得：`--info` 的上级判定、优先级指路文案、selftest
  冻结镜像三者随派生同步，命令侧不存在需要协同修改的梯子或文案（逐字节 diff：
  三个派生面各自与清单序一致，无第二处需改）

#### Scenario: bespoke 拒收不依赖调用点顺序

- **WHEN** 用户给 `--report --view daxian`
- **THEN** 命令非零退出且报错为 bespoke 指路文案（含「不接受」与 `--topic` 指路，
  不含通用「不会生效」）；该拒收是检测入口的前置段、由清单数据驱动——删除 bespoke
  表态时既有断言（钉 bespoke 特有子串）当场红（反向注入），不存在「移回通用检测
  之后四条测试面仍全绿」的静默回退路径
