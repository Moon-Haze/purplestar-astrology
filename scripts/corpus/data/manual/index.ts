/**
 * 断语手册库的查询入口 —— 按主题懒加载（`node:sqlite` 只读 + 参数绑定）。
 *
 * 数据住**生成库** `oracle.db`（同目录，由 `npx tsx tools/db/export-manual.ts db` 从样本库
 * 物化，字节可复现，`npm run manual:check` 对拍）：断语修订链 = 改内核 `scripts/analysis/`
 * → `npm run build:db` → 重建库。库缺失时报错指路，不静默兜底。
 *
 * 模块体只声明查询（不开库、不读库），检索时才打开连接 —— 重数据懒加载纪律
 * （oracle 域在 `search` 体内才经本入口触库）。
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import type { TopicKey } from "../../../analysis/data";
import { TOPIC_CONTENT_SOURCE } from "../../../analysis/data";
import type { OracleStar, SanFangEntry, SihuaEntry } from "./types.ts";

export type { OracleStar, SanFangEntry, SihuaEntry } from "./types.ts";
/** 一个主题的断语全集：主星 → 分类断语集（mods/summary/patterns/mainPalace/sanFang/…）。 */
export type StarTopicOracle = Readonly<Record<string, OracleStar>>;

// 库定位：本文件在 <内核根>/corpus/data/manual/ 下，固定上溯三层到内核根（scripts/）。
// pack 不拍平 scripts/（分发纪律），本目录与内核根的相对层级即产物契约；ZIWEI_ROOT 覆盖
// 语义与 boot-hooks 的 pickRoot 对齐（内核根 = ZIWEI_ROOT ?? 脚本所在目录上溯）。
// 不上溯到仓库根 —— 仓库根相对 scripts/ 的层数不在包契约内。
const DB_PATH = (() => {
	const here = dirname(fileURLToPath(import.meta.url)); // <内核根>/corpus/data/manual
	const kernelRoot = process.env.ZIWEI_ROOT ?? resolve(here, "..", "..", "..");
	return join(kernelRoot, "corpus", "data", "manual", "oracle.db");
})();

let cachedDb: DatabaseSync | null = null;

/** 只读打开断语手册库（模块级单例）。库缺失抛带重建指引的错误 —— 报错不兜底。 */
function openDb(): DatabaseSync {
	if (cachedDb === null) {
		if (!existsSync(DB_PATH)) {
			throw new Error(
				`断语手册库不存在（${DB_PATH}）。先 npx tsx tools/db/export-manual.ts db（前置：npm run build:db）。`
			);
		}
		cachedDb = new DatabaseSync(DB_PATH, { readOnly: true });
	}
	return cachedDb;
}

/**
 * lines 的 section 值域 —— 与建库端（`tools/db/export-manual.ts` 的 `SECTION`）是同一份
 * 约定的两处声明：固定槽裸名；开放集（三方四正宫名、主题专属节名）前缀编码，节名是
 * 行数据的一部分而非表结构。组装端按固定前缀 `slice` 截取，节名含冒号不破坏解析。
 */
const SECTION = {
	mods: "mods",
	summary: "summary",
	mainPalaceStars: "main_palace_stars",
	mainPalace: "main_palace",
	sanFangStars: "san_fang_stars:",
	sanFang: "san_fang:",
	kuiYue: "kui_yue",
	extra: "extra:",
	other: "other",
} as const;

/** 新建一个空分类断语集（字段序即渲染序，与 OracleStar 契约一致）。 */
function freshStar(): OracleStar {
	return {
		mods: [],
		summary: [],
		patterns: [],
		mainPalace: { stars: [], content: [] },
		sanFang: [],
		sihua: [],
		kuiYue: [],
		extras: {},
		other: [],
	};
}

/**
 * 加载一个主题的断语全集：库内行流按组装序重建 `OracleStar`。
 *
 * 行流的 `ord` 单点承载组装序（字段序与 sanFang 宫序，宫序 = 该宫首行的 ord），
 * `ORDER BY star_id, ord` 即分类器写入序，重建无须额外约定。全部查询经 `?` 参数绑定，
 * 主题 key 来自 `TOPIC_CONTENT_SOURCE` 映射而非 CLI 原始输入，无注入面。
 *
 * `study` 是 `career` 的别名视图（`TOPIC_CONTENT_SOURCE`）：库内不携带别名主题的重复
 * 数据，查询即映射到内容源主题。
 */
export async function loadTopicOracle(topic: TopicKey): Promise<StarTopicOracle> {
	const db = openDb();
	const source = TOPIC_CONTENT_SOURCE[topic];
	const topicRow = db.prepare("SELECT id FROM topics WHERE key = ?").get(source) as
		| { id: number }
		| undefined;
	if (topicRow === undefined) {
		throw new Error(
			`断语手册库无「${source}」主题 —— 库与代码的 TOPIC_CONTENT_SOURCE 漂移，重建库。`
		);
	}

	// 行流（组装序）+ 节名 + 行文本：JOIN 一次取全。行数与 TS 数据形态的内存量级相同，
	// 懒加载纪律由「search 体内才触库」承载，不在本函数做分页。
	const lineRows = db
		.prepare(
			`SELECT s.name AS star, sc.name AS section, t.body
			 FROM lines l
			 JOIN stars s ON s.id = l.star_id
			 JOIN sections sc ON sc.id = l.section_id
			 JOIN texts t ON t.id = l.text_id
			 WHERE l.topic_id = ?
			 ORDER BY l.star_id, l.ord`
		)
		.all(topicRow.id) as Array<{ star: string; section: string; body: string }>;

	const patternRows = db
		.prepare(
			`SELECT s.name AS star, p.name, t.body
			 FROM patterns p
			 JOIN stars s ON s.id = p.star_id
			 JOIN texts t ON t.id = p.text_id
			 WHERE p.topic_id = ?
			 ORDER BY p.star_id, p.ord`
		)
		.all(topicRow.id) as Array<{ star: string; name: string; body: string }>;

	const sihuaRows = db
		.prepare(
			`SELECT s.name AS star, t.body AS text, n.body AS note
			 FROM sihua h
			 JOIN stars s ON s.id = h.star_id
			 JOIN texts t ON t.id = h.text_id
			 LEFT JOIN texts n ON n.id = h.note_id
			 WHERE h.topic_id = ?
			 ORDER BY h.star_id, h.ord`
		)
		.all(topicRow.id) as Array<{ star: string; text: string; note: string | null }>;

	const oracle: Record<string, OracleStar> = {};
	const starOf = (name: string): OracleStar => {
		const found = oracle[name];
		if (found !== undefined) {
			return found;
		}
		const fresh = freshStar();
		oracle[name] = fresh;
		return fresh;
	};
	/** star → palace → entry（Map 保首现序：行流首行触发 set，宫序由 ord 顺序自然形成） */
	const sanFangByStar = new Map<string, Map<string, SanFangEntry>>();
	const sanFangEntry = (star: string, palace: string): SanFangEntry => {
		let byPalace = sanFangByStar.get(star);
		if (byPalace === undefined) {
			byPalace = new Map();
			sanFangByStar.set(star, byPalace);
		}
		const found = byPalace.get(palace);
		if (found !== undefined) {
			return found;
		}
		const fresh: SanFangEntry = { palace, stars: [], items: [] };
		byPalace.set(palace, fresh);
		return fresh;
	};

	for (const r of lineRows) {
		const o = starOf(r.star);
		if (r.section === SECTION.mods) {
			o.mods.push(r.body);
		} else if (r.section === SECTION.summary) {
			o.summary.push(r.body);
		} else if (r.section === SECTION.mainPalaceStars) {
			o.mainPalace.stars.push(r.body);
		} else if (r.section === SECTION.mainPalace) {
			o.mainPalace.content.push(r.body);
		} else if (r.section.startsWith(SECTION.sanFangStars)) {
			sanFangEntry(r.star, r.section.slice(SECTION.sanFangStars.length)).stars.push(r.body);
		} else if (r.section.startsWith(SECTION.sanFang)) {
			sanFangEntry(r.star, r.section.slice(SECTION.sanFang.length)).items.push(r.body);
		} else if (r.section === SECTION.kuiYue) {
			o.kuiYue.push(r.body);
		} else if (r.section.startsWith(SECTION.extra)) {
			const name = r.section.slice(SECTION.extra.length);
			const bucket = o.extras[name];
			if (bucket === undefined) {
				o.extras[name] = [r.body];
			} else {
				bucket.push(r.body);
			}
		} else {
			o.other.push(r.body);
		}
	}
	for (const [star, byPalace] of sanFangByStar) {
		oracle[star].sanFang = [...byPalace.values()];
	}
	for (const r of patternRows) {
		starOf(r.star).patterns.push({ name: r.name, text: r.body });
	}
	for (const r of sihuaRows) {
		const entry: SihuaEntry = { text: r.text };
		if (r.note !== null) {
			entry.note = r.note;
		}
		starOf(r.star).sihua.push(entry);
	}
	return oracle;
}
