/**
 * @file 文件缓存（sha256 名）。@remarks 见 docs/code/cli-chart.md。
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { dirname, resolve } from "node:path";

import { generateChart, getLunarInfo } from "@/algorithm";
import type { BirthInfo, ZiweiChart } from "@/types";

/**
 * 格式版本，非算法版本。@remarks 改结构/升 iztro 必递增。
 */
export const CACHE_VERSION = 2;

/**
 * 隔离标签。@remarks 退回 shared（见 {@link cacheRootDir}）。@returns u/n/shared
 */
function userTag(): string {
	try {
		// uid -1 未知
		const uid = userInfo().uid;
		return uid >= 0 ? `u${uid}` : `n${userInfo().username}`;
	} catch {
		return "shared";
	}
}

/**
 * 根目录 = os.tmpdir() 子目录。@returns 绝对路径
 */
export function cacheRootDir(): string {
	return resolve(tmpdir(), `purplestar-astrology-v${CACHE_VERSION}-${userTag()}`);
}

/**
 * 缓存外壳：v/lunarYear 失效判据。@remarks 改键名即递增 {@link CACHE_VERSION}。
 */
export interface CacheEntry {
	/** 格式版本 = {@link CACHE_VERSION} */
	v: number;
	/** 写入农历年；跨年重排 */
	lunarYear: number;
	/** 写入时刻，排查用 */
	savedAt: string;
	/** 命盘本体 */
	chart: ZiweiChart;
}

/** {@link generateChartCached} 参数 */
export interface ChartCacheOptions {
	/** 跳过缓存（--no-cache）；旁路 {@link setCacheBypassAll} */
	noCache?: boolean;
	/** 时钟注入（测试） */
	now?: Date;
}

// 整链旁路
// 回归链路调一次即整链直排——「哪些调用点被豁免」读设定点即知。
// 子进程状态过不去：探针 argv 显式带 --no-cache。
let bypassAll = false;

/**
 * 旁路开关。@param v - true 开启 @returns 无
 */
export function setCacheBypassAll(v: boolean): void {
	bypassAll = v;
}

/**
 * 规范化：固定键序短键。@remarks JSON.stringify 键序变则键飘。
 * @param birth - 六字段 @returns 固定键序 JSON
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
 * 缓存键：sha256。@remarks 必不碰撞，否则把盘发给别人。
 * @param birth - 经 {@link canonicalBirth} @returns 十六进制
 */
export function cacheKeyOf(birth: BirthInfo): string {
	return createHash("sha256").update(canonicalBirth(birth)).digest("hex");
}

/**
 * 缓存路径。@remarks ZIWEI_CACHE_DIR → {@link cacheRootDir}。
 * @param birth - 决定文件名 @returns 绝对路径
 */
export function cacheFileFor(birth: BirthInfo): string {
	const override = process.env.ZIWEI_CACHE_DIR;
	const dir = override !== undefined && override !== "" ? resolve(override) : cacheRootDir();
	return resolve(dir, `${cacheKeyOf(birth)}.json`);
}

/**
 * 农历年，与 generateChart 同算法。
 * @param now - 时刻 @returns 农历年（正月初一为界）
 */
export function todayLunarYear(now: Date): number {
	return getLunarInfo(now.getFullYear(), now.getMonth() + 1, now.getDate()).lunarYear;
}

/**
 * 读缓存校验，不过即 null。@returns 可用盘 @remarks 绝不抛错。
 * @param file - {@link cacheFileFor} @param birth - 须与 chart.birthInfo 一致 @param lunarYear - {@link todayLunarYear}，不符即过期
 */
function readEntry(file: string, birth: BirthInfo, lunarYear: number): ZiweiChart | null {
	let raw: string;
	try {
		raw = readFileSync(file, "utf8");
	} catch {
		return null;
	}
	// 先挡非对象——「声明了什么就校验什么」
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
	// 哈希碰撞守卫：盘须属于这份出生信息
	if (canonicalBirth(c.birthInfo) !== canonicalBirth(birth)) {
		return null;
	}
	return c;
}

/**
 * 原子写：先写临时文件再 rename。@remarks 失败静默降级；目录 0o700。
 * @param file - 目标 @param entry - 外壳 @returns 无；失败即「下次仍然现排」
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
			// 清理也失败
		}
	}
}

/**
 * 排盘+缓存入口。@param birth - 出生信息 @param opts - { noCache, now }；缺省「用缓存、时钟取系统当前」 @returns 命中/现排 @remarks 禁缓存单点（--no-cache 与 {@link setCacheBypassAll}）：回归须直排防假绿
 */
export function generateChartCached(birth: BirthInfo, opts: ChartCacheOptions = {}): ZiweiChart {
	const now = opts.now ?? new Date();
	if (opts.noCache || bypassAll) {
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
