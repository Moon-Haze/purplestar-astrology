// ── 基准样本数据源：db/ziwei.duckdb ──
//
// 全项目**唯一**懂 DuckDB 与表结构的地方。三个手工工具（test/tools/full-corpus.ts、
// test/tools/build-fixtures.ts、test/tools/verify-source.ts）都从这里取样本，
// 它们自己不写 SQL、不碰连接。
//
// ⚠️ 本模块**不进 `npm test` 的断言** —— `npm test` 必须继续在「无 db/ziwei.duckdb、
//    无 DuckDB 依赖、无 jsonl 语料」的环境下跑通（见 test/README.md）。
//    test/sample-source.test.ts 只用**合成行**与**不存在的路径**测纯函数，不碰数据文件。
//
// 表结构（`ziwei` 库，`main` schema）：
//   samples  518,400 行 —— 出生信息 + 农历 + 盘级标量
//   palaces  6,220,800 行 —— 每样本恒 12 行：宫位 + 星曜 + 大限区间
//   topics / topic_dict / topic_lines —— 本次不用（论断文本，单条占原语料 90% 体积）
//
// 为什么数据源是单文件而非 720 个 jsonl.gz 分片：
//   · `--year` / `--month` 从「拼路径 + 判文件存在」变成 SQL 谓词，中间状态消失
//   · 1.7 GB 对 5.5 GB
//   · 可直接 SQL 探查，核对排盘不变量不必再写一次性脚本
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { DuckDBConnection } from "@duckdb/node-api";

import type { BirthInfo, Star } from "@/ziwei/types";
import { loadConstants } from "./loader.ts";
import type {
	BaselineChart, BaselineDaXian, BaselinePalace, BaselineSample, BaselineStar,
} from "./compare.ts";

const HERE = dirname(fileURLToPath(import.meta.url)); // <skill 根>/test/lib
const SKILL_ROOT = resolve(HERE, "../..");

/** 数据文件路径：<skill 根>/db/ziwei.duckdb */
export const SAMPLE_DB: string = resolve(SKILL_ROOT, "db/ziwei.duckdb");

/** 过滤条件。对应 CLI 的 `--year` / `--month`；`limit` 对应 `--limit`。 */
export interface SampleFilter {
	year?: number;
	month?: number;
	/** 已读取的样本数上限；达到即停止。省略或 `Infinity` 表示不限。 */
	limit?: number;
}

/** 数据源不可用（缺文件 / 缺依赖）。`message` 已是可直接打印给用户的完整指引。 */
export class SourceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SourceError";
	}
}

/**
 * `@duckdb/node-api` 未安装时的指引。
 *
 * 它是 devDependency，只有三个**手工执行**的构建/验收工具用到它 —— 运行 skill 本身
 * （`node scripts/purple-star.ts ...`）完全不需要。所以「没装」是正常状态，不是故障。
 */
export function missingDepHint(err: unknown): string {
	return (
		`缺少依赖 @duckdb/node-api（${err instanceof Error ? err.message : String(err)}）\n` +
		`  它是 devDependency，只有三个手工执行的测试工具用到它 —— 运行 skill 本身不需要。\n` +
		`  处理：在 skill 根执行 npm install`
	);
}

/**
 * `db/ziwei.duckdb` 不存在时的指引。
 *
 * ⚠️ 措辞要挡住一个真实的误判：该库不入版本控制，克隆仓库后它必然缺失，很容易被读成
 *    「语料丢了」。它不是唯一副本 —— `reference/` 下的 jsonl 语料是同一份数据的原始形态，
 *    可以重建出这个库。2026-09-25 曾因 `ls` 是带 `--git-ignore` 的 eza 别名而误判语料已失，
 *    见 docs/superpowers/specs/ 下的设计文档。
 */
export function missingDbHint(path: string = SAMPLE_DB): string {
	return (
		`找不到样本数据库：${path}\n` +
		`  该文件**不入版本控制**（1.7 GB，超出 GitHub 单文件上限 100 MB）。\n` +
		`  它不是唯一副本，所以这里**不是**数据丢失：\n` +
		`    reference/ziwei-samples-toolkit/samples-out  是同一份语料的原始形态\n` +
		`    （5.5 GB / 720 个 jsonl.gz / 60 个年份目录 1924-1983），可由其重建本库。\n` +
		`  日常回归不需要它 —— 跑 npm test 即可，fixtures 已入库。`
	);
}

/** 惰性单例：路径 → 已建立的连接。进程退出时自然释放。 */
const connections = new Map<string, Promise<DuckDBConnection>>();

/**
 * 建立（或复用）到样本库的只读连接。
 *
 * @param dbPath 库文件路径。**仅供测试注入一个不存在的路径**；生产调用一律走默认值，
 *               三个工具都不传这个参数。
 * @throws {SourceError} 缺依赖或库文件不存在时，`message` 已是可直接打印的完整指引。
 */
export async function openSource(dbPath: string = SAMPLE_DB): Promise<DuckDBConnection> {
	const cached = connections.get(dbPath);
	if (cached) return cached;

	const pending = (async (): Promise<DuckDBConnection> => {
		// ⚠️ 动态 import 而非顶层静态 import：它是 devDependency，可能没装。
		//    静态 import 会让整个模块加载失败，连错误指引都打不出来。
		let DuckDBInstance: typeof import("@duckdb/node-api").DuckDBInstance;
		try {
			({ DuckDBInstance } = await import("@duckdb/node-api"));
		} catch (err) {
			throw new SourceError(missingDepHint(err));
		}

		if (!existsSync(dbPath)) throw new SourceError(missingDbHint(dbPath));

		// READ_ONLY：基准工具的立场是「只读语料」。写坏了这个库，两个验收层会一起失真。
		const inst = await DuckDBInstance.create(dbPath, { access_mode: "READ_ONLY" });
		return inst.connect();
	})();

	// 失败的不缓存：否则一次瞬时失败会让后续所有调用都拿到同一个 rejected promise。
	pending.catch(() => connections.delete(dbPath));
	connections.set(dbPath, pending);
	return pending;
}

/** 关闭全部已建立的连接（手工工具收尾用）。 */
export function closeSource(): void {
	for (const pending of connections.values()) {
		pending.then(conn => conn.closeSync()).catch(() => {});
	}
	connections.clear();
}

// ── 表结构 → 基准样本的映射 ──
//
// 这里的每一条规则都是实测出来的，不是推断。最隐晦的一条是 `siHua` 键的**存在性**
// （见 hasSiHuaKey），它搞错了 `npm test` 也不会红 —— 只有字节级比对能抓住。
// 详见 docs/superpowers/specs/2026-09-25-duckdb-corpus-source-design.md 的 4.2。

/** `samples` 表的一行（只列本模块用到的列）。 */
export interface SampleRow {
	year: number;
	month: number;
	day: number;
	/** **时辰序号** 0–11（不是 24 小时制的小时；库中正是此时辰序号）。 */
	hour: number;
	gender: string;
	longitude: number;
	lunar_year: number;
	lunar_month: number;
	lunar_day: number;
	year_stem: number;
	year_branch: number;
	is_leap_month: boolean;
	ming_gong_branch: number;
	shen_gong_branch: number;
	wuxing_ju: number;
	wuxing_ju_name: string;
	ziwei_pos: number;
	current_age: number;
	current_daxian_index: number;
}

/** `palaces` 表的一行（只列本模块用到的列）。 */
export interface PalaceRow {
	branch: number;
	stem: number;
	/** **iztro 原生口径**宫名（有「仆役」无「交友」）；翻译交给 `compare.ts` 的 normalizePalaceName。 */
	palace_name: string;
	major_stars: string[];
	lucky_stars: string[];
	sha_stars: string[];
	minor_stars: string[];
	/** 与 `major_stars` **按下标配对**。 */
	major_brightness: string[];
	/** 形如 `["巨门:权"]`；某星无四化则**不在数组内**。 */
	sihua_stars: string[];
	is_ming_gong: boolean;
	is_shen_gong: boolean;
	is_current_daxian: boolean;
	daxian_start: number;
	daxian_end: number;
}

// 四化表从内核取，不在此另抄一份 —— 它是四化的唯一定义处。
// ⚠️ 与 compare.ts 取 IZTRO_TO_PROJECT_PALACE 同理，必须动态获取（见文件头注释）。
const { SI_HUA_TABLE } = await loadConstants();
const SIHUA_STARS: ReadonlySet<string> = new Set(Object.values(SI_HUA_TABLE).flat());

/**
 * 重建出的星曜是否该带 `siHua` **键**（键的存在性，与「值为 `""`」是两回事）。
 *
 * 实测（全库扫 2000 条样本、按星名聚合、无一混用）：
 *   恒有键 18 颗 = 14 主星 + 左辅/右弼/文昌/文曲
 *   恒无键 54 颗 = 天魁/天钺/禄存/天马 + 全部煞星与杂曜
 *
 * 18 ≠ 四化表自身的覆盖数 15：表里 40 个格子去重是 15 颗（11 主星 + 4 辅星），差额来自
 * **终生不参与四化的三颗主星** 天府/天相/七杀 —— 它们有键（因为 type 是 major）、值恒为 ""。
 * 所以规则拆成两半：major 一侧出 14 颗，SIHUA_STARS 一侧只额外补进 4 颗辅星。
 */
function hasSiHuaKey(type: Star["type"], name: string): boolean {
	return type === "major" || SIHUA_STARS.has(name);
}

/** 从 `palaces.sihua_stars`（形如 `["巨门:权"]`）取该星的四化值；该星无四化则 `""`。 */
function siHuaOf(p: PalaceRow, name: string): string {
	for (const entry of p.sihua_stars ?? []) {
		const i = entry.indexOf(":");
		if (i > 0 && entry.slice(0, i) === name) return entry.slice(i + 1);
	}
	return "";
}

/**
 * 一个宫 → `BaselinePalace`。
 *
 * ⚠️ **键序即 JSON 输出顺序**，必须与 jsonl 逐字一致：`branch, stem, name, stars,
 *    daXianAge, isMingGong, isShenGong, isCurrentDaXian`。调换字面量里的书写顺序
 *    会让 charts.jsonl 产生 diff（比对器察觉不到，只有字节级互验能抓住）。
 */
function palaceOf(p: PalaceRow): BaselinePalace {
	const stars: BaselineStar[] = [];

	// 顺序恒为 major → lucky → sha → minor。实测 1200 条样本 × 12 宫 = 14,400 个宫，
	// 段序违例 0 处，故四段直接拼接，不需要按类型排序。
	const majors = p.major_stars ?? [];
	const brightness = p.major_brightness ?? [];
	for (let i = 0; i < majors.length; i++) {
		stars.push({
			name: majors[i],
			type: "major",
			brightness: brightness[i], // 按下标配对；实测长度相等且无空串
			siHua: siHuaOf(p, majors[i]), // 主星恒有键
		});
	}
	for (const name of p.lucky_stars ?? []) {
		if (hasSiHuaKey("lucky", name)) {
			stars.push({ name, type: "lucky", siHua: siHuaOf(p, name) });
		} else {
			stars.push({ name, type: "lucky" }); // 整键缺失，不是 ""
		}
	}
	for (const name of p.sha_stars ?? []) stars.push({ name, type: "sha" });
	for (const name of p.minor_stars ?? []) stars.push({ name, type: "minor" });

	return {
		branch: p.branch,
		stem: p.stem,
		name: p.palace_name,
		stars,
		daXianAge: [p.daxian_start, p.daxian_end],
		isMingGong: p.is_ming_gong,
		isShenGong: p.is_shen_gong,
		isCurrentDaXian: p.is_current_daxian,
	};
}

/**
 * 12 个宫的 `[daxian_start, daxian_end]` 即 12 个大限，**按 `startAge` 升序**排列。
 *
 * ⚠️ 比对器对 `daXians` 是**按下标**逐项比的（`aD[i]` vs `bD[i]`），顺序错了直接报红 ——
 *    这与 `palaces` 按 `branch` 建索引不同。库中行序是丑起，不能直接用。
 */
function daXiansOf(palaces: PalaceRow[]): BaselineDaXian[] {
	return [...palaces] // 复制：不就地改动调用方的数组
		.sort((a, b) => a.daxian_start - b.daxian_start)
		.map(p => ({
			startAge: p.daxian_start,
			endAge: p.daxian_end,
			palaceBranch: p.branch,
			palaceName: p.palace_name,
		}));
}

/**
 * 关系表行 → `BaselineSample`。**纯函数**：不碰数据库、不碰文件系统，故可被 `npm test`
 * 用合成行覆盖（`test/sample-source.test.ts`）。
 *
 * ⚠️ 各层的**键插入顺序**必须与 jsonl 完全一致 —— `JSON.stringify` 按插入顺序输出，
 *    而 `verify-source.ts` 是逐字节比对。顺序见本文件顶部与 spec 的「事实基线」。
 *
 * @param sample  `samples` 表的一行
 * @param palaces 该样本的 12 行 `palaces`，**已按 `(branch + 10) % 12` 排好**（寅起）
 */
export function rowsToSample(sample: SampleRow, palaces: PalaceRow[]): BaselineSample {
	const birthInfo: BirthInfo = {
		year: sample.year,
		month: sample.month,
		day: sample.day,
		hour: sample.hour,
		gender: sample.gender === "female" ? "female" : "male",
		longitude: sample.longitude,
	};

	// ⚠️ 类型不能光写 `BaselineChart` —— 它接口里**没有** `birthInfo` / `currentAge` /
	//    `currentDaXianIndex` 三个字段，但 jsonl 的每一行都有它们（是 JSON.parse 带进来的
	//    多余字段，build-fixtures 写盘时原样保留）。不填它们，重写出的 charts.jsonl 会凭空少字段。
	//    Global Constraints 禁止改 compare.ts 的契约，所以在这里显式扩展类型。
	const chart: BaselineChart & {
		birthInfo: BirthInfo;
		currentAge: number;
		currentDaXianIndex: number;
	} = {
		birthInfo: { ...birthInfo },
		lunarInfo: {
			lunarYear: sample.lunar_year,
			lunarMonth: sample.lunar_month,
			lunarDay: sample.lunar_day,
			yearStem: sample.year_stem,
			yearBranch: sample.year_branch,
			isLeapMonth: sample.is_leap_month,
		},
		mingGongBranch: sample.ming_gong_branch,
		shenGongBranch: sample.shen_gong_branch,
		wuxingJu: sample.wuxing_ju,
		wuxingJuName: sample.wuxing_ju_name,
		ziweiPos: sample.ziwei_pos,
		palaces: palaces.map(palaceOf),
		daXians: daXiansOf(palaces),
		currentAge: sample.current_age,
		currentDaXianIndex: sample.current_daxian_index,
	};

	return { birthInfo, chart };
}

// ── 查询 ──

/**
 * 一条 JOIN 结果行 = `samples` 的列 + `palaces` 的列。
 *
 * ⚠️ `sample_id` 在 JS 侧是 **BigInt**（DuckDB 的 bigint 列经 `yieldRowObjectJs` 不转 number）。
 *    `BigInt(1) !== 1` 恒为 `true`，所以**分组前必须 `Number()` 归一**，否则每组都退化成
 *    「一行一个样本」—— 而且不会报错，只会静默产出 12 倍数量的畸形样本。
 */
type JoinedRow = SampleRow & PalaceRow & { sample_id: bigint };

/**
 * 本模块用到的全部列。`s.sample_id` 供流式遍历分组用（单条取时多余，但共用一条 SQL 更好维护）。
 *
 * ⚠️ 刻意**不** `SELECT *`：库里有 8 个本模块不用的 `sihua_*_star` / `sihua_*_palace` 列，
 *    还有 `topics` 那套论断文本。只取要用的，622 万行的流式读取才不会被无用列拖慢。
 */
const COLUMNS = `
	s.sample_id,
	s.year, s.month, s.day, s.hour, s.gender, s.longitude,
	s.lunar_year, s.lunar_month, s.lunar_day, s.year_stem, s.year_branch, s.is_leap_month,
	s.ming_gong_branch, s.shen_gong_branch, s.wuxing_ju, s.wuxing_ju_name, s.ziwei_pos,
	s.current_age, s.current_daxian_index,
	p.branch, p.stem, p.palace_name,
	p.major_stars, p.lucky_stars, p.sha_stars, p.minor_stars, p.major_brightness, p.sihua_stars,
	p.is_ming_gong, p.is_shen_gong, p.is_current_daxian,
	p.daxian_start, p.daxian_end`;

const FROM = `FROM samples s JOIN palaces p USING (sample_id)`;

/** 宫位必须排成寅起 `[2,3,…,11,0,1]` —— 库中行的物理顺序是丑起 `[1,0,11,…,2]`。 */
const ORDER = `ORDER BY s.sample_id, (p.branch + 10) % 12`;

/** 出生五元组主键（库中唯一确定一条样本）。 */
const KEY_COLUMNS = "s.year = ? AND s.month = ? AND s.day = ? AND s.hour = ? AND s.gender = ?";

/**
 * 按出生信息精确取一条样本；不存在返回 `null`。
 *
 * ⚠️ `birthInfo.hour` 是**时辰序号** 0–11（12=晚子时，语料中不存在）。
 *    `build-fixtures.ts` 的槽位公式恒产出 0–11。
 *
 * ⚠️ 返回 `null` 而非抛错是有意的：`build-fixtures.ts` 在闰月边界上真会遇到取不到的槽位，
 *    它的既有行为是打印「样本缺失」后 `continue`。抛错会让整个重建中断。
 */
export async function fetchSample(birthInfo: BirthInfo): Promise<BaselineSample | null> {
	const conn = await openSource();
	const reader = await conn.runAndReadAll(
		`SELECT ${COLUMNS} ${FROM} WHERE ${KEY_COLUMNS} ${ORDER}`,
		[birthInfo.year, birthInfo.month, birthInfo.day, birthInfo.hour, birthInfo.gender]
	);
	// 唯一一处类型断言：驱动把行值声明为宽松的 `JS` 联合，而我们**刚刚**用上面的 SELECT
	// 亲手指定了列名与顺序，类型由构造保证。断言在 SELECT 旁边，改了列名会立刻失配。
	const rows = reader.getRowObjectsJS() as unknown as JoinedRow[];
	if (rows.length === 0) return null;

	// 只借 `first` 的样本级列（任一 JOIN 行都携带同一份样本列）；`rows` 必须传**全部 12 行**
	// —— `rowsToSample` 的 `palaces.map` 与 `daXiansOf(palaces)` 对整个数组照用，传少了会
	// 产出宫数不足的畸形盘。
	const [first] = rows;
	return rowsToSample(first, rows);
}
