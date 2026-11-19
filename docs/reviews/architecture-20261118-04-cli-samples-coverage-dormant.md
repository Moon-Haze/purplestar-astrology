# 候选 4 · cli-samples 覆盖守卫休眠 + 样例 argv 绕开单点（2026-11-18 第五轮）

**档位**：Strong（守卫搬家）/ Worth exploring（argv 接线）｜ **分层**：tools/ + test/（零内核改动）｜ **规范面**：test 侧加断言若动 quality-gates 矩阵面则并入既有 change 口径，否则普通测试增强 ｜ **与已定决策冲突**：0

## 涉及文件

| 位置                                   | 角色                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `tools/cli-samples.ts:993-1019`        | 参数覆盖自检（**住在 `main()` 里**）                                          |
| `tools/cli-samples.ts:28-31`           | 头注「样例表是**手动维护**的：新增 CLI 参数时在 SAMPLES 里补一条」            |
| `.gitignore:38-39`                     | `docs/cli-samples.md` 自 6e6e9ad 起不入版本控制                               |
| `test/cli.test.ts:25`                  | npm test 消费 `SAMPLES`（跑样例、不跑覆盖检查）                               |
| `scripts/cli/selftest/sample.ts:16-46` | argv 形态单点（SAMPLE_ARGV / DEMO_ARGV / DEMO_FEMALE_ARGV / DEMO_POSITIONAL） |
| `tools/cli-samples.ts` SAMPLES 表      | 手写 DEMO 同款串 35 处（`grep -c "2011-06-24"` = 35）                         |

## 问题（file:line 实据）

10-16 轮候选 5 给 cli-samples 建的参数覆盖自检是对的，但它**住错了地方**：

1. **守卫休眠**：覆盖检查（`OPTION_GROUPS` 全参数 ⊆ SAMPLES 覆盖）在 `main()` 里，只有**实际重导文档**时才运转；而 `docs/cli-samples.md` 是 gitignore 本地物（`.gitignore:38-39`），日常根本没人跑 cli-samples。`npm test` 是 SAMPLES 最大的消费者（样例执行、等价断言全靠它），却不消费覆盖检查——「新增参数忘补样例」回到静默缺节：文档悄悄缺一节，无红灯。守卫还在，只是睡在低频入口里。
2. **单点失约**：`scripts/cli/selftest/sample.ts` 自建为「argv 形态单点」并已接线 selftest 三断言组与 review-gate，但 SAMPLES 表手写了 35 处 DEMO 同款生辰串——单点最大的潜在消费方绕开它，未声明豁免理由。换样例组（比如换生辰）要人肉扫 35 处，漏改不红。

## 为什么是摩擦（词汇口径）

覆盖守卫是一个正确的 seam，放错了 adapter：它服务的承诺（「文档覆盖全参数面」）的**验证时机**应该在每次 `npm test`，而不是每次人工重导。同理，SAMPLES 与 sample.ts 是同一概念（「演示用出生 argv」）的两个 implementation，interface 却各自为政。两处修复都是把既有单点的 leverage 兑现，不发明新东西。

## 方案方向

1. **覆盖断言搬进 `test/cli.test.ts`**：SAMPLES 与 `OPTION_GROUPS` 都已在测试进程内（`cli.test.ts:25` 已 import SAMPLES），纯派生断言约 15 行（把 `main()` 里那段 coveredParams/declaredParams 对拍原样搬来）；`main()` 里的原检查保留（重导时同样先拦），两处共享同一份派生逻辑可提个小函数，但**不强求**——重复一个 10 行派生循环比加一个跨文件接口更便宜，deletion test 不支持为了去重而接线。
2. **SAMPLES 的 DEMO 组合接 sample.ts**：`tools/cli-samples.ts` import `scripts/cli/selftest/sample.ts` 的四个 argv 常量（先例：`tools/review-gate.ts:33` 已 import `DEMO_POSITIONAL`），35 处手写串收敛为常量引用或其小变体；确属不同组的生辰（真实覆盖面的意义所在）保留字面量。
3. 头注 `:28-29` 改口：「新增参数忘补样例会由 npm test 覆盖断言当场拦下」。

## deletion test

覆盖断言搬进 npm test：删掉 `main()` 里的检查，测试断言仍在——保证没有依赖「有人记得跑」这条路，复杂度集中（深化）。SAMPLES 接线单点：换样例生辰只动一处（深化）；反之 argv 各写各的是同形副本各自演化，正是 loader.ts 头注释里记过案的事故形状。

## Before / After

```text
Before: 守卫睡在低频入口                     After: 守卫随 npm test 醒着
新增参数 → SAMPLES 忘补                       新增参数 → SAMPLES 忘补
  ↓                                            ↓
docs/cli-samples.md 静默缺一节                test/cli.test.ts 覆盖断言当场红
（守卫只在人工重导时才看一眼）                 （重导检查保留，双保险同源）
SAMPLES 手写 DEMO 串 ×35                      SAMPLES import sample.ts 常量（异组生辰留字面量）
```

## 验收

- 临时从 SAMPLES 删一个参数的样例 → npm test 当场红（守卫活体证明），还原后全绿。
- SAMPLES 执行结果与 docs/cli-samples.md 产物不变（argv 接线是等值替换；`docs/cli-samples.md` 是本地生成物，重导后逐字节比对）。
- 三件套全绿。

## 落地注意

- tools → scripts/cli/selftest 的 import 方向有先例（review-gate），无分层问题。
- `--no-cache` / `--out` / `--book` 这类当时被守卫抓出的参数保持有样例（10-17 落地记录），搬进测试后这类兜底由 npm test 永续。
