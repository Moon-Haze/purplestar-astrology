# Proposal

## Why

第七轮架构评审（2026-11-21，两路子代理 + 主线程抽验）对新落测试基建与数据链（expand-db-baseline-regression / harden-baseline-data-chain / replace-env-injection-with-flags 三 change）的走查发现两类残留：

1. **S1（Strong）数据链重建指引指向已消失/失效的载体**：`test/lib/sample-source.ts` 的 missingDbHint 仍指 `reference/ziwei-samples-toolkit/samples-out`（不在盘上，且「60 个年份目录 1924-1983」与实盘 `db/tar-shards` 78 目录 1950-2026 矛盾）；`test/fixtures/manifest.json` 的 source 字段仍称原始语料「与本数据集等价」（v4 管线由本仓内核直生成后不再等价）；`test/README.md` 的「三个等价载体」表同簇。missingDbHint 是数据集缺失时唯一可打印的动作指引——错指比缺失更坏。
2. **S2（Strong）引文精度**：`views/health.ts:122` 煞星警示挂「倪师《天纪 11-12》」集数，但「开刀见血光」逐字出处是天纪 07（tianji.ts:358，语境擎羊陀罗病灾），「陀罗、擎羊入疾厄宫」措辞仓内零命中——用户可见的集数精度声明失真，且是 health 重建（8e90785）同文件漏网。
3. **W1-W6（Worth exploring）注释级残留**：health 头注（一源双投影过时 + slot 计数错）、types.ts 星曜类型 JSDoc born-stale（sha/lucky vs tough/soft）、brightness-census 自述未随 v4 更新、run.ts baselineEngine 手抄（manifest 字段在手未消费）、worstPalaces「杀星」语义缺口、json-contract 孤儿注释。

## What Changes

- **S1**：三处数据链指引按实况改写——missingDbHint 改指 `db/tar-shards`（78 目录 1950-2026）+ `build-duckdb`（v4 管线）；fixtures manifest 的 source 字段改血统谱系（经 build-fixtures 生成器改，不手改产物）；README 三载体表改现行谱系（tar-shards → duckdb → dataset，samples-out 移作历史注记）。
- **S2**：health.ts 煞星警示引语按真实出处改引——天纪 07 逐字引文「流年逢到这两颗星，身体病灾就来了」（擎羊陀罗病灾语境），集数声明更正；grades 对拍对 views 渲染面的盲区以注释留档（ grades 对拍只扫 data.ts，view 层引语登记会成幽灵）。
- **W1-W6**：注释级修复——health 头注（删过时的「一源双投影」、slot 计数改列举）、types.ts JSDoc（sha/lucky → tough/soft 对齐联合类型）、census 自述随 v4 更新（diff=0 是同源证据，工具价值=监测文墨表未来漂移）、run.ts 消费 manifest.baselineEngine 删两处手抄、worstPalaces 注释补「主星杀星不计」取舍、json-contract 孤儿注释删除。

## What Doesn't Change

- 不动排盘内核、flags 机制、旁路 API、指纹对账链——零机制改动，全部文案/注释/指引级。
- baselineEngine **字段值**不动（「iztro 2.5.8」沿袭值的语义问题——v4 本仓内核直生成后是否仍成立、compare 白名单是否空转——记 Speculative SP5 留档待拍板，本轮只做「消费字段删手抄」的最小修）。
- Speculative SP1-SP4（--year skipped 计量 / census 双旗标 / TOPIC_SUGGESTIONS 档案注记 / 引语纪律双标声明）记录不动。
- ZIWU_LIUZHU 删除与 health 重建本体不动（本轮只收尾）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无——纯实现修复与文案修订，无 spec delta；skip_specs，先例 dead-interface-face-cleanup。）
