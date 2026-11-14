# 任务 · notes/80-主题手册 孤儿生成物下线

判据形态标记：`[退出码]` / `[计数]` / `[逐字节]` / `[反向注入]`。
⚠️ 本 change 的破坏性行为（重导删文件）**必须先由代码改动解除**，再跑 `notes:export`；
改前**禁止**实跑 `npm run notes:export`（会触发 rmSync 删掉 15 个被跟踪文件）。

## 1. 取证（不实跑生成器）

- [x] 1.1 `git status --short notes/` 为空（工作树干净）；`git ls-files "notes/80-主题手册*"`
      计数 = 15。
      判据 `[计数]`：两值分别为空串与 15。
- [x] 1.2 取 `notes/` 全目录内容基线（`find notes -type f | sort > /tmp/notes-baseline.txt`
      + 各文件 sha256 清单），供任务 4 复现性对拍。
      判据 `[退出码]`：清单文件非空。

## 2. 下线

- [x] 2.1 `git rm -r "notes/80-主题手册"`（15 文件）。判据 `[计数]`：
      `git ls-files "notes/80-主题手册*"` 计数 = 0。
- [x] 2.2 `tools/notes/export-notes.ts`：`MANAGED_DIRS` 删 `80-主题手册` 条目；完成行删
      「主题手册 ${TOPIC_KEYS.length} 篇」计数；删 `:28` 失去消费者的 `TOPIC_KEYS` import。
      判据 `[计数]`：`grep -n "80-主题手册\|TOPIC_KEYS" tools/notes/export-notes.ts`
      零命中；`grep -rn "80-主题手册" tools/ notes/ docs/ references/` 仅剩历史沿革类
      陈述或零命中。
- [x] 2.3 `notes/README.md`：删「80-主题手册」表格行；若目录表自报托管目录总数，
      同步减一。
      判据 `[计数]`：`grep -n "80-主题手册" notes/README.md` 零命中。

## 3. 闸门

- [x] 3.1 `npm run typecheck`。判据 `[退出码]`：0 错误（tools/ 在 typecheck 面内）。
- [x] 3.2 `npx eslint tools/notes/export-notes.ts`。判据 `[退出码]`：0（死 import 删除后
      不引入未用变量告警）。

## 4. 重导证明（先改后跑）

- [x] 4.1 `npm run notes:export` 实跑一遍。
      判据 `[退出码]`：0；完成行自报**不含**「主题手册」字样。
- [x] 4.2 重导后对拍：`git status --short` 对 notes/ 与全仓**零差异**（除本 change 已改
      文件的既staged 状态外无任何新变化）；`find notes -type f | sort` 与 1.2 基线 diff
      恰为 15 行删除、零新增。
      判据 `[逐字节]`：其余托管区（60/70/75/85/90）内容 sha256 与基线一致——重导不产生
      任何新 diff，证明「其余产物逐字节可复现」与「80-主题手册不再被触碰」同时成立。
  <!-- 人工执行（2026-11-05）：文件集对拍 = 恰 15 行删除、0 新增 ✓。内容级对拍发现
       70-课程笔记 / 60-方法·已核对论断 与已提交版漂移——purplestar-voice 上游数据演进
       所致，与本 change 无关：git stash 隔离的 A/B 对拍证明新旧生成器在同份上游数据下
       输出 sha256 全等（A≡B），旧生成器完成行仍虚报「主题手册 14 篇」、新完成行已诚实。
       重导产物按最小 diff 纪律还原为已提交态，上游数据刷新留给后续 notes 重导 commit。
       注入态（4.3）与还原态对其余产物 sha256 全等，判据成立。 -->
- [x] 4.3 反向注入：临时把 `80-主题手册` 加回 `MANAGED_DIRS`（不建目录），实跑
      `npm run notes:export`——应退出 0 且不产生任何 diff（rmSync force 对不存在目录
      静默）——证明清单与实态一致的必要性只能靠 2.2 的 grep 判据钉住；还原。
      判据 `[反向注入]`：注入态无新 diff；还原后 4.1/4.2 判据复验为真。
      （若注入态产生意外 diff 或报错，如实记录并回到 2.2 重审。）
