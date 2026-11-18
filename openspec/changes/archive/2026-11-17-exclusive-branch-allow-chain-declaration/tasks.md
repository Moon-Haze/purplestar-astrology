# Tasks

> 实现项（[ ]）与人工验证项（[V] 标注说明 + 勾选）同表混排；凡标 **[人工验证]**
> 的任务必须由人跑命令核签，其余由实现者自跑自勾。无文件物理位置变动，无生成文件
> 重导任务。

## 1. 基线（动手前，先于一切改动）

- [x] 1.1 取探针矩阵基线：逐条实跑并保存 stdout/stderr 全文——
      `node scripts/purple-star.ts astrology 1990-5-15 9:30 男 北京` ×
      `--report --view daxian` / `--palaces --view daxian` / `--report --monthly 5` /
      `--topic love --yearly 2027` / `--topic love --monthly 5` / `--info --view daxian` /
      `--palaces --topic love` / `--topic love --report` / `--report --info` /
      `--report --pattern` / `--report --json` / `--info --palaces --topic love --report`
      （12 条独占分支组合，放行/吞掉/bespoke 三种文案各至少一条）。判据：基线文件
      落盘（如 `/tmp/exclusive-baseline/`），每条含退出码与全文。
- [x] 1.2 取回归基线：`npm run typecheck`（期望 0 错误）、
      `ZIWEI_NO_CACHE=1 node scripts/purple-star.ts selftest`（记录首行自报项数）、
      `npm test`（记录项数）。判据：三命令退出码 0，首行数字记录在案。

## 2. 声明表（table.ts）

- [x] 2.1 新增按优先序独占分支清单（design D1/D2）：四条目
      palaces → topic → report → info，各带 `consumes`（topic = yearly/monthly/view，
      其余空）；report 条目带 bespoke 拒收表态（keys 含 view、note 为现文案模板）；
      info 条目带 `chainLabel: "其他功能参数"`。判据：`npm run typecheck` 0 错误，
      小表零依赖纯数据（不 import 命令实现与内核）。
- [x] 2.2 `EXCLUSIVE_PRIORITY_LABEL` 改由清单派生（design D4）：导出名不变、
      字符串值逐字节等于 `--palaces > --topic > --report > 其他功能参数`。判据：
      `node -e` 或 selftest 快照断言（3.3）通过。

## 3. 命令侧与守卫（astrology.ts / selftest/args.ts）

- [x] 3.1 `assertNoShadowedFeatures` 扩两段（design D3）：前置段按清单
      `rejectsWithNote` 检查（`--report × --view` 抛 bespoke 文案），后置段通用检测、
      consumed 从清单条目派生（删 astrology.ts:225 内联三元）；`--report` 分支删除
      独立 bespoke 调用点（astrology.ts:491-495）与移序注释（:487-490），头注释改写
      为「bespoke 由清单前置段驱动」。
- [x] 3.2 `--info` 上级梯改派生（design D4）：删 astrology.ts:365-371 手写三元梯，
      改「清单中排在 info 之前、第一个在场者」。
- [x] 3.3 selftest/args.ts 新增声明完整性断言（design D6 / quality-gates delta）：
      ① 每条目 consumes ⊆ SHADOWABLE_KEYS；② 每条目分支名在 OPTION_GROUPS 已声明；
      ③ 派生文案与冻结镜像一致（复用 :200-204 既有对拍即可，若派生已使其等价则注明
      「既有断言升格为顺序守卫」，不另加重复断言）。判据：
      `ZIWEI_NO_CACHE=1 node scripts/purple-star.ts selftest` 全绿，项数以首行自报
      为准（新增断言使项数 +N，不写死）；反向注入自检（可临时改坏一处再还原）：
      撤 view 的 shadow 标志 → ①红；清单改名 → ②红；改清单序 → ③红，还原全绿。
- [x] 3.4 `selftest/commands.ts` --report 非空断言（:189-191）保持不动——兜底面
      由 report.test 子串钉点（4.2）收口，此处不加重复钉点。

## 4. 测试面（test/report.test.ts）

- [x] 4.1 组合矩阵跳过条件改派生（design D6）：`continue` 条件改为
      flag ∈ 该分支 consumes ∪ bespoke keys（从 table.ts 派生），
      `--report × --monthly` 格随之解禁进入通用断言。判据：定向跑
      `npm test -- --test-name-pattern "独占分支"` 全绿（本会话已验证该命令形式
      exit=0；完整面以 6.2 的 `npm test` 为准）。
- [x] 4.2 `--report × --view` 断言（:211-212）补钉 bespoke 特有子串「不接受」。
      判据：全绿；反向注入自检：临时删 table.ts 的 bespoke 表态 → 该断言红（其余
      不红不承诺），还原全绿。

## 5. 文档同步

- [x] 5.1 `docs/code/cli-commands.md`：优先级链节与消费白名单节补「单点在
      table.ts 独占分支清单、命令侧为派生」表述，与 astrology.ts 头注释一致。
- [x] 5.2 `docs/code/cli-args.md`：独占分支清单声明位置与派生关系（含
      EXCLUSIVE_PRIORITY_LABEL 改派生）一句话同步。判据：两文档无与实现矛盾的
      旧表述（grep 手写三元/内联白名单等旧描述无残留）。

## 6. 验收（人工验证）

- [x] 6.1 **[人工验证]** 行为零变化：重跑 1.1 全部 12 条探针，输出与退出码和基线
      **逐字节 diff=0**（`diff` / `cmp` 逐条核）。判据：12 条全零差异；任何一条
      不一致即阻断。
- [x] 6.2 **[人工验证]** 三件套：`npm run typecheck` 0 错误；
      `ZIWEI_NO_CACHE=1 node scripts/purple-star.ts selftest` 全绿（项数与 1.2 记录
      对账，增量为 3.3 新增断言数）；`npm test` 全绿（项数与 1.2 对账，本变更不新增
      it，期望项数不变；`--report × --monthly` 格为既有 it 内新增覆盖）。退出码
      直接取命令本身，不接管道。
- [x] 6.3 **[人工验证]** 风格闸门：`npm run lint` 0 错误；Prettier 只对本次新增/
      改动行跑，`git diff` 无无关排版噪声。
- [x] 6.4 **[人工验证]** 越界报警器核对：内核层测试项数不变（`npm test` 输出对账
      1.2 记录）；未新增 test 文件（`git status` 无新 test/*.test.ts，层表与
      LAYERS 未动）。
- [x] 6.5 **[人工验证]** 在途纪律：`git diff --stat` 确认改动只含本变更 7 文件
      （table.ts / astrology.ts / selftest/args.ts / report.test.ts /
      cli-commands.md / cli-args.md / 或 design 预留的 selftest/commands.ts 不动），
      无工作区在途 hunk 被夹带。
