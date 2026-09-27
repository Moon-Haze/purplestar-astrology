/**
 * 紫微斗数分析数据库 v3 — 倪海厦《天纪》正统口径
 *
 * 来源：自 reference/ziwei-samples-toolkit/lib/ziwei/db-analysis.ts 拷入本仓内核。
 * 拷入时做了三处口径适配（其余逐字保留）：
 *   1. TOPIC_PALACE_NAME 改用**本项目宫名口径**（`Palace.name` 带「宫」字、
 *      「仆役」→「交友宫」，见 constants.ts 的 IZTRO_TO_PROJECT_PALACE）——
 *      本模块按宫名**严格等值**找宫（getPalaceStars 等），旧口径会全部失配
 *      并静默落到「无法找到 xx」的兜底文案。
 *   2. detectGeJu 内 getPalace 加「去宫字」归一化 —— 内容区散布着旧口径名
 *      （如 '迁移'），归一化兜住它们，逻辑零改动。
 *   3. 删除了未使用的 getYearStemIndex 导入（那是公历取模口径，仅流年可用；
 *      生年四化必须用 chart.lunarInfo.yearStem，见 sihua.ts 的口径说明）。
 *
 * ⚠️ 知识来源分级：
 *   - [verified]    倪师《天纪》讲稿原话（天纪 02-13 集已核对）
 *   - [traditional] 紫微斗数传统口诀（《紫微斗数全书》等古书，非倪师独创）
 *   - [methodology] 倪师体系的方法论概念（非原话摘录）
 *   - [suspect]     来源存疑，疑似其他流派或后人整理
 *
 *   以「倪海夏/倪师说」开头的引号句，部分为 traditional 口诀的风格化转述，不一定是
 *   倪师《天纪》逐字原话。CLI 的 topic 命令在输出末尾固定披露此点。
 *   2026-09-27 拆分后，引文主体随 STAR_CONTENT_MAP 移到了 ./analysis-data，本文件只余零星几处。
 *
 * 架构：
 * - 十四主星各自的详细命理内容（12 宫语境）
 * - 四化（禄权科忌）各自的语义补充
 * - getTopicAnalysis：动态推算三方四正、本命四化会照、大限、流年、流月
 */

import type { ZiweiChart, Palace, Star } from "./types";
import { BRANCHES, STEMS } from "./constants";
// 格局的**命中判定**统一由 patterns.ts 负责（本文件只写判词），故这里引它的产出。
// 2026-09-26 先对齐了 4 个口径分歧的格局（紫府同宫 / 火贪格 / 铃贪格 / 机月同梁）；
// 2026-09-27 把剩下 ~30 段手写判定**全部**收敛过去（含 12 个原先只在本文件存在的格局，
// 判定搬进 patterns.ts 的「收敛自 db-analysis 的格局」一组）。至此 `detectGeJu` 不含任何判定。
import { detectPatterns, type Pattern } from "./patterns";
// getYearStemIndex 是**公历年取模**口径，本文件只用于流年干（唯一合法用途；
// 生年四化必须用 chart.lunarInfo.yearStem —— 两口径在 1-2 月出生者身上分叉，
// 见 sihua.ts 的口径说明与 test/cli.test.ts 的「生年四化的年干口径」）
import { getYearStemIndex } from "./sihua";
// 2026-09-27 拆分：本文件原先自带的元数据表与论断文案已移出到 ./analysis-data
// （STAR_CONTENT_MAP，含「倪师…说」引文）。公开面由文末 re-export 兜住。
import { STAR_CONTENT_MAP } from "./analysis-data";
import {
	KUI_YUE_GUIREN_MAP,
	MINOR_STAR_PALACE_CONTENT,
	PALACE_BRANCH_ORGAN,
	PALACE_TO_CONTENT_KEY,
	SIHUA_CHAR_TO_KEY,
	STAR_BRIEF,
	SUMMARY_TOPICS,
	TOPIC_CONTENT_KEY,
	TOPIC_KEY_PALACES,
	TOPIC_LABEL,
	TOPIC_PALACE_NAME,
	TOPIC_SANFANG_LABELS,
	TOPIC_SUGGESTIONS,
	TOPIC_SUMMARY_KEY,
	ZIWU_LIUZHU,
	siHuaSymbol,
	type AnalysisOptions,
	type AnalysisView,
	type StarContent,
	type TopicKey,
} from "./analysis-data";

// ─── 工具函数 ────────────────────────────────────────────────────────────────

/**
 * 过滤与当前性别无关的内容
 * 规则：
 *  1. 删除"；女命xxx"或"；男命xxx"格式的分号子句
 *  2. 删除以"女命"或"男命"开头的完整句子（到。！？结束）
 */
function filterGenderContent(text: string, gender: "male" | "female"): string {
	const removeTag = gender === "male" ? "女命" : "男命";

	let result = text;

	// 规则1：删除 ；女命/男命 引导的子句（不跨句末标点）
	result = result.replace(new RegExp(`；${removeTag}[^；。！？]*`, "g"), "");

	// 规则3：删除整行以 （女命）/（男命） 开头的内容
	result = result
		.split("\n")
		.filter(line => {
			const t = line.trimStart();
			return !t.startsWith("（" + removeTag + "）");
		})
		.join("\n");

	// 规则2：按行处理，删除以 removeTag 开头的完整句子
	result = result
		.split("\n")
		.map(line => {
			if (!line.includes(removeTag)) return line;

			const kept: string[] = [];
			let rest = line;

			while (rest.length > 0) {
				const endIdx = rest.search(/[。！？]/);
				if (endIdx === -1) {
					// 无句末标点的剩余片段
					const trimmed = rest.trimStart();
					if (
						!trimmed.startsWith(removeTag) &&
						!trimmed.startsWith("（" + removeTag + "）")
					)
						kept.push(rest);
					break;
				}
				const sentence = rest.slice(0, endIdx + 1);
				rest = rest.slice(endIdx + 1);
				const trimmed = sentence.trimStart();
				if (!trimmed.startsWith(removeTag) && !trimmed.startsWith("（" + removeTag + "）"))
					kept.push(sentence);
			}

			return kept.join("");
		})
		.join("\n");

	return result;
}

/** 获取宫位的主星列表（空宫则借对宫） */
function getPalaceStars(
	chart: ZiweiChart,
	palaceName: string
): { palace: Palace; mainStars: Star[]; isLoan: boolean } | null {
	const palace = chart.palaces.find(p => p.name === palaceName);
	if (!palace) return null;

	const mainStars = palace.stars.filter(s => s.type === "major");
	if (mainStars.length > 0) return { palace, mainStars, isLoan: false };

	// 空宫：借对宫
	const oppBranch = (palace.branch + 6) % 12;
	const oppPalace = chart.palaces.find(p => p.branch === oppBranch);
	if (!oppPalace) return { palace, mainStars: [], isLoan: false };

	const oppMainStars = oppPalace.stars.filter(s => s.type === "major");
	return { palace, mainStars: oppMainStars, isLoan: true };
}

/** 获取三方四正（4个宫位）*/
function getSanFangSiZheng(chart: ZiweiChart, palaceName: string): Palace[] {
	const main = chart.palaces.find(p => p.name === palaceName);
	if (!main) return [];

	const branches = [
		main.branch,
		(main.branch + 4) % 12,
		(main.branch + 8) % 12,
		(main.branch + 6) % 12,
	];
	return branches.map(b => chart.palaces.find(p => p.branch === b)).filter(Boolean) as Palace[];
}

/** 描述一个宫位的星曜（带四化） */
function descPalaceStars(palace: Palace): string {
	const main = palace.stars.filter(s => s.type === "major");
	if (main.length === 0) return `${palace.name}空宫`;
	return main
		.map(
			s =>
				`${s.name}${s.siHua ? "化" + s.siHua : ""}${s.brightness === "bright" ? "（庙旺）" : s.brightness === "dim" ? "（落陷）" : ""}`
		)
		.join("、");
}

/** 获取宫位中的所有四化信息 */
function getPalaceSiHua(palace: Palace): { name: string; siHua: string }[] {
	return palace.stars.filter(s => s.siHua).map(s => ({ name: s.name, siHua: s.siHua! }));
}

/** 获取某颗星在某宫的四化modifier文字 */
function getSiHuaNote(starName: string, siHua: string): string {
	const profile = STAR_CONTENT_MAP[starName];
	if (!profile?.sihua) return "";
	const key = SIHUA_CHAR_TO_KEY[siHua];
	if (!key) return "";
	return profile.sihua[key] ?? "";
}

/**
 * 疾厄宫 · 地支宫位 → 脏腑映射（倪师体系主轴）
 *
 * ⚠️ 倪师《天纪 05》原话明示：
 *   - 化忌在酉宫 = 肾
 *   - 火星地空在丑宫 = 肝
 *   - 头肩胸区域 = 妇科子宫 / 右卵巢
 *
 * 倪师疾厄论断**以疾厄宫落在哪个地支为主轴**，星曜五行为辅。
 * 这与「按星曜五行对应脏腑」的做法不同——后者是传统三合派用法。
 */
/** 获取次星在某宫的详细文案 */
function getMinorStarNote(starName: string, palaceName: string): string {
	return MINOR_STAR_PALACE_CONTENT[starName]?.[palaceName] ?? "";
}

/** 识别命盘中的重要格局 */
function detectGeJu(chart: ZiweiChart): { name: string; description: string }[] {
	// 格局的**命中事实层 + 两套判词**如今都归 `patterns.ts`：
	//   - 判定（唯一一处）：`detectPatterns`，82 个格局各有独立预言机盯着
	//   - analyze 侧短判词 + 等级：`Pattern.description` / `Pattern.level`
	//   - topic 侧倪师口吻长判词：`Pattern.topicDescription`
	//
	// 本函数只是**投影**：把填了长判词的命中挑出来，供 `overview` / `personality` 展示。
	// 2026-09-27 之前，25 段长判词散在本文件里、按名字二次查表（`hasAny` / `bySuffix` /
	// `starOf` 三个 helper 就是为此而生）；现已搬进各识别器。**新增格局只要在
	// patterns.ts 的识别器里填 `topicDescription`，这边自动就能展示**，不会再有
	// 「判定加了、判词忘了补、topic 静默不显示」的漏。
	//
	// 展示顺序**按 level 降序**（同级保持识别器注册序）—— 不再维护一张 25 元素的手写
	// 顺序表：那张表每加一个格局都要同步，是纯粹的漂移源。（2026-09-27 之前的顺序是
	// 手写的 1–25，与判定无关，故这次变动不影响任何判定结果。）
	return detectPatterns(chart)
		.filter((p): p is Pattern & { topicDescription: string } => !!p.topicDescription)
		.sort((a, b) => b.level - a.level)
		.map(p => ({ name: p.name, description: p.topicDescription }));
}

// ─── 核心分析函数（总分结构 + 三方四正 + 本命四化会照 + 大限）───────────────────

export function getTopicAnalysis(
	chart: ZiweiChart,
	topic: TopicKey,
	options: AnalysisOptions = {}
): string {
	const view: AnalysisView = options.view ?? "mingpan";
	const liunianYear = options.liunianYear ?? new Date().getFullYear();
	const liuyueMonth = options.liuyueMonth ?? new Date().getMonth() + 1;
	const dxIndex = options.daXianIndex ?? chart.currentDaXianIndex;

	const palaceName = TOPIC_PALACE_NAME[topic];
	const topicLabel = TOPIC_LABEL[topic];

	// 获取主宫
	const result = getPalaceStars(chart, palaceName);
	if (!result) return `无法找到${palaceName}相关信息。`;

	const { palace: mainPalace, mainStars, isLoan } = result;
	const primaryStar = mainStars[0];
	const profile = primaryStar ? STAR_CONTENT_MAP[primaryStar.name] : null;

	// 获取三方四正
	const sanFang = getSanFangSiZheng(chart, palaceName);
	const sanFangLabels = TOPIC_SANFANG_LABELS[topic];

	// 当前大限
	const currentDx = chart.daXians[dxIndex];

	const lines: string[] = [];

	// ══════════════════════════════════════════════
	// 一、总论（总-分结构）
	// ══════════════════════════════════════════════
	lines.push(`**【${topicLabel}】**`);
	lines.push("");

	if (primaryStar && profile) {
		const contentKey = TOPIC_CONTENT_KEY[topic];
		const summaryKey = TOPIC_SUMMARY_KEY[topic];
		const gender: "male" | "female" = chart.birthInfo?.gender === "female" ? "female" : "male";

		const isCoreTopic = SUMMARY_TOPICS.has(topic) || topic === "personality";
		const showSummarySection = SUMMARY_TOPICS.has(topic); // personality 不展示 summary 段

		const loanNote = isLoan ? `（${palaceName}空宫，借对宫${primaryStar.name}论事）` : "";

		// ── 动态内容优先：命盘关键定制（亮度 + 四化的 topic_mods，仅核心主题）──
		if (isCoreTopic) {
			const topicMod = profile.topic_mods?.[summaryKey as keyof typeof profile.topic_mods];
			const brightnessKey =
				primaryStar.brightness === "bright"
					? "bright"
					: primaryStar.brightness === "dim"
						? "dim"
						: null;
			const sihuaKey = primaryStar.siHua ? (SIHUA_CHAR_TO_KEY[primaryStar.siHua] ?? null) : null;

			const dynamicParts: string[] = [];
			if (brightnessKey && topicMod?.[brightnessKey]) {
				dynamicParts.push(topicMod[brightnessKey]!);
			}
			if (sihuaKey && topicMod?.[sihuaKey]) {
				dynamicParts.push(topicMod[sihuaKey]!);
			}

			if (dynamicParts.length > 0) {
				lines.push(`**【命盘关键定制】**`);
				lines.push("");
				dynamicParts.forEach(p => {
					lines.push(p);
					lines.push("");
				});
			}
		}

		// 格局识别（仅overview/personality展示）
		if (topic === "overview" || topic === "personality") {
			const geJuList = detectGeJu(chart);
			if (geJuList.length > 0) {
				lines.push(`**【命盘特殊格局】**`);
				lines.push("");
				geJuList.forEach(gj => {
					lines.push(`⭐ **${gj.name}**：${gj.description}`);
					lines.push("");
				});
			}
		}

		// ── 静态白话总论（summary）──
		// 5 个核心主题（命格/感情/事业/财运/健康）显示
		// personality 跳过（避免与 overview 用同一段 summary 'overview' 导致雷同）
		if (showSummarySection && profile.summary?.[gender]?.[summaryKey]) {
			lines.push(`**【星曜深层特质】**`);
			lines.push("");
			lines.push(profile.summary[gender][summaryKey]);
			lines.push("");
		}

		// 命盘推演标题及本宫主星说明
		const mainStarDesc =
			mainStars
				.map(
					s =>
						`${s.name}${s.siHua ? "化" + s.siHua : ""}${s.brightness === "bright" ? "（庙旺）" : s.brightness === "dim" ? "（落陷）" : ""}`
				)
				.join("、") || "空宫";

		lines.push(`**【命盘推演】**`);
		lines.push("");
		lines.push(
			`本宫主星：${loanNote}${mainStarDesc}${topic === "overview" ? `，${chart.wuxingJuName}` : ""}`
		);
		lines.push("");

		// 技术性星曜详解
		if (topic === "overview") {
			lines.push(profile.mingGong);
		} else {
			lines.push(profile[contentKey as keyof StarContent] as string);
		}

		// 亮度补充
		if (primaryStar.brightness === "bright" && profile.brightMod) {
			lines.push("");
			lines.push(`▶ ${profile.brightMod}`);
		} else if (primaryStar.brightness === "dim" && profile.dimMod) {
			lines.push("");
			lines.push(`▶ ${profile.dimMod}`);
		}

		// 同宫第二主星
		if (mainStars[1]) {
			const s2 = mainStars[1];
			const brief = STAR_BRIEF[s2.name] ?? "";
			lines.push("");
			lines.push(`同宫第二主星：**${s2.name}${s2.siHua ? "化" + s2.siHua : ""}**——${brief}`);
		}
	} else {
		lines.push(`${palaceName}空宫，需借对宫论事，命格整体以三方四正综合判断。`);
	}

	// ══════════════════════════════════════════════
	// 二、三方四正联动分析
	// ══════════════════════════════════════════════
	lines.push("");
	lines.push(`**【三方四正联动】**`);
	lines.push("");

	sanFang.forEach((p, idx) => {
		const isMain = p.name === palaceName;
		const label = isMain
			? `本宫 · ${p.name}`
			: `${sanFangLabels[idx - 1] ?? "联动宫"} · ${p.name}`;
		const starsDesc = descPalaceStars(p);
		const mainStarsOfP = p.stars.filter(s => s.type === "major");

		lines.push(`▍**${label}**：${starsDesc}`);

		if (!isMain && mainStarsOfP.length > 0) {
			mainStarsOfP.forEach(s => {
				const starProfile = STAR_CONTENT_MAP[s.name];
				const palaceContentKey = PALACE_TO_CONTENT_KEY[p.name];
				const fullContent =
					starProfile && palaceContentKey
						? (starProfile[palaceContentKey] as string | undefined)
						: null;
				const siHuaStr = s.siHua ? `化${s.siHua}` : "";
				const brightStr =
					s.brightness === "bright"
						? "（庙旺）"
						: s.brightness === "dim"
							? "（落陷）"
							: "";
				const siHuaNote = s.siHua ? getSiHuaNote(s.name, s.siHua) : "";

				if (fullContent) {
					// 有完整宫位段落，直接输出全文 + 四化补充
					lines.push(`**${s.name}${siHuaStr}${brightStr}** 在${p.name}：`);
					lines.push("");
					lines.push(fullContent);
					if (siHuaNote) {
						lines.push("");
						lines.push(`▶ 化${s.siHua}：${siHuaNote}`);
					}
				} else {
					// 无专项段落，用简述 + 四化
					const brief = STAR_BRIEF[s.name] ?? "";
					lines.push(
						`  ${s.name}${siHuaStr}${brightStr}${brief ? "（" + brief + "）" : ""}${siHuaNote ? " | 化" + s.siHua + "：" + siHuaNote : ""}`
					);
				}
				lines.push("");
			});
		} else if (!isMain && mainStarsOfP.length === 0) {
			const oppBranch = (p.branch + 6) % 12;
			const oppP = chart.palaces.find(q => q.branch === oppBranch);
			const oppStars = oppP?.stars.filter(s => s.type === "major") ?? [];
			if (oppStars.length > 0) {
				lines.push(
					`  （空宫，借对宫${oppP?.name ?? ""}：${oppStars.map(s => s.name).join("、")}入事）`
				);
			} else {
				lines.push(`  （空宫）`);
			}
		}

		// ── 次星（六吉 + 禄存 + 天马）深度文案 ──
		const minorStarNotes: string[] = [];
		p.stars
			.filter(s => s.type === "lucky")
			.forEach(ls => {
				const note = getMinorStarNote(ls.name, p.name);
				if (note) minorStarNotes.push(`✦ **${ls.name}**：${note}`);
			});
		if (minorStarNotes.length > 0) {
			minorStarNotes.forEach(n => lines.push(n));
			lines.push("");
		}

		lines.push("");
	});

	// ══════════════════════════════════════════════
	// 三、本命四化会照（三方四正范围内的所有本命四化）
	// ══════════════════════════════════════════════
	const siHuaInSanFang: { palaceName: string; starName: string; siHua: string; note: string }[] =
		[];
	sanFang.forEach(p => {
		getPalaceSiHua(p).forEach(({ name, siHua }) => {
			const note = getSiHuaNote(name, siHua);
			siHuaInSanFang.push({ palaceName: p.name, starName: name, siHua, note });
		});
	});

	if (siHuaInSanFang.length > 0) {
		lines.push(`**【本命四化会照】**`);
		lines.push("");
		siHuaInSanFang.forEach(({ palaceName: pn, starName, siHua, note }) => {
			lines.push(`${siHuaSymbol(siHua)} **${starName}化${siHua}**（落${pn}）`);
			if (note) lines.push(`   ${note}`);
		});
		lines.push("");
	} else {
		lines.push(`**【本命四化会照】**`);
		lines.push("");
		lines.push(
			`三方四正范围内暂无本命四化落入，格局较为中性，需重点看落宫主星、对宫借星与煞曜吉曜组合来判断吉凶起伏。`
		);
		lines.push("");
	}

	// ══════════════════════════════════════════════
	// 三点五、年干四化·全局关键宫位解读
	// （补充未落入三方四正但影响本话题的四化信息）
	// ══════════════════════════════════════════════
	const keyPalaceRules = TOPIC_KEY_PALACES[topic];

	// 收集全盘所有四化（含三方四正外的宫位）
	const allChartSiHua: { palace: string; star: string; siHua: string }[] = [];
	chart.palaces.forEach(p => {
		p.stars
			.filter(s => s.siHua)
			.forEach(s => {
				allChartSiHua.push({ palace: p.name, star: s.name, siHua: s.siHua! });
			});
	});

	// 找出落在关键宫位、但尚未在三方四正中展示的四化
	const alreadyShown = new Set(
		siHuaInSanFang.map(s => `${s.starName}-${s.siHua}-${s.palaceName}`)
	);
	const globalKeyFindings: { palace: string; star: string; siHua: string; meaning: string }[] =
		[];

	keyPalaceRules.forEach(rule => {
		allChartSiHua
			.filter(sh => sh.palace === rule.palace)
			.forEach(sh => {
				const key = `${sh.star}-${sh.siHua}-${sh.palace}`;
				if (alreadyShown.has(key)) return; // 三方四正已展示，跳过
				const ruleKey = SIHUA_CHAR_TO_KEY[sh.siHua];
				const meaning = ruleKey ? rule[ruleKey] : undefined;
				if (meaning) {
					globalKeyFindings.push({
						palace: sh.palace,
						star: sh.star,
						siHua: sh.siHua,
						meaning,
					});
				}
			});
	});

	if (globalKeyFindings.length > 0) {
		lines.push(`**【年干四化·关键宫位影响】**`);
		lines.push("");
		globalKeyFindings.forEach(({ palace, star, siHua, meaning }) => {
			lines.push(`${siHuaSymbol(siHua)} **${star}化${siHua}**（落${palace}）→ ${meaning}`);
		});
		lines.push("");
	}

	// ══════════════════════════════════════════════
	// 四、当前大限分析（倪师《天纪》正统：四化星永远固定不动，
	//                  大限只看走到哪个宫位 + 三方四正会照本命四化）
	// ══════════════════════════════════════════════
	if (currentDx) {
		const dxPalace = chart.palaces.find(p => p.branch === currentDx.palaceBranch);
		const dxStarsDesc = dxPalace ? descPalaceStars(dxPalace) : "未知";

		lines.push(
			`**【当前大限 ${currentDx.startAge}–${currentDx.endAge}岁 · ${currentDx.palaceName}】**`
		);
		lines.push("");
		lines.push(
			`现走**${currentDx.palaceName}**大限（${dxStarsDesc}），此十年是人生的重要阶段。`
		);
		lines.push(
			`倪师《天纪 03》明示：「四化星永远固定在那个宫上面不要动…我们每年是流年在动，星都不动」——大限只看**宫位移动**，而非按宫干重新起化。`
		);

		// ── 大限宫为空宫时借对宫 ──
		if (dxPalace && dxPalace.stars.filter(s => s.type === "major").length === 0) {
			const oppBranch = (dxPalace.branch + 6) % 12;
			const oppP = chart.palaces.find(q => q.branch === oppBranch);
			const oppStars = oppP?.stars.filter(s => s.type === "major").map(s => s.name) ?? [];
			if (oppStars.length > 0) {
				lines.push("");
				lines.push(
					`▶ 大限宫为空宫，借**${oppP?.name}**的${oppStars.join("、")}入事——倪师强调「空宫必借对宫论事」。`
				);
			}
		}

		// ── 大限宫与本命四化的会照（倪师正统）──
		if (dxPalace) {
			const dxSanFangBranches = [
				dxPalace.branch,
				(dxPalace.branch + 4) % 12,
				(dxPalace.branch + 8) % 12,
				(dxPalace.branch + 6) % 12,
			];
			const dxSanFangPalaces = chart.palaces.filter(p =>
				dxSanFangBranches.includes(p.branch)
			);
			const sihuaInDxSanFang: string[] = [];
			dxSanFangPalaces.forEach(p => {
				p.stars
					.filter(s => s.siHua && s.type === "major")
					.forEach(s => {
						sihuaInDxSanFang.push(
							`${siHuaSymbol(s.siHua!)} **本命${s.name}化${s.siHua}** 落${p.name} ${p.branch === dxPalace.branch ? "（大限本宫）" : "（大限三方四正）"}`
						);
					});
			});
			if (sihuaInDxSanFang.length > 0) {
				lines.push("");
				lines.push(`**大限三方四正会照的本命四化**（倪师批大限的核心）：`);
				sihuaInDxSanFang.forEach(x => lines.push(x));
				lines.push("");
			} else {
				lines.push("");
				lines.push(`（大限三方四正未会本命四化，此十年走平盘，重点看落宫主星本身。）`);
				lines.push("");
			}
		}
		lines.push("");
	}

	// ══════════════════════════════════════════════
	// 四点五、流年分析（倪师正统：流年看年支落宫，三方会照本命四化）
	// ══════════════════════════════════════════════
	if (view === "liunian" || view === "liuyue") {
		const lnYearBranch = (((liunianYear - 4) % 12) + 12) % 12;
		const lnYearStem = getYearStemIndex(liunianYear);
		const lnPalace = chart.palaces.find(p => p.branch === lnYearBranch);
		lines.push(
			`**【${liunianYear}年 流年 · ${STEMS[lnYearStem]}${BRANCHES[lnYearBranch]}年】**`
		);
		lines.push("");
		lines.push(
			`流年命宫落${lnPalace?.name ?? BRANCHES[lnYearBranch]}（${lnPalace ? descPalaceStars(lnPalace) : ""}）——倪师正法：**流年只看年支移到哪里，本命四化星固定不动**，看流年三方四正会哪几颗本命化禄/化权/化科/化忌。`
		);
		lines.push("");

		if (lnPalace) {
			const lnSanFangBranches = [
				lnPalace.branch,
				(lnPalace.branch + 4) % 12,
				(lnPalace.branch + 8) % 12,
				(lnPalace.branch + 6) % 12,
			];
			const lnSanFangPalaces = chart.palaces.filter(p =>
				lnSanFangBranches.includes(p.branch)
			);
			const lnHits: string[] = [];
			lnSanFangPalaces.forEach(p => {
				p.stars
					.filter(s => s.siHua && s.type === "major")
					.forEach(s => {
						lnHits.push(
							`${siHuaSymbol(s.siHua!)} **本命${s.name}化${s.siHua}** 在${p.name}${p.branch === lnPalace.branch ? "（流年本宫）" : "（流年三方四正）"}`
						);
					});
			});
			if (lnHits.length > 0) {
				lines.push(`**流年三方四正会本命四化**：`);
				lnHits.forEach(x => lines.push(x));
				lines.push("");
			} else {
				lines.push(`（流年三方四正未会本命四化，此年运势按本宫主星与本命格局判读。）`);
				lines.push("");
			}
		}
	}

	// ══════════════════════════════════════════════
	// 四点六、流月分析（倪师正统：月支移宫位，不重新起化）
	// ══════════════════════════════════════════════
	if (view === "liuyue") {
		const lnYearBranch = (((liunianYear - 4) % 12) + 12) % 12;
		const lyBranch = (lnYearBranch + (liuyueMonth - 1)) % 12;
		const lyPalace = chart.palaces.find(p => p.branch === lyBranch);
		lines.push(`**【${liunianYear}年${liuyueMonth}月 流月 · ${BRANCHES[lyBranch]}月】**`);
		lines.push("");
		lines.push(
			`流月落${lyPalace?.name ?? BRANCHES[lyBranch]}（${lyPalace ? descPalaceStars(lyPalace) : ""}）——倪师不主张按月柱重新起化，只看月支移到哪个本命宫位，借该宫主星与本命四化的会照判月运。`
		);
		lines.push("");
	}

	// ══════════════════════════════════════════════
	// 五、性格专属补充（仅 personality）
	// ══════════════════════════════════════════════
	if (topic === "personality" && primaryStar && profile) {
		lines.push(`**【性格深描】**`);
		lines.push("");
		lines.push(profile.personality);
		lines.push("");
	}

	// ══════════════════════════════════════════════
	// 五点五、疾厄宫 · 地支主轴 + 星曜辅助（倪师《天纪 05》体系）
	// ══════════════════════════════════════════════
	if (topic === "health") {
		// 主轴：疾厄宫所在地支 → 脏腑（倪师原法）
		const branchOrgan = PALACE_BRANCH_ORGAN[mainPalace.branch];
		if (branchOrgan) {
			lines.push(`**【倪师疾厄论 · 宫位主轴】**`);
			lines.push("");
			lines.push(`疾厄宫落于 **${BRANCHES[mainPalace.branch]}宫**——倪师《天纪 05》原法：`);
			lines.push(`▸ 主管脏腑：**${branchOrgan.organ}**`);
			lines.push(`▸ 对应经络：${branchOrgan.meridian}`);
			lines.push(`▸ 子午流注映射：${branchOrgan.peakTime}`);
			lines.push(`▸ 经络旺时：${branchOrgan.peakTime}`);
			lines.push(`▸ 养生要点：${branchOrgan.advice}`);
			lines.push("");
		}

		// 辅助：星曜五行作为加重 / 减轻的附加参考
		if (primaryStar) {
			const ziwu = ZIWU_LIUZHU[primaryStar.name];
			if (ziwu) {
				lines.push(`**【星曜辅助 · 五行加重】**`);
				lines.push("");
				lines.push(
					`疾厄宫主星 **${primaryStar.name}**（${ziwu.element}）辅助指向 **${ziwu.organ}**——星曜五行是"附加提示"，与宫位地支脏腑叠加判断：`
				);
				lines.push(`▸ ${ziwu.advice}`);
				lines.push("");
			}
		}

		// 煞星警示
		const shaInPalace = mainPalace.stars.filter(s =>
			["擎羊", "陀罗", "火星", "铃星"].includes(s.name)
		);
		if (shaInPalace.length > 0) {
			lines.push(
				`⚠️ **煞星入疾厄**：${shaInPalace.map(s => s.name).join("、")}——倪师《天纪 11-12》：「陀罗、擎羊入疾厄宫，开刀见血光」。需提前体检，流年化忌入此宫时尤防手术意外。`
			);
			lines.push("");
		}

		// 化忌叠加警示
		const jiInSanFang = sanFang.some(p =>
			p.stars.some(s => s.siHua === "忌" && s.type === "major")
		);
		if (jiInSanFang && branchOrgan) {
			lines.push(
				`⚠️ 三方四正有化忌——倪师提醒：疾厄宫主管的 **${branchOrgan.organ}** 在化忌年份最需重点体检；经络旺时（${branchOrgan.peakTime.split("、")[0]}）应让该脏腑充分休息。`
			);
			lines.push("");
		}

		if (chart.birthInfo.gender === "female") {
			lines.push(`**【女命妇科保养】**`);
			lines.push("");
			lines.push(
				`女命疾厄需把妇科、经期、孕产列为长期观察轴线：每年妇科超声与基础激素检查，记录经期周期、经量、痛经与情绪波动；备孕、孕产、产后恢复阶段尤其要结合医嘱，不以命理判断替代现代医学检查。`
			);
			lines.push("");
		}
	}

	// ══════════════════════════════════════════════
	// 五点六、魁钺贵人倾向细分（命/事业/财 主题）
	// ══════════════════════════════════════════════
	if (
		topic === "overview" ||
		topic === "personality" ||
		topic === "career" ||
		topic === "wealth"
	) {
		const kuiPalaceForTopic = chart.palaces.find(p => p.stars.some(s => s.name === "天魁"));
		const yuePalaceForTopic = chart.palaces.find(p => p.stars.some(s => s.name === "天钺"));
		const notes: string[] = [];
		if (kuiPalaceForTopic) {
			const map = KUI_YUE_GUIREN_MAP[kuiPalaceForTopic.name];
			if (map?.kui) notes.push(`**天魁在${kuiPalaceForTopic.name}**：${map.kui}`);
		}
		if (yuePalaceForTopic) {
			const map = KUI_YUE_GUIREN_MAP[yuePalaceForTopic.name];
			if (map?.yue) notes.push(`**天钺在${yuePalaceForTopic.name}**：${map.yue}`);
		}
		if (notes.length > 0) {
			lines.push(`**【贵人倾向·魁钺细分】**`);
			lines.push("");
			notes.forEach(n => lines.push(`◇ ${n}`));
			lines.push("");
		}
	}

	// ══════════════════════════════════════════════
	// 六、综合建议
	// ══════════════════════════════════════════════
	lines.push(`**【综合建议】**`);
	lines.push("");

	TOPIC_SUGGESTIONS[topic].forEach(s => lines.push(`→ ${s}`));
	lines.push("");
	lines.push(`**【继续深度追问】**`);
	lines.push(
		`可在下方输入具体问题，如："今年${TOPIC_LABEL[topic]}有何重大变化？""当前大限对${TOPIC_LABEL[topic]}影响如何？"——AI 将结合完整命盘为你进行个性化解读。`
	);

	// 过滤与当前性别无关的内容（男命不显示女命专属句，女命不显示男命专属句）
	const rawText = lines.join("\n");
	return filterGenderContent(rawText, chart.birthInfo.gender);
}

// ─── 公开面 re-export ────────────────────────────────────────────────────────
// 拆分前从本模块导出的 5 个名字，拆分后**逐名仍可从这里 import**。
// `./analysis-data` 是它们的实际归属地，此处只做转发，调用方一行不用改。
// 这 5 个名字本文件的实现也要用，故上方已 import，这里再 export 一次。
export { TOPIC_LABEL, TOPIC_PALACE_NAME };
export type { AnalysisOptions, AnalysisView, TopicKey };
