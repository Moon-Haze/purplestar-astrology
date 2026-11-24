/**
 * @file 数据库查询结果的文本与表格渲染。
 */
// 终端展示原语（tools/db）：JSON 序列化、单元格截断、CJK 表格对齐。
// BigInt 无 toJSON，JSON.stringify 遇之抛 TypeError；值域≤6,220,800 远低于安全整数，转 Number 无损。
/** BIGINT 转 Number 的序列化替换器，避免 toJSON 抛错。 */
export const jsonReplacer = (_k: string, v: unknown): unknown =>
	typeof v === "bigint" ? Number(v) : v;

// 单元格渲染：NULL / 列表 / 结构体统一转字符串，截断至 40 字符
const MAX_CELL = 40;
/**
 * 单元格渲染：统一转字符串并截断。
 * @param v - 单元格取值（NULL / 数组 / 对象 / 标量）
 * @returns 展示串，超长截断加 `...`
 */
export function cell(v: unknown): string {
	const s =
		v === null || v === undefined
			? "NULL"
			: Array.isArray(v)
				? `[${v.join(", ")}]`
				: typeof v === "object"
					? JSON.stringify(v)
					: String(v);
	return s.length > MAX_CELL ? s.slice(0, MAX_CELL - 3) + "..." : s;
}

// 库内容全为中文：CJK 全角占 2 显示列，padEnd 按码元计数会使表头/分隔线/数据行宽度不齐，
// 故一律按显示宽度算。
/** 判断码点是否属于全角或 CJK 宽字符。 */
const isWide = (cp: number): boolean =>
	(cp >= 0x1100 && cp <= 0x115f) || // 韩文字母
	(cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) || // CJK 部首/假名/汉字
	(cp >= 0xac00 && cp <= 0xd7a3) || // 韩文音节
	(cp >= 0xf900 && cp <= 0xfaff) || // CJK 兼容汉字
	(cp >= 0xfe30 && cp <= 0xfe6f) || // CJK 兼容形式
	(cp >= 0xff00 && cp <= 0xff60) || // 全角 ASCII
	(cp >= 0xffe0 && cp <= 0xffe6) || // 全角符号
	(cp >= 0x20000 && cp <= 0x3fffd); // CJK 扩展 B 及以后
/** 显示宽度：全角与 CJK 字符按 2 列计。 */
export const dispWidth = (s: string): number =>
	[...s].reduce((w, ch) => w + (isWide(ch.codePointAt(0) ?? 0) ? 2 : 1), 0);
/** 右填充到指定显示宽度。 */
const pad = (s: string, w: number): string => s + " ".repeat(Math.max(0, w - dispWidth(s)));

/**
 * 渲染成对齐的文本表格；无行时返回「(0 行)」。
 *
 * @param columns - 列名（同时决定列序）
 * @param rows - 行集，键为列名
 * @returns 带表头与列宽对齐的多行表格文本
 */
export function renderTable(columns: string[], rows: Array<Record<string, unknown>>): string {
	if (rows.length === 0) {
		return "(0 行)";
	}
	const widths = columns.map(c =>
		Math.max(dispWidth(c), ...rows.map(r => dispWidth(cell(r[c]))))
	);
	/** 把一行单元格按列宽拼成表格行。 */
	const line = (cells: string[]) => cells.map((s, i) => pad(s, widths[i])).join("  |  ");
	const out = [line(columns), widths.map(w => "-".repeat(w)).join("--+--")];
	for (const r of rows) {
		out.push(line(columns.map(c => cell(r[c]))));
	}
	out.push(`(${rows.length} 行)`);
	return out.join("\n");
}
