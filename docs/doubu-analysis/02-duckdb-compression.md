# 02 · DuckDB 数据库分析与压缩分发方案

**日期：** 2026-09-25
**分析对象：** `db/ziwei.duckdb`（约 1.76GB）
**目标：** 分析数据库用途，并给出压缩、随 GitHub / skill 分发的可行方案

---

## 一、数据库是什么

这是**排盘基准语料的 DuckDB 化载体**。原始语料是 `reference/ziwei-samples-toolkit/samples-out/`（5.5GB / 720 个 `jsonl.gz` 分片，60 年 × 12 月 × 30 日 × 12 时辰 × 2 性别 = 518,400 条），整库导入成 `db/ziwei.duckdb`，实测 **1,760,047,104 字节（1.76GB）**。DuckDB 已把 5.5GB → 1.76GB（列式存储 + 自带压缩）。

### 表结构（已核实）

| 表                                      | 行数                         | 用途                             | 项目是否用     |
| --------------------------------------- | ---------------------------- | -------------------------------- | -------------- |
| `samples`                               | 518,400                      | 出生信息 + 农历 + 盘级标量       | ✅ 基准工具主表 |
| `palaces`                               | 6,220,800                    | 每样本 12 行：宫位 + 星曜 + 大限 | ✅              |
| `topics` / `topic_dict` / `topic_lines` | 518,400 / 21,435 / 6,739,200 | 13 主题论断文本                  | ❌ 全仓无人使用 |

**关键发现：约 90% 体积来自三张 `topics` 论断文本表，而测试工具一行都不用。**

## 二、必须认清的硬约束

1. **GitHub 单文件硬上限 100MB** —— 超过的文件 push 直接被拒。1.76G 无论怎么压，DuckDB 单文件都进不了仓库。
2. **Git LFS 免费额度**：1GB 存储 + 1GB/月带宽，1.76G 连存储配额都超，**不可行**。
3. **GitHub Releases 无单文件 100MB 限制**（单 asset 上限 2GB，免费）—— 分发大文件的官方正路。
4. **skill 是代码分发形态**：装带 1.7G 二进制数据库的 skill 是错误方向。项目已想清楚：`npm test` 只用 300 条 fixtures（1.6MB），数据库只在手动全量核验时用。

## 三、压缩方案（按效果排序）

### 方案 1（效果最大）：剔除 3 张无人用的 topics 表

重建数据库时只导 `samples` + `palaces`。去掉 90% 论断文本后，**1.76G → 估算约 150–300MB**，纯收益。

### 方案 2（DuckDB 原生压缩）：ENUM + 排序 + CHECKPOINT

把 `palace_name`（12 值）、`gender`（2 值）、`brightness`、星名等低基数字符串转成 **ENUM**（存字典码），按 `year`/`gender` 重排序提高压缩率，最后 `CHECKPOINT`/`VACUUM` 回收空间。通常还能再砍 30–50%。

### 方案 3（推荐分发载体）：导出 Parquet（zstd）

Parquet 本身列式 + 压缩，DuckDB 可直接 `read_parquet()` 查询、无需导入：

```sql
COPY (SELECT ... FROM samples JOIN palaces)
  TO 'db/ziwei.parquet.zst' (FORMAT parquet, COMPRESSION zstd);
```

估算可压进 **100–250MB**。

### 方案 4：按年份分片突破 100MB 限制

把 parquet 按 `year` 切成 60 个文件（每片 1.7–4MB），每个都远小于 100MB，可像普通文件一样 commit，用户按需 glob 拉取。

## 四、分发的两条现实路径

### **路径 A（推荐）：GitHub Releases + skill 内置下载脚本**

- 压缩后的单文件（parquet.zst，约 100–250MB）作为 Release asset 上传（免费、无 100MB 限制）。
- skill 提供 `download-corpus` 命令，首次用时下载 + 缓存到本地 `db/`。
- 仓库本体保持干净，`npm test` 不依赖它。

### **路径 B：压到很小（<100–200MB）后直接入库**

- 方案 4 的按年分片 parquet 可直接 commit，clone 即得，无需 LFS 和下载步骤。仅在做完全套压缩后现实。

## 五、结论

| 问题                        | 结论                                                                        |
| --------------------------- | --------------------------------------------------------------------------- |
| 1.76G 直接放 GitHub/skill？ | **不能**，100MB 硬限 + LFS 配额都不够                                       |
| 最该先做什么？              | **删掉无人用的 topics 三张表**，立省 ~90%，约 150–300MB                     |
| 之后怎么再压？              | ENUM + 重排序 + CHECKPOINT，导出 zstd Parquet                               |
| 最终怎么分发？              | **GitHub Releases 传 asset + skill 内置下载脚本**；或压到很小后按年分片入库 |
| skill 要不要带它？          | **不要**，fixtures 已够 `npm test`，保持 gitignore、文档指引重建即可        |
