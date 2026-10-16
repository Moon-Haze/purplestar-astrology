/**
 * 天纪语料导入（tools/corpus）—— 把 nihai-tianji-corpus 的紫微五册判语转印成本仓
 * TS 数据（`scripts/corpus/data/tianji.ts`）。
 *
 * 用法：npx tsx tools/corpus/import-tianji.ts
 * 语料库位置固定在下方 CORPUS_ROOT 常量——换语料位置时改常量重跑（刻意不收
 * 命令行路径参数：路径来源唯一且可审，杜绝输入进路径的穿越面）。
 *
 * 只导入紫微斗数相关的五册（01-stars / 02-palaces / 03-patterns / 04-sihua /
 * 05-illness）；易经 / 堪舆 / 铁板等册不属本 skill 知识面，不导入。
 *
 * ⚠️ 来源与许可：语料出自 nihai-tianji-corpus（倪海厦《天纪》结构化语料库），
 * CC BY-NC-SA 4.0——引用须署名、非商业、相同方式共享；生成的数据文件头部带
 * 来源声明，勿删。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // tools/corpus
// 本工具住在 skill 根的 tools/corpus/ 下，skill 根 = 上两级（dirname 链取根）
const ROOT = resolve(dirname(dirname(HERE)));
const OUT = join(ROOT, "scripts/corpus", "data", "tianji.ts");
const BOOKS = ["01-stars", "02-palaces", "03-patterns", "04-sihua", "05-illness"] as const;

/** 语料库根目录（本地克隆位置；换机重导时改这里）。 */
const CORPUS_ROOT = resolve("/home/swix/Code/GitProjects/nihai-tianji-corpus");
const jsonl = join(CORPUS_ROOT, "data", "entries.jsonl");
if (!existsSync(jsonl)) {
	console.error(`语料库不存在：${jsonl}（请克隆 nihai-tianji-corpus 或改本文件的 CORPUS_ROOT）`);
	process.exit(2);
}

interface RawEntry {
	book: string;
	h2: string;
	h3: string;
	quote: string;
	bvid: string;
	part: number;
	section: number;
	t_hms: string;
	note: string;
}

const rows: RawEntry[] = [];
for (const line of readFileSync(jsonl, "utf8").split("\n").filter(Boolean)) {
	const d = JSON.parse(line) as RawEntry;
	if ((BOOKS as readonly string[]).includes(d.book)) {
		rows.push(d);
	}
}
if (rows.length === 0) {
	console.error("语料中未找到紫微五册条目——检查语料库版本");
	process.exit(2);
}

/** TS 字符串字面量（JSON 转义即合法 TS 字面量）。 */
const lit = (s: string): string => JSON.stringify(s);

const lines: string[] = [
	"/**",
	" * 倪海厦《天纪》紫微斗数判语（生成快照）—— 由 tools/corpus 下的导入工具从",
	" * nihai-tianji-corpus（倪海厦《天纪》结构化语料库）导入。",
	" *",
	" * ⚠️ 来源与许可：语料 **CC BY-NC-SA 4.0**（署名—非商业—相同方式共享）；",
	" * 本文件只收录紫微斗数相关五册（主星 / 十二宫 / 格局 / 四化 / 疾厄）。",
	" * 每条带 [part §section @时:分:秒] 溯源，回放 URL 见 `replayUrl`。",
	" *",
	" * ⚠️ 生成文件 —— 重导命令：npx tsx tools/corpus/import-tianji.ts，**不要手改**。",
	" */",
	"",
	`/** 册代号：紫微斗数相关五册（语料库原生编号）。 */`,
	`export type TianjiBook = ${BOOKS.map(b => lit(b)).join(" | ")};`,
	"",
	`export interface TianjiEntry {`,
	`\tbook: TianjiBook;`,
	`\t/** 册内大类（如「紫微（北斗 · 帝星）」「命宫」「三方四正与对宫借星」） */`,
	`\th2: string;`,
	`\t/** 册内子类（定性 / 性情 / 亮度 …；十二宫册多为空串） */`,
	`\th3: string;`,
	`\t/** 倪师原话短引文（语料库已做字幕勘误与语义清扫） */`,
	`\tquote: string;`,
	`\tbvid: string;`,
	`\tpart: number;`,
	`\tsection: number;`,
	`\t/** 该判语在本单元内的起始时间 */`,
	`\tt_hms: string;`,
	`\t/** 考据标注（字幕错字裁决留痕等）；空串为无 */`,
	`\tnote: string;`,
	`}`,
	"",
	`/** 语料来源与许可（引用本文件即视为同意随附声明，勿删）。 */`,
	`export const TIANJI_SOURCE = {`,
	`\tproject: ${lit("nihai-tianji-corpus（倪海厦《天纪》结构化语料库）")},`,
	`\tlicense: ${lit("CC BY-NC-SA 4.0（语料）")},`,
	`\timportedBooks: ${lit(BOOKS.join(" / "))},`,
	`\timportedCount: ${rows.length},`,
	`} as const;`,
	"",
	`/** 判语的 B 站回放直链（直达该秒）。 */`,
	`export function replayUrl(e: TianjiEntry): string {`,
	`\tconst [h, m, s] = e.t_hms.split(":").map(Number);`,
	`\treturn \`https://www.bilibili.com/video/\${e.bvid}?p=\${e.part}&t=\${h * 3600 + m * 60 + s}\`;`,
	`}`,
	"",
	`/**`,
	` * 紧凑元组形态（book, h2, h3, quote, bvid, part, section, t_hms, note）。`,
	` * 刻意不生成对象字面量数组：千余条对象字面量会让 tsc 的 union 推断爆栈（TS2590）。`,
	` */`,
	`const RAW: readonly [TianjiBook, string, string, string, string, number, number, string, string][] = [`,
	...rows.map(
		r =>
			`\t[${lit(r.book)}, ${lit(r.h2)}, ${lit(r.h3)}, ${lit(r.quote)}, ${lit(r.bvid)}, ${r.part}, ${r.section}, ${lit(r.t_hms)}, ${lit(r.note)}],`
	),
	`];`,
	"",
	`export const TIANJI_ENTRIES: readonly TianjiEntry[] = RAW.map(`,
	`\t([book, h2, h3, quote, bvid, part, section, t_hms, note]) =>`,
	`\t\t({ book, h2, h3, quote, bvid, part, section, t_hms, note }),`,
	`);`,
	"",
];

mkdirSync(join(ROOT, "scripts/corpus", "data"), { recursive: true });
writeFileSync(OUT, lines.join("\n"));
console.error(`scripts/corpus/data/tianji.ts：${rows.length} 条（${BOOKS.join(" / ")}）`);
