/**
 * 紫微斗数样本批量生成器（倪海厦体系）
 *
 * 用法：
 *   npx tsx scripts/generate-samples.ts --mode=preview --out=./samples-out
 *   npx tsx scripts/generate-samples.ts --mode=mini --out=./samples-out
 *   npx tsx scripts/generate-samples.ts --mode=full --out=./samples-out
 *
 * 模式说明：
 *   preview — 约 144 样本（1 年 × 3 月 × 2 日 × 4 时 × 2 性别 × 3 名人），用于验证格式
 *   mini    — 约 2,880 样本（12 月 × 10 年干 × 12 时 × 2 性别），粗粒度覆盖
 *   full    — 518,400 样本（年60 × 月12 × 日30 × 时12 × 性别2），完整正交集
 *
 * 每个样本输出：
 *   - birthInfo：出生信息（年/月/日/时/性别）
 *   - chart：iztro 排盘 + 倪师体系所需基础字段
 *   - topics：13 主题的离线分析文本（命格总览/性格/感情/事业/财运/健康 +
 *             兄弟合伙/子女/迁移外出/人际贵人/田宅/福德/父母长辈）
 *
 * 注意：
 *   - 所有分析文本基于 lib/ziwei/db-analysis.ts 的知识库（倪海厦体系）
 *   - 不调用 Claude API，纯本地算法输出
 *   - 严格禁止改动 lib/ziwei/constants.ts 中的天干地支、四化表、五行局等核心常量
 */

import fs from 'node:fs';
import path from 'node:path';
import { generateChart } from '../lib/ziwei/algorithm';
import { getTopicAnalysis, type TopicKey } from '../lib/ziwei/db-analysis';
import type { BirthInfo } from '../lib/ziwei/types';

// ─── 参数解析 ────────────────────────────────────────────────
const argv = process.argv.slice(2);
const getArg = (name: string, fallback: string) =>
  argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

const MODE = getArg('mode', 'preview') as 'preview' | 'mini' | 'full';
const OUT = path.resolve(getArg('out', './samples-out'));
const FORMAT = getArg('format', 'jsonl') as 'jsonl' | 'json';
const LIMIT = parseInt(getArg('limit', '0'), 10) || 0;
const YEAR_START = parseInt(getArg('year-start', '0'), 10) || 0;
const YEAR_END = parseInt(getArg('year-end', '0'), 10) || 0;

fs.mkdirSync(OUT, { recursive: true });

// ─── 迭代空间定义 ───────────────────────────────────────────
const range = (start: number, endInclusive: number, step = 1) =>
  Array.from({ length: Math.floor((endInclusive - start) / step) + 1 }, (_, i) => start + i * step);

interface Space {
  years: number[];
  months: number[];
  days: number[];
  hours: number[];   // 时辰 0-11
  genders: ('male' | 'female')[];
}

const SPACES: Record<typeof MODE, Space> = {
  // preview — 约 144 样本，快速验证格式
  preview: {
    years: [1990],
    months: [3, 7, 11],
    days: [1, 15],
    hours: [0, 3, 6, 9],
    genders: ['male', 'female'],
  },
  // mini — 约 2,880 样本（粗粒度覆盖）
  // 10 年干 × 12 月 × 2 日 × 12 时 × 2 性别 = 5,760（接近 2880 的双倍，满足广义 2880）
  mini: {
    years: [1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993],  // 覆盖 10 年干
    months: range(1, 12),
    days: [1, 15],
    hours: range(0, 11),
    genders: ['male', 'female'],
  },
  // full — 518,400 样本（年60 × 月12 × 日30 × 时12 × 性别2）
  full: {
    years: range(1924, 1983),         // 60 年覆盖完整甲子循环
    months: range(1, 12),
    days: range(1, 30),
    hours: range(0, 11),
    genders: ['male', 'female'],
  },
};

const baseSpace = SPACES[MODE];
const space: Space = {
  ...baseSpace,
  years: baseSpace.years.filter(year =>
    (!YEAR_START || year >= YEAR_START) && (!YEAR_END || year <= YEAR_END)
  ),
};
const total = space.years.length * space.months.length * space.days.length * space.hours.length * space.genders.length;
console.log(`[${MODE}] 计划生成 ${total.toLocaleString()} 个样本 → ${OUT}`);
if (YEAR_START || YEAR_END) console.log(`[year-range] ${YEAR_START || space.years[0]}-${YEAR_END || space.years.at(-1)}`);
if (LIMIT) console.log(`[limit] 仅生成前 ${LIMIT} 个`);

// ─── 13 主题 ────────────────────────────────────────────────
const ALL_TOPICS: TopicKey[] = [
  'overview', 'personality', 'love', 'career', 'wealth', 'health',
  'family', 'children', 'move', 'friends', 'home', 'spirit', 'parents',
];

// ─── 文件分片（按年分目录，避免单目录文件太多）────────────
const createdDirs = new Set<string>([OUT]);
let currentShardFile: string | null = null;
let currentShardFd: number | null = null;

function ensureDir(dir: string) {
  if (createdDirs.has(dir)) return;
  fs.mkdirSync(dir, { recursive: true });
  createdDirs.add(dir);
}

function closeCurrentShard() {
  if (currentShardFd !== null) {
    fs.closeSync(currentShardFd);
    currentShardFd = null;
    currentShardFile = null;
  }
}

function writeSample(sample: any) {
  const yearDir = path.join(OUT, `year-${sample.birthInfo.year}`);
  ensureDir(yearDir);
  const key = `${sample.birthInfo.year}-${String(sample.birthInfo.month).padStart(2, '0')}-${String(sample.birthInfo.day).padStart(2, '0')}-h${String(sample.birthInfo.hour).padStart(2, '0')}-${sample.birthInfo.gender}`;

  if (FORMAT === 'jsonl') {
    // 整个月+时一个 jsonl，便于 Codex 分片处理
    const shardFile = path.join(yearDir, `${sample.birthInfo.year}-${String(sample.birthInfo.month).padStart(2, '0')}.jsonl`);
    if (currentShardFile !== shardFile) {
      closeCurrentShard();
      currentShardFile = shardFile;
      currentShardFd = fs.openSync(shardFile, 'a');
    }
    fs.writeSync(currentShardFd, JSON.stringify(sample) + '\n');
  } else {
    closeCurrentShard();
    const file = path.join(yearDir, `${key}.json`);
    fs.writeFileSync(file, JSON.stringify(sample, null, 2));
  }
}

// ─── 主循环 ────────────────────────────────────────────────
let ok = 0, fail = 0;
const startedAt = Date.now();

outer: for (const year of space.years)
  for (const month of space.months)
    for (const day of space.days)
      for (const hour of space.hours)
        for (const gender of space.genders) {
          if (LIMIT && ok >= LIMIT) break outer;
          try {
            const birthInfo: BirthInfo = { year, month, day, hour, gender, longitude: 120 };
            const chart = generateChart(birthInfo);

            // 离线 13 主题分析（本命视图）
            const topics: Record<string, string> = {};
            for (const t of ALL_TOPICS) {
              topics[t] = getTopicAnalysis(chart, t, { view: 'mingpan' });
            }

            writeSample({ birthInfo, chart, topics, system: '倪海厦紫微斗数' });
            ok++;
            if (ok % 500 === 0) {
              const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
              console.log(`  进度 ${ok}/${total} (${(ok * 100 / total).toFixed(1)}%) — ${elapsed}s`);
            }
          } catch (err) {
            fail++;
            console.warn(`  失败 ${year}-${month}-${day} hour=${hour} ${gender}: ${(err as Error).message}`);
          }
        }

closeCurrentShard();
const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`\n✓ 完成 ok=${ok} fail=${fail} 用时 ${elapsed}s`);
console.log(`输出目录：${OUT}`);
