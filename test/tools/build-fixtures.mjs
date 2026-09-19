#!/usr/bin/env node
// ── 从 toolkit 样本集抽样，生成 test/fixtures/ 轻量基准 ──
//
// 仅在需要**重建**基准时手动执行（reference/ 不入版本控制，正常跑测试不需要它）：
//   node test/tools/build-fixtures.mjs
//
// 抽样是**确定性的**（不用随机数），同样的输入必然产出同样的 fixtures —— 基准可复现、可审阅 diff。
//
// ⚠️ 产出的基准是 **iztro 2.5.8** 的行为快照，本项目用 2.6.1，两者有且仅有两处已知差异
//    （太阳/太阴在酉宫的亮度），已在 test/lib/compare.mjs 的 KNOWN_DIVERGENCES 里显式登记。
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // <skill 根>/test/tools
const SKILL_ROOT = resolve(HERE, "../..");
const SAMPLES = resolve(SKILL_ROOT, "reference/ziwei-samples-toolkit/samples-out");
const OUT_DIR = resolve(HERE, "../fixtures");

const YEAR_START = 1924;
const YEAR_END = 1983;

// 每年 5 条：4 条常规槽位 + 1 条闰月/年末槽位。60 × 5 = 300 条。
//
// 槽位的「月」与「时辰」**随年份序号轮转**，让 60 年自然铺满 12 个月 × 12 个时辰：
//   月   = (i*5 + s*3) % 12 + 1    —— gcd(5,12)=1，i 走满一圈时 5i%12 遍历全部 12 个值
//   时辰 = (i*7 + s*3) % 12        —— gcd(7,12)=1，同理铺满 12 个时辰
// 固定槽位（每月固定某日某时）只能盖到 4 个时辰、10 个月份，实测过，不够。
const DAYS = [1, 8, 15, 22]; // 日：1 号用于覆盖「公历年初落在农历上一年」的跨年边界

/** 读取某个分片的全部行。 */
async function readShard(year, month) {
	const file = resolve(SAMPLES, `year-${year}`, `${year}-${String(month).padStart(2, "0")}.jsonl.gz`);
	if (!existsSync(file)) return null;
	const lines = [];
	const rl = createInterface({
		input: createReadStream(file).pipe(createGunzip()),
		crlfDelay: Infinity,
	});
	for await (const line of rl) if (line.trim()) lines.push(line);
	return lines;
}

/** 分片内按 (日, 时辰, 性别) 排序，故可直接算下标：idx = (day-1)*24 + hour*2 + genderIdx */
function pickFrom(lines, day, hour, gender) {
	if (!lines) return null;
	const idx = (day - 1) * 24 + hour * 2 + (gender === "female" ? 1 : 0);
	const line = lines[idx];
	return line ? JSON.parse(line) : null;
}

async function main() {
	if (!existsSync(SAMPLES)) {
		console.error(
			`找不到样本目录：${SAMPLES}\n` +
				`  本脚本需要 reference/ziwei-samples-toolkit/ 存在（该目录不入版本控制）。\n` +
				`  测试本身不需要它 —— fixtures 已入库；只有重建基准时才跑本脚本。`
		);
		process.exit(1);
	}

	const { LunarYear, Lunar } = await import("lunar-javascript");
	const samples = [];
	const stats = { months: new Set(), hours: new Set(), genders: new Set(), wuxing: new Set(), leapYears: [] };

	for (let year = YEAR_START, i = 0; year <= YEAR_END; year++, i++) {
		// ── 常规槽位 0-3 ──
		for (let s = 0; s < 4; s++) {
			const month = ((i * 5 + s * 3) % 12) + 1;
			const hour = (i * 7 + s * 3) % 12;
			const gender = s % 2 === 0 ? "male" : "female";
			const day = DAYS[s];
			const raw = pickFrom(await readShard(year, month), day, hour, gender);
			if (!raw) {
				console.warn(`  ⚠ ${year}-${month}-${day} 时${hour} ${gender}：样本缺失`);
				continue;
			}
			stats.months.add(month);
			stats.hours.add(hour);
			stats.genders.add(gender);
			stats.wuxing.add(raw.chart.wuxingJuName);
			samples.push(raw);
		}

		// ── 槽位 4：闰月年取闰月首日（农历换算的闰月分支），平年取 12-30 子时 ──
		const leapMonth = LunarYear.fromYear(year).getLeapMonth();
		let raw;
		if (leapMonth) {
			const solar = Lunar.fromYmd(year, -leapMonth, 1).getSolar();
			const hour = (i * 7 + 3) % 12;
			raw = pickFrom(await readShard(year, solar.getMonth()), solar.getDay(), hour, "male");
			if (raw) stats.leapYears.push(`${year}(闰${leapMonth})`);
		} else {
			raw = pickFrom(await readShard(year, 12), 30, 0, "male");
		}
		if (!raw) {
			console.warn(`  ⚠ ${year} 槽位 4：样本缺失`);
			continue;
		}
		stats.months.add(raw.birthInfo.month);
		stats.hours.add(raw.birthInfo.hour);
		stats.genders.add(raw.birthInfo.gender);
		stats.wuxing.add(raw.chart.wuxingJuName);
		samples.push(raw);
	}

	// ── 写盘前的分歧自检 ──
	// 重建 fixtures 是「把当前行为固化成新基准」的动作。若此刻基准与当前内核已有分歧，
	// 直接固化等于把分歧悄悄转正 —— 下次跑测试就是绿的，谁也不知道行为变过。
	// 故先比对一遍：白名单之外的差异一律拦下，逼出显式审阅。
	// ⚠️ 这条路会把「样板是 iztro 2.5.8 快照」这一前提也一起检查 —— 若 toolkit 换了样本集，
	//    差异会大面积出现，此时该做的是重新评估整份基准，而不是往白名单里加条目。
	const { loadAlgorithm } = await import("../lib/loader.mjs");
	const { compareChart, formatDiffs } = await import("../lib/compare.mjs");
	const { generateChart } = await loadAlgorithm();

	const diverged = [];
	for (const s of samples) {
		const diffs = compareChart(generateChart({ ...s.birthInfo }), s.chart);
		if (diffs.length) diverged.push({ birth: s.birthInfo, diffs });
	}
	if (diverged.length) {
		console.error(
			`\n✖ 抽样中已有 ${diverged.length}/${samples.length} 条与当前内核不一致，拒绝写盘。\n` +
				`  基准是 iztro 2.5.8 的行为快照；本项目内核可能已随 iztro 升级而变化。\n\n` +
				`  处理：\n` +
				`    · 若确为预期的版本行为变化 → 先在 test/lib/compare.mjs 的 KNOWN_DIVERGENCES\n` +
				`      登记根因（写清是哪一版改了什么），再重建\n` +
				`    · 若不是预期变化 → 这是回归，先查 scripts/ziwei/ 下的内核改动\n`
		);
		for (const { birth, diffs } of diverged.slice(0, 10)) {
			console.error(`  ${birth.year}-${birth.month}-${birth.day} 时${birth.hour} ${birth.gender}`);
			console.error(formatDiffs(diffs, 5));
		}
		if (diverged.length > 10) console.error(`  …… 另有 ${diverged.length - 10} 条未列出`);
		process.exit(1);
	}
	console.log(`  分歧自检通过：${samples.length} 条抽样与当前内核一致（白名单之外零差异）`);

	// ── 写出：只保留 birthInfo + chart ──
	// 样本的 `topics`（13 主题解读文本）占单条体积 90%，且由 toolkit 私有的 db-analysis.ts
	// 生成 —— 本项目刻意不含该文件，无法复现，故一律剔除。单条 62.5KB → 6.1KB。
	mkdirSync(OUT_DIR, { recursive: true });
	const jsonl = samples
		.map(s => JSON.stringify({ birthInfo: s.birthInfo, chart: s.chart }))
		.join("\n");
	writeFileSync(resolve(OUT_DIR, "charts.jsonl"), jsonl + "\n", "utf8");

	writeFileSync(
		resolve(OUT_DIR, "manifest.json"),
		JSON.stringify(
			{
				description: "紫微斗数排盘基准（golden）—— 从 reference/ziwei-samples-toolkit 抽样而来",
				source: "reference/ziwei-samples-toolkit/samples-out",
				baselineEngine: "iztro 2.5.8",
				note: "基准为 iztro 2.5.8 的行为快照；本项目用 2.6.1，已知差异见 test/lib/compare.mjs 的 KNOWN_DIVERGENCES",
				generatedAt: new Date().toISOString().slice(0, 10),
				count: samples.length,
				yearRange: [YEAR_START, YEAR_END],
				algorithm:
					"每年 5 条：4 条常规槽位（月/时辰随年份序号轮转以铺满 12 月 × 12 时辰）+ 1 条闰月年取闰月首日、平年取 12-30 子时",
				coverage: {
					months: [...stats.months].sort((a, b) => a - b),
					hours: [...stats.hours].sort((a, b) => a - b),
					genders: [...stats.genders].sort(),
					wuxingJu: [...stats.wuxing].sort(),
					leapYears: stats.leapYears,
				},
			},
			null,
			"\t"
		) + "\n",
		"utf8"
	);

	const m = stats.months.size, h = stats.hours.size;
	console.log(`已生成 ${samples.length} 条基准 → test/fixtures/charts.jsonl`);
	console.log(
		`  覆盖：${m}/12 月 · ${h}/12 时辰 · ${stats.genders.size}/2 性别 · ${stats.wuxing.size}/5 五行局 · ${stats.leapYears.length} 个闰月年`
	);
	if (m < 12 || h < 12) console.warn("  ⚠ 月或时辰覆盖不全，检查槽位轮转公式");
}

// ── 仅直接执行时跑 main ──
// Node 的默认测试文件识别模式包含 `test/**/*`。若不加这道守卫，`node --test test/`
// 可能把这个会写盘的脚本当成测试文件执行（它会重写 test/fixtures/）。
const isDirectRun =
	process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
	main().catch(err => {
		console.error(err);
		process.exit(1);
	});
}
