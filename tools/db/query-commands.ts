// 封装子命令的查询与输出（tools/db）：每个子命令一条固定 SQL + 具名参数绑定，
// 输入不进 SQL；行集统一走 getRowObjectsJS（list/struct 已转纯 JS 值）。
import type { DuckDBConnection } from "@duckdb/node-api";
import { STORAGE_TOPIC_KEYS, TOPIC_LABEL, type TopicKey } from "../../scripts/analysis/data";
import { dispWidth, jsonReplacer, renderTable } from "./render";
import { GAN, ZHI, SAMPLE_LABELS, dash, formatSampleValue, sihuaCell, starList } from "./format";
import { SEARCH_MAX_LIMIT, type ParsedArgs } from "./query-args";

async function rowsOf(conn: DuckDBConnection, sql: string, params: Record<string, unknown>) {
	const result = await conn.run(sql, params as Record<string, never>);
	return (await result.getRowObjectsJS()) as Array<Record<string, unknown>>;
}

async function runSample(conn: DuckDBConnection, id: number, json: boolean): Promise<void> {
	const rows = await rowsOf(conn, "SELECT * FROM samples WHERE sample_id = $id", { id });
	if (rows.length === 0) {
		throw new Error(`样本 ${id} 不存在`);
	}
	if (json) {
		console.log(JSON.stringify(rows[0], jsonReplacer));
		return;
	}
	const line = Object.entries(SAMPLE_LABELS).map(([key, label]) => ({
		字段: label,
		值: formatSampleValue(key, rows[0][key]),
	}));
	console.log(renderTable(["字段", "值"], line));
}

async function runPalaces(conn: DuckDBConnection, id: number, json: boolean): Promise<void> {
	const rows = await rowsOf(conn, "SELECT * FROM palaces WHERE sample_id = $id ORDER BY branch", {
		id,
	});
	if (rows.length === 0) {
		throw new Error(`样本 ${id} 不存在（palaces 无宫位行）`);
	}
	if (json) {
		console.log(JSON.stringify(rows, jsonReplacer));
		return;
	}
	const table = rows.map(r => {
		const marks: string[] = [];
		if (r.is_shen_gong === true) {
			marks.push("身宫");
		}
		if (r.is_current_daxian === true) {
			marks.push("当前大限");
		}
		return {
			宫位: String(r.palace_name),
			干支:
				`${dash(r.stem) === "—" ? "—" : (GAN[Number(r.stem)] ?? "?")}` +
				`${dash(r.branch) === "—" ? "—" : (ZHI[Number(r.branch)] ?? "?")}`,
			主星: starList(r.major_stars, r.major_brightness),
			吉星: starList(r.lucky_stars),
			煞星: starList(r.sha_stars),
			四化: sihuaCell(r.sihua_flags, r.sihua_stars),
			大限:
				r.daxian_start === null || r.daxian_end === null
					? "—"
					: `${r.daxian_start}-${r.daxian_end}`,
			标记: marks.length > 0 ? marks.join("·") : "—",
		};
	});
	console.log(renderTable(Object.keys(table[0]!), table));
}

async function runTopic(
	conn: DuckDBConnection,
	id: number,
	keys: string[],
	json: boolean
): Promise<void> {
	// SQL 侧固定 SELECT *：主题列由展示层按（已过白名单的）keys 过滤，输入不进 SQL。
	const rows = await rowsOf(conn, "SELECT * FROM topics WHERE sample_id = $id", { id });
	if (rows.length === 0) {
		throw new Error(`样本 ${id} 不存在`);
	}
	const row = rows[0];
	const selected = keys.length > 0 ? keys : [...STORAGE_TOPIC_KEYS];
	if (json) {
		const out: Record<string, unknown> = { sample_id: Number(row.sample_id) };
		for (const k of selected) {
			out[k] = row[k] ?? null;
		}
		console.log(JSON.stringify(out, jsonReplacer));
		return;
	}
	for (const k of selected) {
		const label = TOPIC_LABEL[k as TopicKey];
		const head = `── ${k}（${label}）`;
		console.log(head + "─".repeat(Math.max(2, 46 - dispWidth(head))));
		const text = row[k];
		console.log(typeof text === "string" && text.length > 0 ? text : "（无文本）");
		console.log("");
	}
}

async function runSearch(
	conn: DuckDBConnection,
	topic: string,
	pattern: string,
	limit: number,
	json: boolean
): Promise<void> {
	// 两次查询都走同一个宏 + 绑定参数：计数给总数，分页控制输出量。
	const params = { topic, pattern };
	const countRows = await rowsOf(
		conn,
		"SELECT count(*) AS n FROM search_topic($topic, $pattern)",
		params
	);
	const total = Number(countRows[0]!.n);
	const pageRows = await rowsOf(
		conn,
		"SELECT sample_id FROM search_topic($topic, $pattern) ORDER BY sample_id LIMIT $limit",
		{ ...params, limit }
	);
	const ids = pageRows.map(r => Number(r.sample_id));
	const label = TOPIC_LABEL[topic as TopicKey];
	if (json) {
		console.log(
			JSON.stringify({ topic, label, pattern, total, sample_ids: ids }, jsonReplacer)
		);
		return;
	}
	if (total === 0) {
		console.log(`无命中：主题 ${topic}（${label}），模式 "${pattern}"`);
		return;
	}
	console.log(
		total <= limit
			? `命中 ${total} 个样本（主题 ${topic}（${label}），模式 "${pattern}"）`
			: `命中 ${total} 个样本，显示前 ${ids.length} 条（上限可用第三个参数调整，最大 ${SEARCH_MAX_LIMIT}）`
	);
	for (let i = 0; i < ids.length; i += 10) {
		console.log(ids.slice(i, i + 10).join("  "));
	}
}

async function runCount(conn: DuckDBConnection, json: boolean): Promise<void> {
	const rows = await rowsOf(
		conn,
		"SELECT (SELECT count(*) FROM samples) AS samples," +
			" (SELECT count(*) FROM palaces) AS palaces," +
			" (SELECT count(*) FROM topics) AS topics",
		{}
	);
	if (json) {
		console.log(JSON.stringify(rows[0], jsonReplacer));
		return;
	}
	const one = Object.fromEntries(Object.entries(rows[0]!).map(([k, v]) => [k, Number(v)]));
	console.log(renderTable(Object.keys(one), [one]));
}

// 按解析结果分发：sql 形态透传（SQL 的作者就是使用者本人，本层不做二次加工），
// 其余走各自的封装查询。
export async function dispatch(conn: DuckDBConnection, args: ParsedArgs): Promise<void> {
	const c = args.command;
	if (c.kind === "sql") {
		const result = await conn.run(c.sql);
		const columns = result.columnNames();
		const rows = (await result.getRowObjectsJS()) as Array<Record<string, unknown>>;
		if (args.json) {
			console.log(JSON.stringify(rows, jsonReplacer));
		} else {
			console.log(renderTable(columns, rows));
		}
		return;
	}
	if (c.kind === "sample") {
		return runSample(conn, c.id, args.json);
	}
	if (c.kind === "palaces") {
		return runPalaces(conn, c.id, args.json);
	}
	if (c.kind === "topic") {
		return runTopic(conn, c.id, c.keys, args.json);
	}
	if (c.kind === "search") {
		return runSearch(conn, c.topic, c.pattern, c.limit, args.json);
	}
	return runCount(conn, args.json);
}
