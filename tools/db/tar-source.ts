/**
 * tar 源物化 —— 把 ziwei-interp 分发 tar（v4 同款格式：MANIFEST.json + SHA256SUMS.txt +
 * year-YYYY.jsonl.zst）转换成 build:db 消费的**月分片目录**（v3 行格式：
 * year-YYYY/YYYY-MM.jsonl.gz，每行 {birthInfo, chart, topics, system}）。
 *
 * 两种行 schema 自动识别：
 *   - v3 行（有 `birthInfo` 键）：chart/topics 自带，**原样直通**（内容零改动）。
 *   - v4 行（有 `k`/`ms` 键）：纯解读数据集（五元组 + 主星 + c 文本，无 chart）——
 *     本仓内核**现场排盘**补 chart，`ms` 与排盘命宫主星交叉校验（不一致计数报警），
 *     `c` 的 13 键作 topics；`t`（字数统计）丢弃。
 *
 * 转换幂等且产物确定：outDir 已有 MANIFEST.json（上次转换的完成标记）时直接复用，
 * 不重复付出转换成本（v4 全量含 67 万次排盘，约 40–60 分钟）。
 */
import { spawn, spawnSync } from "node:child_process";
import { createGunzip, gzipSync } from "node:zlib";
import {
	createReadStream,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { toShardChart } from "./shard-format";
import type { Calendar } from "./sample-id";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(HERE, "../..");

// 内核排盘 —— 相对导入（tools/ 不走 @/ 别名），与 export-manual.ts 同款
const { generateChart } = await import("../../scripts/algorithm");

export interface TarMaterializeResult {
	calendar: Calendar;
	shardDir: string;
}

/** MANIFEST.calendar 字段 → 编码口径（synthetic 合成历 / solar 真实公历）。 */
function calendarOf(manifestCalendar: string): Calendar {
	return manifestCalendar.startsWith("synthetic") ? "synthetic" : "solar";
}

/** 排盘与 v4 `ms` 的交叉校验计数（超阈值中止，防「排盘口径漂移还静默入库」）。 */
let msMismatch = 0;
let msChecked = 0;
/** v4 空宫盘的 ms=null 计数（合法值域，不作不一致处理）。 */
let msNull = 0;

export async function materializeTarShards(
	tarPath: string,
	outDir: string
): Promise<TarMaterializeResult> {
	const marker = join(outDir, "MANIFEST.json");
	const sourceMark = join(outDir, ".source-tar");
	// 三态复用判据（绑 tar 来源）：
	//   a. 标记齐且 sourceMark 匹配当前 tar → 物化已完成，整体复用；
	//   b. sourceMark 不存在（上次运行中断，从未写完成标记）→ **保留现有月分片作断点**，
	//      断点续物化 —— 已落盘的年份不重付排盘成本；
	//   c. sourceMark 存在但指向别的 tar（换源，如 v3 → v4 换代）→ 旧分片全部作废重做，
	//      否则新数据集会静默吃到旧数据。
	if (
		existsSync(marker) &&
		existsSync(sourceMark) &&
		readFileSync(sourceMark, "utf8") === tarPath
	) {
		const manifest = JSON.parse(readFileSync(marker, "utf8")) as { calendar: string };
		console.error(`tar 源：复用既有物化产物 ${outDir}（calendar=${manifest.calendar}）`);
		return { calendar: calendarOf(manifest.calendar), shardDir: outDir };
	}
	if (existsSync(sourceMark) && readFileSync(sourceMark, "utf8") !== tarPath) {
		console.error(
			`tar 源：换源（原 ${readFileSync(sourceMark, "utf8")} → 现 ${tarPath}），清空旧物化产物`
		);
		rmSync(outDir, { recursive: true, force: true });
	}
	mkdirSync(outDir, { recursive: true });

	// work 目录放 outDir 旁而非 /tmp：/tmp 是系统与并发会话的公共清理面——
	// 曾实测物化中途（year-2002）解包文件被外力删除导致构建中断。同域存放 + 断点续物化。
	const work = join(dirname(outDir), "tar-work");
	rmSync(work, { recursive: true, force: true });
	mkdirSync(work, { recursive: true });
	try {
		// ① 解包（154MB 级，秒级）
		const untar = spawnSync("tar", ["-xf", tarPath, "-C", work]);
		if (untar.status !== 0) {
			throw new Error(`tar 解包失败（退出码 ${untar.status}）`);
		}
		const manifest = JSON.parse(readFileSync(join(work, "MANIFEST.json"), "utf8")) as {
			calendar: string;
		};
		const calendar = calendarOf(manifest.calendar);
		// sourceMark 在物化**开始时**写入（非完成时）：中断后重启的断点分片才可归属到
		// 当前 tar —— 否则「v3 中断 → v4 续跑」会把两套分片混在一起。
		writeFileSync(sourceMark, tarPath);

		const yearFiles = readdirSync(work)
			.filter(f => f.startsWith("year-") && f.endsWith(".jsonl.zst"))
			.sort();
		if (yearFiles.length === 0) {
			throw new Error(`tar 内没有 year-*.jsonl.zst 成员（${tarPath}）`);
		}

		// ② 逐年 zstd 流式 → 行 → 按 (y,m) 聚合月缓冲 → 月切换即落盘（峰值内存 = 1 个月缓冲）。
		// 断点续物化：某年已在 outDir 落满 12 个月分片（上次运行的完成态）则整年跳过，
		// 不重付排盘成本；未满 12 片的年（中断残留）整年重跑，旧片被幂等覆盖。
		let monthKey = "";
		let monthLines: string[] = [];
		let shardCount = 0;
		let skippedYears = 0;
		const flush = (): void => {
			if (monthKey === "") {
				return;
			}
			const [ys, ms] = monthKey.split("-");
			const dir = join(outDir, `year-${ys}`);
			mkdirSync(dir, { recursive: true });
			const file = join(dir, `${monthKey}.jsonl.gz`);
			writeFileSync(file, gzipSync(Buffer.from(monthLines.join("\n") + "\n")));
			shardCount++;
			if (shardCount % 60 === 0) {
				console.error(`  物化进度：${shardCount} 个月分片`);
			}
			monthKey = "";
			monthLines = [];
		};
		// 行处理：转 v3 行 → 按 (y,m) 聚合月缓冲（月切换即 flush 落盘）
		const onRow = (row: Record<string, unknown>): void => {
			const v3 = toV3Row(row);
			const y = v3.birthInfo.year as number;
			const m = v3.birthInfo.month as number;
			const key = `${y}-${String(m).padStart(2, "0")}`;
			if (key !== monthKey) {
				flush();
				monthKey = key;
			}
			monthLines.push(JSON.stringify(v3));
		};

		for (const f of yearFiles) {
			const year = f.slice("year-".length, -".jsonl.zst".length);
			const yearDir = join(outDir, `year-${year}`);
			const done =
				existsSync(yearDir) &&
				readdirSync(yearDir).filter(g => g.endsWith(".jsonl.gz")).length === 12;
			if (done) {
				skippedYears++;
				continue;
			}
			await materializeOneYear(work, f, tarPath, onRow, () => {
				monthKey = "";
				monthLines = [];
			});
		}
		flush();
		if (skippedYears > 0) {
			console.error(`断点续物化：跳过已完成年份 ${skippedYears} 个`);
		}

		// ③ ms 校验汇总（仅 v4 源产生计数）
		if (msChecked > 0 && msMismatch / msChecked > 0.005) {
			throw new Error(
				`v4 主星交叉校验失败：${msMismatch}/${msChecked} 盘命宫主星与数据集 ms 不一致 —— 排盘口径可能漂移，中止`
			);
		}
		if (msChecked > 0) {
			console.error(
				`v4 主星交叉校验：${msChecked} 盘中不一致 ${msMismatch}（阈值 0.5%）；空宫 ms=null ${msNull} 盘`
			);
		}

		// ④ MANIFEST 拷贝作完成标记（.source-tar 已在物化开始时写入）
		writeFileSync(marker, readFileSync(join(work, "MANIFEST.json"), "utf8"));
		console.error(
			`tar 源物化完成：${shardCount} 个月分片 → ${outDir.slice(SKILL_ROOT.length + 1)}（calendar=${calendar}）`
		);
		return { calendar, shardDir: outDir };
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}

/**
 * 单年物化：zstd 流式解压 → 逐行转换（{@link onRow} 由调用方闭包处理月缓冲）。
 *
 * @remarks
 * 鲁棒性三件套（2026-10-31 实测 year-2002 源文件在 /tmp 被外力删除后加）：
 * ① work 里该年 zst 缺失时从 tar **单成员重提**（tar 本身是权威源）；② zstd 失败重试
 * 一次；③ 重试前由调用方重置月缓冲（该年已落月分片被幂等覆盖，不产生重复行）。
 */
async function materializeOneYear(
	work: string,
	f: string,
	tarPath: string,
	onRow: (row: Record<string, unknown>) => void,
	resetMonth: () => void
): Promise<void> {
	let attempt = 0;
	for (;;) {
		const zstPath = join(work, f);
		if (!existsSync(zstPath)) {
			console.error(`  ${f} 在 work 缺失，从 tar 单成员重新提取…`);
			const extract = spawnSync("tar", ["-xOf", tarPath, f], { maxBuffer: 1 << 28 });
			if (extract.status !== 0 || !extract.stdout) {
				throw new Error(`tar 单成员提取失败（${f}，退出码 ${extract.status}）`);
			}
			writeFileSync(zstPath, extract.stdout);
		}
		attempt++;
		const zstd = spawn("zstd", ["-dc", "--long=27", zstPath], {
			stdio: ["ignore", "pipe", "inherit"],
		});
		if (!zstd.stdout) {
			throw new Error("zstd stdout 不可用");
		}
		const rl = createInterface({ input: zstd.stdout, crlfDelay: Infinity });
		try {
			for await (const line of rl) {
				if (line.trim() === "") {
					continue;
				}
				onRow(JSON.parse(line) as Record<string, unknown>);
			}
			await new Promise<void>((res, rej) => {
				zstd.on("close", code =>
					code === 0 ? res() : rej(new Error(`zstd 退出码 ${code}（${f}）`))
				);
				zstd.on("error", rej);
			});
			return;
		} catch (e) {
			zstd.kill();
			rl.close();
			if (attempt >= 2) {
				throw e;
			}
			console.error(`  ${f} 物化失败（第 ${attempt} 次），重置月缓冲后重试：${e}`);
			resetMonth();
		}
	}
}

// ── 行转换 ─────────────────────────────────────────────────────────────────────

type V3Row = {
	birthInfo: Record<string, unknown>;
	chart: ReturnType<typeof toShardChart>;
	topics: Record<string, string>;
	system: string;
};

function toV3Row(row: Record<string, unknown>): V3Row {
	if ("birthInfo" in row) {
		return row as unknown as V3Row;
	}
	if (
		typeof row.k !== "string" ||
		(row.ms !== null && typeof row.ms !== "string") ||
		typeof row.c !== "object"
	) {
		throw new Error(
			`无法识别的行 schema（既非 v3 也非 v4）：键 ${Object.keys(row).join(",")}；` +
				`typeof k=${typeof row.k} ms=${typeof row.ms} c=${typeof row.c}；` +
				`行头 120 字：${JSON.stringify(row).slice(0, 120)}`
		);
	}
	const gender = row.g as "male" | "female";
	const birth = {
		year: row.y as number,
		month: row.m as number,
		day: row.d as number,
		hour: row.h as number,
		gender,
		longitude: 120,
	};
	const chart = generateChart({
		year: birth.year,
		month: birth.month,
		day: birth.day,
		timeIndex: birth.hour,
		gender,
		longitude: 120,
	});
	// ms 交叉校验：数据集主星应出现在排盘命宫主星（空宫时在借星中）。
	// ⚠️ v4 的 ms 对**空宫盘为 null**（合法值域）——跳过校验、单独计数观察。
	const ms = row.ms as string | null;
	if (ms !== null) {
		msChecked++;
		const ming = chart.palaces.find(p => p.branch === chart.soulBranch);
		const majors = ming ? ming.stars.filter(s => s.type === "major").map(s => s.name) : [];
		const borrowed = ming && !majors.length ? (ming.borrowedStars ?? []) : [];
		if (!majors.includes(ms) && !borrowed.includes(ms)) {
			msMismatch++;
			if (msMismatch <= 3) {
				console.error(
					`  ms 不一致样例：${row.k} 数据集=${ms} 本仓排盘命宫主星=[${majors.join("、") || "空宫"}]借=[${borrowed.join("、")}]`
				);
			}
		}
	} else {
		msNull++;
	}
	return {
		birthInfo: birth,
		chart: toShardChart(chart, birth),
		topics: row.c as Record<string, string>,
		system: "倪海厦紫微斗数",
	};
}
