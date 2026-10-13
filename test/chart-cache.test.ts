// ── 层 3：排盘缓存层（scripts/cli/chart-cache.ts）──
//
// 缓存的正确性靠**行为断言**而不是「跑两次输出相同」来验：后者在缓存根本没生效时
// 也成立（两次现排本来就一致），是零信号断言。故本文件的核心手法是**哨兵 chart** ——
// 手工往缓存文件里塞一份「mingZhu 被改成哨兵串」的合法命盘，再调缓存层：
// 拿到哨兵 = 真的读了文件；拿到现排 = 走了失效路径重排。每个失效维度各测一次。
//
// 隔离：每个用例一个 mkdtemp 临时目录（经 ZIWEI_CACHE_DIR 注入），不碰仓库 .cache/；
// 并在 beforeEach 里摘掉 ZIWEI_NO_CACHE —— npm test 会给全链设上它（防回归假绿），
// 缓存层自己的用例必须能让缓存真的生效，故此处显式接管该变量。
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { BirthInfo, ZiweiChart } from "@/types";
import { load, loadAlgorithm } from "./lib/loader.ts";

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(HERE, "..");
const CLI = resolve(SKILL_ROOT, "scripts/purple-star.ts");

const cacheNs = await load<typeof import("@/cli/chart-cache")>("@/cli/chart-cache");
const {
	generateChartCached,
	cacheFileFor,
	cacheKeyOf,
	cacheRootDir,
	todayLunarYear,
	CACHE_VERSION,
} = cacheNs;
const { generateChart } = await loadAlgorithm();

/** 样例出生信息（2011-06-24 巳时男；测试数据为虚构）。 */
const SAMPLE: BirthInfo = { year: 2011, month: 6, day: 24, timeIndex: 5, gender: "male" };

/** 固定时钟：让 meta 里的农历年 / savedAt 完全确定。 */
const FIXED = new Date(2026, 5, 24, 12, 0, 0);

/** 哨兵串：写进假缓存的 `mingZhu`，出现在返回值里即证明读了缓存文件。 */
const SENTINEL = "__CACHE_SENTINEL__";

let dir: string;
let savedNoCache: string | undefined;

/** 把一份合法缓存文件写到 `file`；`patch` 可覆盖任一 meta 字段（造失效场景用）。 */
function writeCacheFile(
	file: string,
	chart: ZiweiChart,
	patch: Record<string, unknown> = {}
): void {
	writeFileSync(
		file,
		JSON.stringify({
			v: CACHE_VERSION,
			lunarYear: todayLunarYear(FIXED),
			savedAt: FIXED.toISOString(),
			chart,
			...patch,
		}),
		"utf8"
	);
}

/** 真盘的 JSON 往返副本 + 哨兵标记（只在 mingZhu 上动，故其余字段仍合法）。 */
function sentinelChart(): ZiweiChart {
	const c = JSON.parse(JSON.stringify(generateChart(SAMPLE))) as ZiweiChart;
	c.mingZhu = SENTINEL;
	return c;
}

/** 当前 SAMPLE 的缓存文件路径（ZIWEI_CACHE_DIR 已由 beforeEach 指到临时目录）。 */
const cacheFile = (): string => cacheFileFor(SAMPLE);

/**
 * 归一到 JSON 形态 —— 缓存的固有边界：`JSON.stringify` 会丢掉值为 `undefined` 的可选键
 * （`Star.mutagen` / `decadalRange` / `brightness` 等）。这些键本就可选、缺失合法，
 * 但 `deepStrictEqual` 会判 `{a: undefined}` ≠ `{}`。故凡「落盘内容 vs 内存盘」的对拍，
 * 双方都要先过这一层。
 */
const asJson = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "ziwei-cache-"));
	process.env.ZIWEI_CACHE_DIR = dir;
	// 摘掉 npm test 设的禁缓存开关：缓存层自己的用例要让缓存生效
	savedNoCache = process.env.ZIWEI_NO_CACHE;
	delete process.env.ZIWEI_NO_CACHE;
});

afterEach(() => {
	if (savedNoCache === undefined) {
		delete process.env.ZIWEI_NO_CACHE;
	} else {
		process.env.ZIWEI_NO_CACHE = savedNoCache;
	}
	delete process.env.ZIWEI_CACHE_DIR;
	rmSync(dir, { recursive: true, force: true });
});

describe("chart-cache · 落盘与命中", () => {
	it("冷排落盘：文件存在、meta 三字段齐全，且盘面等于现排结果", () => {
		const chart = generateChartCached(SAMPLE, { now: FIXED });
		const file = cacheFile();
		assert.ok(existsSync(file), `缓存文件应落盘：${file}`);
		const entry = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
		assert.equal(entry.v, CACHE_VERSION, "meta 须记当前缓存格式版本");
		assert.equal(entry.lunarYear, todayLunarYear(FIXED), "meta 须记注入时钟的农历年");
		assert.equal(entry.savedAt, FIXED.toISOString(), "savedAt 须取注入时钟");
		assert.deepEqual(entry.chart, asJson(chart), "落盘的盘面须与现排结果一致（JSON 契约上）");
	});

	it("命中读回：第二次调用读的是文件而非重排（哨兵原样返回）", () => {
		writeCacheFile(cacheFile(), sentinelChart());
		const hit = generateChartCached(SAMPLE, { now: FIXED });
		assert.equal(hit.mingZhu, SENTINEL, "应命中缓存文件（拿到哨兵），而不是又排一次");
		// 命中时不得改写文件（否则「读到哪写回哪」的循环会掩盖写入失败）
		const entry = JSON.parse(readFileSync(cacheFile(), "utf8")) as { savedAt: string };
		assert.equal(entry.savedAt, FIXED.toISOString());
	});

	it("键与文件名：同输入同键、异输入异键，文件名即 sha256", () => {
		assert.equal(cacheKeyOf(SAMPLE), cacheKeyOf({ ...SAMPLE }), "同输入必须同键");
		assert.notEqual(
			cacheKeyOf(SAMPLE),
			cacheKeyOf({ ...SAMPLE, timeIndex: 12 }),
			"时辰不同须异键"
		);
		assert.notEqual(
			cacheKeyOf(SAMPLE),
			cacheKeyOf({ ...SAMPLE, gender: "female" }),
			"性别不同须异键"
		);
		assert.match(cacheKeyOf(SAMPLE), /^[0-9a-f]{64}$/, "键须是 sha256 十六进制");
		assert.equal(cacheFile(), resolve(dir, `${cacheKeyOf(SAMPLE)}.json`), "文件名即键 + .json");
	});

	it("原子写不留 .tmp 残留", () => {
		generateChartCached(SAMPLE, { now: FIXED });
		assert.deepEqual(readdirSync(dir), [`${cacheKeyOf(SAMPLE)}.json`], "目录里只应有最终文件");
	});
});

describe("chart-cache · 五条失效路径（任何一条都必须重排，绝不返回坏盘）", () => {
	it("格式版本不符 → 重排", () => {
		writeCacheFile(cacheFile(), sentinelChart(), { v: CACHE_VERSION + 1 });
		const got = generateChartCached(SAMPLE, { now: FIXED });
		assert.notEqual(got.mingZhu, SENTINEL, "版本不符必须重排");
	});

	it("农历年跨年 → 重排，并覆写成当前农历年", () => {
		writeCacheFile(cacheFile(), sentinelChart(), { lunarYear: todayLunarYear(FIXED) - 1 });
		const got = generateChartCached(SAMPLE, { now: FIXED });
		assert.notEqual(got.mingZhu, SENTINEL, "农历年不同必须重排（虚岁口径跨春节即变）");
		const entry = JSON.parse(readFileSync(cacheFile(), "utf8")) as { lunarYear: number };
		assert.equal(entry.lunarYear, todayLunarYear(FIXED), "重排后须覆写为当前农历年");
	});

	it("JSON 损坏（半截文件）→ 不抛错，重排并覆写", () => {
		writeFileSync(cacheFile(), '{"v":1,"lunarYear":2026,"chart":{"palac', "utf8");
		const got = generateChartCached(SAMPLE, { now: FIXED });
		assert.equal(got.mingZhu, generateChart(SAMPLE).mingZhu, "损坏文件须当未命中重排");
		const entry = JSON.parse(readFileSync(cacheFile(), "utf8")) as Record<string, unknown>;
		assert.equal(entry.v, CACHE_VERSION, "覆写后的文件须是合法缓存");
	});

	it("结构不符（palaces 不是 12 宫）→ 重排", () => {
		const bad = sentinelChart();
		bad.palaces = bad.palaces.slice(0, 5);
		writeCacheFile(cacheFile(), bad);
		const got = generateChartCached(SAMPLE, { now: FIXED });
		assert.notEqual(got.mingZhu, SENTINEL, "结构不符必须重排");
		assert.equal(got.palaces.length, 12, "返回的须是完整命盘");
	});

	it("birthInfo 不匹配（哈希碰撞守卫）→ 重排，绝不把别人的盘发出去", () => {
		const alien = sentinelChart();
		alien.birthInfo = { ...alien.birthInfo, day: 1, year: 1999 };
		writeCacheFile(cacheFile(), alien);
		const got = generateChartCached(SAMPLE, { now: FIXED });
		assert.notEqual(got.mingZhu, SENTINEL, "键指向的盘与出生信息对不上时必须重排");
		assert.deepEqual(
			got.birthInfo,
			generateChart(SAMPLE).birthInfo,
			"返回的须是本份出生信息的盘"
		);
	});
});

describe("chart-cache · 开关与时钟", () => {
	it("noCache：不读也不写（哨兵文件保持原样）", () => {
		writeCacheFile(cacheFile(), sentinelChart());
		const got = generateChartCached(SAMPLE, { now: FIXED, noCache: true });
		assert.notEqual(got.mingZhu, SENTINEL, "--no-cache 必须直排，不读缓存");
		const entry = JSON.parse(readFileSync(cacheFile(), "utf8")) as { chart: ZiweiChart };
		assert.equal(entry.chart.mingZhu, SENTINEL, "--no-cache 不得覆写缓存文件");
	});

	it("ZIWEI_NO_CACHE 环境变量同样禁缓存（selftest / npm test 走这条）", () => {
		writeCacheFile(cacheFile(), sentinelChart());
		process.env.ZIWEI_NO_CACHE = "1";
		try {
			const got = generateChartCached(SAMPLE, { now: FIXED });
			assert.notEqual(got.mingZhu, SENTINEL, "环境变量须能禁掉缓存");
		} finally {
			delete process.env.ZIWEI_NO_CACHE;
		}
	});

	it("无缓存时静默跳过写入也不报错（只读文件系统场景）", () => {
		// 指向一个「文件」当目录：mkdirSync 必失败，写盘应被吞掉
		const blocker = resolve(dir, "blocker");
		writeFileSync(blocker, "not a dir", "utf8");
		process.env.ZIWEI_CACHE_DIR = blocker;
		const got = generateChartCached(SAMPLE, { now: FIXED });
		assert.deepEqual(got, generateChart(SAMPLE), "写盘失败须静默降级为现排，结果不变");
	});

	it("now 注入决定 meta 农历年（两个农历年产出互不相同的缓存条目）", () => {
		const early = new Date(2000, 0, 1);
		const late = new Date(2001, 0, 1);
		assert.notEqual(todayLunarYear(early), todayLunarYear(late), "两个时刻须跨农历年");
		generateChartCached(SAMPLE, { now: early });
		const e1 = JSON.parse(readFileSync(cacheFile(), "utf8")) as { lunarYear: number };
		assert.equal(e1.lunarYear, todayLunarYear(early), "meta 须取注入时钟的农历年");
		generateChartCached(SAMPLE, { now: late });
		const e2 = JSON.parse(readFileSync(cacheFile(), "utf8")) as { lunarYear: number };
		assert.equal(e2.lunarYear, todayLunarYear(late), "换时钟后条目须被覆写");
	});

	it("默认目录在系统临时目录下（skill 包内零写入），与 cwd 无关", () => {
		delete process.env.ZIWEI_CACHE_DIR;
		const expected = resolve(cacheRootDir(), `${cacheKeyOf(SAMPLE)}.json`);
		assert.equal(cacheFile(), expected);
		const root = dirname(expected);
		// 两条硬约束：① 必须在 tmpdir 之下 —— skill 目录保持干净、拷走即干净；
		// ② 目录名带缓存版本与用户隔离标签（POSIX 的 /tmp 多用户共享，而缓存里是生辰数据）
		assert.equal(dirname(root), tmpdir(), "缓存根必须在系统临时目录之下");
		assert.match(basename(root), /^purplestar-astrology-v\d+-(u\d+|n.+|shared)$/);
		// skill 包内不该留下缓存目录（这条约束回归过一次，值得钉住）
		assert.equal(
			existsSync(resolve(SKILL_ROOT, ".cache")),
			false,
			"skill 目录里不应出现 .cache/"
		);
	});
});

describe("chart-cache · CLI 端到端", () => {
	const ARGS = [
		"astrology",
		"--date",
		"2011-06-24",
		"--time",
		"07:45",
		"--city",
		"杭州",
		"--gender",
		"male",
		"--json",
	];

	/** 子进程 env：清掉 npm test 的禁缓存开关（空串 = 不生效），指向本用例的临时目录。 */
	const env = (noCache: string) => ({
		...process.env,
		ZIWEI_CACHE_DIR: dir,
		ZIWEI_NO_CACHE: noCache,
	});

	it("两次 CLI 调用输出逐字节一致，且只落一个缓存条目", async () => {
		const a = await execFileAsync(process.execPath, [CLI, ...ARGS], { env: env("") });
		const b = await execFileAsync(process.execPath, [CLI, ...ARGS], { env: env("") });
		assert.equal(a.stdout, b.stdout, "命中缓存的输出须与冷排逐字节一致");
		// 不断言键名：CLI 的出生信息经真太阳时换算（杭州经度校正 + 07:45 → 辰时），
		// 与本文件的 SAMPLE 不是同一份，键自然不同。这里只守「落了且只落一个」。
		assert.equal(
			readdirSync(dir).filter(f => f.endsWith(".json")).length,
			1,
			"两次调用只应落一个缓存条目"
		);
		assert.equal(readdirSync(dir).filter(f => f.endsWith(".tmp")).length, 0, "不留临时文件");
	});

	it("--no-cache 强排：不读也不写（子进程清空缓存目录后仍无文件）", async () => {
		const out = await execFileAsync(process.execPath, [CLI, ...ARGS, "--no-cache"], {
			env: env(""),
		});
		assert.ok(out.stdout.length > 0, "--no-cache 仍须正常输出");
		assert.deepEqual(readdirSync(dir), [], "--no-cache 不得写缓存");
	});

	it("ZIWEI_NO_CACHE=1 的子进程不写缓存（回归链路保证）", async () => {
		const out = await execFileAsync(process.execPath, [CLI, ...ARGS], { env: env("1") });
		assert.ok(out.stdout.length > 0);
		assert.deepEqual(readdirSync(dir), [], "禁缓存时不得写盘");
	});
});
