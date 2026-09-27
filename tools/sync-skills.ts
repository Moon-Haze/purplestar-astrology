// ── 把源 skill 的副本同步到各派生 skill ──
//
// 用法：
//   npm run sync:skills            # 写：补齐差异、删掉残留
//   npm run sync:skills -- --check # 只比对不写；有差异则非零退出（CI / 断言用）
//
// 切片声明在 `tools/skills.ts`（唯一源），本文件只负责执行 —— 复制哪些文件、
// 哪些是各 skill 手写不能碰，全部由那份声明决定。
//
// ## 开发循环
//
//   改源（`skills/purplestar-astrology/scripts/`）→ `npm test` → `npm run sync:skills`
//
// ⚠️ **绝不要直接改派生 skill 的副本文件**：下一次同步会覆盖它，而中间那段时间
// `npm test` 的逐字节断言是红的。派生 skill 的 `ownFiles`（入口 / 命令表 / selftest /
// SKILL.md / package.json）才是可以就地改的。
//
// ## 为什么要删「多余文件」
//
// 清单缩小时（某个文件不再被入口引用），上一次同步留下的副本不会被任何逐字节断言发现 ——
// 断言只检查「清单里的都在且一致」，清单外的它不看。残留的副本会**继续被解析钩子加载**，
// 于是「已经删掉的模块」在派生 skill 里阴魂不散。故同步时按实际目录走一遍，清掉清单外、
// ownFiles 外的 `.ts`。
//
// ## 为什么 `--check` 是独立模式而不是同步后比对
//
// `test/repo.test.ts` 的断言要的是「**此刻**是否一致」，同步一次再断言等于什么都没测。
// 这与本仓「能派生的派生、不能派生的由断言盯双向一致」是同一路数。

import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import {
	DERIVED_SKILLS,
	SKILLS_DIR,
	SOURCE_SKILL,
	type SkillSpec,
	actualFiles,
	isOwned,
	skillDir,
	sourcePathOf,
	syncedFiles,
} from "./skills";

const CHECK = process.argv.includes("--check");

/** 两个文件是否逐字节相同；目标不存在即不同。 */
function sameBytes(a: string, b: string): boolean {
	if (!existsSync(b)) return false;
	return readFileSync(a).equals(readFileSync(b));
}

interface SkillResult {
	readonly name: string;
	/** 源里缺失的清单项 —— 声明写错了，或文件被删了。 */
	readonly missingInSource: string[];
	/** 目标缺失或内容不同的清单项。 */
	readonly drifted: string[];
	/** 清单外、ownFiles 外的残留副本。 */
	readonly stale: string[];
}

function inspect(spec: SkillSpec): SkillResult {
	const wanted = syncedFiles(spec);
	const missingInSource = wanted.filter(f => !existsSync(sourcePathOf(f)));
	const drifted = wanted
		.filter(f => existsSync(sourcePathOf(f)))
		.filter(f => !sameBytes(sourcePathOf(f), resolve(skillDir(spec), "scripts", f)));
	// 残留 = 实际存在、但既不在同步清单里、也不是本 skill 自有的文件。
	// 归属判定统一走 isOwned（相对 `<skill>/` 的路径），与 test/repo.test.ts 的守卫同源。
	const stale = actualFiles(spec).filter(
		f => !wanted.includes(f) && !isOwned(spec, `scripts/${f}`)
	);
	return { name: spec.name, missingInSource, drifted, stale };
}

/** 把源文件复制到目标位置，必要时建目录。返回是否真的写了。 */
function copyInto(spec: SkillSpec, rel: string): boolean {
	const from = sourcePathOf(rel);
	const to = resolve(skillDir(spec), "scripts", rel);
	if (sameBytes(from, to)) return false;
	mkdirSync(dirname(to), { recursive: true });
	copyFileSync(from, to);
	return true;
}

function main(): void {
	const results = DERIVED_SKILLS.map(inspect);
	const broken = results.filter(r => r.missingInSource.length);

	console.log(CHECK ? "副本一致性检查（只读）" : "同步派生 skill 的副本");
	console.log(`  源：${relative(SKILLS_DIR, resolve(SKILLS_DIR, SOURCE_SKILL))}`);

	for (const r of results) {
		const spec = DERIVED_SKILLS.find(s => s.name === r.name) as SkillSpec;
		const total = syncedFiles(spec).length;
		console.log(`\n▸ ${r.name} —— ${spec.summary}`);
		console.log(`  清单 ${total} 个文件：${total - r.drifted.length} 一致 / ${r.drifted.length} 待同步`);
		for (const f of r.missingInSource) console.log(`  ✗ 源里不存在：${f}`);
		for (const f of r.drifted) console.log(`  ~ ${f}`);
		for (const f of r.stale) console.log(`  - 残留（清单外）：${f}`);
	}

	if (broken.length) {
		console.error(
			`\n[失败] 有清单项在源里不存在 —— 切片声明写错，或文件被删。` +
				`\n  处理：核对 tools/skills.ts 的 kernelEntries / sharedFiles 与实际文件名。`
		);
		process.exit(1);
	}

	const changed = results.reduce((n, r) => n + r.drifted.length + r.stale.length, 0);
	if (CHECK) {
		if (changed) {
			console.error(
				`\n[失败] 副本与源不一致（${changed} 个文件）。\n` +
					`  处理：npm run sync:skills 后重跑。\n` +
					`  注意：若你刚刚是**直接改的副本**，那次改动会被覆盖 —— 派生 skill 里只有\n` +
					`  ownFiles（入口 / 命令表 / selftest / SKILL.md / package.json）可以就地改。`
			);
			process.exit(1);
		}
		console.log("\n[通过] 全部副本与源逐字节一致。");
		return;
	}

	let written = 0;
	let removed = 0;
	for (const r of results) {
		const spec = DERIVED_SKILLS.find(s => s.name === r.name) as SkillSpec;
		for (const f of r.drifted) if (copyInto(spec, f)) written++;
		for (const f of r.stale) {
			unlinkSync(resolve(skillDir(spec), "scripts", f));
			removed++;
		}
	}
	console.log(`\n[完成] 写入 ${written} 个 / 删除 ${removed} 个。`);
}

main();
