# db-tools —— 基准数据工具（tools/db/）

本篇覆盖 `tools/db/`：`db.ts`（构建/读侧 SQL 与输出路径）· `sample-id.ts`（样本 id 公式）·
`verify-duckdb.ts`（文本对账）。分类判据见 [README.md](README.md)。
条目为源码长注释的**原文搬迁**（2026-11-01，enforce-code-style-checker change 顺带清零存量）。

---

## 一、`db.ts`：库内 topics 视图（⚠️ unnest 与 LEFT JOIN 缺一不可）

> 两处写法都是必需的（均为实测结论）：
>
> 1. 必须走 unnest 展开路径：string_agg 只在输入为多行标量时按行拼接，直接传数组会被
>    字符串化成 "[a, '']" 这样的字面量并返回，不报错但结果全错（spec §6.1）。
> 2. 两处都必须是 LEFT JOIN，不能写逗号连接 + JOIN：
>       FROM topic_lines tl, unnest(tl.line_ids) u(id)  →  空数组产生 0 行，
>     「该主题文本为 NULL」的 (样本, 主题) 对会整行消失；若某个样本 13 个主题全是 NULL，
>    该样本会从视图里凭空消失（实测 3 行输入只剩 2 行：[] 的那行没了）。
>    LEFT JOIN unnest(...) ON TRUE + LEFT JOIN topic_dict 让该行留下、string_agg 无输入
>    → 输出 NULL，正是源侧 NULL 的语义。
>    实测 25,920 样本上两种写法耗时无差（全量重建 0.313s vs 0.334s，点查 0.017s vs 0.014s）。

## 二、`db.ts`：输出位置的唯一定义处

> build / verify / query 三个脚本都从这里取名字，不各自拼装：路径规则只有一份，
> 改一次即三处同步，不会出现「build 写到 A、query 读 B」这类只在下游才暴露的漂移。
>
> 命令行只给一个目录（--out=DIR），名字全部固定：
>   <DIR>/ziwei.duckdb                 库文件（inline 与 dataset 的构建载体）
>   <DIR>/dataset/                     分发 parquet 目录（仅 --mode=dataset）
>   <DIR>/ziwei.duckdb.dict.jsonl      行字典副本（见 dictPathFor）
>   <DIR>/ziwei.duckdb.progress.json   构建进度（断点续跑）
>
> 路径参数契约（与 cli/host/out.ts 的 --out 同款）：拒收含 `..` 段的**原始**路径，
> 绝对路径与子目录不受影响，相对位置的跳转一律用绝对路径表达。校验必须写在
> 各自函数体内（内联 if-throw），抽公共函数则调用方视图中断不了污点流。

## 三、`db.ts`：读侧形态判定（⚠️ 顺序不能反）

> 顺序不能反。dataset 形态下视图与宏都是**每次查询时**按当次 --out 现建的，路径永远指向
> 本次目录；而库在 dataset 形态下只是构建载体——库内 topics 视图把构建时的绝对路径烧死
> 在定义里（搬到别处就查不了，原目录还在时更会静默读旧数据），且库里根本没有
> search_topic 宏。所以「库在就用库」会让本地 build:db --mode=dataset 之后这一最常见
> 状态既查不到 search_topic，又在搬运产物目录后读到旧数据。
>
> inline 形态不产 dataset/，仍然走库——本顺序对它没有影响。

## 四、`sample-id.ts`：SQL 侧样本 id 公式（⚠️ 三个实测陷阱）

> ⚠️ 源字段名是 `hour`（ziwei-interp 分片的导出口径），**语义是时辰索引 0–11**、
>    不是钟点 —— 曾误改成本仓内部命名 timeIndex，导致 read_json 永远取 NULL、
>    palaces.sample_id 全数违约。
>
> ⚠️ day 容器必须与日历口径配套：solar（真实公历）若用 30 容器，31 日会与次月 1 号
>    撞 id（(m-1)*30+30 = m*30+0）。
>
> 必须把 year 显式转 BIGINT：read_json 的 columns 把 year/month/day/hour 声明为 SMALLINT，
> 而 DuckDB 会把「能容纳于 SMALLINT 的字面量」下推为 SMALLINT，使整式在 INT16 内求值 ——
> 真实数据上必然 "Overflow in multiplication of INT16"。
> 一旦首项为 BIGINT，其后各级运算随之提升（solar 最大 686,880 亦无碍）。

## 五、`verify-duckdb.ts`：第 3 层文本逐字节对账

> 比对用 FULL OUTER JOIN + IS DISTINCT FROM，不用 EXCEPT（实测）：
> 两个含 unnest 的**视图**做 EXCEPT，即使只取 6,000 个样本、只比 2 个主题列，
> 在 4GB 内存上限下也直接 OOM；把四个 EXCEPT 计数写成同一个 SELECT 的四个兄弟标量子
> 查询同样 OOM。EXCEPT 两侧必须是已物化且行数已被分块限住的临时表才可行，
> 而一旦两侧都是临时表，FULL OUTER JOIN 就是更省的选择：实测 2,160 样本 / 28,080 行
> 上 2ms 完成，且能同时报告「仅源有」「仅库有」与「哈希不同」三种差异。
>
> 源侧取构建时的输入 .jsonl.gz——源文件是构建真正读入的原始数据，比库侧视图更强。
> 源侧必须是单次扫描 + 对齐 unnest：13 路 UNION ALL
> 在同规模下直接 OOM（实测 3 分片 / 2GB）。
>
> 分块按「库里实际有哪些月份」推导，故范围构建（--from-year/--to-year）也能正确对账，
> 不会把库里没有的月份算成差异。实测 3 分片 / 2,160 样本 / 28,080 行：232ms 通过，
> 差异 0；12 分片 / 8,640 样本在 2GB 下 OOM。块的约束来自文本总量而非样本数。
