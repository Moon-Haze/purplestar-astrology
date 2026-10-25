# Tasks

## 1. 基线

- [x] 1.1 四域典型查询输出落盘作基线：`node scripts/purple-star.ts knowledge --search 紫微`、`--source stars --search 紫微`、`--source tianji --search 紫微`、`--source oracle --topic career --star 七杀` 各重定向到 `/tmp/kq-before-*.txt`。判据：四份文件存在且非空

## 2. 类型与解码层

- [x] 2.1 在 `scripts/knowledge/types.ts` 定义 `KnowledgeQuery`（`term?: string` / `limit: number` / `book?: string` / `topic?: string` / `star?: string` / `positional: string[]`），`KnowledgeSource.search` 签名改为 `search(query: KnowledgeQuery)`，删 `import type { CliArgs }`。判据：`npm run typecheck` 报出四源与入口的类型错误（消费方未改前必然报错，证明新类型可被引用）

- [x] 2.2 在 `scripts/cli/knowledge/index.ts` 把 `assertKnowledgeArgs` 升级为 `decodeKnowledgeQuery(args, source): KnowledgeQuery`：保留 `--search`/`--limit` 校验，新增解码（`String`/`Number` 收窄、默认 limit 15），并上收 `--book`/`--topic` 裸开关守卫（报错文案骨架不变）。判据：`npm run typecheck` 零错（此时四源与入口已同步改）

## 3. 四源签名收窄

- [x] 3.1 books/stars/tianji/oracle 四个 `search` 改收 `KnowledgeQuery`，删 `import type { CliArgs }` 与 `typeof x === "boolean"` + `String(x)` 防御收窄；位置参数改读 `query.positional`（oracle 的 `positional[0]`/`positional[1]` 语义不变）。判据：`grep -rn "@/cli/args" scripts/knowledge/` 零命中；`npm run typecheck` 零错

- [x] 3.2 复核 `--book`/`--topic` 报错仍走 throw：`node scripts/purple-star.ts knowledge --source tianji --book` 与 `--source oracle --topic` 退出码非零、报错到 stderr。判据：两条命令退出码非零（直接取命令退出码，不接管道）

## 4. 验证

- [x] 4.1 四域输出逐字节对拍基线：重跑 1.1 的四条命令到 `/tmp/kq-after-*.txt`，`diff` 四份均空。判据：`diff` 无输出、退出码 0

- [x] 4.2 五闸门：`npm run typecheck`（0 错）、`node scripts/purple-star.ts selftest`（全绿）、`npm test`（全绿）、`npm run lint`、`npm run format`（干净）。判据：各命令退出码 0、无报错
