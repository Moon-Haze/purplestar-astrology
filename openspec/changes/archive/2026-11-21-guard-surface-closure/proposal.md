# Proposal

## Why

第五轮架构评审（2026-11-18）候选 2 / 3 / 4 三处守卫面缺口，本轮（2026-11-21）拍板落地。三处同属「守卫自己的正确性没有守卫」或「守卫睡在低频入口」一类：

- **候选 2**：MD_POINTER 只覆盖「.ts 注释里带前缀的 .md 路径」窄域——`npm run X` 命令指针（存量腐烂已从 14 处涨到 17 处，含两处用户可见文案）、字符串字面量里的 `references/` 路径、裸 `*.test.ts` 断针（承诺的覆盖者不存在）三类形态完全无守卫；
- **候选 3**：review-gate 的 `GENERATED` 是手抄单，与三个真实来源各漂移一处（README 误伤 / notes 分区缺位且目录已删成死规则 / wenmo-tables、tianji 两个仓内生成物无机检面）；
- **候选 4**：cli-samples 参数覆盖自检住在 `main()` 低频入口（docs/cli-samples.md 是 gitignore 本地物，日常无人重导），`npm test` 是 SAMPLES 最大消费者却不消费覆盖检查；SAMPLES 手写 DEMO 同款出生串 35+ 处绕开 argv 单点。

## What Changes

- **候选 2**：repo 层 MD_POINTER 守卫扩三类词元——① 注释与字符串里的 `npm run X` 断言 script 存在（package.json 补 `build:db` 别名使存量引用全部变真）；② 字符串字面量中 `references/` 前缀 `.md` 路径存在性（窄域，零误伤）；③ 注释中裸 `*.test.ts` 文件名断言 `test/` 下存在。白名单机制（带理由 + 反向守卫）照旧共用。存量腐烂清单逐条清理（build:db / 四域→三域 / 392KB 计数 / manual 目录残留引用 / tests/db.test.ts 断针 / notes 死分支 / AGENTS.md notes 行 / cli-commands.md 测试路径）。
- **候选 3**：`GENERATED` 手抄单改为**消费生成器自报**——export-manual 新增 `MANAGED_PATHS`、export-notes 的 `MANAGED_DIRS` / `MANAGED_METHOD_FILES` 提为 export、tianji 由 `import-tianji.ts` 自报、wenmo-tables（生成器在上游仓）以登记常量入册；notes 死正则删除；README 移出误伤并改自述为真话。
- **候选 4**：参数覆盖对拍从 `main()` 复制进 `test/cli.test.ts`（npm test 永续醒着；main() 内检查保留双保险）；`sample.ts` 补 DEMO 组件值单点（`DEMO_PARTS` / `DEMO_FEMALE_PARTS`），cli-samples 的 SAMPLES 表 DEMO 同款串收敛为单点引用（异组生辰留字面量），头注改口。

## What Doesn't Change

- 守卫只查**存在性**的既有口径不动（SHALL NOT 审查内容正确性）；白名单「跳过必须看得见 + 反向守卫」纪律不动
- `manual:check` 不进 `npm test` 日常回归的取舍不动；review 闸门其余检查项不动
- cli-samples 的场景集合与执行形态不动（只收敛出生串来源）；main() 覆盖检查保留
- 排盘内核与知识内容零改动（分层红线）

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `quality-gates`：「注释指针有效性守卫」扩三类词元；「生成物漂移探针」补生成器自报与登记面；新增「样例表参数覆盖随回归守卫」
