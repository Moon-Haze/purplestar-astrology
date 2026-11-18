# Tasks

> 实现项（[ ]）与人工验证项（**[人工验证]** 标注）同表混排；凡标 **[人工验证]**
> 的任务必须由人跑命令核签，其余由实现者自跑自勾。本变更为纯测试面改动：
> 运行链路（scripts/）零文件改动，无生成文件重导任务，无新增测试文件
> （无层表 / LAYERS 登记义务）。

## 1. 基线（动手前，先于一切改动）

- [x] 1.1 取回归基线：`npm run typecheck`（期望 0 错误）、
      `ZIWEI_NO_CACHE=1 node scripts/purple-star.ts selftest`（记录首行自报项数）、
      `npm test`（记录项数与 report.test 的 describe/it 数）。判据：三命令退出码 0，
      首行数字记录在案。
- [x] 1.2 复核探针前置条件：提案阶段已对封闭枚举全部 48 格实跑探针并逐格全绿
      （45 格通用「点名 + 不会生效」断言 + 3 格 allow 断言，含 3 个自指格的
      parse 判重行为核实——证据见 proposal.md What Changes 节）。实现前核对
      `git log -1 --format=%h` 时点上 `EXCLUSIVE_BRANCHES`（table.ts:493）与
      `SHADOWABLE_KEYS`（table.ts:433）成员相对提案时点无增删；若有增删，
      先按 design D4 补探针再动手。

## 2. 测试面（test/report.test.ts，唯一代码改动文件）

- [x] 2.1 两张探针映射（design D2）：分支取值映射
      `{ topic: ["love"] }`（其余分支裸旗标）+ 值形态旗标映射
      `{ ages: "34", daily: "10", decadal: "2", focus: "财帛", hourly: "3",
      monthly: "5", topic: "love", view: "daxian", yearly: "2027" }`
      （switch 形态 mutagen / pattern / info / report 不需要条目）。
      switch/value 判定依据声明表 `kind` 字段，不另立形态清单。判据：
      `npm run typecheck` 0 错误。
- [x] 2.2 缺名守卫（design D3）：矩阵循环入口遍历派生轴，映射缺席条目
      `assert.fail` 并点名该分支/旗标（「新分支/旗标未登记探针取值，未入矩阵」）。
      分支轴、旗标轴、allow 方向三处派生各挂守卫。判据：定向跑矩阵 it 全绿；
      反向注入自检——临时往 `EXCLUSIVE_BRANCHES` 追加
      `{ name: "focus", consumes: [] }` → 缺名守卫红并点名 focus，还原全绿。
- [x] 2.3 两根轴改派生 + skip 规则补自指项（design D1）：外层分支轴改遍历
      `EXCLUSIVE_BRANCHES`（删 report.test.ts:250 手抄四元组）、内层旗标轴改遍历
      `SHADOWABLE_KEYS`（删 :251-255 手抄 4 格）；skip 条件在既有派生
      （consumes ∪ bespoke keys）上补 `flag === branch` 自指项（自指格端到端触发
      parse 判重文案而非被吞文案，实跑证据见 proposal）。判据：定向跑矩阵 it
      全绿（45 格通用断言格格命中）。
- [x] 2.4 allow 循环改派生（design D1）：遍历 `EXCLUSIVE_BRANCHES` 中
      `consumes` 非空的条目（删 report.test.ts:269-273 手抄三元组），放行成员
      探针值复用 2.1 旗标值映射并挂缺名守卫。判据：定向跑矩阵 it 全绿
      （--topic × yearly/monthly/view 三格出主题论断、无误伤报错）。
- [x] 2.5 格数自报（计数类事实不写死）：矩阵 it 跑完输出自报行
      （通用格数 + allow 格数，从派生轴计算，落地时点为 45 + 3）。判据：数字
      与 52 − 3 自指 − 3 放行 − 1 bespoke 账目吻合；格数随声明表增删自动变化。
- [x] 2.6 注释与指针同步：it 标题与块注释（report.test.ts:231-238）从
      「跳过格由声明表派生」改写为「三根轴封闭派生」（删除对「四条独占分支 ×
      {monthly, daily, hourly, view}」手抄形态的描述）；report.test.ts:73 的
      argsTable 引入注释同步为「组合矩阵三根轴从它派生」。判据：注释与代码一致
      （注释指针有效性纪律），无对已删手抄清单的残余描述。

## 3. 文档同步（仓库级，不进分发件）

- [x] 3.1 `docs/code/cli-args.md:104` 的指针注释同步：从「report.test 组合矩阵的
      跳过格全部由此派生」改为「report.test 组合矩阵的三根轴（分支轴 / 被吞旗标轴 /
      allow 方向）全部由此派生」。判据：注释与 test/report.test.ts 实际派生面一致。

## 4. 自查闸门（实现者自跑）

- [x] 4.1 `npm run typecheck` 0 错误；新增行跑 `npm run lint` 与 Prettier
      （只对改动行，无无关排版噪声）。
- [x] 4.2 `ZIWEI_NO_CACHE=1 node scripts/purple-star.ts selftest` 全绿，首行项数
      与 1.1 基线一致（selftest 面零改动的结构保证：`selftest/args.ts` 等
      scripts/ 文件零 diff）。
- [x] 4.3 `npm test` 全绿，项数与 1.1 基线一致（无新增 it）；矩阵 it 内覆盖格数
      从 13+3 升为 45+3（以 2.5 自报行为准）。反向注入自检（延续 2.2）：还原后
      全绿。

## 5. 验收（人工验证）

- [x] 5.1 **[人工验证]** 三件套 + 风格：`npm run typecheck` / `ZIWEI_NO_CACHE=1
      node scripts/purple-star.ts selftest` / `npm test` 退出码全 0（直接取命令
      本身，不接管道）；`npm run lint` 0 错误。
- [x] 5.2 **[人工验证]** 运行链路零改动核对：`git diff --stat` 只含
      `test/report.test.ts`、`docs/code/cli-args.md` 与本变更 openspec 工件——
      `scripts/` 下零文件改动（CLI 行为逐字节不变的结构保证）、无新 test 文件、
      `test/README.md` 层表与 `test/lib/run.ts` LAYERS 未动、内核层测试项数不变
      （AGENTS.md:311-312 越界报警器无感）。
- [x] 5.3 **[人工验证]** 接缝判据闭合演练（AGENTS.md:307 实证留档）：临时往
      `EXCLUSIVE_BRANCHES` 追加 `{ name: "focus", consumes: [] }`（第 5 条分支
      场景）→ 跑矩阵 it → 缺名守卫红并点名 focus（「新分支未入矩阵」不静默）；
      补一行探针映射 → 矩阵自动出现 focus 列。若 focus × 某旗标格断言红，
      按 design D4 判别（夹具缺席 vs 次序缺陷）并留档——两种结果都是演练价值；
      演练毕完整还原，`git diff` 回到只含本变更改动。
