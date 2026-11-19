# 候选 10 · `--no-cache` 指引腐烂：help 文案指向不存在的 `.cache/charts`，且同句手抄三份（2026-11-18 第五轮）

**档位**：Strong ｜ **分层**：cli/args 声明表 + tools/（零内核行为改动）｜ **规范面**：文案修正 + 手抄收敛，SKILL.md/references 不动（options.md 本就是正确口径）；无需 openspec change ｜ **与已定决策冲突**：0（e417115「文案手抄收敛」的漏网项补刀）

## 涉及文件

| 位置                                     | 角色                                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `scripts/cli/args/table.ts:318`          | 声明表 desc：「跳过排盘缓存，强制现排（默认同一农历年内复用 **.cache/charts** 里的排盘结果）」——help 渲染的单点数据  |
| `tools/cli-samples.ts:739`               | 同句**手抄**第二份（Sample.desc）                                                                                    |
| `docs/code/cli-selftest.md:56`           | 同句第三份（「.cache/charts 里改动前写下的条目」）                                                                   |
| `scripts/cli/chart/chart-cache.ts:60-62` | 实际缓存根：`tmpdir()/purplestar-astrology-v{CACHE_VERSION}-{userTag}`（**系统临时目录**，不是仓库 `.cache/charts`） |
| `test/chart-cache.test.ts:247-249`       | 反证断言：「skill 目录里不应出现 .cache/」——直接钉死 desc 所指路径不该存在                                           |
| `references/options.md:65`               | **正确口径**：临时子目录 + `ZIWEI_CACHE_DIR` 可持久化                                                                |

## 问题（file:line 实据）

`--no-cache` 的 help desc 告诉用户「默认复用 `.cache/charts` 里的排盘结果」——这个路径**不存在**：缓存根自建在系统临时目录（`chart-cache.ts:60-62`），且测试明文断言 skill 目录里不应出现 `.cache/`。照 help 文案去清缓存会**扑空**；想持久缓存的真实开关（`ZIWEI_CACHE_DIR`）在 desc 里一个字没提，而 options.md:65 早已写了正确口径。

同句在手样例表（`cli-samples.ts:739`）与 `docs/code/cli-selftest.md:56` 各手抄一份——错误被三处互相印证，并经 cli-samples 忠实转录进生成的文档。这是「文案手抄双写」缺陷类在 e417115 收敛扫描里的漏网项（该轮只盯 `--view` 值域）。

## 为什么是摩擦（词汇口径）

help desc 是声明表（参数面唯一真相源）的一部分——真相源本身的内容失真，且它的第二份手抄让失真有了「两处一致」的假象。缓存位置的语义属主是 `chart-cache.ts`（`cacheRootDir` module），文案层复述了它一个已过时的旧值；三处文案与一个实现之间没有任何对拍。修复后「缓存根在哪」回到单一 module 的事实 + 文案不复述路径细节，locality 归位。

## 方案方向

1. `table.ts:318` desc 改现口径（一句话，不给路径细节或只说「系统临时目录」；提 `ZIWEI_CACHE_DIR` 可选）。措辞与 `references/options.md:65` 对齐。
2. `cli-samples.ts:739` 的手抄 desc 不再复述实现细节（改一句不含路径的话，或消费声明表 desc——若 Sample.desc 结构允许直接引用，优先引用，让手抄湮灭）。
3. `docs/code/cli-selftest.md:56` 的 `.cache/charts` 改为实态表述。
4. 重导 `docs/cli-samples.md`（生成物）。

## deletion test

只改字面不动抄写结构 = 修文案；让样例表 desc 消费声明表 = 该句回到单一 module（深化方向）。至少做到改字面三处一致；结构性收敛视 Sample.desc 的装配形态顺手做。

## Before / After

```text
Before: 事实 × 1（chart-cache）+ 失真复述 × 3       After: 事实 × 1 + 复述 × 0～1
chart-cache.ts:60  tmpdir()/purplestar-…-v{N}       chart-cache.ts:60 （不变，唯一事实）
table.ts:318     「.cache/charts」 ✗ 用户扑空        table.ts:318     「系统临时目录（ZIWEI_CACHE_DIR 可持久）」
cli-samples:739  手抄同句 ✗                          cli-samples:739  一句话或引用声明表
cli-selftest.md:56 同句 ✗                            cli-selftest.md:56 改实态
```

## 验收

- `grep -rn "\.cache/charts" scripts/ tools/ docs/` 归零。
- help 输出（`astrology --help`）的 `--no-cache` 行为新口径；cli-samples 重导后 diff 仅该条。
- selftest / npm test 全绿（chart-cache.test 的「不应出现 .cache/」断言不变，仍是反证锚）。

## 落地注意

- 声明表 desc 被 help 与 selftest 参数面审计消费，改 desc 后确认 `runSkillArgsAudit` 类断言没有锚定旧句（改文案不该红，若有锚定旧句的断言恰说明又一处文案手抄，顺手改派生）。
- 与候选 2 的存量清单同族（都是「指向不在的事实」），但本条是**用户可见指引**，单独成项以示优先。
