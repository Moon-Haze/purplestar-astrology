/**
 * chart-cache.ts —— 排盘结果的文件缓存层（文件名 = 出生信息的 sha256）。
 *
 * ## 为什么需要它
 *
 * 本 skill 是「一次调用、一次冷启动」的形态：助手每轮解读都要重跑
 * `node scripts/purple-star.ts astrology …`，而排盘（`generateChart` → iztro + 本项目组装）
 * 是端到端耗时的大头。同一份出生信息在一轮对话里往往被反复排（换专题参数、换视角、
 * 追问某一宫都要重来一次），而**排盘对同一份 `BirthInfo` 是确定性的**——把它落盘，
 * 第二次起就只剩「读文件 + 渲染」。
 *
 * ## 缓存什么、不缓存什么
 *
 * 缓存的是 {@link generateChart} 的返回值（`ZiweiChart`，纯数据）——`--palaces --json`
 * 本就直接序列化它，JSON 往返结构上无损耗。**不缓存任何渲染文本**：渲染由一堆纯函数
 * 从 chart 派生，几乎不花钱，却与专题参数（`--pattern` / `--topic` / …）强相关；
 * 把文本缓存下来等于把整张参数面也塞进缓存键，代价高、收益低。
 *
 * ## 放在哪
 *
 * 系统临时目录（{@link cacheRootDir}）下的应用专属子目录，**不写 skill 包目录** ——
 * 本仓整个可拷进 `~/.claude/skills/` 直接使用，缓存属机器级派生数据，包内零写入
 * （细节与隔离取舍见该函数）。
 *
 * ## 失效靠两个维度（都在文件 meta 里）
 *
 * 1. **格式版本 {@link CACHE_VERSION}** —— 改 `generateChart` 的输出结构、改盘算法口径、
 *    或升级 iztro 之后必须递增；递增即整批失效（重排一次的事）。
 * 2. **农历年 `lunarYear`** —— `generateChart` 内部的 `currentAge` 是**虚岁**且以农历
 *    正月初一为界（algorithm.ts），同一农历年内它恒定、跨年必变。故缓存只在本农历年内
 *    有效：跨春节后首次调用自动重排，不会把去年的虚岁当成今年的。
 *
 * ## 正确性优先于命中率
 *
 * 读取、解析、结构校验、**出生信息回验**任何一步不通过，一律当未命中 → 重排 → 覆写。
 * 出生信息回验是哈希碰撞的守卫：宁可重排一次，也不能把 A 的盘发给 B。
 * 写盘失败（只读文件系统 / 磁盘满）静默跳过 —— 缓存是性能优化，不参与正确性，
 * 不能因为缓存写不进去就让排盘失败。
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
 * ⚠️ 改 `generateChart` 的输出结构（`ZiweiChart` 字段增删改）、改盘算法口径、或升级
 * iztro 之后**必须递增**：旧文件里的 `chart` 可能已经与新内核不同形。
 * 递增即整批失效，成本是每个生日重排一次 —— 远小于「拿错盘」。
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
 * **为什么不放 skill 目录**：本仓整个可拷进 `~/.claude/skills/` 直接使用，缓存是
 * **机器级**的派生数据（随时可重建）。写进包目录会让「拷走即干净」这条性质失效 ——
 * 还得为它加 .gitignore、还得防它被误提交。落到系统临时目录则包内零写入。
 * 附带好处：同一台机器上有多份拷贝时**共享同一份缓存**，不必各排一次。
 *
 * **为什么目录名带 uid**：POSIX 的 `/tmp` 是**多用户共享**目录，而缓存文件里装的是
 * 生辰命盘数据 —— 既不该被别的用户读到，也不能让别人抢占了同名目录再让本进程写失败。
 * 目录名带 uid + {@link writeEntry} 建目录时用 `0o700`，两道都必要（Windows 的
 * `os.tmpdir()` 本就是 per-user 私有目录，那里只起冗余保护作用）。
 *
 * **为什么目录名带 `CACHE_VERSION`**：递增版本即换目录，天然与旧格式缓存隔离，
 * 不必担心「旧文件混进新目录」。
 *
 * **代价（刻意的取舍）**：系统会清理临时目录，重启即冷排一次；临时目录空间也有限
 * （本机 `/tmp` 是 10 MB tmpfs，按 ~9 KB/张约合千张），写满时 {@link writeEntry}
 * 静默降级为现排。缓存只为提速，丢了只慢一次，不影响任何结果。
 * 需要持久缓存就设 `ZIWEI_CACHE_DIR`（如 `~/.cache/purplestar-astrology`）。
 */
export function cacheRootDir(): string {
	return resolve(tmpdir(), `purplestar-astrology-v${CACHE_VERSION}-${userTag()}`);
}

/**
 * 缓存文件外壳：`v` / `lunarYear` 是失效判据，`chart` 是本体，`savedAt` 仅供人排查。
 *
 * @remarks
 * ⚠️ 这是**落盘的跨版本契约**：改键名 / 改语义就要把 {@link CACHE_VERSION} 递增，
 * 否则旧文件会被当有效缓存读回来。
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
 * sha256 而非短哈希：文件名长一点无所谓，而生日空间的键必须**绝不碰撞**——
 * 碰撞的后果不是丢性能，是可能把一张盘发给另一个人（由 {@link readEntry} 的
 * 出生信息回验兜底，但那是最后一道防线，不该指望它）。
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
 * 本函数**绝不抛错**：无文件不是错误（首次排盘就是它），文件损坏（半截 JSON / 非法
 * 语法）也不是 —— 它只是「缓存不可用」，由调用方重排覆写。故 `readFileSync` 与
 * `JSON.parse` 两处失败都静默吞成 `null`。
 *
 * ⚠️ JSON 往返会丢掉值为 `undefined` 的可选键（`Star.mutagen` / `palace.decadalRange`
 *    / `brightness` 等 stringify 时消失），这是**结构上**与内存态 `ZiweiChart` 兼容的
 *    （可选键本就允许缺失），下游读的都是可选链。故缓存返回的对象缺这些键属正常，
 *    测试对拍时双方都要先归一到 JSON 形态再比。
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
 * `rename` 在同目录内是原子的 —— 两个进程同时排同一张盘时，后落地的那个 rename 只是
 * 覆盖成同内容，读者永远不会看到截断的半截 JSON（`writeFileSync` 直写则可能）。
 *
 * ⚠️ 失败一律**静默降级**：写盘只为提速，命盘此刻已在调用方手上，此时再抛错就是
 *    「缓存写不进去 → 排盘也失败」，与本层的承诺相反。故 catch 里连临时文件的清理
 *    都再包一层 try —— 目录根本不可用时 `rmSync` 同样会抛（ENOTDIR / EACCES），
 *    那一次抛错曾直接把整个调用顶穿。
 *
 * 建目录用 `0o700`：缓存文件里是生辰命盘数据，默认临时目录多用户可读不该对它生效。
 * （目录已存在时 mode 不变 —— 此时能读到它的人当初就已拿到过读权限。）
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
 * 禁缓存在此**单点**判定（参数 `--no-cache` 与环境变量 `ZIWEI_NO_CACHE` 都归一到这里）：
 * selftest 与 `npm test` 走进程内排盘，必须强制直排 —— 否则内核改动后回归会命中改动前
 * 写下的缓存文件而**假绿**，那比没有回归更坏。
 *
 * 缓存失败一律静默降级为「现排、不缓存」：命中与否不影响结果，只影响速度。
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
