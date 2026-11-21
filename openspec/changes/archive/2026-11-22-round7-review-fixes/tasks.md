# Tasks

## 1. S1：数据链指引按实况改写

- [x] 1.1 `test/lib/sample-source.ts` missingDbHint：samples-out 段（5.5GB / 60 目录 / 1924-1983）改指 `db/tar-shards`（78 目录 1950-2026）+ `tools/db/build-duckdb.ts`（v4 管线）；体积数字按实测更正
- [x] 1.2 `test/tools/build-fixtures.ts` manifest source 字段改血统谱系（生成器改，产物重导随建）
- [x] 1.3 `test/README.md` 三载体表改现行谱系（tar-shards → duckdb → dataset；samples-out 移作历史注记）

## 2. S2：引文精度

- [x] 2.1 `views/health.ts:122` 煞星警示改引天纪 07 逐字引文（「流年逢到这两颗星，身体病灾就来了」，擎羊陀罗语境），集数声明更正；grades 对拍 views 盲区以注释留档
- [x] 2.2 grades.ts 的 `开刀见血光` 条目注释补盲区说明（该条目锚 data.ts 文案；views 渲染面引语不在对拍面）

## 3. W 批（注释级）

- [x] 3.1 health.ts 头注：删过时「一源双投影」、slot 计数改列举
- [x] 3.2 types.ts 星曜类型 JSDoc：sha/lucky → tough/soft 对齐联合类型
- [x] 3.3 brightness-census.ts 自述随 v4 更新（头注 + :168 + :171）
- [x] 3.4 run.ts 消费 manifest.baselineEngine（:114 与 :127 两处手抄删除）
- [x] 3.5 worstPalaces 注释补「主星杀星不计」取舍
- [x] 3.6 json-contract.test.ts:39 孤儿注释删除

## 4. 验收

- [x] 4.1 typecheck 0 错误 / selftest 全绿 / npm test 全绿 / eslint-prettier 过
- [x] 4.2 引文守卫与 grades 对拍不受影响（歌诀登记面原样）
- [x] 4.3 `openspec validate --all` 通过、零警告
