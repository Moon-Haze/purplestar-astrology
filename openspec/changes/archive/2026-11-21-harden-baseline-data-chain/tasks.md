# Tasks

## 1. 数据集指纹对账

- [x] 1.1 前置验证 parquet 重导可复现：`npm run build:db -- --mode=dataset` 从现有 `ziwei.duckdb` 重导，两次导出（或与盘上现值）比哈希。一致 → 字节哈希成立，结论记入任务注记；不一致 → 切换 D1 备选逻辑指纹（条数 + 年份范围 + 主键序列哈希），并在本任务注记留档切换原因。完成判据：重导实跑退出码 0，哈希对比结论明确。（三方哈希全同：同库重导×2 与盘上现值互同——字节哈希成立；顺带钉死血统：db/dataset ≡ ziwei.duckdb 同参重导）
- [x] 1.2 导出工具自报登记：`tools/db/build-duckdb.ts` 的 dataset 导出路径写 `db/dataset/MANIFEST.json`（两个 parquet 的 sha256 + 总条数 + 年份范围 + 生成日期 + 血统备注——备注按 D1 措辞诚实填写），并完成首次登记（对盘上现值登记，不等重导）。完成判据：重导后 MANIFEST 与重导产物一致（哈希复算通过）；`npm run typecheck` 过。（writeDatasetManifest 住 build-duckdb，finalizeDataset 导出收尾自报；首登记以追认语境完成）
- [x] 1.3 对账断言：`repo.test.ts` 加 describe「数据集指纹对账」（读登记面 + 只读文件字节算哈希比对；登记缺失 / 字段不全即红并报缺什么），`test/lib/run.ts` 的 LAYERS suites 同步登记。反向注入：改 parquet 任一字节 → 断言红并报出登记 vs 实测哈希与两条出路 → 还原全绿。完成判据：`ZIWEI_NO_CACHE=1 npm test` 全绿、注入实验红/还原绿、git diff 干净。（repo.test 新 describe 2 项 + LAYERS suites 登记；注入一字节 → 红并报登记≠实测与两条出路 → 还原绿）

## 2. 基准范围正式化（1950–2026）

- [x] 2.1 重建输入侧：`test/tools/build-fixtures.ts` 抽样年份 1950–2026；`test/tools/full-corpus.ts` 的范围标签改为运行时自报（描述性文案不手写第二份）。完成判据：两脚本 `npm run typecheck` 过；`build-fixtures` 空跑 `--help` 类自报行不含手写年份串。（年份常量 1950–2026 + full-corpus expectedTotal/scope 运行时查询自报——旧「每月恒 720」模型被闰月证伪）
- [x] 2.2 重导 fixtures + 计数派生化：跑 `build-fixtures` 重导（写盘前分歧自检必须绿——红则停，按「升级 iztro 的流程」查血统，不得加白名单了事）；`test/chart.test.ts` 的「300 条（60 年 × 5 条）」改为从 manifest 派生（count 与 yearRange 互证）。完成判据：fixtures diff 审阅——charts.jsonl 只含样本集换血、manifest.json 只含元数据与指纹节；`ZIWEI_NO_CACHE=1 npm test` 全绿且层 1 项数按新样本数自报。（分歧自检 385 条全过；层 5 raw-rows 按 README 流程重导；ROSTER 补火铃夹命 + NO_HIT 移出；horoscope 预言机前提断言改分桶对账；npm test 1114/1114）
- [x] 2.3 文案与计数陈述同步：grep 全仓旧串（`518,400` / `518400` / `1924` / `60 年` / `300 条` 的语境逐一核）——README（命令注释 / 分工表 / 文件清单 / 「fixtures 从哪来」节）、AGENTS（npm test 行的条数与耗时按实跑更新）、其余源码注释中的旧年份陈述。涉及生成文件处只改生成器 + 重导。完成判据：grep 旧串零残留（或逐处带理由保留）；`test:midcorpus -- --n 600` 复跑双档一致（交叉核对在新 fixtures 上绿）。（grep 清零：README 10 处、AGENTS 5 处、源注释 14 处；tools/db 构建体系各代设计常量带理由保留；历史叙事 5 处保留；midcorpus 600 条复跑绿）

## 3. 普查基线对拍

- [x] 3.1 基线两形态：`test/tools/brightness-census.ts` 加「存基线 / 对基线」形态（固定单点 `test/fixtures/brightness-census-baseline.json`，不加路径参数；对基线逐行 diff——新增 / 消失 / 计数变化逐条点名，零变化一行确认；基线非闸门，两形态都不红不绿只报事实）。完成判据：存基线后重跑对拍输出「零变化」确认；`npm run typecheck` 过。（--save-baseline / --check-baseline 固定单点 fixtures/brightness-census-baseline.json；非闸门退出码恒 0）
- [x] 3.2 对拍可分辨演练：临时注错文墨表一格 → 对基线形态报出「新增组合行 + 计数变化」→ 还原后对基线恢复零变化、`git diff` 干净。完成判据：两轮输出符合形态；基线文件此后保持与无注错实况一致。（注错一格 → 对基线报「+ 新增 天机: 庙旺→陷 × 31」→ 还原零变化；机制验证通过）

## 4. 集成验收

- [x] 4.1 三件套全绿：`npm run typecheck` 0 错误；`node scripts/purple-star.ts selftest` 全绿；`ZIWEI_NO_CACHE=1 npm test` 全绿（含指纹对账与派生化断言）。完成判据：三条命令退出码 0（不接管道取码）。（typecheck 0 错误 / selftest 169/169 / npm test 1114/1114）
- [x] 4.2 风格闸门：`npm run lint` 0 error；prettier 仅对本次新增 / 改动文件跑，无关行零噪声。完成判据：退出码 0，`git diff` 审阅无夹带。（lint 0 error，warning 全部预存；prettier 仅对改动文件，AGENTS 表格重排为行宽连动）
- [x] 4.3 规范校验：`openspec validate --all` 通过且零警告（普通与 --strict）。完成判据：退出码 0、输出无 WARNING。（validate --all 普通与 --strict 双模式零警告）
