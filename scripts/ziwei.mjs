#!/usr/bin/env node
/**
 * ziwei.mjs — 紫微斗数排盘 / 合盘 / 知识检索 CLI
 *
 * 设计原则：**不重复实现任何命理逻辑**，全部复用项目 lib/ 下的既有模块。
 *   lib/ziwei/algorithm.ts        排盘主流程
 *   lib/ziwei/patterns.ts         格局识别（40+ 格局，含古籍出处与破格条件）
 *   lib/ziwei/sihua.ts            四化（生年 / 流年 / 流月）
 *   lib/ziwei/heming-knowledge.ts 合盘方法论 + 夫妻宫断语
 *   lib/ziwei/cities.ts           中国城市经纬度（真太阳时校正）
 *   lib/ziwei/constants.ts        天干地支 / 四化表 / 星曜释义
 *   lib/classics/                 古籍原文全文检索
 *   lib/nihai/                    倪海厦天纪/地纪/人纪知识
 *
 * 依赖 Node ≥ 22.15（module.registerHooks + 原生 TS 类型擦除）。
 * 用法：node scripts/ziwei.mjs <command> [options]   （在 skill 根目录下执行；脚本本身也可从任意 cwd 运行）
 * 帮助：node scripts/ziwei.mjs help
 * 自检：node scripts/ziwei.mjs selftest
 */

import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

// 抑制噪声：lib/*.ts 所在 package.json 无 "type":"module"，Node 每次加载都会告警。
// 不能改 package.json（Next.js 的 next.config.js / postcss.config.js 依赖 CJS），故在此过滤。
const _emitWarning = process.emitWarning.bind(process);
process.emitWarning = (warning, ...rest) => {
  const code =
    typeof rest[0] === "string" && typeof rest[1] === "string"
      ? rest[1] // (warning, type, code)
      : (rest[0]?.code ?? warning?.code); // (warning, options)
  if (code === "MODULE_TYPELESS_PACKAGE_JSON") return;
  _emitWarning(warning, ...rest);
};

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(HERE, "..");

// ── 排盘内核根目录：两级优先级 ──
//   1. ZIWEI_ROOT 环境变量 —— 显式指定（想把 lib/ 指到别处时用）
//   2. 技能自带内核        —— <SKILL_DIR>/lib，与 SKILL.md、scripts/ 同级
//
// 这里刻意**没有**「宿主项目」候选：本仓库根就是 skill 根，仓库内只有一份 lib/，
// 不存在「实时内核」与「分发副本」两套并存，也就没有副本漂移问题。
function pickRoot() {
  const tried = [];
  const candidates = [
    [
      process.env.ZIWEI_ROOT && resolve(process.env.ZIWEI_ROOT),
      "ZIWEI_ROOT 环境变量",
    ],
    [SKILL_DIR, "技能自带内核"],
  ];
  for (const [dir, label] of candidates) {
    if (!dir) continue;
    if (existsSync(resolve(dir, "lib/ziwei/algorithm.ts")))
      return { root: dir, label, tried };
    tried.push(`${label}：${dir}`);
  }
  return { root: null, label: null, tried };
}

const { root: ROOT, label: ROOT_LABEL, tried: ROOT_TRIED } = pickRoot();

if (!ROOT) {
  console.error(
    `[ziwei 启动失败] 找不到排盘内核（lib/ziwei/algorithm.ts）\n` +
      `  已尝试：\n` +
      ROOT_TRIED.map((t) => `    - ${t}`).join("\n") +
      "\n" +
      `  处理：\n` +
      `    ① 确认本 skill 目录完整 —— SKILL.md 同级应同时有 lib/ 与 scripts/（拷贝时漏带 lib/ 会走到这里）；或\n` +
      `    ② 用 ZIWEI_ROOT=<含 lib/ 的目录> 显式指定内核位置。`,
  );
  process.exit(1);
}

// ── 让 Node 直接加载 TS：解析 @/ 别名，补全省略的 .ts / index.ts，并把裸包名指向当前根 ──
// 裸包名重定向的意义：脱离项目运行时，从文件位置向上找不到 node_modules，
// 必须显式把 'iztro' / 'lunar-javascript' 指到当前内核根去解析。
const ROOT_PARENT_URL = pathToFileURL(resolve(ROOT, "package.json")).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = resolve(ROOT, specifier.slice(2));
      // 依次尝试：原样 → <base>.ts → <base>/index.ts（目录导入兜底，避免 ERR_UNSUPPORTED_DIR_IMPORT）
      const target = existsSync(base + ".ts")
        ? base + ".ts"
        : existsSync(resolve(base, "index.ts"))
          ? resolve(base, "index.ts")
          : base;
      return nextResolve(pathToFileURL(target).href, context);
    }
    if (specifier.startsWith(".")) {
      if (!/\.[cm]?[jt]s$/.test(specifier)) {
        try {
          return nextResolve(specifier + ".ts", context);
        } catch {
          /* 非 TS 目标，落回默认解析 */
        }
      }
      return nextResolve(specifier, context);
    }
    // 裸包名（含 @scope/pkg）：若当前根的 node_modules 里有，就从当前根解析，摆脱对 cwd 与文件位置的依赖
    if (!specifier.startsWith("node:")) {
      const pkgName = specifier.startsWith("@")
        ? specifier.split("/").slice(0, 2).join("/")
        : specifier.split("/")[0];
      if (existsSync(resolve(ROOT, "node_modules", pkgName))) {
        return nextResolve(specifier, {
          ...context,
          parentURL: ROOT_PARENT_URL,
        });
      }
    }
    return nextResolve(specifier, context);
  },
});

// ── 统一加载器：任何上游模块挂了都给出可执行的排查指引，而不是裸栈 ──
async function load(spec) {
  try {
    return await import(spec);
  } catch (err) {
    console.error(
      `[ziwei 启动失败] 无法加载 ${spec}\n  ${err.message}\n` +
        `  当前内核根：${ROOT}（来源：${ROOT_LABEL}）\n` +
        `  → Cannot find module 'iztro' / 'lunar-javascript'：依赖未装。\n` +
        `     在 ${ROOT} 内执行 npm install 即可（依赖清单见同目录 package.json）\n` +
        `  → registerHooks is not a function 或 TS 语法报错：Node 版本过低，需 ≥ 22.15（当前 ${process.version}）`,
    );
    process.exit(1);
  }
}

const { generateChart } = await load("@/lib/ziwei/algorithm");
const { detectPatterns, getMingGongSummary } = await load(
  "@/lib/ziwei/patterns",
);
const { getSiHuaByStem, getYearStemIndex, getLiuNianSiHua, getLiuYueSiHua } =
  await load("@/lib/ziwei/sihua");
const { STEMS, BRANCHES, SHICHEN, STAR_DESCRIPTIONS } = await load(
  "@/lib/ziwei/constants",
);
const { PROVINCES } = await load("@/lib/ziwei/cities");
const {
  HEMING_METHODOLOGY,
  STAR_IN_FUQI_GU,
  SIHUA_IN_FUQI_GU,
  MARRIAGE_STARS_BRIEF,
  HEMING_SCORE_CRITERIA,
} = await load("@/lib/ziwei/heming-knowledge");
const { searchClassics, ALL_BOOKS, TOTAL_PARAGRAPHS } = await load(
  "@/lib/classics/index",
);
const { TIANJI_MODULES, RENJI_MODULES, DIJI_MODULES, NI_HAIXIA_BIO } =
  await load("@/lib/nihai/index");
const { Lunar } = await load("lunar-javascript");

// ── 启动自检：上游 lib/ 若重构导致关键导出消失，立即报错，而不是静默产出错盘 ──
const REQUIRED_EXPORTS = [
  ["generateChart", generateChart],
  ["detectPatterns", detectPatterns],
  ["getMingGongSummary", getMingGongSummary],
  ["getSiHuaByStem", getSiHuaByStem],
  ["getYearStemIndex", getYearStemIndex],
  ["getLiuNianSiHua", getLiuNianSiHua],
  ["getLiuYueSiHua", getLiuYueSiHua],
  ["STEMS", STEMS],
  ["BRANCHES", BRANCHES],
  ["SHICHEN", SHICHEN],
  ["STAR_DESCRIPTIONS", STAR_DESCRIPTIONS],
  ["PROVINCES", PROVINCES],
  ["searchClassics", searchClassics],
  ["Lunar", Lunar],
];
{
  const missing = REQUIRED_EXPORTS.filter(
    ([, v]) => v === undefined || v === null,
  ).map(([n]) => n);
  if (missing.length) {
    console.error(
      `[ziwei 启动自检失败] 以下上游导出缺失：${missing.join("、")}\n` +
        `  当前内核根：${ROOT}（来源：${ROOT_LABEL}）\n` +
        `  可能原因：lib/ 被重构，或导出被改名 / 删除。\n` +
        `  处理：核对本文件顶部的 import 列表与 lib/ 的实际导出是否对得上。`,
    );
    process.exit(1);
  }
}

// ══════════════════════ 工具函数 ══════════════════════

const BRIGHTNESS_CN = { bright: "庙旺", normal: "平", dim: "落陷" };

/** 时辰支索引 → "巳时(09:00-11:00)"；SHICHEN 是 {branch,name,range} 对象数组 */
const shichenLabel = (i) =>
  `${SHICHEN[i]?.name ?? BRANCHES[i] + "时"}(${SHICHEN[i]?.range ?? ""})`;

const fmtDate = (i) =>
  `${i.year}-${String(i.month).padStart(2, "0")}-${String(i.day).padStart(2, "0")}`;
const genderCN = (g) => (g === "male" ? "男" : "女");

/** 参数解析：--key value / --flag */
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) args[key] = true;
      else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

/**
 * 北京时间 + 经度 → 真太阳时。
 * 与 components/BirthForm.tsx 的 calcTrueSolarBranch 保持同一换算公式。
 *
 * 返回 { branch, isLateZi, offsetMinutes, solarMinutes }：
 *   branch     时辰支 0-11（0=子 … 11=亥）
 *   isLateZi   是否落在 23:00–23:59（晚子时）——**这个区分很重要**：
 *              子时横跨两日，23:00 后出生按传统三合派应「算次日」，排出的盘与当日早子时完全不同。
 */
function calcTrueSolar(clockHour, clockMinute, longitude) {
  const clockMins = clockHour * 60 + clockMinute;
  const offset = (longitude - 120) * 4;
  const solar = (((clockMins + offset) % 1440) + 1440) % 1440;
  const isLateZi = solar >= 1380; // 23:00–23:59
  const branch =
    solar >= 1380 || solar < 60 ? 0 : Math.floor((solar - 60) / 120) + 1;
  return {
    branch,
    isLateZi,
    offsetMinutes: Math.round(offset),
    solarMinutes: Math.round(solar),
  };
}

// 行政区划后缀：用户常写「石家庄市」「石家庄地区」「XX自治州」，而城市表里存的是简称
const ADMIN_SUFFIX = /(特别行政区|自治州|自治县|自治区|地区|盟|市|县|区|旗)$/;
const stripSuffix = (s) => String(s).trim().replace(ADMIN_SUFFIX, "");

/**
 * 按城市名查经度（容错匹配）。
 * 依次尝试：原名精确 → 去行政后缀精确 → 双向包含（取最短名，最贴近）。
 * @returns {{longitude:number, matched:string, exact:boolean, ambiguous:string[]|null}|null}
 */
function findLongitude(cityName) {
  const raw = String(cityName).trim();
  if (!raw) return null;
  const bare = stripSuffix(raw);
  const all = PROVINCES.flatMap((p) => p.cities);

  const hit =
    all.find((c) => c.name === raw) ??
    (bare !== raw ? all.find((c) => c.name === bare) : null);
  // exact 表示「用户写的就是表里那个名字」，用于上层决定要不要提示已做容错解析
  if (hit)
    return {
      longitude: hit.longitude,
      matched: hit.name,
      exact: hit.name === raw,
      ambiguous: null,
    };

  const cands = all.filter(
    (c) => c.name.includes(bare) || bare.includes(c.name),
  );
  if (!cands.length) return null;
  // 命中最短的城市名（最短名最贴近用户所写），并记录同长度候选供提示
  cands.sort(
    (a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name),
  );
  const best = cands[0];
  const rivals = cands.filter(
    (c) => c.name !== best.name && c.name.length === best.name.length,
  );
  return {
    longitude: best.longitude,
    matched: best.name,
    exact: false,
    ambiguous: rivals.length
      ? rivals.slice(0, 5).map((c) => `${c.name}(${c.longitude})`)
      : null,
  };
}

/**
 * 从参数构造 BirthInfo。
 *
 * 日期（三选一）：
 *   --date  YYYY-MM-DD        公历生日
 *   --lunar YYYY-MM-DD        农历生日（脚本自动换算成公历）
 *   --year/--month/--day      公历生日（分写）
 *   --leap                    配合 --lunar 表示闰月
 * 时辰（二选一）：
 *   --time   HH:MM + --lng/--city  → 真太阳时自动换算
 *   --branch 0-12                  → 直接指定时辰支（0=子 … 11=亥；12=晚子时）
 *   --late-zi                      → 配合 --time，把 23:00–23:59 改按「晚子时算次日」排
 */
function buildBirthInfo(args, p = "") {
  const g = (k) => args[p + k];

  // ── 出生日期 ──
  let year,
    month,
    day,
    dateNote = "";
  const lunarStr = g("lunar");
  const solarStr = g("date");

  if (lunarStr && solarStr)
    throw new Error("--lunar 与 --date 不能同时使用（一个是农历，一个是公历）");

  if (lunarStr) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(lunarStr));
    if (!m) throw new Error(`农历日期格式应为 YYYY-MM-DD，收到：${lunarStr}`);
    const ly = Number(m[1]),
      lm = Number(m[2]),
      ld = Number(m[3]);
    const isLeap = g("leap") === true || g("leap") === "true";
    if (lm < 1 || lm > 12) throw new Error(`农历月份应为 1-12，收到：${lm}`);
    if (ld < 1 || ld > 30) throw new Error(`农历日期应为 1-30，收到：${ld}`);
    let solar;
    try {
      // lunar-javascript 约定：闰月用负数月份表示；该年若无此闰月会抛 "wrong lunar year ..."
      solar = Lunar.fromYmd(ly, isLeap ? -lm : lm, ld).getSolar();
    } catch (err) {
      const hint = isLeap
        ? `${ly} 年可能没有闰${lm}月（闰月并非每年都有）`
        : "请核对年月日是否存在";
      throw new Error(
        `农历 ${ly}年${isLeap ? "闰" : ""}${lm}月${ld}日 换算失败：${hint}。原始错误：${err.message}`,
      );
    }
    year = solar.getYear();
    month = solar.getMonth();
    day = solar.getDay();

    // 回环校验：换算结果反查回来必须与输入一致，防止静默的日期滚动（错一天，整盘皆错）
    const back = solar.getLunar();
    const backMonth = back.getMonth();
    if (
      back.getYear() !== ly ||
      backMonth !== (isLeap ? -lm : lm) ||
      back.getDay() !== ld
    ) {
      throw new Error(
        `农历 ${ly}年${isLeap ? "闰" : ""}${lm}月${ld}日 换算后回查不一致：` +
          `得到 ${back.getYear()}年${backMonth < 0 ? "闰" : ""}${Math.abs(backMonth)}月${back.getDay()}日。请核对农历日期。`,
      );
    }
    dateNote = `农历 ${ly}年${isLeap ? "闰" : ""}${lm}月${ld}日 → 公历 ${year}-${month}-${day}`;
  } else if (solarStr) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(solarStr));
    if (!m) throw new Error(`日期格式应为 YYYY-MM-DD，收到：${solarStr}`);
    [, year, month, day] = m.map(Number);
  } else {
    year = Number(g("year"));
    month = Number(g("month"));
    day = Number(g("day"));
  }
  if (!year || !month || !day)
    throw new Error(
      "缺少出生日期：需 --date YYYY-MM-DD、--lunar YYYY-MM-DD 或 --year/--month/--day",
    );

  const genderRaw = String(g("gender") ?? "male").toLowerCase();
  const gender = ["female", "f", "女"].includes(genderRaw) ? "female" : "male";

  // ── 经度：--lng 优先，其次 --city / --province，默认 120（东八区标准经线，即不做校正）──
  let longitude,
    lngNote = "",
    lngAmbiguous = null;
  if (g("lng") !== undefined) {
    longitude = Number(g("lng"));
    if (!Number.isFinite(longitude))
      throw new Error(`--lng 应为数字，收到：${g("lng")}`);
  } else if (g("city")) {
    const found = findLongitude(g("city"));
    if (!found)
      throw new Error(
        `未收录城市：${g("city")}（可用 \`cities --search <关键词>\` 查询，或改用 --lng 指定经度）`,
      );
    longitude = found.longitude;
    // 仅在「做了容错解析」或「存在同名歧义」时提示——用户写的就是表里的名字时不必打扰
    if (!found.exact)
      lngNote = `「${g("city")}」按「${found.matched}」解析 → 东经 ${found.longitude}°`;
    lngAmbiguous = found.ambiguous;
    if (lngAmbiguous && !lngNote)
      lngNote = `「${g("city")}」→ 东经 ${found.longitude}°`;
  } else if (g("province")) {
    const prov = PROVINCES.find(
      (x) =>
        x.name === g("province") || x.name.startsWith(String(g("province"))),
    );
    longitude = prov?.cities[0]?.longitude ?? 120;
    lngNote = prov
      ? `${prov.name}（按省会 ${prov.cities[0]?.name} 计）`
      : "省份未收录，按 120° 处理";
  } else {
    longitude = 120;
    lngNote =
      "未给出生地，按东经 120° 处理（不做真太阳时校正，结果可能有偏差）";
  }

  // ── 时辰 ──
  let hour, hourNote;
  const wantLateZi = g("late-zi") === true || g("late-zi") === "true";
  // 23:00–23:59 出生 → 早/晚子时两口径会排出不同的盘，此标记用于上层给出提醒
  let lateZiCandidate = false;

  if (g("branch") !== undefined) {
    hour = Number(g("branch"));
    // 12 = 晚子时（安星按次日），是本 CLI 对 iztro timeIndex 12 的显式暴露
    if (!Number.isInteger(hour) || hour < 0 || hour > 12)
      throw new Error("--branch 应为 0-11（0=子 … 11=亥）或 12（晚子时）");
    hourNote =
      hour === 12
        ? "直接指定 晚子时（子时，安星按次日）"
        : `直接指定 ${shichenLabel(hour)}`;
  } else if (g("time") !== undefined) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(g("time")));
    if (!m) throw new Error(`时间格式应为 HH:MM，收到：${g("time")}`);
    const ch = Number(m[1]),
      cm = Number(m[2]);
    if (ch > 23 || cm > 59) throw new Error(`时间超出范围：${g("time")}`);
    const t = calcTrueSolar(ch, cm, longitude);
    lateZiCandidate = t.isLateZi;

    if (t.isLateZi && wantLateZi) {
      hour = 12;
      hourNote = `钟表 ${String(ch).padStart(2, "0")}:${m[2]} → 真太阳时校正 ${t.offsetMinutes >= 0 ? "+" : ""}${t.offsetMinutes} 分 → 晚子时（安星按次日）`;
    } else {
      hour = t.branch;
      hourNote = `钟表 ${String(ch).padStart(2, "0")}:${m[2]} → 真太阳时校正 ${t.offsetMinutes >= 0 ? "+" : ""}${t.offsetMinutes} 分 → ${shichenLabel(hour)}`;
      if (t.isLateZi) hourNote += "（晚子时，按当日早子时口径）";
    }
  } else {
    throw new Error("缺少出生时辰：需 --time HH:MM 或 --branch 0-12");
  }

  if (wantLateZi && g("time") === undefined && g("branch") === undefined) {
    throw new Error("--late-zi 需配合 --time 使用");
  }

  const notes = [dateNote, lngNote, hourNote].filter(Boolean);
  return {
    info: {
      year,
      month,
      day,
      hour,
      gender,
      name: g("name") ? String(g("name")) : undefined,
      longitude,
    },
    note: hourNote,
    notes,
    longitude,
    lngNote,
    lngAmbiguous,
    lateZiCandidate,
    isLateZi: hour === 12,
  };
}

/** 出生地解析提示（容错命中 / 省份近似 / 未给地点，三种都需让用户知道） */
function birthplaceSection(lngNote, lngAmbiguous) {
  const out = [];
  if (lngNote) out.push(`【出生地解析】${lngNote}`);
  if (lngAmbiguous) {
    out.push(
      `  ⚠️ 存在同名候选：${lngAmbiguous.join("、")} —— 已取最短名，如有误请直接用 --lng 指定经度`,
    );
  }
  if (out.length) out.push("");
  return out;
}

/** 四化星 → 落宫 */
function locateSihua(chart, transforms) {
  const out = [];
  for (const hua of ["禄", "权", "科", "忌"]) {
    const star = transforms[hua];
    const palace =
      chart.palaces.find((p) =>
        p.stars.some((s) => s.name === star && s.type === "major"),
      ) ?? chart.palaces.find((p) => p.stars.some((s) => s.name === star));
    out.push({
      hua,
      star,
      palace: palace ? palace.name : null,
      branch: palace ? BRANCHES[palace.branch] : null,
      isMajor: palace
        ? !!palace.stars.find((s) => s.name === star && s.type === "major")
        : false,
    });
  }
  return out;
}

/** 三方四正：本宫 + 三合两宫 + 对宫 */
function sanFangSiZheng(chart, branch) {
  const idx = [branch, (branch + 4) % 12, (branch + 8) % 12, (branch + 6) % 12];
  return idx.map((b) => chart.palaces.find((p) => p.branch === b)?.name ?? "?");
}

function starLine(s) {
  const parts = [s.name];
  if (s.siHua) parts.push(`化${s.siHua}`);
  if (s.brightness) parts.push(BRIGHTNESS_CN[s.brightness]);
  return parts.join("");
}

/** 单宫渲染 */
function renderPalace(p, chart) {
  const major = p.stars.filter((s) => s.type === "major");
  const lucky = p.stars.filter((s) => s.type === "lucky");
  const sha = p.stars.filter((s) => s.type === "sha");
  const minor = p.stars.filter((s) => s.type === "minor");

  const head = `${p.name}【${BRANCHES[p.branch]}${STEMS[p.stem]}】`;
  const age = p.daXianAge ? `${p.daXianAge[0]}-${p.daXianAge[1]}岁` : "";
  const marks = [
    p.isMingGong ? "命宫" : "",
    p.isShenGong ? "身宫" : "",
    p.isCurrentDaXian ? `当前大限(${age})` : age,
  ]
    .filter(Boolean)
    .join(" · ");

  const lines = [`${head}${marks ? "  — " + marks : ""}`];

  if (major.length) lines.push(`  主星：${major.map(starLine).join("、")}`);
  else
    lines.push(
      `  主星：（空宫）借对宫 ${p.borrowedFromName ?? ""} 的 ${(p.borrowedStars ?? []).join("、")}`,
    );

  if (lucky.length)
    lines.push(`  吉星：${lucky.map((s) => s.name).join("、")}`);
  if (sha.length) lines.push(`  煞星：${sha.map((s) => s.name).join("、")}`);
  if (minor.length)
    lines.push(`  杂曜：${minor.map((s) => s.name).join("、")}`);
  lines.push(`  三方四正：${sanFangSiZheng(chart, p.branch).join(" / ")}`);

  return lines.join("\n");
}

/** 单宫一行速览（供十二宫一览表用） */
function palaceBrief(p) {
  const major = p.stars.filter((s) => s.type === "major");
  const lucky = p.stars.filter((s) => s.type === "lucky");
  const sha = p.stars.filter((s) => s.type === "sha");
  const main = major.length
    ? major.map(starLine).join("、")
    : `空宫借${p.borrowedFromName ?? "?"}(${(p.borrowedStars ?? []).join("、") || "无主星"})`;
  const cols = [
    p.name,
    `${BRANCHES[p.branch]}${STEMS[p.stem]}`,
    main,
    `吉:${lucky.map((s) => s.name).join("、") || "—"}`,
    `煞:${sha.map((s) => s.name).join("、") || "—"}`,
    p.daXianAge ? `${p.daXianAge[0]}-${p.daXianAge[1]}岁` : "—",
  ];
  const tags = [
    p.isShenGong ? "★身宫" : "",
    p.isCurrentDaXian ? "←当前大限" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return "  " + cols.join(" │ ") + (tags ? "  " + tags : "");
}

/** 命盘指纹：用于比对两盘是否完全一致（地支 + 全星曜集合） */
const chartSignature = (c) =>
  c.palaces
    .map(
      (p) =>
        `${p.name}:${p.branch}:${p.stars
          .map((s) => s.name)
          .sort()
          .join(",")}`,
    )
    .join("|");

const ziweiBranchOf = (c) => BRANCHES[c.ziweiPos];

/** 命宫主星简述（空宫则写借宫） */
function mingMajorBrief(c) {
  const m = c.palaces.find((p) => p.branch === c.mingGongBranch);
  if (!m) return "—";
  const s = m.stars.filter((x) => x.type === "major").map((x) => x.name);
  return s.length
    ? s.join("、")
    : `空宫(借${m.borrowedFromName ?? "?"}：${(m.borrowedStars ?? []).join("、") || "无主星"})`;
}

/**
 * 晚子时口径提醒。
 * 23:00–23:59 出生时，子时横跨两日：「当日早子时」与「晚子时算次日」排出的是两张不同的盘。
 * 本 CLI 默认沿用线上 metisziwei.com 口径（当日早子时），此处把差异摆明，供复核。
 */
function lateZiSection(chart, info, isLateZi, lateZiCandidate) {
  const out = [];
  if (isLateZi) {
    out.push("【晚子时口径】");
    out.push("  本次按【晚子时·算次日】排盘（--late-zi / --branch 12）。");
    out.push(
      "  注意：安星依据的是次日的农历日数，故下方「农历」栏显示的是出生当日，与安星所用日相差一天，属正常。",
    );
    const alt = generateChart({ ...info, hour: 0 });
    out.push(
      `  对照【当日早子时】口径：紫微落 ${ziweiBranchOf(alt)} · 命宫主星 ${mingMajorBrief(alt)}`,
    );
    out.push("");
    return out;
  }
  if (!lateZiCandidate) return out;
  const alt = generateChart({ ...info, hour: 12 });
  out.push("【⚠️ 晚子时口径提醒】");
  out.push(
    "  你给的钟表时间落在 23:00–23:59。子时横跨两日，两种口径排出的是**两张不同的盘**。",
  );
  out.push(
    `  本次按【当日早子时】排盘（与线上 metisziwei.com 口径一致）：紫微落 ${ziweiBranchOf(chart)} · 命宫主星 ${mingMajorBrief(chart)}`,
  );
  out.push(
    `  传统三合派另有【晚子时·算次日】之说：紫微落 ${ziweiBranchOf(alt)} · 命宫主星 ${mingMajorBrief(alt)}`,
  );
  out.push(
    "  两盘差异可能极大（命宫主星、紫微位、格局组全变）。若命主确系 23:00 后出生，",
  );
  out.push("  建议加 --late-zi 复核后再下断语，并向命主确认具体钟点。");
  out.push("");
  return out;
}

// ══════════════════════ 命令实现 ══════════════════════

function cmdChart(args) {
  const { info, note, lateZiCandidate, isLateZi, lngNote, lngAmbiguous } =
    buildBirthInfo(args);
  const chart = generateChart(info);

  if (args.json) return JSON.stringify(chart, null, 2);

  const out = [
    `命盘  ${info.name ?? ""} ${fmtDate(info)} ${note} · ${genderCN(info.gender)}`,
    `农历：${chart.lunarInfo.lunarYear}年${chart.lunarInfo.isLeapMonth ? "闰" : ""}${chart.lunarInfo.lunarMonth}月${chart.lunarInfo.lunarDay}日 · 年柱${STEMS[chart.lunarInfo.yearStem]}${BRANCHES[chart.lunarInfo.yearBranch]}`,
    `命宫：${BRANCHES[chart.mingGongBranch]} · 身宫：${BRANCHES[chart.shenGongBranch]} · 五行局：${chart.wuxingJuName} · 紫微：${BRANCHES[chart.ziweiPos]}`,
    "",
  ];
  out.push(...birthplaceSection(lngNote, lngAmbiguous));
  out.push(...lateZiSection(chart, info, isLateZi, lateZiCandidate));
  out.push("─".repeat(56));
  for (const p of chart.palaces) out.push(renderPalace(p, chart), "");
  out.push(
    "大限：" +
      chart.daXians
        .map(
          (d) =>
            `${d.startAge}-${d.endAge}岁 ${d.palaceName}(${BRANCHES[d.palaceBranch]})`,
        )
        .join(" | "),
  );
  out.push(
    `当前年龄：${chart.currentAge}岁 · 当前大限：${chart.daXians[chart.currentDaXianIndex]?.palaceName ?? "—"}`,
  );
  return out.join("\n");
}

function cmdAnalyze(args) {
  const {
    info,
    note,
    longitude,
    lateZiCandidate,
    isLateZi,
    lngNote,
    lngAmbiguous,
  } = buildBirthInfo(args);
  const chart = generateChart(info);

  const yearStem = getYearStemIndex(info.year);
  const native = getSiHuaByStem(yearStem);
  // 注意：流年用 --liunian，不可复用 --year —— 后者是出生年的回退参数，同时使用会撞车
  const liuNianYear = args.liunian
    ? Number(args.liunian)
    : new Date().getFullYear();
  const liuNian = getLiuNianSiHua(liuNianYear);
  // 流月：农历月 1-12，取流年干推五虎遁（可选）
  const liuYueMonth = args.liuyue !== undefined ? Number(args.liuyue) : null;
  if (
    liuYueMonth !== null &&
    (!Number.isInteger(liuYueMonth) || liuYueMonth < 1 || liuYueMonth > 12)
  ) {
    throw new Error("--liuyue 应为农历月 1-12");
  }
  const liuYue =
    liuYueMonth !== null
      ? getLiuYueSiHua(liuNian.stemIndex, liuYueMonth)
      : null;

  if (args.json) {
    return JSON.stringify(
      {
        chart,
        patterns: detectPatterns(chart),
        mingGongSummary: getMingGongSummary(chart),
        nativeSiHua: {
          stem: STEMS[yearStem],
          transforms: native,
          located: locateSihua(chart, native),
        },
        liuNianSiHua: {
          year: liuNianYear,
          stem: liuNian.stemName,
          transforms: liuNian.transforms,
          located: locateSihua(chart, liuNian.transforms),
        },
        liuYueSiHua: liuYue
          ? {
              month: liuYueMonth,
              stem: liuYue.stemName,
              transforms: liuYue.transforms,
              located: locateSihua(chart, liuYue.transforms),
            }
          : null,
        lateZi: { candidate: lateZiCandidate, applied: isLateZi },
      },
      null,
      2,
    );
  }

  const ming = chart.palaces.find((p) => p.branch === chart.mingGongBranch);
  const shen = chart.palaces.find((p) => p.branch === chart.shenGongBranch);
  const summary = getMingGongSummary(chart);

  // 命宫空宫时 getMingGongSummary 返回空关键词/星性，改从借入的对宫主星取释义
  let mingKeywords = summary.keywords;
  let mingNature = summary.nature;
  if (!mingKeywords.length && ming.isEmpty && ming.borrowedStars?.length) {
    mingKeywords = ming.borrowedStars.flatMap(
      (s) => STAR_DESCRIPTIONS[s]?.keywords?.split("·") ?? [],
    );
    mingNature = `空宫，借${ming.borrowedFromName ?? ""}的${ming.borrowedStars.join("、")}论`;
  }
  if (!mingKeywords.length)
    mingNature = mingNature || "无主星亦无对宫可借，全看三方四正会照";
  const patterns = detectPatterns(chart);
  const dx = chart.daXians[chart.currentDaXianIndex];
  const dxPalace = dx
    ? chart.palaces.find((p) => p.branch === dx.palaceBranch)
    : null;

  const out = [];
  out.push(
    `【命盘总览】${info.name ?? ""} ${fmtDate(info)} ${note} · ${genderCN(info.gender)} · 经度 ${longitude}°E`,
  );
  out.push(
    `农历 ${chart.lunarInfo.lunarYear}年${chart.lunarInfo.isLeapMonth ? "闰" : ""}${chart.lunarInfo.lunarMonth}月${chart.lunarInfo.lunarDay}日 · 年柱 ${STEMS[chart.lunarInfo.yearStem]}${BRANCHES[chart.lunarInfo.yearBranch]} · ${chart.wuxingJuName}`,
  );
  out.push(
    `命宫 ${BRANCHES[chart.mingGongBranch]} · 身宫 ${BRANCHES[chart.shenGongBranch]} · 紫微落 ${BRANCHES[chart.ziweiPos]} · 三方四正 ${sanFangSiZheng(chart, chart.mingGongBranch).join("/")}`,
  );
  out.push("");

  out.push(...birthplaceSection(lngNote, lngAmbiguous));
  out.push(...lateZiSection(chart, info, isLateZi, lateZiCandidate));

  // ── 十二宫一览（按地支序，速查全盘用；解读主力仍是下方命宫/身宫详表）──
  out.push("【十二宫一览】按地支序 子→亥");
  for (const p of chart.palaces) out.push(palaceBrief(p));
  out.push("");

  out.push("【命宫】");
  out.push(renderPalace(ming, chart));
  out.push(`  关键词：${mingKeywords.join("、") || "—"} · 星性：${mingNature}`);
  out.push("");

  out.push("【身宫】");
  out.push(renderPalace(shen, chart));
  out.push("");

  out.push(`【格局识别】共 ${patterns.length} 个`);
  if (!patterns.length) out.push("  （未识别到已收录格局）");
  for (const p of patterns) {
    out.push(`  ▸ ${p.name} [${p.level}]  涉及：${p.palaces.join("、")}`);
    out.push(`    ${p.description}`);
    if (p.conditions) {
      if (p.conditions.required?.length)
        out.push(`    成立：${p.conditions.required.join("；")}`);
      if (p.conditions.bonus?.length)
        out.push(`    加分：${p.conditions.bonus.join("；")}`);
      if (p.conditions.breaking?.length)
        out.push(`    破格：${p.conditions.breaking.join("；")}`);
    }
    if (p.source) out.push(`    出处：${p.source}`);
  }
  out.push("");

  out.push(`【生年四化】年干 ${STEMS[yearStem]}`);
  for (const x of locateSihua(chart, native)) {
    out.push(
      `  化${x.hua} ${x.star} → ${x.palace ?? "（未上盘）"}${x.branch ? `(${x.branch})` : ""}`,
    );
  }
  out.push("");

  out.push(`【${liuNianYear} 流年四化】年干 ${liuNian.stemName}`);
  for (const x of locateSihua(chart, liuNian.transforms)) {
    out.push(
      `  化${x.hua} ${x.star} → ${x.palace ?? "（未上盘）"}${x.branch ? `(${x.branch})` : ""}`,
    );
  }
  out.push("");

  if (liuYue) {
    out.push(
      `【${liuNianYear} 年 农历${liuYueMonth}月 流月四化】月干 ${liuYue.stemName}（五虎遁，由流年干 ${liuNian.stemName} 推）`,
    );
    for (const x of locateSihua(chart, liuYue.transforms)) {
      out.push(
        `  化${x.hua} ${x.star} → ${x.palace ?? "（未上盘）"}${x.branch ? `(${x.branch})` : ""}`,
      );
    }
    out.push("");
  }

  out.push(
    `【大限】当前 ${chart.currentAge}岁，走 ${dx ? `${dx.startAge}-${dx.endAge}岁 ${dx.palaceName}(${BRANCHES[dx.palaceBranch]})` : "—"}`,
  );
  if (dxPalace) out.push(renderPalace(dxPalace, chart));
  out.push("");
  out.push("全部大限：");
  for (const d of chart.daXians) {
    out.push(
      `  ${String(d.startAge).padStart(2)}-${String(d.endAge).padStart(2)}岁  ${d.palaceName}(${BRANCHES[d.palaceBranch]})${d === dx ? "  ← 当前" : ""}`,
    );
  }

  // 指定宫位深挖
  if (args.focus) {
    const target = chart.palaces.find(
      (p) => p.name === args.focus || BRANCHES[p.branch] === args.focus,
    );
    if (!target) {
      out.push(
        "",
        `【聚焦失败】找不到宫位「${args.focus}」。可用：${chart.palaces.map((p) => p.name).join("、")}`,
      );
    } else {
      out.push("", `【聚焦：${target.name}】`);
      out.push(renderPalace(target, chart));
      out.push(
        `  对宫：${chart.palaces.find((p) => p.branch === (target.branch + 6) % 12)?.name}`,
      );
    }
  }

  return out.join("\n");
}

function cmdHeming(args) {
  const a = buildBirthInfo(args, "a-");
  const b = buildBirthInfo(args, "b-");
  const ca = generateChart(a.info);
  const cb = generateChart(b.info);

  const mingA = ca.palaces.find((p) => p.branch === ca.mingGongBranch);
  const mingB = cb.palaces.find((p) => p.branch === cb.mingGongBranch);
  const fuqiA = ca.palaces.find((p) => p.name === "夫妻");
  const fuqiB = cb.palaces.find((p) => p.name === "夫妻");
  const fudeA = ca.palaces.find((p) => p.name === "福德");
  const fudeB = cb.palaces.find((p) => p.name === "福德");

  const majors = (p) =>
    (p?.stars ?? []).filter((s) => s.type === "major").map((s) => s.name);
  const mA = majors(mingA),
    mB = majors(mingB);
  const fA = majors(fuqiA),
    fB = majors(fuqiB);

  if (args.json) {
    return JSON.stringify(
      {
        a: { chart: ca, mingGong: mA, fuQiGong: fA, fuDeGong: majors(fudeA) },
        b: { chart: cb, mingGong: mB, fuQiGong: fB, fuDeGong: majors(fudeB) },
        methodology: HEMING_METHODOLOGY,
        scoreCriteria: HEMING_SCORE_CRITERIA,
      },
      null,
      2,
    );
  }

  const out = [];
  out.push("【合盘 · 双宫联参】倪海夏：看婚姻不能只看夫妻宫，必须同时看福德宫");
  out.push("");
  out.push(
    `甲方 ${a.info.name ?? ""} ${fmtDate(a.info)} ${a.note} · ${genderCN(a.info.gender)} · ${ca.wuxingJuName}`,
  );
  out.push(
    `  命宫 ${BRANCHES[ca.mingGongBranch]}：${mA.join("、") || "（空宫借对宫）"}`,
  );
  out.push(
    `  夫妻宫 ${BRANCHES[fuqiA.branch]}：${fA.join("、") || "（空宫借对宫）"}`,
  );
  out.push(
    `  福德宫 ${BRANCHES[fudeA.branch]}：${majors(fudeA).join("、") || "（空宫借对宫）"}`,
  );
  out.push("");
  out.push(
    `乙方 ${b.info.name ?? ""} ${fmtDate(b.info)} ${b.note} · ${genderCN(b.info.gender)} · ${cb.wuxingJuName}`,
  );
  out.push(
    `  命宫 ${BRANCHES[cb.mingGongBranch]}：${mB.join("、") || "（空宫借对宫）"}`,
  );
  out.push(
    `  夫妻宫 ${BRANCHES[fuqiB.branch]}：${fB.join("、") || "（空宫借对宫）"}`,
  );
  out.push(
    `  福德宫 ${BRANCHES[fudeB.branch]}：${majors(fudeB).join("、") || "（空宫借对宫）"}`,
  );
  out.push("");

  // 晚子时提醒（任一方命中都要提示，否则合盘基准可能是错的）
  for (const [label, side] of [
    ["甲", a],
    ["乙", b],
  ]) {
    if (side.lateZiCandidate && !side.isLateZi) {
      out.push(
        `⚠️ ${label}方出生时间落在 23:00–23:59（晚子时），本次按当日早子时口径排盘。`,
      );
      out.push(
        `   若改用 --${label === "甲" ? "a" : "b"}-late-zi（晚子时算次日），该方命盘会整体改变，合盘结论需重跑。`,
      );
    }
  }
  out.push("");

  // 天作之合判定（HEMING_METHODOLOGY 二）
  out.push("【对应关系判定】");
  const crossA = fA.some((s) => mB.includes(s));
  const crossB = fB.some((s) => mA.includes(s));
  const both = crossA && crossB;
  out.push(
    `  甲方夫妻宫主星 ∩ 乙方命宫主星：${fA.filter((s) => mB.includes(s)).join("、") || "无"}`,
  );
  out.push(
    `  乙方夫妻宫主星 ∩ 甲方命宫主星：${fB.filter((s) => mA.includes(s)).join("、") || "无"}`,
  );
  out.push(
    `  → ${both ? "双向对应，符合「天作之合」最高级匹配" : crossA || crossB ? "单向对应，属「次级良配」" : "无主星对应，需结合四化与福德宫另判"}`,
  );
  out.push("");

  // 夫妻宫断语（STAR_IN_FUQI_GU 为五字段对象；空宫借对宫主星论）
  out.push("【夫妻宫断语】");
  for (const [label, fuqi] of [
    ["甲", fuqiA],
    ["乙", fuqiB],
  ]) {
    const stars = majors(fuqi);
    const borrowed = stars.length ? stars : (fuqi.borrowedStars ?? []);
    if (!borrowed.length) {
      out.push(
        `  ${label}方夫妻宫空宫且对宫亦无主星 —— 婚姻之事全看四化与大限引动`,
      );
      continue;
    }
    if (!stars.length)
      out.push(
        `  ${label}方夫妻宫空宫，借对宫 ${fuqi.borrowedFromName ?? ""} 主星论：`,
      );
    for (const s of borrowed) {
      const e = STAR_IN_FUQI_GU[s];
      if (!e) {
        out.push(`    ${s}：（无收录断语）`);
        continue;
      }
      out.push(`    ${s}：${e.summary}`);
      out.push(`      吉象：${e.good}`);
      out.push(`      凶象：${e.bad}`);
      out.push(`      配偶特质：${e.spouse_traits}`);
      out.push(`      婚期：${e.timing}`);
      if (e.ni_quote) out.push(`      倪师原话：「${e.ni_quote}」`);
    }
  }
  out.push("");

  // 四化入夫妻宫：SIHUA_IN_FUQI_GU 的键是「化禄/化权/化科/化忌」，需先定位生年四化落宫
  out.push("【生年四化入夫妻宫】");
  let sihuaHit = 0;
  for (const [label, chart, fuqi] of [
    ["甲", ca, fuqiA],
    ["乙", cb, fuqiB],
  ]) {
    const stem = getYearStemIndex(chart.birthInfo.year);
    for (const x of locateSihua(chart, getSiHuaByStem(stem))) {
      if (x.palace !== fuqi.name) continue;
      sihuaHit++;
      out.push(
        `  ${label}方 生年${STEMS[stem]}干 化${x.hua}（${x.star}）入夫妻宫：`,
      );
      out.push(`    ${SIHUA_IN_FUQI_GU["化" + x.hua] ?? ""}`);
    }
  }
  if (!sihuaHit)
    out.push(
      "  双方夫妻宫均无生年四化落入 —— 婚姻非先天格局的着力点，随大限流年引动。",
    );
  out.push("");

  // 夫妻宫桃花 / 孤克星
  out.push("【夫妻宫桃花·孤克星】");
  let marriageHit = 0;
  for (const [label, fuqi] of [
    ["甲", fuqiA],
    ["乙", fuqiB],
  ]) {
    for (const s of fuqi.stars) {
      if (MARRIAGE_STARS_BRIEF[s.name]) {
        marriageHit++;
        out.push(`  ${label}方 ${s.name}：${MARRIAGE_STARS_BRIEF[s.name]}`);
      }
    }
  }
  if (!marriageHit) out.push("  双方夫妻宫无收录的桃花/孤克星。");
  out.push("");
  out.push("【评分标准】");
  out.push(
    typeof HEMING_SCORE_CRITERIA === "string"
      ? HEMING_SCORE_CRITERIA
      : JSON.stringify(HEMING_SCORE_CRITERIA, null, 2),
  );
  out.push("");
  out.push("【完整方法论】");
  out.push(HEMING_METHODOLOGY);

  return out.join("\n");
}

function cmdClassics(args) {
  if (!args.search && !args._.length) {
    return [
      `已收录古籍 ${ALL_BOOKS.length} 部，共 ${TOTAL_PARAGRAPHS} 段：`,
      ...ALL_BOOKS.map(
        (b) =>
          `  ▸ ${b.title ?? b.name ?? b.slug}（${b.slug}）${b.chapters?.length ?? 0} 章`,
      ),
      "",
      "用法：classics --search <关键词>",
    ].join("\n");
  }
  const q = String(args.search ?? args._.join(" "));
  const hits = searchClassics(q, Number(args.limit ?? 15));
  if (!hits.length) return `古籍中未找到「${q}」。`;
  const out = [`古籍检索「${q}」命中 ${hits.length} 条：`, ""];
  for (const h of hits) {
    const plain = String(h.snippet ?? "")
      .replace(/<\/?mark>/g, "『")
      .replace(/『([^』]*)『/g, "『$1』");
    out.push(
      `  ▸ [${h.bookTitle ?? h.bookSlug ?? ""} · ${h.chapterTitle ?? ""}]`,
    );
    out.push(`    ${plain.replace(/\n/g, " ")}`);
  }
  return out.join("\n");
}

function cmdNihai(args) {
  const cat = String(args.category ?? "").toLowerCase();
  if (args.bio) {
    return JSON.stringify(NI_HAIXIA_BIO, null, 2);
  }
  const groups = [
    [
      "tianji",
      "天纪 —— 上知天文（紫微斗数、易经、堪舆、推命、面相、测字）",
      TIANJI_MODULES,
    ],
    ["diji", "地纪 —— 下知地理（国家地理志、风水与国运）", DIJI_MODULES],
    [
      "renji",
      "人纪 —— 中知人事（针灸、黄帝内经、神农本草经、伤寒论、金匮要略）",
      RENJI_MODULES,
    ],
  ];
  const out = [];
  for (const [key, title, mods] of groups) {
    if (cat && cat !== key) continue;
    out.push(`【${title}】共 ${mods.length} 个模块`, "");
    for (const m of mods) {
      out.push(`  ▸ ${m.name}（${m.nameEn}）[${m.status}]`);
      out.push(`    ${m.subtitle}`);
      out.push(`    ${m.description}`);
      if (m.keywords?.length) out.push(`    关键词：${m.keywords.join("、")}`);
      for (const ch of m.chapters ?? []) {
        out.push(`      · ${ch.title}${ch.subtitle ? "｜" + ch.subtitle : ""}`);
        out.push(`        ${ch.description}`);
        if (ch.keyPoints?.length)
          out.push(`        要点：${ch.keyPoints.join("；")}`);
        for (const q of ch.quotes ?? []) out.push(`        原文：「${q}」`);
      }
      out.push("");
    }
  }
  return out.join("\n");
}

function cmdCities(args) {
  const q = String(args.search ?? args._.join(" "));
  if (!q) {
    const total = PROVINCES.reduce((n, p) => n + p.cities.length, 0);
    return [
      `已收录 ${PROVINCES.length} 个省级行政区、${total} 个城市。`,
      "用法：cities --search <城市或省份关键词>",
      "",
      ...PROVINCES.map(
        (p) =>
          `${p.name}：${p.cities.map((c) => `${c.name}(${c.longitude})`).join(" ")}`,
      ),
    ].join("\n");
  }
  const hits = [];
  for (const p of PROVINCES) {
    if (p.name.includes(q)) {
      for (const c of p.cities)
        hits.push(`${p.name} ${c.name} → 东经 ${c.longitude}°`);
    }
    for (const c of p.cities) {
      if (c.name.includes(q))
        hits.push(`${p.name} ${c.name} → 东经 ${c.longitude}°`);
    }
  }
  const uniq = [...new Set(hits)];
  const out = uniq.length
    ? `匹配 ${uniq.length} 条：\n` + uniq.map((h) => "  " + h).join("\n")
    : `未收录「${q}」，可用 --lng 直接指定经度。`;
  // 顺带告知排盘时的容错解析结果，避免「查询有结果但 --city 传不进去」
  const resolved = findLongitude(q);
  return resolved
    ? out +
        `\n\n排盘容错解析：「${q}」→ ${resolved.matched}（东经 ${resolved.longitude}°）` +
        (resolved.ambiguous
          ? `\n⚠️ 存在同名候选：${resolved.ambiguous.join("、")}，已取最短名，如有误请直接 --lng`
          : "")
    : out;
}

function cmdStars(args) {
  const names = Object.keys(STAR_DESCRIPTIONS);
  if (args.search) {
    const s = STAR_DESCRIPTIONS[args.search];
    if (!s) return `未收录星曜「${args.search}」。已收录：${names.join("、")}`;
    return `${args.search}：关键词 ${s.keywords} · 星性 ${s.nature} · 五行 ${s.element}`;
  }
  return [
    "已收录星曜释义：",
    ...names.map((n) => {
      const s = STAR_DESCRIPTIONS[n];
      return `  ${n}：${s.keywords} · ${s.nature} · ${s.element}`;
    }),
  ].join("\n");
}

// ══════════════════════ 回归自检 ══════════════════════

/**
 * selftest —— 上游 lib/ 或 iztro 升级后，用一组不变量快速验证本 CLI 仍然正确。
 * 覆盖：农历换算、真太阳时、晚子时等价性、城市容错、排盘不变量、三合派约束、格局与知识源可用性。
 */
function cmdSelftest() {
  const results = [];
  const eq = (actual, expected, msg = "") => {
    if (actual !== expected)
      throw new Error(
        `${msg}期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`,
      );
  };
  const ok = (name, fn) => {
    try {
      const detail = fn();
      results.push({ pass: true, name, detail: detail ?? "" });
    } catch (err) {
      results.push({ pass: false, name, detail: err.message });
    }
  };

  const sample = { year: 1990, month: 5, day: 15, hour: 5, gender: "male" };
  const sol = (y, m, d) => `${y}-${m}-${d}`;

  // ── 1. 农历 → 公历换算 ──
  ok("农历换算：1990年四月廿一 = 公历 1990-05-15", () => {
    const s = Lunar.fromYmd(1990, 4, 21).getSolar();
    eq(sol(s.getYear(), s.getMonth(), s.getDay()), "1990-5-15");
  });
  ok("农历换算：闰月用负数月份（2020年闰四月初一 = 2020-05-23）", () => {
    const s = Lunar.fromYmd(2020, -4, 1).getSolar();
    eq(sol(s.getYear(), s.getMonth(), s.getDay()), "2020-5-23");
  });
  ok("农历输入：--lunar 路径与 --date 路径产出同一命盘", () => {
    const viaLunar = buildBirthInfo(
      parseArgs(["--lunar", "1990-04-21", "--branch", "0", "--gender", "male"]),
    );
    const viaSolar = buildBirthInfo(
      parseArgs(["--date", "1990-05-15", "--branch", "0", "--gender", "male"]),
    );
    eq(fmtDate(viaLunar.info), fmtDate(viaSolar.info));
    eq(
      chartSignature(generateChart(viaLunar.info)),
      chartSignature(generateChart(viaSolar.info)),
    );
  });
  ok("农历输入：不存在的闰月必须报错（2021 年无闰四月）", () => {
    let msg = null;
    try {
      buildBirthInfo(
        parseArgs([
          "--lunar",
          "2021-04-01",
          "--leap",
          "--branch",
          "0",
          "--gender",
          "male",
        ]),
      );
    } catch (e) {
      msg = e.message;
    }
    if (!msg)
      throw new Error("2021 年闰四月不存在，却未报错（静默滚动会让整盘皆错）");
    if (!msg.includes("闰")) throw new Error(`错误信息未点明闰月问题：${msg}`);
    return msg.split("。")[0];
  });
  ok("农历输入：合法的闰月可正常换算（2020 年闰四月初一）", () => {
    const b = buildBirthInfo(
      parseArgs([
        "--lunar",
        "2020-04-01",
        "--leap",
        "--branch",
        "0",
        "--gender",
        "male",
      ]),
    );
    eq(fmtDate(b.info), "2020-05-23");
  });
  ok("农历输入：闰月与非闰月是不同日期", () => {
    const leap = buildBirthInfo(
      parseArgs([
        "--lunar",
        "2020-04-01",
        "--leap",
        "--branch",
        "0",
        "--gender",
        "male",
      ]),
    );
    const plain = buildBirthInfo(
      parseArgs(["--lunar", "2020-04-01", "--branch", "0", "--gender", "male"]),
    );
    if (fmtDate(leap.info) === fmtDate(plain.info))
      throw new Error("闰四月与四月被算成了同一天");
  });

  // ── 2. 真太阳时 ──
  ok("真太阳时：东经 120° 不校正，09:30 → 巳时(5)", () => {
    const t = calcTrueSolar(9, 30, 120);
    eq(t.branch, 5);
    eq(t.isLateZi, false);
    eq(t.offsetMinutes, 0);
  });
  ok("真太阳时：00:30 → 子时(0) 且非晚子时", () => {
    const t = calcTrueSolar(0, 30, 120);
    eq(t.branch, 0);
    eq(t.isLateZi, false);
  });
  ok("真太阳时：23:40 → 子时(0) 且标记晚子时", () => {
    const t = calcTrueSolar(23, 40, 120);
    eq(t.branch, 0);
    eq(t.isLateZi, true);
  });
  ok("真太阳时：经度偏移按 (lng-120)*4 分钟计（石家庄 = -22 分）", () => {
    const lx = findLongitude("石家庄");
    if (!lx) throw new Error("城市表查不到石家庄");
    const t = calcTrueSolar(12, 0, lx.longitude);
    eq(t.offsetMinutes, Math.round((lx.longitude - 120) * 4));
    if (t.offsetMinutes >= 0)
      throw new Error(`石家庄经度应小于 120，实得 offset=${t.offsetMinutes}`);
  });

  // ── 3. 晚子时等价性（本技能最易错处）──
  ok("晚子时：timeIndex 12 ≡ 次日 timeIndex 0（命盘完全一致）", () => {
    const late = generateChart({
      year: 1990,
      month: 5,
      day: 15,
      hour: 12,
      gender: "male",
    });
    const nextEarly = generateChart({
      year: 1990,
      month: 5,
      day: 16,
      hour: 0,
      gender: "male",
    });
    eq(chartSignature(late), chartSignature(nextEarly), "晚子时与次日早子时");
  });
  ok("晚子时：与当日早子时是两张不同的盘", () => {
    const early = generateChart({
      year: 1990,
      month: 5,
      day: 15,
      hour: 0,
      gender: "male",
    });
    const late = generateChart({
      year: 1990,
      month: 5,
      day: 15,
      hour: 12,
      gender: "male",
    });
    if (chartSignature(early) === chartSignature(late))
      throw new Error("两口径产出相同命盘，与「差异极大」的预期不符");
  });
  ok("晚子时：--branch 12 与 --late-zi 两条路径等价", () => {
    const viaBranch = buildBirthInfo(
      parseArgs(["--date", "1990-05-15", "--branch", "12", "--gender", "male"]),
    );
    const viaFlag = buildBirthInfo(
      parseArgs([
        "--date",
        "1990-05-15",
        "--time",
        "23:40",
        "--late-zi",
        "--gender",
        "male",
      ]),
    );
    eq(viaBranch.info.hour, 12);
    eq(viaFlag.info.hour, 12);
    eq(
      chartSignature(generateChart(viaBranch.info)),
      chartSignature(generateChart(viaFlag.info)),
    );
  });
  ok("晚子时：--time 23:40 默认走早子时口径并打上候选标记", () => {
    const b = buildBirthInfo(
      parseArgs([
        "--date",
        "1990-05-15",
        "--time",
        "23:40",
        "--gender",
        "male",
      ]),
    );
    eq(b.info.hour, 0);
    eq(b.lateZiCandidate, true);
    eq(b.isLateZi, false);
  });
  ok("时辰：--branch 13 应被拒绝", () => {
    let threw = false;
    try {
      buildBirthInfo(
        parseArgs([
          "--date",
          "1990-05-15",
          "--branch",
          "13",
          "--gender",
          "male",
        ]),
      );
    } catch {
      threw = true;
    }
    eq(threw, true, "--branch 13 ");
  });

  // ── 4. 城市容错 ──
  ok("城市容错：石家庄 / 石家庄市 / 河北省石家庄市 解析一致", () => {
    const a = findLongitude("石家庄"),
      b = findLongitude("石家庄市"),
      c = findLongitude("河北省石家庄市");
    if (!a || !b || !c) throw new Error("存在未解析的写法");
    eq(a.longitude, b.longitude, "石家庄 vs 石家庄市 ");
    eq(a.longitude, c.longitude, "石家庄 vs 河北省石家庄市 ");
  });
  ok("城市容错：未收录城市返回 null（不误匹配）", () => {
    eq(findLongitude("不存在的城市XYZ"), null);
    eq(findLongitude(""), null);
  });
  ok("城市容错：--city 石家庄市 能正常起盘", () => {
    const b = buildBirthInfo(
      parseArgs([
        "--date",
        "1990-05-15",
        "--time",
        "09:30",
        "--city",
        "石家庄市",
        "--gender",
        "male",
      ]),
    );
    if (!Number.isFinite(b.info.longitude)) throw new Error("经度未解析");
    eq(chartSignature(generateChart(b.info)).length > 0, true);
  });
  ok("城市容错：精确命中不提示，容错命中才提示（exact 标志）", () => {
    eq(findLongitude("石家庄").exact, true, "原名 "); // 表里就是「石家庄」，无需提示
    eq(findLongitude("石家庄市").exact, false, "带后缀 "); // 做了容错，需提示
    const exact = buildBirthInfo(
      parseArgs(["--date", "1990-05-15", "--branch", "0", "--city", "石家庄"]),
    );
    const fuzzy = buildBirthInfo(
      parseArgs([
        "--date",
        "1990-05-15",
        "--branch",
        "0",
        "--city",
        "石家庄市",
      ]),
    );
    eq(exact.lngNote, "", "精确命中的 lngNote ");
    if (!fuzzy.lngNote) throw new Error("容错命中应给出 lngNote");
    return fuzzy.lngNote;
  });
  ok("出生地：未给地点时必须提示「按 120° 处理、未做校正」", () => {
    const b = buildBirthInfo(
      parseArgs(["--date", "1990-05-15", "--branch", "0"]),
    );
    eq(b.info.longitude, 120);
    if (!b.lngNote || !b.lngNote.includes("120"))
      throw new Error(
        `未给地点时 lngNote 应提醒，实得：${JSON.stringify(b.lngNote)}`,
      );
    return b.lngNote;
  });

  // ── 5. 排盘不变量 ──
  ok("排盘不变量：十二宫齐全 / 地支不重复 / 命宫唯一 / 五行局合法", () => {
    const c = generateChart(sample);
    eq(c.palaces.length, 12, "宫位数 ");
    eq(new Set(c.palaces.map((p) => p.branch)).size, 12, "地支去重后 ");
    eq(c.palaces.filter((p) => p.isMingGong).length, 1, "命宫数 ");
    if (![2, 3, 4, 5, 6].includes(c.wuxingJu))
      throw new Error(`五行局异常：${c.wuxingJu}`);
    if (c.ziweiPos < 0 || c.ziweiPos > 11)
      throw new Error(`紫微位异常：${c.ziweiPos}`);
    if (c.daXians.length !== 12)
      throw new Error(`大限数异常：${c.daXians.length}`);
  });
  ok("排盘不变量：空宫均带借宫字段", () => {
    const c = generateChart(sample);
    for (const p of c.palaces.filter((x) => x.isEmpty)) {
      if (p.borrowedFromName === undefined || p.borrowedStars === undefined) {
        throw new Error(`空宫 ${p.name} 缺 borrowedFromName / borrowedStars`);
      }
    }
  });

  // ── 6. 三合派硬约束守护（防止飞星派逻辑回流）──
  ok("三合派约束：宫干自化未被填充", () => {
    const c = generateChart(sample);
    const dirty = c.palaces.filter((p) => p.selfSihua);
    if (dirty.length)
      throw new Error(
        `检测到 selfSihua 被填充：${dirty.map((p) => p.name).join("、")}（飞星派逻辑疑似回流）`,
      );
  });
  ok("三合派约束：大限未携带宫干四化字段", () => {
    const c = generateChart(sample);
    const dirty = c.daXians.filter(
      (d) =>
        d.siHua !== undefined ||
        d.stemIndex !== undefined ||
        d.stemName !== undefined,
    );
    if (dirty.length)
      throw new Error(
        `检测到大限携带四化/宫干字段：${dirty.length} 条（飞星派逻辑疑似回流）`,
      );
  });

  // ── 7. 格局与四化 ──
  ok("格局识别：返回数组且每条含 name / level", () => {
    const ps = detectPatterns(generateChart(sample));
    if (!Array.isArray(ps)) throw new Error("detectPatterns 未返回数组");
    for (const p of ps)
      if (!p.name || !p.level)
        throw new Error(`格局条目缺字段：${JSON.stringify(p).slice(0, 80)}`);
    return `样本盘识别到 ${ps.length} 个格局`;
  });
  ok("四化：甲干 = 廉贞禄 / 破军权 / 武曲科 / 太阳忌", () => {
    const t = getSiHuaByStem(0);
    eq(`${t.禄}${t.权}${t.科}${t.忌}`, "廉贞破军武曲太阳");
  });
  ok("四化：生年干索引按 (year-4)%10 计（1990 → 庚 = 6）", () => {
    eq(getYearStemIndex(1990), 6);
    eq(STEMS[getYearStemIndex(1990)], "庚");
  });
  ok("流月：五虎遁 甲年正月 = 丙寅", () => {
    eq(getLiuYueSiHua(0, 1).stemName, "丙");
    eq(getLiuYueSiHua(1, 1).stemName, "戊", "乙年正月 ");
  });

  // ── 8. 知识源可用性 ──
  ok("知识源：古籍库非空", () => {
    if (!ALL_BOOKS.length) throw new Error("ALL_BOOKS 为空");
    if (!TOTAL_PARAGRAPHS) throw new Error("TOTAL_PARAGRAPHS 为 0");
    return `${ALL_BOOKS.length} 部 / ${TOTAL_PARAGRAPHS} 段`;
  });
  ok("知识源：古籍检索可命中", () => {
    const hits = searchClassics("紫微", 3);
    if (!hits.length) throw new Error("检索「紫微」无命中");
    return `命中 ${hits.length} 条`;
  });
  ok("知识源：倪海夏三纪模块非空", () => {
    if (!TIANJI_MODULES.length || !RENJI_MODULES.length || !DIJI_MODULES.length)
      throw new Error("三纪模块存在空数组");
    return `天纪 ${TIANJI_MODULES.length} / 人纪 ${RENJI_MODULES.length} / 地纪 ${DIJI_MODULES.length}`;
  });
  ok("知识源：合盘断语与四化断语非空", () => {
    if (!Object.keys(STAR_IN_FUQI_GU).length)
      throw new Error("STAR_IN_FUQI_GU 为空");
    if (!Object.keys(SIHUA_IN_FUQI_GU).length)
      throw new Error("SIHUA_IN_FUQI_GU 为空");
    if (!HEMING_METHODOLOGY) throw new Error("HEMING_METHODOLOGY 为空");
    return `夫妻宫断语 ${Object.keys(STAR_IN_FUQI_GU).length} 星`;
  });
  ok("知识源：星曜释义覆盖十四主星", () => {
    const majorStars = [
      "紫微",
      "天机",
      "太阳",
      "武曲",
      "天同",
      "廉贞",
      "天府",
      "太阴",
      "贪狼",
      "巨门",
      "天相",
      "天梁",
      "七杀",
      "破军",
    ];
    const miss = majorStars.filter((s) => !STAR_DESCRIPTIONS[s]);
    if (miss.length) throw new Error(`缺失释义：${miss.join("、")}`);
    eq(Object.keys(STAR_DESCRIPTIONS).length, 14, "星曜释义条数 ");
  });

  // ── 输出 ──
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  // 先报内核根：正常情况下就是本 skill 目录（SKILL.md 的上一级）
  const srcNote =
    ROOT_LABEL === "技能自带内核" ? "" : `（来源：${ROOT_LABEL}）`;
  const out = [
    `紫微斗数 skill 回归自检 —— 通过 ${passed}/${results.length}`,
    `内核根：${ROOT} ${srcNote}`,
    "",
  ];
  for (const r of results) {
    out.push(
      `${r.pass ? "✅" : "❌"} ${r.name}${r.detail ? `\n     ${r.detail}` : ""}`,
    );
  }
  if (failed) {
    out.push(
      "",
      `❌ ${failed} 项未通过。若为上游 lib/ 或 iztro 升级所致，请核对 ziwei.mjs 顶部的 import 列表与换算公式。`,
    );
  } else {
    out.push("", "✅ 全部通过。");
  }
  const text = out.join("\n");
  if (failed) {
    console.error(text);
    process.exit(1);
  }
  return text;
}

// ══════════════════════ 入口 ══════════════════════

const HELP = `紫微斗数 CLI —— 复用项目 lib/ 排盘内核与知识库

用法：node scripts/ziwei.mjs <command> [options]

命令：
  analyze    解读用完整输入包（命盘 + 十二宫一览 + 格局 + 四化 + 大限）★ 最常用
  chart      纯排盘十二宫
  heming     合盘（双宫联参 + 夫妻宫断语 + 方法论）
  classics   古籍原文检索（骨髓赋 / 紫微斗数全集 / 全书）
  nihai      倪海厦天纪 / 地纪 / 人纪知识
  stars      星曜释义
  cities     城市经纬度查询（真太阳时校正用）
  selftest   回归自检（农历换算 / 真太阳时 / 晚子时 / 排盘不变量 / 三合派约束）

出生日期（三选一；heming 加 a- / b- 前缀）：
  --date  YYYY-MM-DD   公历生日
  --lunar YYYY-MM-DD   农历生日（脚本自动换算，勿与 --date 同用）
  --leap               配合 --lunar，表示闰月
  --year / --month / --day   公历生日（分写）

出生时辰（二选一）：
  --time HH:MM         钟表时间（配合 --lng / --city 自动换算真太阳时）
  --branch 0-12        直接指定时辰支（0=子 … 11=亥；12=晚子时），与 --time 二选一
  --late-zi            配合 --time：23:00–23:59 出生改按「晚子时算次日」排

其他出生信息：
  --gender male|female
  --lng 116.4          出生地经度（默认 120，即不校正）
  --city 北京          用城市名代替 --lng（容错「石家庄市」「石家庄地区」等写法）
  --province 山东      用省份代替 --lng（按省会计）
  --name 张三          可选

输出选项：
  --json              输出原始 JSON（供程序消费）
  --liunian 2027      analyze 时指定流年（默认今年）。勿用 --year，那是出生年
  --liuyue 6          analyze 时追加农历 6 月的流月四化（需先有流年）
  --focus 财帛        analyze 时额外展开指定宫位

⚠️ 晚子时：23:00–23:59 出生时，子时横跨两日，【当日早子时】与【晚子时算次日】
   排出的是两张不同的盘。本 CLI 默认沿用线上 metisziwei.com 口径（当日早子时），
   并在命中时自动给出两盘差异提醒。复核请加 --late-zi 或 --branch 12。

示例：
  # 单人解读（公历）
  node scripts/ziwei.mjs analyze --date 1990-05-15 --time 09:30 --city 北京 --gender male

  # 用户只给农历生日
  node scripts/ziwei.mjs analyze --lunar 1988-06-26 --time 10:30 --city 杭州 --gender male

  # 时辰直接指定 + 指定流年 + 聚焦官禄宫
  node scripts/ziwei.mjs analyze --date 1985-11-03 --branch 6 --gender female --liunian 2027 --focus 官禄

  # 23:00 后出生，复核晚子时口径
  node scripts/ziwei.mjs analyze --date 1988-02-14 --time 23:40 --late-zi --city 北京 --gender male

  # 合盘
  node scripts/ziwei.mjs heming \\
    --a-date 1990-05-15 --a-time 09:30 --a-gender male --a-city 北京 \\
    --b-date 1993-08-22 --b-time 14:00 --b-gender female --b-city 上海

  # 古籍检索 / 回归自检
  node scripts/ziwei.mjs classics --search 紫微居午
  node scripts/ziwei.mjs selftest
`;

const COMMANDS = {
  analyze: cmdAnalyze,
  chart: cmdChart,
  heming: cmdHeming,
  classics: cmdClassics,
  nihai: cmdNihai,
  stars: cmdStars,
  cities: cmdCities,
  selftest: cmdSelftest,
};

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(HELP);
    return;
  }
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.error(
      `未知命令「${cmd}」。可用：${Object.keys(COMMANDS).join(" / ")}\n运行 help 查看完整用法。`,
    );
    process.exit(1);
  }
  try {
    console.log(fn(parseArgs(argv.slice(1))));
  } catch (err) {
    console.error(`错误：${err.message}`);
    process.exit(1);
  }
}

main();
