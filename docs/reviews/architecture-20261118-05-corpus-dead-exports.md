# 候选 5 · corpus 公开面三个零消费导出（2026-11-18 第五轮）

**档位**：Strong（小而确定的纯减法）｜ **分层**：corpus 知识内容层 ｜ **规范面**：无需 openspec change（corpus 不在冻结契约面，纯减法）｜ **与已定决策冲突**：0

## 涉及文件

| 位置                            | 角色                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/corpus/index.ts:44-46` | `getBookBySlug`（唯一 caller 是文件内 `getChapter`）                                                                             |
| `scripts/corpus/index.ts:55-65` | `getChapter`（全仓零外部消费）                                                                                                   |
| `scripts/corpus/index.ts:76-87` | `getParagraphById`（全仓零外部消费）                                                                                             |
| `scripts/corpus/index.ts:4`     | 头注「提供按 slug / 章节序号 / 段落 id 取用与全文检索两组 API」                                                                  |
| `scripts/corpus/index.ts:110`   | `searchClassics`——真正活的公开面（消费点：`cli/commands/report.ts`、`knowledge/sources/books.ts`、`corpus/selftest-asserts.ts`） |

## 问题（file:line 实据）

三个按 slug / 章节下标 / 段落 id 直查的导出函数全仓**零运行时消费**（codegraph blast radius 证实：`getBookBySlug` 仅 1 个 caller 且是文件内 `getChapter`；后两者零 caller）。历史上它们服务断语手册时代的直出链与建库——手册退役（12a3e4d）后成了悬空的公开面：interface 承诺三种寻址语义与各自的越界 `null` 行为（docstring 写得清清楚楚），却没有任何实现面消费者在背书。

## 为什么是摩擦（词汇口径）

`corpus/index.ts` 是 corpus 域对外的 interface 单点；interface 里每多一个成员，读者就要多懂一条「这条什么时候用」——三个死成员让「古籍取用」的 interface 复杂度高于它的实际行为（shallow 面）。删掉后公开面收敛到「实际被用的一种」（`ALL_BOOKS` / `TOTAL_PARAGRAPHS` / `searchClassics`），interface 与行为重新对齐——这是典型的删接口即深化。

## 方案方向

1. 删 `getBookBySlug` / `getChapter` / `getParagraphById` 三个导出及各自 docstring。
2. 头注 `:4` 改为实态：「提供全文检索与书目/段落统计」。
3. `docs/code/corpus.md` 若列了这三个入口，同步收敛（改模块设计先改文档纪律）。

## deletion test

教科书式的「删掉即深化」：没有任何调用方需要重写逻辑、没有任何测试锚在这三个函数上（blast radius + `grep` 双证）；删的是 interface 承诺，不是实现——复杂度**湮灭**而非转移。

## Before / After

```text
Before: interface 承诺 4 组取用，1 组活着        After: interface ≡ 行为
corpus/index.ts                                  corpus/index.ts
├─ ALL_BOOKS          （活）                     ├─ ALL_BOOKS          （活）
├─ TOTAL_PARAGRAPHS   （活）                     ├─ TOTAL_PARAGRAPHS   （活）
├─ searchClassics     （活，6 callers）          ├─ searchClassics     （活，6 callers）
├─ getBookBySlug      （死，内部互引）           └─ （三寻址 API 删除）
├─ getChapter         （死）
└─ getParagraphById   （死）
```

## 验收

- typecheck 0 错误（零消费由编译器兜底确认：删导出后若有隐性消费会立刻爆）。
- selftest 古籍段与 `npm test` 全绿；`knowledge --source books --search 紫微` 行为不变。
- `git grep -n "getBookBySlug\|getChapter\|getParagraphById"` 归零（docs/ 同步收敛后）。

## 落地注意

- 与候选 2 的存量清理同日可做，但独立成 change 不必要——这是纯减法，直接提交，commit message 注明「断语手册时代直出链退役余波」。
- 不要顺手把 `escapeHtml` 也动了（它是 `searchClassics` 的活实现零件）；本候选只动公开面。
