# Spec Delta

## ADDED Requirements

### Requirement: 独占分支不静默吞功能参数

独占分支（`--palaces` / `--topic` / `--report` / `--info`）激活时，系统 SHALL 对同给的
其他功能参数**非零退出并点名**（「以下功能参数不会生效」），绝不静默丢弃后照常产出。
被吞检测域 SHALL 由参数声明表单一派生（`shadow` 标志入选、`noShadow` 排除、独占参数自身
在内），不得在命令侧维护第二份清单；运限四化层级族（`--monthly` / `--daily` / `--hourly`）
SHALL 全员在检测域内。「缺上级」的逐级依赖报错（如 `--daily` 需要 `--monthly`）仍由默认
路径守卫负责，不并入本需求。

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
