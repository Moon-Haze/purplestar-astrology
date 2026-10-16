// 通用终端展示原语（tools/db）：JSON 安全序列化、单元格截断、CJK 对齐表格。
// BigInt 无 toJSON，JSON.stringify 遇之直接抛 TypeError —— 库里所有 id/计数列都是 BIGINT。
// 值域最大 6,220,800，远低于 Number.MAX_SAFE_INTEGER，转 Number 无损。
export const jsonReplacer = (_k: string, v: unknown): unknown =>
	typeof v === "bigint" ? Number(v) : v;

// 单元格渲染：NULL / 列表 / 结构体各有形态，统一转字符串后截断至 40 字符
const MAX_CELL = 40;
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

// 库内容全为中文：CJK 等全角字符占 2 显示列，而 padEnd 按 UTF-16 码元计数，
// 直接用会让表头、分隔线、数据行三者宽度互不相等。故一律按显示宽度计算。
const isWide = (cp: number): boolean =>
	(cp >= 0x1100 && cp <= 0x115f) || // 韩文字母
	(cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) || // CJK 部首/假名/汉字
	(cp >= 0xac00 && cp <= 0xd7a3) || // 韩文音节
	(cp >= 0xf900 && cp <= 0xfaff) || // CJK 兼容汉字
	(cp >= 0xfe30 && cp <= 0xfe6f) || // CJK 兼容形式
	(cp >= 0xff00 && cp <= 0xff60) || // 全角 ASCII
	(cp >= 0xffe0 && cp <= 0xffe6) || // 全角符号
	(cp >= 0x20000 && cp <= 0x3fffd); // CJK 扩展 B 及以后
export const dispWidth = (s: string): number =>
	[...s].reduce((w, ch) => w + (isWide(ch.codePointAt(0) ?? 0) ? 2 : 1), 0);
const pad = (s: string, w: number): string => s + " ".repeat(Math.max(0, w - dispWidth(s)));

export function renderTable(columns: string[], rows: Array<Record<string, unknown>>): string {
	if (rows.length === 0) {
		return "(0 行)";
	}
	const widths = columns.map(c =>
		Math.max(dispWidth(c), ...rows.map(r => dispWidth(cell(r[c]))))
	);
	const line = (cells: string[]) => cells.map((s, i) => pad(s, widths[i])).join("  |  ");
	const out = [line(columns), widths.map(w => "-".repeat(w)).join("--+--")];
	for (const r of rows) {
		out.push(line(columns.map(c => cell(r[c]))));
	}
	out.push(`(${rows.length} 行)`);
	return out.join("\n");
}
