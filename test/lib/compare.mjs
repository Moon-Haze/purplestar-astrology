// ── 排盘比对器 ──
//
// 拿本项目的 `generateChart()` 输出，与 toolkit 样本里的 `chart` 逐字段比。
// 产出**结构化 diff 列表**而非布尔值 —— 300 条基准里某条失败时要能一眼看出是哪个字段。
//
// 三处归一化（都是实测出来的真实差异，不是防御性代码）：
//   1. 空值形态：本项目无四化的星是显式 `siHua: undefined`，样本则该键不存在；
//      两边无庙旺的星都可能给 `""`。一律视为「无此属性」并忽略键的存在性差异。
//   2. 字段超集：本项目 `Palace` 比样本多出 `oppositeBranch` / `isEmpty`
//      （空宫时另有 `borrowedFromBranch` / `borrowedFromName` / `borrowedStars`）。
//      这些是本项目新增的借宫结构化字段，样本没有，故只比共有字段。
//   3. 顺序：两边 `palaces` 数组顺序实测一致（都是寅起），但**按 branch 建索引**比对，
//      不依赖数组下标 —— 将来顺序若有变化也不会误判。
// 十二地支。刻意在此独立定义而不从内核 constants.ts 取：比对器是同步函数，
// 而内核模块是异步加载的；且这份表是常量，不随内核演进而变。
export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

// ── 已知差异白名单 ──
//
// 基准样本由 iztro **2.5.8** 生成，本项目用 **2.6.1**。两版之间 iztro 改了星曜亮度表，
// 影响**太阳与太阴在酉宫**的庙旺利陷（跨 60 年抽样 360 条实测，差异仅此两条，此外零差异）。
// 新版取值（酉宫日平、月旺）更合传统口径，故本项目是对的，样本是**旧版的陈旧值**。
//
// 白名单条目必须写明 `cause`：它是升级 iztro 时审阅差异的依据，不是掩盖差异的补丁。
// 只放行**单个字段**（brightness）的差异，不是整颗星 —— 星曜名、type、siHua 仍严格比对。
export const KNOWN_DIVERGENCES = [
	{
		star: "太阳",
		branch: 9, // 酉
		baseline: "dim", // 样本（iztro 2.5.8）
		current: "normal", // 本项目（iztro 2.6.1）
		cause: "iztro 2.5.8→2.6.1 亮度表变更：酉宫太阳由陷改判为平",
	},
	{
		star: "太阴",
		branch: 9,
		baseline: "dim",
		current: "bright",
		cause: "iztro 2.5.8→2.6.1 亮度表变更：酉宫太阴由陷改判为旺",
	},
];

function isWhitelisted(starName, branch, baseline, current) {
	return KNOWN_DIVERGENCES.some(
		d =>
			d.star === starName &&
			d.branch === branch &&
			d.baseline === baseline &&
			d.current === current
	);
}

// 空值（'' / undefined / null）一律归一为「无」
const val = v => (v === "" || v === null ? undefined : v);

/** 归一化单颗星：只保留有值的属性，消除「键存在但值为空」的形态差异。 */
export function normalizeStar(s) {
	const o = { name: s.name, type: s.type };
	const b = val(s.brightness);
	if (b !== undefined) o.brightness = b;
	const h = val(s.siHua);
	if (h !== undefined) o.siHua = h;
	return o;
}

/** 本项目 `Palace` 中样本也有的字段 —— 比对只覆盖这些。 */
export const SHARED_PALACE_FIELDS = [
	"branch",
	"stem",
	"name",
	"daXianAge",
	"isMingGong",
	"isShenGong",
];

/** 大限的可比字段（飞星派的 stemIndex / stemName / siHua 两边都不该有）。 */
export const DAXIAN_FIELDS = ["startAge", "endAge", "palaceBranch", "palaceName"];

/** 依当前年份重算随年份漂移的期望值（见下）。 */
export function expectedAge(birthYear, now = new Date()) {
	return now.getFullYear() - birthYear;
}

/**
 * 比对本项目排盘结果与基准样本。
 * @param {object} actual   本项目 generateChart() 的输出
 * @param {object} baseline 样本里的 chart
 * @param {object} [opts]
 * @param {Date}   [opts.now] 注入「当前时间」以便测试漂移逻辑，默认取真实时间
 * @returns {Array<{path:string, expected:*, actual:*, note?:string}>} 空数组表示完全一致
 */
export function compareChart(actual, baseline, opts = {}) {
	const now = opts.now ?? new Date();
	const diffs = [];
	// keepWhitelisted：保留白名单内的已知差异并打上 `whitelisted: true`。
	// 默认丢弃（测试只关心「白名单之外零差异」）；全量核验脚本用它统计白名单放行了多少处，
	// 以便升级 iztro 时判断这些已知差异是仍在、还是已消失（消失即说明白名单该清理了）。
	const push = (path, expected, got, note, whitelisted) => {
		if (whitelisted && !opts.keepWhitelisted) return;
		const d = { path, expected, actual: got };
		if (note) d.note = note;
		if (whitelisted) d.whitelisted = true;
		diffs.push(d);
	};

	// ── 顶层标量 ──
	for (const k of ["mingGongBranch", "shenGongBranch", "wuxingJu", "wuxingJuName", "ziweiPos"]) {
		if (actual[k] !== baseline[k]) push(k, baseline[k], actual[k]);
	}

	// ── 农历 ──
	const aL = actual.lunarInfo ?? {};
	const bL = baseline.lunarInfo ?? {};
	for (const k of ["lunarYear", "lunarMonth", "lunarDay", "yearStem", "yearBranch", "isLeapMonth"]) {
		if (aL[k] !== bL[k]) push(`lunarInfo.${k}`, bL[k], aL[k]);
	}

	// ── 十二宫：按 branch 建索引，不依赖数组顺序 ──
	const aByBranch = new Map((actual.palaces ?? []).map(p => [p.branch, p]));
	const bByBranch = new Map((baseline.palaces ?? []).map(p => [p.branch, p]));
	for (let b = 0; b < 12; b++) {
		const aP = aByBranch.get(b);
		const bP = bByBranch.get(b);
		const label = `${BRANCHES[b]}宫(branch=${b})`;
		if (!aP) {
			push(`palaces[${label}]`, "存在", "缺失");
			continue;
		}
		if (!bP) {
			push(`palaces[${label}]`, "缺失", "存在");
			continue;
		}
		for (const f of SHARED_PALACE_FIELDS) {
			if (f === "branch") continue;
			const a = f === "daXianAge" ? JSON.stringify(aP[f] ?? null) : aP[f];
			const bb = f === "daXianAge" ? JSON.stringify(bP[f] ?? null) : bP[f];
			if (a !== bb) push(`palaces[${label}].${f}`, bP[f] ?? null, aP[f] ?? null);
		}
		compareStars(aP.stars ?? [], bP.stars ?? [], label, b, push);
	}

	// ── 大限 ──
	const aD = actual.daXians ?? [];
	const bD = baseline.daXians ?? [];
	if (aD.length !== bD.length) {
		push("daXians.length", bD.length, aD.length);
	} else {
		for (let i = 0; i < bD.length; i++) {
			for (const f of DAXIAN_FIELDS) {
				if (aD[i][f] !== bD[i][f]) push(`daXians[${i}].${f}`, bD[i][f], aD[i][f]);
			}
		}
	}

	// ── 随年份漂移的三个字段：重算期望值，而非直接抄样本的陈旧快照 ──
	// algorithm.ts: `currentAge = new Date().getFullYear() - year`（无 +1）。
	// 样本生成于 2026 年，直接比对会在 2027 年全线失败。
	const age = expectedAge(actual.birthInfo.year, now);
	if (actual.currentAge !== age) push("currentAge", age, actual.currentAge, "按当前年份重算");
	const expIdx = bD.findIndex(d => age >= d.startAge && age <= d.endAge);
	if (actual.currentDaXianIndex !== expIdx) {
		push("currentDaXianIndex", expIdx, actual.currentDaXianIndex, "按当前年份重算");
	}

	return diffs;
}

/** 比对一个宫内的星曜集合：按星名建索引，比对 type / brightness / siHua。 */
function compareStars(aStars, bStars, label, branch, push) {
	const aByName = new Map(aStars.map(s => [s.name, s]));
	const bByName = new Map(bStars.map(s => [s.name, s]));

	for (const name of bByName.keys()) {
		if (!aByName.has(name)) push(`palaces[${label}].stars`, `含 ${name}`, "缺该星");
	}
	for (const name of aByName.keys()) {
		if (!bByName.has(name)) push(`palaces[${label}].stars`, "无该星", `多出 ${name}`);
	}

	for (const [name, bS] of bByName) {
		const aS = aByName.get(name);
		if (!aS) continue;
		if (aS.type !== bS.type) push(`palaces[${label}].stars[${name}].type`, bS.type, aS.type);

		const aB = val(aS.brightness);
		const bB = val(bS.brightness);
		if (aB !== bB) {
			const wl = isWhitelisted(name, branch, bB, aB);
			push(
				`palaces[${label}].stars[${name}].brightness`,
				bB,
				aB,
				wl ? "已知差异（白名单）" : undefined,
				wl
			);
		}

		const aH = val(aS.siHua);
		const bH = val(bS.siHua);
		if (aH !== bH) push(`palaces[${label}].stars[${name}].siHua`, bH, aH);
	}
}

/** 把 diff 列表渲染成可读的失败信息（node:test 的断言消息里用）。 */
export function formatDiffs(diffs, limit = 25) {
	if (!diffs.length) return "无差异";
	const head = diffs
		.slice(0, limit)
		.map(
			d =>
				`  ${d.whitelisted ? "○" : "✗"} ${d.path}\n      基准=${JSON.stringify(d.expected)}  实际=${JSON.stringify(d.actual)}${d.note ? `  (${d.note})` : ""}`
		);
	if (diffs.length > limit) head.push(`  …… 另有 ${diffs.length - limit} 处差异未列出`);
	return `共 ${diffs.length} 处差异：\n${head.join("\n")}`;
}

/** 盘指纹：快速判定两张盘是否逐宫一致（用于 CLI 的 --branch 12 ≡ 次日 --branch 0 之类断言）。 */
export function chartSignature(chart) {
	return [...chart.palaces]
		.sort((x, y) => x.branch - y.branch)
		.map(p => `${p.name}:${p.branch}:${p.stars.map(s => s.name).sort().join(",")}`)
		.join("|");
}
