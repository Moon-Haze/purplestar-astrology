/**
 * astrology 输出形态断言组：未深入/深入/零输入/--palaces/--topic/--focus/--config/--template
 * 与组合层端到端（原 `./commands.ts` 的 `runAstrologyShapes` 整块迁入）。
 *
 * @remarks
 * 断言体原样搬移，只改文件归属（harness 经 {@link SelftestDeps} 注入；直调探针
 * `call` 由主 selftest 构造后经 deps 传入 —— 组文件不静态 import cli/commands.ts）。
 * 在主 selftest 的调用序里与源码顺序一致。去重说明：本组原有「旧命令名已删」
 * （键集层面）与「组合层 --monthly 守卫」两条，分别与 `runCommandSplit` /
 * `runCommandSurface` 的直调版重复，已并入彼处（architecture-review-20261016 候选 2）。
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq, type SelftestDeps } from "./kit";

/** astrology 输出形态：未深入/深入/零输入/--palaces/--topic/--focus/--config/--template。 */
export function runAstrologyShapes({ ok, call }: Pick<SelftestDeps, "ok" | "call">): void {
	ok("astrology：概览与 --info 带面板 + 运限速览 + 专题指路；给了专题参数则只出专题详版", () => {
		// 未深入形态（无功能参数概览 / 仅 --info）输出三节；给了具体专题参数的
		// 输出 = 口径提示 + 专题详版 —— 面板与速览/指路均不带。
		// 任何形态都不出现【命盘总览】抬头。
		for (const argv of [
			["astrology", "1990-5-15", "9:30", "男", "北京"],
			[
				"astrology",
				"--date",
				"1990-05-15",
				"--time",
				"9:30",
				"--gender",
				"男",
				"--city",
				"北京",
				"--info",
			],
		]) {
			const r = call(argv);
			if (r.code !== 0) {
				throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
			}
			for (const want of [
				"【基本信息】",
				"公历生日 : 1990-05-15",
				"命宫:",
				"三方四正:",
				"子年斗君",
				"【运限速览】",
				"【专题深入】",
			]) {
				if (!r.out.includes(want)) {
					throw new Error(`${argv.join(" ")} 缺 ${want}`);
				}
			}
			for (const gone of ["【命盘总览】", "【格局识别】", "【生年四化】"]) {
				if (r.out.includes(gone)) {
					throw new Error(`${argv.join(" ")} 不应出现 ${gone}`);
				}
			}
		}
		const deep = call([
			"astrology",
			"1990-5-15",
			"9:30",
			"男",
			"北京",
			"--pattern",
			"--mutagen",
		]);
		if (deep.code !== 0) {
			throw new Error(`退出码 ${deep.code}，stderr：${deep.err.trim()}`);
		}
		for (const want of ["【格局识别】", "【生年四化】"]) {
			if (!deep.out.includes(want)) {
				throw new Error(`专题叠加缺 ${want}`);
			}
		}
		for (const gone of ["【命盘总览】", "【基本信息】", "【运限速览】", "【专题深入】"]) {
			if (deep.out.includes(gone)) {
				throw new Error(`专题叠加不应出现 ${gone}（已在深入，基底与指路是噪声）`);
			}
		}
		return "未深入形态带三节（无总览抬头）；专题形态只出专题详版";
	});
	ok(
		"astrology：零输入默认输出虚构示例面板 + 运限速览 + 专题指路；--json/部分输入仍守纪律",
		() => {
			// 契约：出生信息一项不给且未表达其他输出意图 → 不报「缺少出生日期」，
			// 以虚构样例（与 help 示例同源）演示【基本信息】面板、运限速览与专题指路并附
			// 用法指路。--json 是机器接口不喂虚构数据；部分输入（给了一半）继续按
			// 「缺一问一」报错。
			for (const argv of [["astrology"], ["astrology", "--info"]]) {
				const r = call(argv);
				if (r.code !== 0) {
					throw new Error(
						`零输入 ${argv.join(" ")} 应演示面板，实得 code ${r.code}：${r.err.trim()}`
					);
				}
				for (const want of [
					"【基本信息】",
					"公历生日 : 2011-06-24",
					"虚构",
					"--date",
					"【运限速览】",
					"【专题深入】",
				]) {
					if (!r.out.includes(want)) {
						throw new Error(`零输入输出缺 ${want}`);
					}
				}
			}
			const json = call(["astrology", "--json"]);
			if (json.code === 0 || !json.err.includes("出生")) {
				throw new Error("--json 零输入必须报错指路（机器接口不喂虚构数据）");
			}
			const partial = call(["astrology", "1990-5-15"]);
			if (partial.code === 0 || !partial.err.includes("时辰")) {
				throw new Error(`部分输入应报缺时辰（缺一问一），实得：${partial.err.trim()}`);
			}
			// 「其他出生信息」组也是出生信息：只给 --gender 不是零输入，走演示盘等于
			// 无视用户输入（现状 startsWith("出生") 漏该组的后果，见候选 2 / ledger Ruling）。
			const genderOnly = call(["astrology", "--gender", "male"]);
			if (genderOnly.code === 0 || !genderOnly.err.includes("出生")) {
				throw new Error(
					`只给 --gender 应按「缺一问一」报错，实得：code ${genderOnly.code} ${genderOnly.err.trim()}`
				);
			}
			return "零输入示例面板在；--json 与部分输入（含 --gender 单给）仍报错";
		}
	);
	ok("astrology：--palaces 出十二宫逐宫详表", () => {
		const r = call(["astrology", "1990-5-15", "9:30", "男", "--palaces"]);
		if (r.code !== 0) {
			throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
		}
		// 十二宫逐宫详表：每宫名一块 + renderPalace 形态（星曜行）
		for (const palace of ["命宫", "夫妻宫", "官禄宫", "福德宫", "田宅宫"]) {
			if (!r.out.includes(palace)) {
				throw new Error(`缺宫位块 ${palace}`);
			}
		}
		if (!r.out.includes("大限")) {
			throw new Error("缺大限一览");
		}
		if (!/(化禄|化权|化科|化忌)/.test(r.out)) {
			throw new Error("详表应含四化标注");
		}
		return "十二宫详表在";
	});
	ok("astrology：--topic love 出主题论断；--view 英文取值与拼音等价；--view 越界报错", () => {
		const r = call(["astrology", "1990-5-15", "9:30", "男", "--topic", "love"]);
		if (r.code !== 0) {
			throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
		}
		if (!r.out.includes("【主题论断")) {
			throw new Error("缺主题论断标题");
		}
		if (!r.out.includes("知识来源分级")) {
			throw new Error("缺知识来源分级披露");
		}
		// 英文取值与拼音逐一等价（输出应完全一致）
		for (const [en, py] of [
			["decadal", "daxian"],
			["yearly", "liunian"],
			["monthly", "liuyue"],
		] as const) {
			const byEn = call([
				"astrology",
				"1990-5-15",
				"9:30",
				"男",
				"--topic",
				"love",
				"--view",
				en,
			]);
			const byPy = call([
				"astrology",
				"1990-5-15",
				"9:30",
				"男",
				"--topic",
				"love",
				"--view",
				py,
			]);
			if (byEn.code !== 0) {
				throw new Error(`--view ${en} 应可用，stderr：${byEn.err.trim()}`);
			}
			if (byEn.out !== byPy.out) {
				throw new Error(`--view ${en} 与 ${py} 输出应逐字一致`);
			}
		}
		const bad = call([
			"astrology",
			"1990-5-15",
			"9:30",
			"男",
			"--topic",
			"love",
			"--view",
			"xxx",
		]);
		if (bad.code === 0 || !bad.err.includes("--view")) {
			throw new Error("--view 越界应报错并点名");
		}
		return "主题论断、view 英文等价与越界校验在";
	});
	ok("astrology：--focus 四项深化（全星曜/对宫详表/涉及格局/运限引动）", () => {
		const r = call(["astrology", "1990-5-15", "9:30", "男", "--focus", "命宫"]);
		if (r.code !== 0) {
			throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
		}
		for (const want of ["会照", "对宫", "格局", "小限"]) {
			if (!r.out.includes(want)) {
				throw new Error(`focus 深化缺 ${want}`);
			}
		}
		return "四项深化在";
	});
	ok("astrology：不存在的公历日期全链路报错（--json 机器路径同受校验）", () => {
		// 进程内 buildBirthInfo 断言在「出生信息」区；这条补的是**用户与机器真正走的路**：
		// --json 分支（先 buildBirthInfo 再 stringify）不许把 throw 吞成正常 JSON 输出。
		// 载体是进程内直调：throw → code 1 / out 空 / err 含原文；「stderr 前缀 + exit 1」
		// 的子进程真链路由文末冒烟覆盖。
		for (const bad of ["2011-02-30", "2011-02-29"]) {
			const r = call([
				"astrology",
				"--date",
				bad,
				"--time",
				"07:45",
				"--city",
				"杭州",
				"--gender",
				"male",
				"--json",
			]);
			if (r.code === 0) {
				throw new Error(`${bad} 未报错（退出码 0）—— 静默归一化又回来了`);
			}
			if (r.out.trim()) {
				throw new Error(
					`${bad} 报错时 stdout 应为空（不许输出半截 JSON），实得：${r.out.slice(0, 60)}`
				);
			}
			if (!(r.err.includes(bad) || r.err.includes("不存在"))) {
				throw new Error(`${bad} 的报错未回显原始输入，实得：${r.err.trim()}`);
			}
		}
		// 闰年边界不得误伤：2012-02-29 必须正常排出整盘
		const leap = call([
			"astrology",
			"--date",
			"2012-02-29",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"male",
		]);
		if (leap.code !== 0) {
			throw new Error(`2012-02-29（闰年）被误伤：${leap.err.trim()}`);
		}
		if (!leap.out.includes("【基本信息】")) {
			throw new Error("2012-02-29 应正常排出基本信息面板");
		}
		return "非法日期 code1/out空/err回显（--json 同）；闰年 2-29 放行";
	});
	ok("--config：JSON 配置应用，命令行同名键覆盖，排盘正确", () => {
		// spec §3.3：配置是基底，命令行更明确必须赢。未知键与命令行同规则中文报错。
		const tmp = mkdtempSync(join(tmpdir(), "ziwei-config-"));
		try {
			// ① 纯配置：排出虚构样例盘
			const cfg = join(tmp, "a.json");
			writeFileSync(
				cfg,
				JSON.stringify({ date: "2011-06-24", time: "07:45", gender: "male", city: "杭州" }),
				"utf8"
			);
			const viaCfg = call(["astrology", "--config", cfg]);
			if (viaCfg.code !== 0) {
				throw new Error(`--config 排盘失败：${viaCfg.err.trim()}`);
			}
			if (!viaCfg.out.includes("2011-6-24") && !viaCfg.out.includes("2011-06-24")) {
				throw new Error("配置里的日期没生效");
			}
			// ② 命令行覆盖：同键以命令行为准（换城市 → 经度行不同）
			const mixed = call(["astrology", "--config", cfg, "--city", "成都"]);
			if (mixed.code !== 0) {
				throw new Error(`覆盖运行失败：${mixed.err.trim()}`);
			}
			if (!mixed.out.includes("成都") && !mixed.out.includes("104.1")) {
				throw new Error("命令行 --city 未覆盖配置的同名键");
			}
			// ③ 配置内未知键报错（与命令行同规则）
			const bad = join(tmp, "bad.json");
			writeFileSync(bad, JSON.stringify({ date: "2011-06-24", noSuchKey: 1 }), "utf8");
			const r = call(["astrology", "--config", bad]);
			if (r.code === 0) {
				throw new Error("未知键未报错");
			}
			if (!r.err.includes("noSuchKey")) {
				throw new Error(`报错未点名未知键，实得：${r.err.trim()}`);
			}
			return "应用 / 覆盖 / 未知键三面成立";
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});
	ok("--template：模板可被 --config 吃回并排出示例盘（闭环）", () => {
		const tmp = mkdtempSync(join(tmpdir(), "ziwei-tpl-"));
		try {
			const tpl = call(["astrology", "--template"]);
			if (tpl.code !== 0) {
				throw new Error(`--template 失败：${tpl.err.trim()}`);
			}
			if (!tpl.out.includes("_")) {
				throw new Error("模板缺注释性 _ 前缀键");
			}
			// 落盘后直接 --config 吃回（模板必须是合法可跑的配置）
			const f = join(tmp, "my.json");
			writeFileSync(f, tpl.out, "utf8");
			const back = call(["astrology", "--config", f]);
			if (back.code !== 0) {
				throw new Error(`模板吃回失败：${back.err.trim()}`);
			}
			// 模板自带 pattern/yearly/focus → 吃回即专题叠加形态（不带
			// 面板），以格局详版在场证明配置吃回成功。
			if (!back.out.includes("【格局识别】")) {
				throw new Error("吃回后应排出示例盘专题详版");
			}
			return "模板闭环成立";
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});
	// ── 组合层端到端（候选 3）：专题旗标 → section 接线，经 deps.call 全链 ──
	// 此前 --decadal / --ages 的端到端用例为 0（守卫链也只有进程外探针）——旗标
	// 解析通了但 section 没接上的回归，没有任何断言会红。期望文案取自实跑
	// （Task 5 Step 2）；写入时先以假期望验红（四条同红、红因各指检查点），
	// 再换实文案转绿 —— 保护性断言同样要证明它真的在读输出。
	const base = ["--date", "1990-05-15", "--branch", "5", "--gender", "male"];
	ok("组合层：--decadal 端到端经 cmdAstrology 出大限节（候选 3）", () => {
		const r = call(["astrology", ...base, "--decadal", "37"]);
		eq(r.code, 0, r.err);
		if (!r.out.includes("【大限 · 十年大运】")) {
			throw new Error("缺大限节标题");
		}
		return "大限节在";
	});
	ok("组合层：--ages 端到端出小限节", () => {
		const r = call(["astrology", ...base, "--ages", "45"]);
		eq(r.code, 0, r.err);
		if (!r.out.includes("【小限】")) {
			throw new Error("缺小限节标题");
		}
		return "小限节在";
	});
	ok("组合层：deepDive 门——给 --pattern 时不输出基底节", () => {
		// 深入形态输出 = 口径提示 + 专题详版；三块基底（基本信息 / 运限速览 /
		// 专题指路）任一在场即门失效。实跑确认 --pattern / --decadal 均不含。
		const r = call(["astrology", ...base, "--pattern"]);
		eq(r.code, 0, r.err);
		const baseSections = ["【基本信息】", "运限速览", "专题指路"].filter(s =>
			r.out.includes(s)
		);
		if (baseSections.length) {
			throw new Error(`deepDive 门失效：深入形态仍输出基底 ${baseSections.join("、")}`);
		}
		return "deepDive 门在";
	});
}
