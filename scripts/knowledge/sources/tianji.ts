/**
 * knowledge 的 **tianji 域**：天纪判语检索（实现即插件：渲染逻辑与注册形态同址，无转发壳）。
 *
 * 数据（`corpus/data/tianji.ts`，全量快照——条数以自报 importedCount 为准）在 `search`
 * 体内动态 import 懒加载，
 * 本模块被 registry 静态 import 也不把语料拉进 CLI 主链路。`--search` 三态与 `--limit`
 * 校验由命令入口守卫单点承担（`cli/knowledge/index.ts`）。
 *
 * 每条判语带 `[part §section @时:分:秒]` 溯源与 B 站回放直链；语料 CC BY-NC-SA 4.0
 * （见 docs/code/cli-commands.md）。
 *
 * @file knowledge 的 **tianji 域**：天纪判语检索（实现即插件：渲染逻辑与注册形态同址，无转发壳）
 */

import type { KnowledgeQuery, KnowledgeSource } from "../types";
// 册名映射是展示层手写单点（穷尽性由 Record<TianjiBook, …> 对生成物联合类型执行）；
// TianjiBook 是 type-only 引用，运行时擦除，不把重语料拉进主链路。
import { TIANJI_BOOK_NAMES } from "@/corpus/data/tianji-books";
import type { TianjiBook } from "@/corpus/data/tianji";

/** 天纪域尾注：来源声明与口径提示。 */
const TIANJI_FOOTER = [
	"─".repeat(56),
	"⚠️ 知识来源：nihai-tianji-corpus（倪海厦《天纪》结构化语料库，CC BY-NC-SA 4.0）——倪师原话短引文，",
	"   可回放验证；引用下断语时注明出处与口径，商业用途受 NC 条款约束。",
];

/** 册代号 → 展示名；用户手输的未知代号原样回落——语义回落而非键域 miss（已知册码经穷尽性 Record 不可能 miss）。 */
const bookLabel = (code: string): string =>
	code in TIANJI_BOOK_NAMES ? TIANJI_BOOK_NAMES[code as TianjiBook] : code;

/** tianji 域：无关键词列五册概览，有关键词逐条引文 + 溯源 + 回放直链。 */
export const tianjiSource: KnowledgeSource = {
	id: "tianji",
	label: "天纪判语",
	/** 检索天纪判语；重语料按需懒加载。 */
	async search(query: KnowledgeQuery): Promise<string> {
		const q = query.term ?? query.positional.join(" ");
		const limit = Math.floor(query.limit);

		// 限册：接受册代号（01-stars）或中文名（主星）。裸开关已在入口 throw，这里直接读 string。
		const bookStr = query.book ?? "";
		const bookNorm = bookStr
			? ((Object.keys(TIANJI_BOOK_NAMES) as TianjiBook[]).find(
					k => k === bookStr || TIANJI_BOOK_NAMES[k] === bookStr
				) ?? bookStr)
			: null;

		const { TIANJI_ENTRIES, TIANJI_SOURCE, replayUrl } = await import("@/corpus/data/tianji");

		// 无检索词：列五册概览
		if (!q) {
			const byBook = new Map<string, number>();
			for (const e of TIANJI_ENTRIES) {
				byBook.set(e.book, (byBook.get(e.book) ?? 0) + 1);
			}
			return [
				"天纪判语库（倪海厦《天纪》原话 + 秒级回放溯源）：",
				...[...byBook.entries()].map(
					([b, n]) => `  ${b.padEnd(12)} ${bookLabel(b)}：${n} 条`
				),
				"",
				"用法：knowledge --source tianji <关键词> [--book 册名] [--limit N]",
				`来源：${TIANJI_SOURCE.project}（${TIANJI_SOURCE.license}）`,
			].join("\n");
		}

		const hits = TIANJI_ENTRIES.filter(
			e =>
				(!bookNorm || e.book === bookNorm) &&
				(e.quote.includes(q) || e.h2.includes(q) || e.h3.includes(q))
		);
		if (hits.length === 0) {
			const scope = bookNorm ? `「${bookLabel(bookNorm)}」册` : "紫微五册";
			return `天纪判语中未找到「${q}」（${scope}）。`;
		}
		const shown = hits.slice(0, limit);
		const out: string[] = [
			`天纪判语检索「${q}」：${hits.length} 条命中${bookNorm ? `（限 ${bookLabel(bookNorm)} 册）` : ""}`,
			"",
		];
		for (const e of shown) {
			const sub = [e.h2, e.h3].filter(Boolean).join("·");
			out.push(
				`「${e.quote}」`,
				`  —— 《天纪·${bookLabel(e.book)}${sub ? "·" + sub : ""}`,
				`     [p${e.part} §${e.section} @${e.t_hms}] ${replayUrl(e)}`,
				""
			);
		}
		if (hits.length > shown.length) {
			out.push(`（仅显示前 ${shown.length} 条，--limit 可调）`, "");
		}
		out.push(...TIANJI_FOOTER);
		return out.join("\n");
	},
};

// 三域的「实现即插件」形态与懒加载纪律见 docs/code/knowledge.md。
