/**
 * 参数系统断言组：解析引擎、参数面、声明表、SKILL.md 参数对拍
 * （原 `cli/selftest.ts` 的解析引擎 / 参数面 / 声明表区块）。
 *
 * @remarks
 * 断言体原样搬移，只改依赖归属（harness 经 {@link SelftestDeps} 注入）；
 * 「参数面」「声明表」「SKILL.md 参数对拍」在主 selftest 的调用序里分别排在
 * 出生信息形态、help 裁剪、专题渲染之后，均与源码顺序一致。
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OPTION_NAMES, SIDE_PREFIXES, parseArgs } from "../args";
import { ALL_OPTION_NAMES, OPTION_ALIASES } from "../args/table";
// namespace import：候选 2 的派生常量在实现落地前访问为 undefined，
// 红发生在断言级（eq 报「实得 undefined」）而非模块加载崩溃 —— TDD 的红要看得到条目。
import * as table from "../args/table";
import { OPTION_SCOPE } from "../args/scope";
import { renderCommandHelp } from "../commands/help";
// namespace：断言要检查 help 是否仍手抄 OPTION_OWNERSHIP（不存在的导出用 `in` 探测）
import * as helpNs from "../commands/help";
import { eq, type SelftestDeps } from "./kit";

/** 解析引擎：util.parseArgs tokens 底座、重复参数报错、拼音别名归一、三连删除。 */
export function runParseEngine({ ok }: Pick<SelftestDeps, "ok">): void {
	ok("解析引擎：util.parseArgs tokens 底座——贪婪取值 / 等号式 / -- 分隔", () => {
		// 解析引擎（spec §2.8）：底座为 Node 内置 util.parseArgs（tokens 模式）。
		// ⚠️ 贪婪取值是**版本敏感**行为（Node ≥ 22.15 实测贪婪；早期 18.x 会把负数当短选项），
		//    本断言钉死——Node 行为若回退立即变红。
		const a = parseArgs(["--limit", "-3"], "knowledge");
		eq(a.limit, "-3", "--limit -3 的值 ");
		eq(parseArgs(["--focus=财帛"], "astrology").focus, "财帛", "等号式 ");
		eq(parseArgs(["--", "-x", "y"], "astrology")._.join(","), "-x,y", "-- 之后全位置 ");
	});
	ok("解析引擎：重复参数与主别名同现必须报错", () => {
		// 旧引擎（cac）对重复参数取末值——静默择一。新契约：显式报错（宁可报错不静默）。
		for (const argv of [
			["--geju", "--geju"],
			["--geju", "--pattern"],
		]) {
			let msg = "";
			try {
				parseArgs(argv, "astrology");
			} catch (e) {
				msg = (e as Error).message;
			}
			if (!msg) {
				throw new Error(`${argv.join(" ")} 未报错——重复参数应报错（旧「取末值」废止）`);
			}
		}
	});
	ok("解析引擎：拼音别名归一到英文主名", () => {
		eq(parseArgs(["--geju"], "astrology").pattern, true, "--geju → pattern ");
		eq(parseArgs(["--sihua"], "astrology").mutagen, true, "--sihua → mutagen ");
		eq(parseArgs(["--liunian", "2027"], "astrology").yearly, "2027", "--liunian → yearly ");
	});
	ok("解析引擎：--year/--month/--day 三连已删，未知参数中文报错", () => {
		// 三连由 --date 完全覆盖（spec §1.2），删除后误敲 --year 由拼错建议引向 --yearly（距离 2）。
		let msg = "";
		try {
			parseArgs(["--year", "1990"], "astrology");
		} catch (e) {
			msg = (e as Error).message;
		}
		if (!msg.includes("未知参数") || !msg.includes("--yearly")) {
			throw new Error(`应报未知参数并建议 --yearly，实得：${msg}`);
		}
	});
}

/** 参数面：拼错旗标指路、作用域收窄、专题参数族。 */
export function runArgSurface({ ok }: Pick<SelftestDeps, "ok">): void {
	ok("参数面：拼错的旗标必须报错，并指向最接近的合法名", () => {
		// 拼错旗标以前是**静默**的：parseArgs 任何 `--xxx` 都照单全收，buildBirthInfo
		// 读不到就落回默认值 —— `--ctiy 喀什` 排出的是一张经度按默认 120°E 算的盘
		// （错约 176 分钟 ≈ 3 个时辰），全程零提示。这类静默错盘正是本项目
		// REQUIRED_EXPORTS 与 projectPalaceName 都在防的东西。
		//
		// 本断言锁的是**行为**（未知旗标必须抛错）而非文案 —— 文案可以改，
		// 但一旦有人把 parseArgs 的校验摘掉，静默错盘就会原样回来，而别的断言全绿。
		const probes: Array<[string, string]> = [
			["--ctiy", "city"], // 换位
			["--gendr", "gender"], // 漏字
			["--lunnar", "lunar"], // 多字
		];
		for (const [bad, want] of probes) {
			let msg = "";
			try {
				parseArgs([bad, "x"], "astrology");
			} catch (e) {
				msg = (e as Error).message;
			}
			if (!msg) {
				throw new Error(`${bad} 未报错 —— 未知旗标又变成静默忽略了`);
			}
			if (!msg.includes(`--${want}`)) {
				throw new Error(`${bad} 的提示应指向 --${want}，实得：${msg}`);
			}
		}
		// 作用域收窄探针：**本 skill 不认**的旗标必须报错，而不是静默收下。
		// 合并后 `--limit`（knowledge）与 `--chart`（synastry 的 --a-chart/--b-chart 裸底名）
		// 都进了本 skill 作用域，故收窄探针只剩**出生方前缀**这一维：`a-` / `b-` 前缀
		// 只有 synastry 命令认，叠在 astrology 上必须报错（当前前缀已退役，实际落
		// 「未知参数」——报错非空即守住「不静默收下」这条底线）。
		//
		// ⚠️ 少了这一条，哪天有人把 args.ts 的未知参数校验摘掉，`astrology --a-chart x`
		// 会静默通过 —— 而没有任何断言变红。
		const outOfScope: Array<[string, string]> = [
			// 合盘的命盘前缀（真实存在、只是归 synastry 命令）：探针必须挑这种「存在但错位」
			// 的旗标，不存在的旗标与上面那组拼写错误探针重叠。
			["--a-chart", "/tmp/a.json"],
			["--b-chart", "/tmp/b.json"],
		];
		for (const [flag, value] of outOfScope) {
			let msg = "";
			try {
				parseArgs([flag, value], "astrology");
			} catch (e) {
				msg = (e as Error).message;
			}
			if (!msg) {
				throw new Error(`${flag} 在 astrology 上未报错 —— 旗标作用域收窄失效`);
			}
		}
		return `${probes.length} 个拼写错误均被拦下，${outOfScope.length} 个作用域外旗标被拒`;
	});
	ok("参数面：专题参数族（info/pattern/mutagen/decadal/ages）均可解析", () => {
		// 专题参数族：每个参数对应一个输出专题，加了就只出该专题的详版（英文名主名，
		// 拼音别名见 OPTION_ALIASES）。switch 型裸开关给 true；decadal / ages 是可选值
		// 形态，带值给字符串、裸开关（= 默认当前虚岁）给 true。
		const base = ["--date", "1990-05-15", "--branch", "5", "--gender", "male"];
		const a = parseArgs([...base, "--info", "--pattern", "--mutagen"], "astrology");
		eq(a.info, true, "--info ");
		eq(a.pattern, true, "--pattern ");
		eq(a.mutagen, true, "--mutagen ");
		const b = parseArgs([...base, "--decadal", "37"], "astrology");
		eq(b.decadal, "37", "--decadal 带值 ");
		const c = parseArgs([...base, "--decadal"], "astrology");
		eq(c.decadal, true, "--decadal 裸开关 ");
		const d = parseArgs([...base, "--ages", "45"], "astrology");
		eq(d.ages, "45", "--ages 带值 ");
		return "5 个专题参数（3 开关 + 2 可选值）";
	});
}

/** 声明表：作用域差量排除表、可选值参数 help 语法。 */
export function runDeclarationTable({ ok }: Pick<SelftestDeps, "ok">): void {
	ok("声明表：作用域差量排除表里的名字都真实存在（拼错不许静默失效）", () => {
		// 差量化后 OPTION_NAMES = 全集 − excluded：排除项拼错不再「静默让参数失效」，
		// 而是从这里变红 —— excluded 每一项都必须能在全集里点到位。
		for (const n of OPTION_SCOPE.excluded) {
			if (!ALL_OPTION_NAMES.has(n)) {
				throw new Error(`OPTION_SCOPE.excluded 里的「${n}」不在声明表 —— 拼写错误`);
			}
		}
		const scope = [...ALL_OPTION_NAMES].filter(n => !OPTION_SCOPE.excluded.includes(n));
		if (scope.length !== OPTION_NAMES.size) {
			throw new Error("OPTION_NAMES 与「全集 − excluded」的基数不一致 —— 派生逻辑或引用脱节");
		}
		return `全集 ${ALL_OPTION_NAMES.size} · 排除 ${OPTION_SCOPE.excluded.length} · 作用域 ${OPTION_NAMES.size}`;
	});
	ok("声明表：语义角色派生与原字符串反推等价（候选 2）", () => {
		// 期望值 = 迁移前 astrology.ts 三处 startsWith 字符串反推的实测快照（Step 1）。
		// B 为修漏组后的 12 项：「其他出生信息」组（gender / lng / city / province / name）
		// 现状被 startsWith("出生") 漏掉，只给 --gender/--city 会误走零输入演示盘；
		// 按 role 标 birth 后进集合，与注释承诺的「部分输入 → 缺一问一」一致（见 ledger Ruling）。
		// 数组经 join 归一成串再比：kit 的 eq 是 !==，直接比数组恒红。
		const snap = {
			S: "ages,decadal,focus,info,monthly,mutagen,pattern,report,topic,yearly",
			B: "branch,city,date,eot,gender,lateZi,leap,lng,lunar,name,noDst,province,time",
			I: "ages,book,daily,decadal,focus,hourly,json,limit,monthly,mutagen,out,palaces,pattern,report,search,source,star,template,topic,view,yearly",
		};
		eq(
			[...(table.SHADOWABLE_KEYS ?? [])].sort().join(","),
			snap.S,
			"SHADOWABLE_KEYS 与旧字符串反推等价 "
		);
		eq(
			[...(table.BIRTH_KEYS ?? [])].sort().join(","),
			snap.B,
			"BIRTH_KEYS 与旧字符串反推等价（含修漏组）"
		);
		eq(
			[...(table.INTENT_KEYS ?? [])].sort().join(","),
			snap.I,
			"INTENT_KEYS 与旧字符串反推等价 "
		);
		eq(
			[...(table.DEEP_DIVE_KEYS ?? [])].sort().join(","),
			"ages,decadal,focus,mutagen,pattern,yearly",
			"DEEP_DIVE_KEYS 与 deepDive 六旗标等价 "
		);
		eq(
			table.EXCLUSIVE_PRIORITY_LABEL,
			"--palaces > --topic > --report > 其他功能参数",
			"优先级链文案 "
		);
		const unmarked = (table.OPTION_GROUPS ?? []).filter(g => !g.role).map(g => g.title);
		if (unmarked.length) {
			throw new Error(`存在未标 role 的选项组：${unmarked.join("、")}`);
		}
		return "role 标注齐、四套派生与优先级链同源";
	});
	ok("归属：OPTION_OWNERSHIP 从声明投影而非手抄（候选 4）", () => {
		// 同步断言：kit 的 ok 不 await async 断言体（Promise 恒 truthy = 假绿），
		// 依赖一律走本文件已有的静态 import（table / helpNs）。
		if (typeof table.ownedOptions !== "function") {
			throw new Error("args-table 缺 ownedOptions 投影（候选 4 未实现）");
		}
		if (!table.GLOBAL_OPTIONS?.includes("out")) {
			throw new Error("--out 应为全局参数（GLOBAL_OPTIONS）");
		}
		if (!table.ownedOptions("knowledge")?.includes("search")) {
			throw new Error("knowledge 应含 --search");
		}
		if (!table.ownedOptions("synastry")?.includes("charts")) {
			throw new Error("synastry 应含 --charts");
		}
		if ((table.ownedOptions("selftest") ?? []).length !== 0) {
			throw new Error("selftest 无专属参数");
		}
		if (!table.ownedOptions("astrology")?.includes("config")) {
			throw new Error("astrology 应含 --config");
		}
		if (table.ownedOptions("astrology")?.includes("out")) {
			throw new Error("--out 已升全局，不应留在 astrology 专属投影里");
		}
		if ("OPTION_OWNERSHIP" in helpNs) {
			throw new Error("help.ts 仍手抄归属表 OPTION_OWNERSHIP");
		}
		return "投影探针 + --out 全局 + help 无第二表";
	});
	ok("声明表：可选值参数 help 显示 <[x]>，必值参数保持 <x>（值语法不再混用）", () => {
		const s = renderCommandHelp("astrology");
		// 可选值族（裸开关合法）：缺省取当前值或列清单
		for (const want of [
			"--yearly <[年]>",
			"--decadal <[虚岁]>",
			"--ages <[虚岁]>",
			"--topic <[key]>",
		]) {
			if (!s.includes(want)) {
				throw new Error(`可选值语法缺失：${want}`);
			}
		}
		// 必值族：缺值会被指路，尖括号不吞方括号
		if (!s.includes("--focus <宫>")) {
			throw new Error("必值参数 --focus <宫> 的值语法变了");
		}
		if (s.includes("--monthly <[1-12]>")) {
			throw new Error("--monthly 被标成可选值 —— 它必须带值（裸开关会指路）");
		}
	});
}

/** SKILL.md 行为规范对拍：提到的旗标都在 args-table.ts 的声明表里。 */
export function runSkillArgsAudit({ ok, ctx }: Pick<SelftestDeps, "ok" | "ctx">): void {
	ok("参数面：SKILL.md 提到的旗标都在 args-table.ts 的声明表里", () => {
		// SKILL.md 是给助手读的**行为规范**（见仓库根 CLAUDE.md：改它就等于改 skill
		// 的行为）。它提到的旗标若在解析层不存在，助手会照着敲一个被拒的参数。
		//
		// 只查「SKILL.md → 声明表」这一个方向。反向（声明表里的旗标都要写进 SKILL.md）
		// 刻意不查：SKILL.md 是使用指南不是穷举清单，`topic` 的全部 key、`knowledge` 的
		// 位置参数这类细节本就不该塞进去。
		const md = readFileSync(resolve(ctx.root, "..", "SKILL.md"), "utf8");
		const mentioned = [...md.matchAll(/--([a-z][a-z0-9-]*)/g)].map(m => m[1]);
		// 先确认真扫到了东西：正则写歪或文件挪了位置都会得到空数组，那样的「零违规」是假绿。
		if (!mentioned.length) {
			throw new Error("未从 SKILL.md 扫到任何旗标 —— 正则或路径可能已失效");
		}
		const names = [...new Set(mentioned)];
		const unknown = names
			.map(n => {
				// 剥掉出生方前缀再查表：`--a-late-zi` 声明的是 `late-zi`。前缀表取自
				// 本 skill 的作用域（`SIDE_PREFIXES`），从声明派生，作用域变了会自动跟上。
				const p = SIDE_PREFIXES.find(pre => n.startsWith(pre));
				return p ? n.slice(p.length) : n;
			})
			// 拼音别名归一到英文主名（--geju 提到的是 --pattern 的别名，同样合法）
			.map(n => OPTION_ALIASES[n] ?? n)
			.filter(n => !OPTION_NAMES.has(n));
		if (unknown.length) {
			throw new Error(
				`SKILL.md 提到但 args.ts 未声明的参数：${unknown.map(n => "--" + n).join("、")}`
			);
		}
		return `${names.length} 种参数写法全部有声明`;
	});
}
