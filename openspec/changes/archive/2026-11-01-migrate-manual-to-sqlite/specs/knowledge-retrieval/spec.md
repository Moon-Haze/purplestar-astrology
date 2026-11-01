# Spec Delta

## MODIFIED Requirements

### Requirement: 重数据懒加载

系统 SHALL 保持知识源实现的懒加载纪律：重数据只在 `search` 体内按需加载，注册表只静态
import 轻量包装模块。天纪语料经 `await import` 加载；oracle 断语手册经按需打开
SQLite 只读连接查询（断语数据住 `manual-store` 能力约束的断语手册库，不再是生成 TS 文件）。
静态引入实现会把大体积数据拖进 CLI 启动。

#### Scenario: 启动开销

- **WHEN** 用户执行与知识检索无关的命令（如 `help`）
- **THEN** 不加载天纪语料，也不打开断语手册库

#### Scenario: oracle 按需查询

- **WHEN** 用户执行 `knowledge --source oracle` 检索
- **THEN** 断语手册库以只读方式按需打开并查询，三形态（裸列 / 主题概览 / 单星展开）
  输出与迁移前 TS 数据形态逐字一致
