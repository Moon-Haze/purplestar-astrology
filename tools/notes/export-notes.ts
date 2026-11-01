/**
 * Obsidian 笔记导出（tools/notes）—— 把多根工作区各仓的紫微斗数知识整理成
 * `notes/` 下的 Obsidian vault（精选口径：语料库紫微五册 + 本仓古籍 + toolkit
 * 引文核对 + voice 课程主题笔记）。
 *
 * 用法：npm run notes:export
 * 产物目录 `notes/` 是**自包含 vault**（用户在 Obsidian 里「打开文件夹作为库」）。
 *
 * 生成的文件一律带头注「生成物，勿手改」；手写页（README、00-索引/、
 * 60-方法/体系口径.md、90-模板/）脚本**绝不触碰**——重导只清空并重建
 * 「托管目录」，手写页与托管目录互不重叠，见 MANAGED_DIRS / HAND_FILES。
 *
 * ⚠️ 来源与许可：倪师判语出自 nihai-tianji-corpus（CC BY-NC-SA 4.0，非商业、
 * 相同方式共享、须署名），voice 课程笔记为 AI 总结需甄别——每篇产物 frontmatter
 * 均带来源与许可标注，勿删。
 *
 * 输出确定性：产物不含任何时间戳/随机数，同输入两次导出逐字节一致（导两次
 * diff=0 是验收标准）。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { guSuiFu } from "../../scripts/corpus/data/gusuifu.ts";
import { ziWeiQuanJi } from "../../scripts/corpus/data/quanji.ts";
import { ziWeiQuanShu } from "../../scripts/corpus/data/quanshu.ts";
import { PATTERN_VERDICTS } from "../../scripts/corpus/data/patterns.ts";
import { STAR_CONTENT_MAP, TOPIC_KEYS, TOPIC_LABEL } from "../../scripts/analysis/data.ts";
import {
	STAR_IN_FUQI_GU,
	SIHUA_IN_FUQI_GU,
	MARRIAGE_STARS_BRIEF,
} from "../../scripts/synastry/synastry-knowledge.ts";
import type { Book } from "../../scripts/corpus/types.ts";
import type { GenderField, MutagenModifier, PalaceContent } from "../../scripts/analysis/data.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(dirname(dirname(HERE)));
const OUT = join(ROOT, "notes");

/** 三个外部数据源仓的本地克隆位置（换机重导时改常量，与 import-tianji.ts 同纪律）。 */
const CORPUS_ROOT = resolve("/home/swix/Code/GitProjects/nihai-tianji-corpus");
const VOICE_ROOT = resolve("/home/swix/Code/PythonProjects/purplestar-voice");
const TOOLKIT_ROOT = resolve("/home/swix/Code/TypeScriptProjects/ziwei-samples-toolkit");

/** 语料库紫微五册 → vault 分区目录。 */
const BOOK_DIRS: Record<string, string> = {
	"01-stars": "10-星曜",
	"02-palaces": "20-宫位",
	"03-patterns": "30-格局",
	"04-sihua": "40-四化",
	"05-illness": "50-疾厄",
};
/** 脚本清空重建的目录（手写页不在这里，重导安全）。 */
const MANAGED_DIRS = [...new Set(Object.values(BOOK_DIRS))].concat(
	"55-古籍",
	"70-课程笔记",
	"75-主星论断",
	"80-主题手册",
	"85-合盘断语"
);
/** 60-方法 下由本脚本托管的文件名（该目录另有手写页，不能整目录清空）。 */
const MANAGED_METHOD_FILES = ["引文真伪分级.md", "已核对论断"];

const GENERATED_BANNER = [
	"> [!warning] 生成物，勿手改",
	"> 本笔记由 `npm run notes:export` 从外部数据源仓自动生成；要改内容请改对应数据源后重导。",
].join("\n");

const LICENSE_LINE =
	"判语出自倪海厦《天纪》结构化语料库 nihai-tianji-corpus（CC BY-NC-SA 4.0：署名 · 非商业 · 相同方式共享）。";

interface Entry {
	book: string;
	h2: string;
	h3: string;
	quote: string;
	section: number;
	t_hms: string;
	note: string;
	bvid: string;
	part: number;
}

/** 文件名净化：去掉文件系统与 wikilink 的非法/干扰字符。 */
function safeName(raw: string): string {
	return raw
		.replace(/[/\\:*?"<>|#^\n\r]/g, "·")
		.replace(/[\u2600-\u27BF]/gu, "")
		.replace(/\uFE0F/gu, "")
		.replace(/\s+/g, " ")
		.trim();
}

/** t_hms → 秒（B 站回放定位参数）。 */
function hmsToSeconds(hms: string): number {
	const [m, s] = hms.split(":").map(Number);
	return m * 60 + s;
}

/** 判语条目的回放链接（bvid + 分P + 秒定位）。 */
function replayLink(e: Entry): string {
	return `https://www.bilibili.com/video/${e.bvid}?p=${e.part}&t=${hmsToSeconds(e.t_hms)}`;
}

function frontmatter(fields: Array<[string, string | number]>): string {
	const lines = fields.map(([k, v]) => `${k}: ${v}`);
	return `---\n${lines.join("\n")}\n---\n`;
}

function readJsonl(): Entry[] {
	const file = join(CORPUS_ROOT, "data", "entries.jsonl");
	if (!existsSync(file)) {
		console.error(`语料库不存在：${file}（请克隆 nihai-tianji-corpus 或改本文件 CORPUS_ROOT）`);
		process.exit(1);
	}
	return readFileSync(file, "utf8")
		.split("\n")
		.filter(l => l.trim())
		.map(l => JSON.parse(l) as Entry);
}

interface Group {
	book: string;
	dir: string;
	title: string; // 笔记标题（h2，格局册为 h3）
	parent: string; // 所属 h2（格局册用于标注层级）
	entries: Entry[];
}

/** 紫微五册 → 分组（格局册按 h3 一篇，其余按 h2 一篇）。 */
function groupEntries(all: Entry[]): Group[] {
	const groups: Group[] = [];
	let lastH2 = "";
	for (const e of all) {
		const dir = BOOK_DIRS[e.book];
		if (!dir) {
			continue;
		}
		// 格局册判语是逐格讲解，一篇一格（h3）；其余册按 h2 主题聚合
		const useH3 = e.book === "03-patterns";
		const title = useH3 ? e.h3 : e.h2;
		if (useH3 ? lastH2 === e.h3 : title === lastH2 && groups.at(-1)?.book === e.book) {
			groups.at(-1)?.entries.push(e);
		} else {
			groups.push({ book: e.book, dir, title, parent: e.h2, entries: [e] });
		}
		lastH2 = title;
	}
	return groups;
}

function entryBlock(e: Entry): string {
	const cite = `—— ${e.h2} / ${e.h3} · [回放 ${e.t_hms}](${replayLink(e)})`;
	const quote = e.quote
		.split(/(?<=[。！？；])\s*/)
		.filter(Boolean)
		.map(s => `> ${s}`)
		.join("\n");
	return `${quote}\n>\n${cite}${e.note ? `\n>\n> ⚠️ 勘误：${e.note}` : ""}`;
}

function noteBody(g: Group, prev: Group | undefined, next: Group | undefined): string {
	const fm = frontmatter([
		["tags", "紫微斗数/天纪判语"],
		["来源", "nihai-tianji-corpus"],
		["册", g.book],
		["主题", g.parent],
		["条数", g.entries.length],
		["许可", "CC BY-NC-SA 4.0"],
	]);
	const nav = [
		prev ? `← [[${safeName(prev.title)}]]` : "",
		next ? `[[${safeName(next.title)}]] →` : "",
	]
		.filter(Boolean)
		.join(" ｜ ");
	const body = [
		fm,
		GENERATED_BANNER,
		"",
		`# ${g.title}`,
		"",
		`共 ${g.entries.length} 条倪师原话判语。${LICENSE_LINE}`,
		"",
		...groupedEntries(g),
	];
	if (nav) {
		body.push("---", "", nav, "");
	}
	return body.join("\n");
}

/**
 * 判语按 h3 小节分组排版：同一 h2 主题下常有多个 h3 小节（如四化篇的定性/应期），
 * 连排会让小节边界淹没在引用块里——有多个 h3 时插 `###` 小节标题，单 h3 则不插。
 */
function groupedEntries(g: Group): string[] {
	const out: string[] = [];
	let lastH3: string | undefined;
	for (const e of g.entries) {
		if (e.h3 !== lastH3) {
			if (countH3(g) > 1) {
				out.push(`### ${e.h3}`, "");
			}
			lastH3 = e.h3;
		}
		out.push(`${entryBlock(e)}\n`);
	}
	return out;
}

function countH3(g: Group): number {
	return new Set(g.entries.map(e => e.h3)).size;
}

function renderGroups(groups: Group[], dir: string): void {
	mkdirSync(join(OUT, dir), { recursive: true });
	// 同目录内按出现顺序编号，文件序 = 语料序
	groups.forEach((g, i) => {
		const name = `${String(i + 1).padStart(2, "0")} ${safeName(g.title)}.md`;
		writeFileSync(join(OUT, dir, name), noteBody(g, groups[i - 1], groups[i + 1]));
	});
}

function sectionIndex(dir: string, label: string, titles: string[]): string {
	const links = titles.map(
		(t, i) => `- [[${String(i + 1).padStart(2, "0")} ${safeName(t)}|${t}]]`
	);
	return [GENERATED_BANNER, "", `# ${label} · 索引`, "", ...links, ""].join("\n");
}

/** 本仓三部古籍：一章一篇。 */
function exportBooks(books: Array<Book & { dir: string; label: string }>): void {
	const titlesByDir = new Map<string, string[]>();
	for (const book of books) {
		mkdirSync(join(OUT, book.dir), { recursive: true });
		book.chapters.forEach((ch, i) => {
			const paras = ch.paragraphs
				.map(p => `> ${p.text}${p.niNote ? `\n>\n> 🗒 倪师注：${p.niNote}` : ""}`)
				.join("\n\n");
			const content = [
				frontmatter([
					["tags", "紫微斗数/古籍"],
					["来源", "purplestar-astrology/scripts/corpus"],
					["书", book.title],
					["朝代", book.dynasty],
					["编者", book.author],
					["许可", "公版"],
				]),
				GENERATED_BANNER,
				"",
				`# ${book.title} · ${ch.title}`,
				ch.subtitle ? `\n> ${ch.subtitle}` : "",
				"",
				`${book.intro}（全书约 ${book.wordCount} 字，本仓为节选。）`,
				"",
				paras,
				"",
			];
			writeFileSync(
				join(
					OUT,
					book.dir,
					`${book.label} ${String(i + 1).padStart(2, "0")} ${safeName(ch.title)}.md`
				),
				content.join("\n")
			);
			const list = titlesByDir.get(book.dir) ?? [];
			list.push(`${book.title} · ${ch.title}`);
			titlesByDir.set(book.dir, list);
		});
	}
	for (const [dir, titles] of titlesByDir) {
		writeFileSync(join(OUT, dir, "_索引.md"), sectionIndex(dir, dir, titles));
	}
}

/** toolkit 引文五级真伪分级 → 方法论一页。 */
function exportAnnotations(): void {
	const file = join(TOOLKIT_ROOT, "corpus", "annotations.json");
	if (!existsSync(file)) {
		console.error(
			`引文核对表不存在：${file}（请克隆 ziwei-samples-toolkit 或改 TOOLKIT_ROOT）`
		);
		process.exit(1);
	}
	const data = JSON.parse(readFileSync(file, "utf8")) as {
		_legend: Record<string, string>;
		entries: Array<{ line: number; text: string; status: string; note: string }>;
		top_priority_fixes: Array<{ priority: string; action: string; lines: number[] }>;
	};
	const legend = Object.entries(data._legend)
		.map(([k, v]) => `- **${k}**：${v}`)
		.join("\n");
	const rows = data.entries.map(e => `| ${e.status} | ${e.text} | ${e.note} |`);
	const fixes = data.top_priority_fixes.map(
		f => `- **${f.priority}**：${f.action}（涉及行 ${f.lines.join("、")}）`
	);
	const content = [
		frontmatter([
			["tags", "紫微斗数/方法论"],
			["来源", "ziwei-samples-toolkit/corpus/annotations.json"],
		]),
		GENERATED_BANNER,
		"",
		"# 引文真伪分级",
		"",
		"对代码与文档中全部「倪师/倪海厦」引语的来源核对结果与五级分级：",
		"",
		legend,
		"",
		"## 优先修正清单",
		"",
		...fixes,
		"",
		"| 级别 | 引语 | 核对备注 |",
		"| --- | --- | --- |",
		...rows,
		"",
	].join("\n");
	writeFileSync(join(OUT, "60-方法", "引文真伪分级.md"), content);
}

/** toolkit 已核对论断七篇：复制进 vault 并加来源头注。 */
function exportVerified(): void {
	const srcDir = join(TOOLKIT_ROOT, "corpus", "verified");
	if (!existsSync(srcDir)) {
		console.error(
			`已核对论断目录不存在：${srcDir}（请克隆 ziwei-samples-toolkit 或改 TOOLKIT_ROOT）`
		);
		process.exit(1);
	}
	const outDir = join(OUT, "60-方法", "已核对论断");
	mkdirSync(outDir, { recursive: true });
	for (const name of readdirSync(srcDir).filter(f => f.endsWith(".md"))) {
		const body = readFileSync(join(srcDir, name), "utf8").replace(/^# /, "# ");
		const content = [
			frontmatter([
				["tags", "紫微斗数/已核对论断"],
				["来源", "ziwei-samples-toolkit/corpus/verified"],
			]),
			GENERATED_BANNER,
			"",
			body,
		].join("\n");
		writeFileSync(join(outDir, name), content);
	}
}

/** voice 课程主题笔记（紫微斗数课程目录）→ 复制并加「AI 总结需甄别」标注。 */
function exportVoiceNotes(): void {
	// voice 仓 markdown/ 下唯一以「2.」开头的目录即紫微斗数正课
	const mdRoot = join(VOICE_ROOT, "markdown");
	const courseDir = readdirSync(mdRoot)
		.filter(d => d.startsWith("2."))
		.map(d => join(mdRoot, d))
		.find(p => existsSync(p) && readdirSync(p).some(f => f.endsWith(".md")));
	if (!courseDir) {
		console.error(
			`voice 课程目录不存在：${mdRoot}/2.*（请确认 purplestar-voice 已产出 markdown，或改 VOICE_ROOT）`
		);
		process.exit(1);
	}
	const outDir = join(OUT, "70-课程笔记");
	mkdirSync(outDir, { recursive: true });
	const files = readdirSync(courseDir)
		.filter(f => f.endsWith(".md"))
		.sort();
	files.forEach((name, i) => {
		const body = readFileSync(join(courseDir, name), "utf8");
		const content = [
			frontmatter([
				["tags", "紫微斗数/课程笔记"],
				["来源", "purplestar-voice/markdown（AI 总结，需甄别）"],
				["原文件", name],
			]),
			"> [!warning] 生成物，勿手改；本文为 AI 对课程视频的主题化总结，**观点需回原视频甄别**。",
			"> 逐字稿原文见 purplestar-voice 仓 `markdown/` 与 `corrected/`。",
			"",
			body,
		].join("\n");
		writeFileSync(
			join(
				outDir,
				`${String(i + 1).padStart(2, "0")} ${safeName(name.replace(/\.md$/, ""))}.md`
			),
			content
		);
	});
	writeFileSync(
		join(outDir, "_索引.md"),
		sectionIndex(
			"70-课程笔记",
			"70-课程笔记",
			files.map(n => n.replace(/\.md$/, ""))
		)
	);
}

// ─── 本仓源代码知识（analysis / patterns / synastry）──────────────────

/** 四化键 → 中文标签。 */
const MUTAGEN_LABELS: Array<[keyof MutagenModifier, string]> = [
	["lu", "化禄"],
	["quan", "化权"],
	["ke", "化科"],
	["ji", "化忌"],
];

/** 性别结构化内容 → 「共享 + 男命/女命」行。 */
function renderGenderField(g: GenderField): string[] {
	const lines = [g.common];
	if (g.male) {
		lines.push(`【男命】${g.male}`);
	}
	if (g.female) {
		lines.push(`【女命】${g.female}`);
	}
	if (g.suffix) {
		lines.push(g.suffix);
	}
	return lines.filter(Boolean);
}

/** 宫位语境条目（string / 性别结构化 / 条件分支 三形态）→ 行。 */
function renderPalaceContent(c: PalaceContent): string[] {
	if (typeof c === "string") {
		return [c];
	}
	if ("common" in c && !("lu" in c) && !("brightness" in c)) {
		// BranchedContent.brightness 是可选属性，`in` 收窄排不干净，此处只能是 GenderField
		return renderGenderField(c as GenderField);
	}
	// BranchedContent：common + 四化/亮度条件分支全量收录（笔记是知识全集，不做运行期投影）
	const b = c as {
		common: string | GenderField;
		sihua?: MutagenModifier;
		brightness?: { bright?: string | GenderField; dim?: string | GenderField };
	};
	const lines = typeof b.common === "string" ? [b.common] : renderGenderField(b.common);
	for (const [k, label] of MUTAGEN_LABELS) {
		const v = b.sihua?.[k];
		if (!v) {
			continue;
		}
		const text = typeof v === "string" ? v : renderGenderField(v).join(" ");
		lines.push(`〔${label}〕${text}`);
	}
	if (b.brightness?.bright) {
		const t =
			typeof b.brightness.bright === "string"
				? b.brightness.bright
				: renderGenderField(b.brightness.bright).join(" ");
		lines.push(`〔庙旺〕${t}`);
	}
	if (b.brightness?.dim) {
		const t =
			typeof b.brightness.dim === "string"
				? b.brightness.dim
				: renderGenderField(b.brightness.dim).join(" ");
		lines.push(`〔落陷〕${t}`);
	}
	return lines;
}

/** 四化/亮度修饰的宽松视图：MutagenModifier ∪ TopicMod（含 bright/dim 分支）。 */
type ModRecord = Record<string, string | GenderField | undefined>;

function renderMutagenModifier(m: object): string[] {
	const rec = m as ModRecord;
	const lines = MUTAGEN_LABELS.filter(([k]) => rec[k] != null).map(([k, label]) => {
		const v = rec[k] as string | GenderField;
		const text = typeof v === "string" ? v : renderGenderField(v).join(" ");
		return `- **${label}**：${text}`;
	});
	for (const [k, label] of [
		["bright", "庙旺"],
		["dim", "落陷"],
	] as const) {
		const v = rec[k];
		if (!v) {
			continue;
		}
		const text = typeof v === "string" ? v : renderGenderField(v).join(" ");
		lines.push(`- **${label}**：${text}`);
	}
	return lines;
}

const PALACE_FIELDS: Array<[string, string]> = [
	["xiongDi", "兄弟宫"],
	["fuQi", "夫妻宫"],
	["ziNv", "子女宫"],
	["caiBo", "财帛宫"],
	["jiE", "疾厄宫"],
	["qianYi", "迁移宫"],
	["jiaoYou", "交友宫"],
	["guanLu", "官禄宫"],
	["tianZhai", "田宅宫"],
	["fuDe", "福德宫"],
	["fuMu", "父母宫"],
];

/** analysis 的 STAR_CONTENT_MAP（十四主星 × 宫位/四化/亮度/总述）→ 75-主星论断/，一星一篇。 */
function exportStarAnalyses(): void {
	const dir = "75-主星论断";
	mkdirSync(join(OUT, dir), { recursive: true });
	const stars = Object.keys(STAR_CONTENT_MAP);
	stars.forEach((star, i) => {
		const s = STAR_CONTENT_MAP[star];
		const sections: string[] = [];
		sections.push("## 命宫概述", "", ...renderPalaceContent(s.mingGong), "");
		if (s.personality) {
			sections.push("## 性格深描", "", ...renderPalaceContent(s.personality), "");
		}
		for (const [key, label] of PALACE_FIELDS) {
			const v = s[key as keyof typeof s] as PalaceContent | undefined;
			if (!v) {
				continue;
			}
			sections.push(`## ${label}`, "", ...renderPalaceContent(v), "");
		}
		const mods = renderMutagenModifier(s.sihua);
		if (mods.length > 0) {
			sections.push("## 四化修饰", "", ...mods, "");
		}
		if (s.brightMod) {
			const t =
				typeof s.brightMod === "string"
					? s.brightMod
					: renderGenderField(s.brightMod).join(" ");
			sections.push(`- **庙旺**：${t}`);
		}
		if (s.dimMod) {
			const t =
				typeof s.dimMod === "string" ? s.dimMod : renderGenderField(s.dimMod).join(" ");
			sections.push(`- **落陷**：${t}`);
		}
		if (s.brightMod || s.dimMod) {
			sections.push("");
		}
		const TOPIC_MOD_LABELS: Array<[keyof NonNullable<typeof s.topic_mods>, string]> = [
			["overview", "命格总览"],
			["love", "感情"],
			["career", "事业"],
			["wealth", "财富"],
			["health", "健康"],
		];
		if (s.topic_mods) {
			for (const [key, label] of TOPIC_MOD_LABELS) {
				const tm = s.topic_mods[key];
				if (!tm) {
					continue;
				}
				const lines = renderMutagenModifier(tm);
				if (lines.length > 0) {
					sections.push(`## 话题四化 · ${label}`, "", ...lines, "");
				}
			}
		}
		const sum = s.summary;
		for (const gender of ["male", "female"] as const) {
			const g = sum[gender];
			const label = gender === "male" ? "男命" : "女命";
			sections.push(
				`## 总述（${label}）`,
				"",
				`- 命格：${g.overview}`,
				`- 感情：${g.love}`,
				`- 事业：${g.career}`,
				`- 财富：${g.wealth}`,
				`- 健康：${g.health}`,
				""
			);
		}
		const content = [
			frontmatter([
				["tags", "紫微斗数/主星论断"],
				["来源", "purplestar-astrology/scripts/analysis"],
				["星", star],
			]),
			GENERATED_BANNER,
			"",
			`# ${star} · 主星论断`,
			"",
			`本篇是产品仓 analysis 论断库中「${star}」的全量论断（命格/性格/十二宫/四化/亮度/总述）。`,
			"",
			...sections,
		];
		writeFileSync(
			join(OUT, dir, `${String(i + 1).padStart(2, "0")} ${safeName(star)}.md`),
			content.join("\n")
		);
	});
	writeFileSync(join(OUT, dir, "_索引.md"), sectionIndex(dir, dir, stars));
}

function exportPatternVerdicts(): void {
	const rows = Object.entries(PATTERN_VERDICTS).map(([name, v]) => {
		const lines = [`### ${name}`, "", v.description, ""];
		if (v.topicDescription) {
			lines.push(`> 倪师口吻长判词：${v.topicDescription}`, "");
		}
		if (v.source) {
			lines.push(`出处：${v.source}`, "");
		}
		return lines.join("\n");
	});
	const content = [
		frontmatter([
			["tags", "紫微斗数/格局判词"],
			["来源", "purplestar-astrology/scripts/corpus/data/patterns.ts PATTERN_VERDICTS"],
			["格局数", Object.keys(PATTERN_VERDICTS).length],
		]),
		GENERATED_BANNER,
		"",
		"# 格局判词表",
		"",
		`产品仓格局层的判词表全集（${Object.keys(PATTERN_VERDICTS).length} 格）；倪师原话判语见本目录其余笔记，本页是 analysis/patterns 内核实际使用的判词。`,
		"",
		...rows,
	];
	writeFileSync(join(OUT, "30-格局", "判词表.md"), content.join("\n"));
}

/** synastry/synastry-knowledge 的合盘断语 → 85-合盘断语/夫妻宫断语.md 单页。 */
function exportSynastry(): void {
	mkdirSync(join(OUT, "85-合盘断语"), { recursive: true });
	const stars = Object.entries(STAR_IN_FUQI_GU).map(([star, v]) => {
		const lines = [
			`### ${star}`,
			"",
			`- **核心断语**：${v.summary}`,
			`- **吉象**：${v.good}`,
			`- **凶象**：${v.bad}`,
			`- **配偶形性**：${v.spouse_traits}`,
			`- **婚期**：${v.timing}`,
		];
		if (v.ni_quote) {
			lines.push(`- **倪师原话**：「${v.ni_quote}」`);
		}
		return `${lines.join("\n")}\n`;
	});
	const sihua = Object.entries(SIHUA_IN_FUQI_GU)
		.map(([k, v]) => `- **${k}**：${v}`)
		.join("\n");
	const brief = Object.entries(MARRIAGE_STARS_BRIEF)
		.map(([k, v]) => `- **${k}**：${v}`)
		.join("\n");
	const content = [
		frontmatter([
			["tags", "紫微斗数/合盘断语"],
			["来源", "purplestar-astrology/scripts/synastry/synastry-knowledge.ts"],
		]),
		GENERATED_BANNER,
		"",
		"# 夫妻宫断语（合盘）",
		"",
		"合盘知识库的夫妻宫断语全集：十四主星五段式 + 四化入夫妻宫 + 婚星简断；体系口径见 [[60-方法/体系口径|体系口径]]（断语中「自化/飞化」是传统措辞，本体系禁用飞星派工具）。",
		"",
		"## 四化入夫妻宫",
		"",
		sihua,
		"",
		"## 十四主星坐夫妻宫",
		"",
		...stars,
		"## 婚星简断",
		"",
		brief,
		"",
	];
	writeFileSync(join(OUT, "85-合盘断语", "夫妻宫断语.md"), content.join("\n"));
}

async function main(): Promise<void> {
	// 先清托管区（手写页在 00-索引 / 60-方法体系口径 / 90-模板 / README，不受影响）
	for (const dir of MANAGED_DIRS) {
		rmSync(join(OUT, dir), { recursive: true, force: true });
	}
	for (const f of MANAGED_METHOD_FILES) {
		rmSync(join(OUT, "60-方法", f), { recursive: true, force: true });
	}
	mkdirSync(join(OUT, "60-方法"), { recursive: true });

	const all = readJsonl();
	const groups = groupEntries(all);
	const byDir = new Map<string, Group[]>();
	for (const g of groups) {
		if (!byDir.has(g.dir)) {
			byDir.set(g.dir, []);
		}
		byDir.get(g.dir)?.push(g);
	}
	for (const [dir, list] of byDir) {
		renderGroups(list, dir);
		writeFileSync(
			join(OUT, dir, "_索引.md"),
			sectionIndex(
				dir,
				dir,
				list.map(g => g.title)
			)
		);
	}

	exportBooks([
		{ ...ziWeiQuanShu, dir: "55-古籍", label: "全书" },
		{ ...ziWeiQuanJi, dir: "55-古籍", label: "全集" },
		{ ...guSuiFu, dir: "55-古籍", label: "骨髓赋" },
	]);
	exportAnnotations();
	exportVerified();
	exportVoiceNotes();
	exportStarAnalyses();
	exportPatternVerdicts();
	exportSynastry();

	const noteCount = groups.reduce((n, g) => n + g.entries.length, 0);
	console.log(
		`notes 导出完成：判语 ${noteCount} 条 → ${groups.length} 篇 + 古籍 ${
			ziWeiQuanShu.chapters.length + ziWeiQuanJi.chapters.length + guSuiFu.chapters.length
		} 章 + 方法论页 + 课程笔记 + 主星论断 ${Object.keys(STAR_CONTENT_MAP).length} 篇 + 主题手册 ${
			TOPIC_KEYS.length
		} 篇 + 格局判词表 + 合盘断语；输出 ${OUT}`
	);
}

await main();
