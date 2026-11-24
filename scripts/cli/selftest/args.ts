/**
 * 参数系统断言组：解析引擎、参数面、声明表、SKILL.md 参数对拍。
 * @remarks 只改依赖归属（harness 经 {@link SelftestDeps} 注入）；
 * 「参数面」「声明表」「SKILL.md 参数对拍」调用序在出生信息形态、
 * help 裁剪、专题渲染后。
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OPTION_NAMES, SIDE_PREFIXES, parseArgs } from "../args";
import { ALL_OPTION_NAMES, OPTION_ALIASES } from "../args/table";
// namespace import：派生常量落地前为 undefined，红在断言级
// （eq 报「实得 undefined」）而非模块加载崩溃 —— TDD 红要看得见。
import * as table from "../args/table";
import { OPTION_SCOPE } from "../args/scope";
import { renderCommandHelp } from "../commands/help";
// namespace：查 help 是否仍手抄 OPTION_OWNERSHIP（不存在的导出用 `in` 探）
import * as helpNs from "../commands/help";
import { eq, type SelftestDeps } from "./kit";
import { SAMPLE_ARGV } from "./sample";

/**
 * 解析引擎：util.parseArgs tokens 底座、重复报错、别名归一、三连删除。
 *
 * @param ok - harness 断言注册：逐条收集，失败不影响其余
 * @returns 无返回值；四条断言进主报告
 * @throws `throw` 由 `ok` 捕获记为失败项，不向外抛；触发条件为贪婪取值 / 等号式 / `--` 分隔漂移、重复或主别名同现未报错、别名未归一、三连仍被接受
 */
export function runParseEngine({ ok }: Pick<SelftestDeps, "ok">): void {
	ok("解析引擎：util.parseArgs tokens 底座——贪婪取值 / 等号式 / -- 分隔", () => {
		// 解析引擎（spec §2.8）：底座 Node 内置 util.parseArgs tokens。
		// ⚠️ 贪婪取值**版本敏感**（Node ≥ 22.15 贪婪；18.x 把负数当短选项），
		//    本断言钉死——Node 行为回退立即红。
		const a = parseArgs(["--limit", "-3"], "knowledge");
		eq(a.limit, "-3", "--limit -3 的值 ");
		eq(parseArgs(["--focus=财帛"], "astrology").focus, "财帛", "等号式 ");
		eq(parseArgs(["--", "-x", "y"], "astrology")._.join(","), "-x,y", "-- 之后全位置 ");
	});
	ok("解析引擎：重复参数与主别名同现必须报错", () => {
		// cac 旧引擎重复参数取末值=静默择一；新契约显式报错（宁报错不静默）
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
		// 三连由 --date 覆盖（spec §1.2），误敲 --year 由拼错建议引向 --yearly
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

/**
 * 参数面：拼错旗标指路、作用域收窄、专题参数族。
 *
 * @param ok - harness 断言注册
 * @returns 无返回值；两条断言进主报告
 * @throws `throw` 由 `ok` 捕获记为失败项，不向外抛；触发条件为拼错旗标被静默接受、提示未指向最近合法名、专题族（info/pattern/mutagen/decadal/ages）解析不出
 */
export function runArgSurface({ ok }: Pick<SelftestDeps, "ok">): void {
	ok("参数面：拼错的旗标必须报错，并指向最接近的合法名", () => {
		// 拼错旗标以前**静默**：parseArgs 照收，buildBirthInfo 读不到即落回默认值 ——
		// `--ctiy 喀什` 排出按默认 120°E 算的盘（错约 176 分钟 ≈ 3 个时辰），零提示。
		// 这类静默错盘正是 REQUIRED_EXPORTS 与 projectPalaceName 所防
		// 本断言锁**行为**（未知旗标须抛错）非文案：文案可改，但摘掉校验则静默错盘
		// 原样回来、别的断言全绿。
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
		// 作用域探针：**本 skill 不认**的旗标须报错非静默收。合并后 `--limit`
		// （knowledge）与 `--chart`（synastry 的 --a-chart/--b-chart 裸名）都进作用域，
		// 探针只剩**出生方前缀**一维：`a-`/`b-` 仅 synastry 认，叠 astrology 报错
		// （前缀已退役，实际落「未知参数」——报错非空即守「不静默收下」）。
		// ⚠️ 少了它，摘掉 args.ts 未知参数校验后 `astrology --a-chart x` 会静默通过
		// 而无任何断言变红。
		const outOfScope: Array<[string, string]> = [
			// 命盘前缀（真实存在、归 synastry）：挑「存在但错位」的旗标，
			// 不存在的与上面拼写错误探针重叠。
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
		// 专题参数族：每参数对应一输出专题，加了只出该专题详版（英文主名，别名见
		// OPTION_ALIASES）。switch 裸开关给 true；decadal/ages 可选值，带值给字符串、
		// 裸开关（= 默认当前虚岁）给 true。
		const base = [...SAMPLE_ARGV];
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

/**
 * 声明表：作用域差量排除表、可选值参数 help 语法。
 *
 * @param ok - harness 断言注册
 * @returns 无返回值；七条断言进主报告（一条以「全集 / 排除 / 作用域」基数为说明）
 * @throws `throw` 由 `ok` 捕获记为失败项，不向外抛；触发条件为 `OPTION_SCOPE.excluded`
 *   含声明表外名字、作用域基数与「全集 − excluded」脱节、语义角色反推不等价、
 *   独占分支违背后置不变量、`OPTION_OWNERSHIP` 回归、可选值 help 混用、专题菜单对不上
 */
export function runDeclarationTable({ ok }: Pick<SelftestDeps, "ok">): void {
	ok("声明表：作用域差量排除表里的名字都真实存在（拼错不许静默失效）", () => {
		// OPTION_NAMES = 全集 − excluded：排除项拼错不再「静默让参数失效」，这里变红；
		// excluded 每项须能在全集里点到位。
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
		// 期望值 = 迁移前 astrology.ts 三处 startsWith 反推的实测快照（Step 1）。
		// star 曾随 oracle 域入 I，下线后随声明移除。
		// B 为修漏组后 12 项：「其他出生信息」组（gender/lng/city/province/name）遭
		// startsWith("出生") 漏掉，只给 --gender/--city 会误走零输入演示盘；标 birth 后
		// 进集合，与「部分输入 → 缺一问一」一致（见 ledger Ruling）。数组经 join 归一
		// 成串再比：kit 的 eq 是 !==，直接比数组恒红。
		// S 修守卫域缺口后 12 项：daily/hourly 补标 shadow（2026-11-09
		// exclusive-branch-shadowable-gap），运限四化族进被吞检测域；S 13 项
		// （2026-11-11 shadow-decision-exhaustive-guard）view 表态入域（此前被静默吞）。
		// 均有理由；钉点在 test/report.test.ts 独占分支 describe。
		const snap = {
			S: "ages,daily,decadal,focus,hourly,info,monthly,mutagen,pattern,report,topic,view,yearly",
			B: "branch,city,date,eot,gender,lateZi,leap,lng,lunar,name,noDst,province,time",
			I: "ages,book,daily,decadal,focus,hourly,json,limit,monthly,mutagen,out,palaces,pattern,report,search,source,template,topic,view,yearly",
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
		// ↑ 自 EXCLUSIVE_PRIORITY_LABEL 改由 EXCLUSIVE_BRANCHES 清单序派生起
		//   （2026-11-17-exclusive-branch-allow-chain-declaration），从「文案快照」
		//   升格为「清单顺序守卫」：改清单序/显示段即红，不另加重复断言。
		const unmarked = (table.OPTION_GROUPS ?? []).filter(g => !g.role).map(g => g.title);
		if (unmarked.length) {
			throw new Error(`存在未标 role 的选项组：${unmarked.join("、")}`);
		}
		return "role 标注齐、四套派生与优先级链同源";
	});
	ok(
		"声明表：output-select × astrology 参数的 shadow/noShadow 决策显式表态（穷尽性守卫）",
		() => {
			// 失败可见性增长守卫：output-select 默认域外，漏标 shadow = 静默。
			// daily/hourly（2026-11-09）与 view（2026-11-11）两次静默吞同根因，现快照
			// 与行为测试都只守收缩方向。本断言要求该组每个 astrology 参数显式二选一表态，
			// 「隐式默认域外」的开放枚举收敛为封闭声明义务，决策单点回 table.ts；未表态即红。
			const group = (table.OPTION_GROUPS ?? []).find(g => g.role === "output-select");
			if (!group) {
				throw new Error("声明表缺 output-select 组 —— role 派生守卫失效");
			}
			const undecided = group.options
				.filter(o => (o.cmds ?? []).includes("astrology"))
				.filter(o => o.shadow !== true && o.noShadow !== true)
				.map(o => o.name);
			if (undecided.length) {
				throw new Error(
					`output-select 组 astrology 参数未表态（shadow / noShadow 必须二选一）：` +
						undecided.join("、")
				);
			}
			const total = group.options.filter(o => (o.cmds ?? []).includes("astrology")).length;
			return `output-select × astrology ${total} 个参数 shadow/noShadow 全部显式表态`;
		}
	);
	ok("声明表：独占分支清单跨字段不变量（放行 ⊆ 被吞域、分支名已声明）", () => {
		// EXCLUSIVE_BRANCHES 清单（2026-11-17-exclusive-branch-allow-chain-declaration）
		// 判定链唯一表态处，两表（清单 × OPTION_GROUPS）不许漂移：
		// ① consumes ⊆ SHADOWABLE_KEYS —— 放行参数须同在被吞域，域外放行=静默吞后门重开；
		// ② 条目分支名须已声明 —— 清单只声明分支级关系，参数存在性归 OPTION_GROUPS
		//   （防清单成为第二份参数清单）。
		const branches = table.EXCLUSIVE_BRANCHES ?? [];
		if (branches.length === 0) {
			throw new Error("EXCLUSIVE_BRANCHES 清单为空 —— 独占判定链声明丢失");
		}
		const declared = new Set(
			(table.OPTION_GROUPS ?? []).flatMap(g => (g.options ?? []).map(o => o.name))
		);
		for (const b of branches) {
			if (!declared.has(b.name)) {
				throw new Error(`独占分支清单条目「${b.name}」不在参数声明表 —— 分支名漂移`);
			}
			const illegal = (b.consumes ?? []).filter(c => !table.SHADOWABLE_KEYS?.has(c));
			if (illegal.length) {
				throw new Error(
					`独占分支 ${b.name} 的消费白名单含被吞域外参数：` +
						`${illegal.join("、")}（放行 ⊆ 被吞域，域外放行即静默吞后门）`
				);
			}
		}
		return `独占分支清单 ${branches.length} 条：consumes ⊆ SHADOWABLE_KEYS、分支名均已声明`;
	});
	ok("归属：OPTION_OWNERSHIP 从声明投影而非手抄（候选 4）", () => {
		// 同步断言：kit 的 ok 不 await async 断言体（Promise 恒 truthy = 假绿），
		// 依赖走本文件已有的静态 import（table / helpNs）。
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
	ok("参数面：专题菜单与声明表双向对拍（deep 旗标全在菜单、菜单条目全有声明）", () => {
		// 评审 N7：指路行与 help DESCRIPTION 的旗标列举段都由 DEEP_DIVE_MENU 拼装，
		// 本对拍钉住两个方向 —— 新增专题只标 deep: true 却漏登菜单、或菜单引用了
		// 未声明的旗标，都在这里红（策展排列住菜单数组序，此处只查集合关系）。
		const declared = new Set(table.OPTION_GROUPS.flatMap(g => g.options.map(o => o.name)));
		const menuNames = table.DEEP_DIVE_MENU.map(e => e.name);
		const notDeclared = menuNames.filter(n => !declared.has(n));
		if (notDeclared.length) {
			throw new Error(
				`专题菜单引用了未声明的旗标：${notDeclared.map(n => `--${n}`).join("、")}`
			);
		}
		const notInMenu = table.DEEP_DIVE_KEYS.filter(k => !menuNames.includes(k));
		if (notInMenu.length) {
			throw new Error(`deep 旗标未进专题菜单：${notInMenu.map(n => `--${n}`).join("、")}`);
		}
		const dup = menuNames.filter((n, i) => menuNames.indexOf(n) !== i);
		if (dup.length) {
			throw new Error(`专题菜单重复登记：${dup.map(n => `--${n}`).join("、")}`);
		}
	});
}

/**
 * SKILL.md 行为规范对拍：提到的旗标都在 args-table.ts 的声明表里。
 *
 * @param ok - harness 断言注册
 * @param ctx - 运行期上下文；`ctx.root` 是内核根（`scripts/`），SKILL.md 从上级读
 * @returns 无返回值；通过时以「N 种参数写法全部有声明」为说明
 * @throws `throw` 由 `ok` 捕获记为失败项，不向外抛；触发条件为 SKILL.md 扫不到旗标
 *   （正则或路径失效，「零违规」即假绿），或旗标剥前缀、归别名后不在声明表
 */
export function runSkillArgsAudit({ ok, ctx }: Pick<SelftestDeps, "ok" | "ctx">): void {
	ok("参数面：SKILL.md 提到的旗标都在 args-table.ts 的声明表里", () => {
		// SKILL.md 给助手读的**行为规范**（见 AGENTS.md：改它即改 skill 行为），
		// 旗标若解析层不存在，助手会照敲被拒参数。只查「SKILL.md → 声明表」一向；
		// 反向不查：SKILL.md 是指南非穷举清单，`topic` 全部 key、`knowledge`
		// 位置参数这类细节本就不该塞进去。
		const md = readFileSync(resolve(ctx.root, "..", "SKILL.md"), "utf8");
		const mentioned = [...md.matchAll(/--([a-z][a-z0-9-]*)/g)].map(m => m[1]);
		// 先确认真扫到东西：正则歪或文件挪位得空数组，「零违规」是假绿。
		if (!mentioned.length) {
			throw new Error("未从 SKILL.md 扫到任何旗标 —— 正则或路径可能已失效");
		}
		const names = [...new Set(mentioned)];
		const unknown = names
			.map(n => {
				// 剥出生方前缀查表：`--a-late-zi` 声明 `late-zi`。前缀表取自
				// 作用域（`SIDE_PREFIXES`），从声明派生，作用域变了自动跟上。
				const p = SIDE_PREFIXES.find(pre => n.startsWith(pre));
				return p ? n.slice(p.length) : n;
			})
			// 拼音别名归一到英文主名（--geju 是 --pattern 别名，同样合法）
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
