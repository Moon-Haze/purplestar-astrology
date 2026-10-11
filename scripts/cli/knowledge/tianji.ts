/**
 * classics 的 **tianji 域**：天纪判语检索。
 *
 * 由 `knowledge --source tianji` 进入。数据（`corpus/tianji/entries.ts`，392KB、1125 条）
 * 在函数体内动态 import 懒加载 —— 本模块被 classics.ts 静态 import，不能让 CLI 主链路
 * 吃这份语料。
 *
 * 每条判语带 [part §section @时:分:秒] 溯源与 B 站回放直链；语料 CC BY-NC-SA 4.0。
 */

import type { CliArgs } from "../args";

/** 册代号 → 中文名（语料库原生编号）。 */
const TIANJI_BOOK_NAMES: Record<string, string> = {
	"01-stars": "主星",
	"02-palaces": "十二宫",
	"03-patterns": "格局",
	"04-sihua": "四化",
	"05-illness": "疾厄",
};

/** 天纪域尾注：来源声明与口径提示。 */
const TIANJI_FOOTER = [
	"─".repeat(56),
	"⚠️ 知识来源：nihai-tianji-corpus（倪海厦《天纪》结构化语料库，CC BY-NC-SA 4.0）——倪师原话短引文，",
	"   可回放验证；引用下断语时注明出处与口径，商业用途受 NC 条款约束。",
];

/** 渲染 tianji 域：无关键词列五册概览，有关键词逐条引文 + 溯源 + 回放直链。 */
export async function renderTianji(args: CliArgs): Promise<string> {
	if (typeof args.search === "boolean")
		throw new Error(
			"--search 需要一个检索词（如 --search 半空折翅），也可直接写位置参数：classics --source tianji 半空折翅。"
		);
	if (typeof args.limit === "boolean")
		throw new Error("--limit 需要一个正整数（如 --limit 5）。");
	const q = String(args.search ?? args._.join(" ") ?? "");
	const limitRaw = Number(args.limit ?? 15);
	if (Number.isNaN(limitRaw) || limitRaw < 1)
		throw new Error(`--limit 应为正整数，收到：${String(args.limit)}`);
	const limit = Math.floor(limitRaw);

	// 限册：接受册代号（01-stars）或中文名（主星）。args.book 是 string | boolean | string[]
	//（索引签名），String() 先收窄成 string 再比对。
	const bookArg = args.book;
	if (typeof bookArg === "boolean")
		throw new Error("--book 需要一个册名（如 --book 01-stars）。");
	const bookStr = bookArg === undefined ? "" : String(bookArg);
	const bookNorm = bookStr
		? (Object.keys(TIANJI_BOOK_NAMES).find(
				k => k === bookStr || TIANJI_BOOK_NAMES[k] === bookStr
			) ?? bookStr)
		: null;

	const { TIANJI_ENTRIES, TIANJI_SOURCE, replayUrl } = await import("@/corpus/tianji/entries");

	// 无检索词：列五册概览
	if (!q) {
		const byBook = new Map<string, number>();
		for (const e of TIANJI_ENTRIES) byBook.set(e.book, (byBook.get(e.book) ?? 0) + 1);
		return [
			"天纪判语库（倪海厦《天纪》原话 + 秒级回放溯源）：",
			...[...byBook.entries()].map(
				([b, n]) => `  ${b.padEnd(12)} ${TIANJI_BOOK_NAMES[b] ?? b}：${n} 条`
			),
			"",
			"用法：classics --source tianji <关键词> [--book 册名] [--limit N]",
			`来源：${TIANJI_SOURCE.project}（${TIANJI_SOURCE.license}）`,
		].join("\n");
	}

	const hits = TIANJI_ENTRIES.filter(
		e =>
			(!bookNorm || e.book === bookNorm) &&
			(e.quote.includes(q) || e.h2.includes(q) || e.h3.includes(q))
	);
	if (hits.length === 0) {
		const scope = bookNorm ? `「${TIANJI_BOOK_NAMES[bookNorm] ?? bookNorm}」册` : "紫微五册";
		return `天纪判语中未找到「${q}」（${scope}）。`;
	}
	const shown = hits.slice(0, limit);
	const out: string[] = [
		`天纪判语检索「${q}」：${hits.length} 条命中${bookNorm ? `（限 ${TIANJI_BOOK_NAMES[bookNorm] ?? bookNorm} 册）` : ""}`,
		"",
	];
	for (const e of shown) {
		const sub = [e.h2, e.h3].filter(Boolean).join("·");
		out.push(
			`「${e.quote}」`,
			`  —— 《天纪·${TIANJI_BOOK_NAMES[e.book] ?? e.book}${sub ? "·" + sub : ""}`,
			`     [p${e.part} §${e.section} @${e.t_hms}] ${replayUrl(e)}`,
			""
		);
	}
	if (hits.length > shown.length) out.push(`（仅显示前 ${shown.length} 条，--limit 可调）`, "");
	out.push(...TIANJI_FOOTER);
	return out.join("\n");
}
