/**
 * chart-cache.ts —— 排盘结果的文件缓存层（文件名 = 出生信息的 sha256）。
 *
 * 排盘对同一份 `BirthInfo` 是确定性的，而一轮对话里同一份出生信息会被反复排，故落盘；
 * 缓存的是 `generateChart` 的返回值（纯数据），**不缓存任何渲染文本**（渲染几乎不花钱，
 * 却与专题参数强相关）。
 *
 * **失效靠两个维度**：格式版本 `CACHE_VERSION`（改输出结构 / 口径 / 升级 iztro 必须递增）
 * 与农历年 `lunarYear`（虚岁以正月初一为界，跨年必变）。
 * **正确性优先于命中率**：读取 / 解析 / 结构校验 / 出生信息回验任一步不通过即重排覆写。
 *
 * ⚠️ 完整论证（为什么需要、放在哪、uid 隔离、原子写、静默降级、禁缓存单点）
 *    见 docs/code/cli-chart.md。
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { dirname, resolve } from "node:path";

import { generateChart, getLunarInfo } from "@/algorithm";
import type { BirthInfo, ZiweiChart } from "@/types";

/**
 * 缓存**格式**版本（不是排盘算法版本）。
 *
 * @remarks
 * ⚠️ 改 `generateChart` 的输出结构、改盘算法口径、或升级 iztro 之后**必须递增**：旧文件
 *    里的 `chart` 可能已经与新内核不同形。递增即整批失效，成本远小于「拿错盘」
 *    （见 docs/code/cli-chart.md）。
 */
export const CACHE_VERSION = 1;

/**
 * 用户隔离标签：`u<uid>`（POSIX）或 `n<用户名>`（拿不到 uid 时，如 Windows）。
 *
 * @remarks
 * 拿不到就退回共享标签 —— 此时 `/tmp` 里的目录可能被别人抢先创建（见
 * {@link cacheRootDir} 的隔离理由），但写盘失败会被静默降级为现排，不会排错盘。
 */
function userTag(): string {
	try {
		// uid 在 Windows 上是 -1（未知），不是 >= 0，故不能直接用它做标签
		const uid = userInfo().uid;
		return uid >= 0 ? `u${uid}` : `n${userInfo().username}`;
	} catch {
		return "shared";
	}
}

/**
 * 缓存根目录 = 系统临时目录（`os.tmpdir()`）下的应用专属子目录。
 *
 * @remarks
 * 系统临时目录下的应用专属子目录，**不写 skill 包目录**（包内零写入，且同机多份拷贝共享
 * 一份缓存）。目录名带 uid（`/tmp` 多用户共享，缓存里是生辰命盘数据）与 `CACHE_VERSION`
 * （换版本即换目录）。代价：系统清理后冷排一次、空间写满时静默降级为现排 —— 缓存只为
 * 提速，丢了只慢一次。要持久缓存就设 `ZIWEI_CACHE_DIR`。见 docs/code/cli-chart.md。
 */
export function cacheRootDir(): string {
	return resolve(tmpdir(), `purplestar-astrology-v${CACHE_VERSION}-${userTag()}`);
}

/**
 * 缓存文件外壳：`v` / `lunarYear` 是失效判据，`chart` 是本体，`savedAt` 仅供人排查。
 *
 * @remarks
 * ⚠️ 这是**落盘的跨版本契约**：改键名 / 改语义就要把 {@link CACHE_VERSION} 递增，否则
 *    旧文件会被当有效缓存读回来（见 docs/code/cli-chart.md）。
 */
export interface CacheEntry {
	/** 缓存格式版本，须等于 {@link CACHE_VERSION} */
	v: number;
	/** 写入当天的农历年 —— 命盘虚岁以农历正月初一为界，跨年必须重排 */
	lunarYear: number;
	/** 写入时刻（ISO 8601）。仅供排查，不参与失效判定 */
	savedAt: string;
	chart: ZiweiChart;
}

/** {@link generateChartCached} 的可选参数。 */
export interface ChartCacheOptions {
	/** 跳过缓存：不读也不写（`--no-cache` / `ZIWEI_NO_CACHE` 都走这里） */
	noCache?: boolean;
	/** 时钟注入（测试用；缺省即 `new Date()`） */
	now?: Date;
}

/**
 * 出生信息的规范化序列化 —— **固定键序的短键**，与字段书写顺序无关。
 *
 * @remarks
 * 为什么不用 `JSON.stringify(birth)`：对象键序取决于键的插入顺序，同一份出生信息
 * 经不同路径构造出来可能序列化成不同字符串，缓存键就会飘。定序短键消除这一类，
 * 且顺手把键名压短。
 */
function canonicalBirth(birth: BirthInfo): string {
	return JSON.stringify({
		d: birth.day,
		g: birth.gender,
		m: birth.month,
		n: birth.name ?? null,
		t: birth.timeIndex,
		y: birth.year,
	});
}

/**
 * 缓存键：出生信息的 sha256 十六进制串（即缓存文件名，不含扩展名）。
 *
 * @remarks
 * sha256 而非短哈希：生日空间的键必须**绝不碰撞** —— 碰撞的后果不是丢性能，是可能把
 * 一张盘发给另一个人（`readEntry` 的出生信息回验只是最后一道防线，不该指望它）。
 */
export function cacheKeyOf(birth: BirthInfo): string {
	return createHash("sha256").update(canonicalBirth(birth)).digest("hex");
}

/**
 * 某份出生信息当前对应的缓存文件路径（测试与运维排查用）。
 *
 * @remarks
 * 目录解析顺序：`ZIWEI_CACHE_DIR` 环境变量（测试隔离 / 想要持久缓存时用）→ 默认
 * {@link cacheRootDir}（系统临时目录）。两者都与 cwd 无关，也不与 skill 安装位置绑定。
 */
export function cacheFileFor(birth: BirthInfo): string {
	const override = process.env.ZIWEI_CACHE_DIR;
	const dir = override !== undefined && override !== "" ? resolve(override) : cacheRootDir();
	return resolve(dir, `${cacheKeyOf(birth)}.json`);
}

/**
 * 给定时刻的农历年 —— 与 `generateChart` 内部同一算法（`algorithm.ts` 的 `getLunarInfo`），
 * 故缓存的有效期与虚岁口径天然对齐。
 */
export function todayLunarYear(now: Date): number {
	return getLunarInfo(now.getFullYear(), now.getMonth() + 1, now.getDate()).lunarYear;
}

/**
 * 读缓存并逐层校验，任何一步不通过即返回 `null`（= 未命中）。
 *
 * @returns 可用的 `ZiweiChart`；无文件 / 版本不符 / 农历年不符 / 结构不符 / 出生信息
 *   对不上时一律 `null`
 *
 * @remarks
 * 本函数**绝不抛错**：无文件不是错误（首次排盘就是它），文件损坏也不是 —— 都只是
 * 「缓存不可用」，由调用方重排覆写。故 `readFileSync` 与 `JSON.parse` 两处失败都吞成 `null`。
 *
 * ⚠️ JSON 往返会丢掉值为 `undefined` 的可选键（结构上与内存态 `ZiweiChart` 兼容），故缓存
 *    返回的对象缺这些键属正常 —— 测试对拍时双方都要先归一到 JSON 形态再比
 *    （见 docs/code/cli-chart.md）。
 */
function readEntry(file: string, birth: BirthInfo, lunarYear: number): ZiweiChart | null {
	let raw: string;
	try {
		raw = readFileSync(file, "utf8");
	} catch {
		return null;
	}
	// JSON.parse 只能给出 unknown（项目不用 any 绕过报错），故先挡一层非对象，
	// 收窄后再按 CacheEntry 取字段 —— 下面的逐层守卫即「声明了什么就校验什么」。
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== "object") {
		return null;
	}
	const entry = parsed as CacheEntry;
	if (entry.v !== CACHE_VERSION) {
		return null;
	}
	if (entry.lunarYear !== lunarYear) {
		return null;
	}
	const c = entry.chart;
	if (!c || typeof c !== "object" || !Array.isArray(c.palaces) || c.palaces.length !== 12) {
		return null;
	}
	if (!c.birthInfo || typeof c.birthInfo !== "object") {
		return null;
	}
	// 哈希碰撞守卫：键指向的盘必须是这一份出生信息的盘。挡不住就把 A 的盘发给 B，
	// 比多排一次盘恶劣得多。
	if (canonicalBirth(c.birthInfo) !== canonicalBirth(birth)) {
		return null;
	}
	return c;
}

/**
 * 原子写盘：先写同目录临时文件再 `rename`。
 *
 * @remarks
 * `rename` 在同目录内是原子的 —— 并发排同一张盘时，读者永远不会看到截断的半截 JSON。
 *
 * ⚠️ 失败一律**静默降级**：写盘只为提速，命盘此刻已在调用方手上，此时再抛错就成了
 *    「缓存写不进去 → 排盘也失败」。catch 里连临时文件清理都再包一层 try —— 目录不可用
 *    时 `rmSync` 同样会抛（曾直接把整个调用顶穿）。建目录用 `0o700`：缓存里是生辰命盘
 *    数据。完整理由见 docs/code/cli-chart.md。
 */
function writeEntry(file: string, entry: CacheEntry): void {
	const tmp = `${file}.${process.pid}.tmp`;
	try {
		mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
		writeFileSync(tmp, JSON.stringify(entry), "utf8");
		renameSync(tmp, file);
	} catch {
		try {
			rmSync(tmp, { force: true });
		} catch {
			// 清理也失败（目录不可用等）：无临时文件可留，无事发生
		}
	}
}

/**
 * 排盘 + 缓存：本模块对外的**唯一**入口，替代裸调 `generateChart`。
 *
 * @param birth - 出生信息（`BirthInfo`；`name` 参与缓存键，因为它进 `chart.birthInfo`）
 * @param opts - `{ noCache, now }`；缺省即「用缓存、时钟取系统当前」
 * @returns 命盘：命中缓存时是文件里那份，未命中时是现排的（并落盘供下次复用）
 *
 * @remarks
 * 禁缓存在此**单点**判定（`--no-cache` 与 `ZIWEI_NO_CACHE` 都归一到这里）：selftest 与
 * `npm test` 走进程内排盘，必须强制直排 —— 否则内核改动后回归会命中改动前写下的缓存
 * 文件而**假绿**，那比没有回归更坏。缓存失败一律静默降级为「现排、不缓存」
 * （见 docs/code/cli-chart.md）。
 */
export function generateChartCached(birth: BirthInfo, opts: ChartCacheOptions = {}): ZiweiChart {
	const now = opts.now ?? new Date();
	if (opts.noCache || process.env.ZIWEI_NO_CACHE) {
		return generateChart(birth);
	}
	const lunarYear = todayLunarYear(now);
	const file = cacheFileFor(birth);
	const hit = readEntry(file, birth, lunarYear);
	if (hit) {
		return hit;
	}
	const chart = generateChart(birth);
	writeEntry(file, { v: CACHE_VERSION, lunarYear, savedAt: now.toISOString(), chart });
	return chart;
}
