// ── 排盘比对器 ──
//
// 拿本项目的 `generateChart()` 输出，与 toolkit 样本里的 `chart` 逐字段比。
// 产出**结构化 diff 列表**而非布尔值 —— 300 条基准里某条失败时要能一眼看出是哪个字段。
//
// 四处归一化（都是实测出来的真实差异，不是防御性代码）：
//   1. 空值形态：本项目无四化的星是显式 `siHua: undefined`，样本则该键不存在；
//      两边无庙旺的星都可能给 `""`。一律视为「无此属性」并忽略键的存在性差异。
//   2. 字段超集：本项目 `Palace` 比样本多出 `oppositeBranch` / `isEmpty`
//      （空宫时另有 `borrowedFromBranch` / `borrowedFromName` / `borrowedStars`）。
//      这些是本项目新增的借宫结构化字段，样本没有，故只比共有字段。
//   3. 顺序：两边 `palaces` 数组顺序实测一致（都是寅起），但**按 branch 建索引**比对，
//      不依赖数组下标 —— 将来顺序若有变化也不会误判。
//   4. 宫名口径：样本存的是 iztro 的名（…/仆役/…），本项目存的是倪师《天纪》的名
//      （…/交友宫/…）。翻译**只施加在 baseline 一侧**，见 normalizePalaceName。
// 农历换算。刻意在此**独立**调用，不复用内核的 getLunarInfo —— 见 expectedAge 的注释。
import { Solar } from "lunar-javascript";

import { loadConstants } from "./loader.mjs";

// 宫名映射**从内核取**，不在此另抄一份。
// 宫名是项目自己的词汇，`scripts/ziwei/constants.ts` 是它唯一的定义处；比对器只是要把
// 基准样本的 iztro 词汇翻译成项目词汇才比得起来，本身对宫名没有立场。
// 另起一份转录只会制造第二个真相源 —— 认表错误的任务交给下面这条注释指向的预言机。
//
// ⚠️ 用顶层 await 而非静态 import：ESM 的静态 import 在 loader.mjs 注册解析钩子
//    **之前**就完成了链接，那时 `@/ziwei/constants`（.ts）还解析不了。
//
// ⚠️⚠️ 共用同一张表意味着：**表若被写错（比如把「仆役」映射成「官禄宫」），
//    本文件与内核会一起错，层 1 照旧全绿**。这与 test/README.md 记录的 02 号历史
//    事故是同一个形状（比对器与内核同源同错）。堵这个盲区的是层 3 的两条**不读本表**
//    的预言机：invariants.test.mjs 的「iztro 直连词法」与「十二宫偏移位置」。
const { IZTRO_TO_PROJECT_PALACE } = await loadConstants();

/**
 * 把**基准样本**的宫名翻成项目口径。
 *
 * ⚠️ 只对 baseline 一侧调用，**绝不碰 actual** —— 这是本函数唯一要紧的事。
 *    若两侧都归一化，「内核忘记映射」（有人回退 algorithm.ts 的 projectPalaceName）
 *    会让 expected 与 actual 一起退回 iztro 名，差异被吞、回归静默通过。
 *    单向归一化下同一个回归会报 `expected=夫妻宫, actual=夫妻`，又准又可读。
 *
 * 未命中原样返回而不抛错：iztro 哪天改了宫名，应当表现为一条**可读的 diff**，
 * 而不是把整个套件炸成一堆异常。
 */
const normalizePalaceName = v => IZTRO_TO_PROJECT_PALACE[v] ?? v;

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

/**
 * 依「注入的当前时间」独立重算虚岁期望值。
 *
 * 口径：**虚岁**，以农历年（正月初一）为界 —— 不是生日、也不是立春。对应 iztro 的默认
 * `ageDivide: 'normal'`（见 `iztro/lib/astro/FunctionalAstrolabe.js`）：
 *     nominalAge = 目标日农历年 − 出生农历年 + 1
 * 这正是 `daXians[].startAge/endAge` 所在的域，故 currentAge 必须用同一口径才能比。
 *
 * ⚠️ 这里**独立换算**，刻意不引用内核的 currentAge。
 *    2026-09 之前两边都写 `getFullYear() - year`（周岁），域不同却公式同形，
 *    于是内核算错、比对器跟着错，测试恒绿 —— 大限错位因此潜伏了很久。
 *    比对器的期望值必须来自另一条计算路径，否则它就只是内核的复读机。
 *    （更独立的预言机：iztro 自身的 horoscope().age.nominalAge，见 invariants.test.mjs。）
 *
 * @param {{year:number, month:number, day:number}} birthInfo 出生公历
 * @param {Date} [now] 注入「当前时间」以便测试漂移逻辑，默认取真实时间
 */
export function expectedAge(birthInfo, now = new Date()) {
	const lunarYearAt = d =>
		Solar.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate()).getLunar().getYear();
	const birth = new Date(birthInfo.year, birthInfo.month - 1, birthInfo.day);
	return lunarYearAt(now) - lunarYearAt(birth) + 1;
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
			if (f === "name") {
				// 宫名唯一需要翻译（见 normalizePalaceName）。翻译后仍是**严格相等**比对，
				// 没有跳过任何字段 —— 性质是词汇翻译，不是放宽断言。
				const want = normalizePalaceName(bP.name);
				if (aP.name !== want) {
					push(
						`palaces[${label}].name`,
						want,
						aP.name,
						want !== bP.name ? `基准原文「${bP.name}」是 iztro 旧口径` : undefined
					);
				}
				continue;
			}
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
				if (f === "palaceName") {
					// 同 palaces[].name：翻译 baseline 一侧后再严格相等比对
					const want = normalizePalaceName(bD[i].palaceName);
					if (aD[i].palaceName !== want) {
						push(
							`daXians[${i}].palaceName`,
							want,
							aD[i].palaceName,
							want !== bD[i].palaceName
								? `基准原文「${bD[i].palaceName}」是 iztro 旧口径`
								: undefined
						);
					}
					continue;
				}
				if (aD[i][f] !== bD[i][f]) push(`daXians[${i}].${f}`, bD[i][f], aD[i][f]);
			}
		}
	}

	// ── 随年份漂移的三个字段：重算期望值，而非直接抄样本的陈旧快照 ──
	// algorithm.ts 的 currentAge 是虚岁（农历年差 +1）。样本生成于 2026 年，
	// 直接比对会在跨过下一个农历年（正月初一）后全线失败。
	// 受影响的共三处：currentAge、currentDaXianIndex、palace.isCurrentDaXian —— 都在下面重算。
	const age = expectedAge(actual.birthInfo, now);
	if (actual.currentAge !== age) push("currentAge", age, actual.currentAge, "按当前年份重算");
	const expIdx = bD.findIndex(d => age >= d.startAge && age <= d.endAge);
	if (actual.currentDaXianIndex !== expIdx) {
		push("currentDaXianIndex", expIdx, actual.currentDaXianIndex, "按当前年份重算");
	}

	// ── palace.isCurrentDaXian ──
	// 样本 palace 里**有**这个字段，但同样是 2026 年的快照，故不能直接比（理由同上）。
	// 改为按「重算的虚岁是否落在该宫大限区间内」重新推导应有的标记，用的是
	// **基准样本的 daXianAge**（外部数据）+ **重算的 age**，去核对内核的标记逻辑。
	//
	// 为什么不复用上面的 expIdx：expIdx 只回答「当前走到第几步」，不回答「标在了哪个宫」。
	// 内核分两处独立完成这件事（algorithm.ts 里由 daXianAge 循环标记、由 daXians 求 index），
	// 两者理论上可以对不上。
	//
	// ⚠️ 效力边界（实测，非推测）：本检查**依赖 expectedAge()**，而它正是历史事故里与内核
	//    一起写错的那条路径。实测把内核与比对器**同时**退回周岁，300 条盘的 currentAge /
	//    currentDaXianIndex / isCurrentDaXian 三者本检查**全部保持全绿**，唯一变红的是层 3 的
	//    horoscope() 预言机。即：本检查能抓「只有内核改了」的回归（已用注入 bug 验证过会红），
	//    **抓不到「内核与比对器同源同错」**——那始终是层 3 外部预言机的职责，不可互相替代。
	for (let b = 0; b < 12; b++) {
		const aP = aByBranch.get(b);
		const bP = bByBranch.get(b);
		if (!aP || !bP) continue; // 宫位缺失已在上面报过，不重复计入
		const range = bP.daXianAge;
		const should = Array.isArray(range) && age >= range[0] && age <= range[1];
		if (!!aP.isCurrentDaXian !== should) {
			push(
				`palaces[${BRANCHES[b]}宫(branch=${b})].isCurrentDaXian`,
				should,
				!!aP.isCurrentDaXian,
				`按重算虚岁 ${age} 落在区间 ${JSON.stringify(range)} 推导`
			);
		}
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

/**
 * 盘指纹：快速判定两张盘是否逐宫一致（用于 CLI 的 --branch 12 ≡ 次日 --branch 0 之类断言）。
 *
 * ⚠️ 与 scripts/purple-star.mjs 里的 chartSignature 是**两份必须行为一致的实现** ——
 *    test/ 与 CLI 刻意不共享模块（同 lib/loader.mjs 的理由），故改动其一时必须同步另一个。
 *    先按 branch 排序再拼接，使指纹与 `palaces` 的数组顺序无关（实测为寅起 2,3,…,11,0,1）。
 */
export function chartSignature(chart) {
	return [...chart.palaces]
		.sort((x, y) => x.branch - y.branch)
		.map(p => `${p.name}:${p.branch}:${p.stars.map(s => s.name).sort().join(",")}`)
		.join("|");
}
