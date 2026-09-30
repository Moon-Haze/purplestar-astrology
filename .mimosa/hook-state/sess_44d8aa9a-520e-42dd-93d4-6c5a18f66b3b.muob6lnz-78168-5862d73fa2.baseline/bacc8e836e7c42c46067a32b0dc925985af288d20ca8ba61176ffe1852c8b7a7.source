/**
 * 倪海厦体系 v3 硬约束校验。
 *
 * 生成样本前后均可运行：
 *   npm run validate:nihaixia
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { generateChart } from '../lib/ziwei/algorithm';
import { getTopicAnalysis } from '../lib/ziwei/db-analysis';
import { getLiuYueStemIndex } from '../lib/ziwei/sihua';
import type { Palace, Star } from '../lib/ziwei/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dbText = fs.readFileSync(path.join(root, 'lib/ziwei/db-analysis.ts'), 'utf8');

const failures: string[] = [];
const MAX_FAILURES = 100;

function expect(condition: unknown, message: string) {
  if (!condition && failures.length < MAX_FAILURES) failures.push(message);
}

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const p = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(p) : [p];
  });
}

const requiredWarnings = [
  '紫微守命，贵而不富，需禄配合方全美',
  '空宫必借对宫论事',
  '化忌主是非',
  '魁钺夹命，贵人在旁',
  '羊陀夹命，刑克逃不掉',
  '火铃夹命，性急刑伤',
  '禄马交驰，财从动中来',
  '田宅化忌，家破财散',
  '福德宫化忌，夫妻宫未见生离，必定死别',
  '迁移化忌，半空折翅',
  '擎羊入命，刑克自伤',
  '命运不是人生的全部，加上地理位置和人念，才是',
];

requiredWarnings.forEach(phrase => {
  expect(dbText.includes(phrase), `缺少倪师原话警示语：${phrase}`);
});

const requiredPatternSignals = [
  '紫府同宫格',
  '紫府朝垣格',
  '杀破狼格',
  '机月同梁格',
  '廉相格',
  '武曲七杀',
  '日月夹命',
  '日月同宫',
  '日月并明格',
  '辅弼夹命',
  '魁钺夹命',
  '火铃夹命',
  '羊陀夹命',
  '双禄交流格',
  '禄马交驰格',
  '七杀朝斗格',
  '日丽中天格',
  '英星入庙格',
  '火贪格',
  '铃贪格',
  '天马落空',
  '文昌化忌',
  '文曲化忌',
  '化忌入命',
  '化忌入迁移宫',
  '禄存守命格',
  '擎羊入命',
];

requiredPatternSignals.forEach(signal => {
  expect(dbText.includes(signal), `格局清单缺少识别信号：${signal}`);
});

const forbiddenDbPhrases = [
  '大限宫干四化',
  '流年四化',
  '流月四化',
  '自化警示',
  '来因宫追溯',
  '北派飞星',
  '飞星派',
];

forbiddenDbPhrases.forEach(phrase => {
  expect(!dbText.includes(phrase), `db-analysis 仍包含 v3 已下线段落：${phrase}`);
});

expect(!dbText.includes('倪海夏说化忌主是非'), '化忌主是非引文仍使用旧归因');
expect(!dbText.includes('倪海夏提醒：「化忌主是非」'), '化忌主是非引文仍使用旧提醒归因');
expect(!dbText.includes('倪海夏原话：武曲化忌为刑囚之星'), '武曲化忌 fabricated 引文仍使用旧归因');
expect(!dbText.includes('倪海夏原话：「武曲化忌，为刑囚之星」'), '武曲化忌 fabricated 引文仍使用旧归因');
expect(dbText.includes('古诀云'), '化忌主是非引文未改为古诀云口径');

const wuHuDunCases: Array<[number, number, number, string]> = [
  [0, 1, 2, '甲年正月起丙寅'],
  [5, 1, 2, '己年正月起丙寅'],
  [1, 1, 4, '乙年正月起戊寅'],
  [6, 1, 4, '庚年正月起戊寅'],
  [2, 1, 6, '丙年正月起庚寅'],
  [7, 1, 6, '辛年正月起庚寅'],
  [3, 1, 8, '丁年正月起壬寅'],
  [8, 1, 8, '壬年正月起壬寅'],
  [4, 1, 0, '戊年正月起甲寅'],
  [9, 1, 0, '癸年正月起甲寅'],
  [0, 2, 3, '甲年二月顺推丁卯'],
];

wuHuDunCases.forEach(([yearStem, month, expected, label]) => {
  expect(getLiuYueStemIndex(yearStem, month) === expected, `五虎遁错误：${label}`);
});

const chart = generateChart({ year: 1990, month: 3, day: 15, hour: 6, gender: 'male', longitude: 120 });

chart.daXians.forEach((dx, index) => {
  const palace = chart.palaces.find(p => p.branch === dx.palaceBranch);
  expect(palace, `大限 ${index} 找不到对应宫位`);
  if (!palace) return;
  const keys = Object.keys(dx).sort().join('|');
  expect(keys === 'endAge|palaceBranch|palaceName|startAge', `大限 ${index} 字段不符合 v3：${keys}`);
  expect(!('stemIndex' in (dx as any)), `大限 ${index} 不应含 stemIndex 字段`);
  expect(!('stemName' in (dx as any)), `大限 ${index} 不应含 stemName 字段`);
  expect(!('siHua' in (dx as any)), `大限 ${index} 不应含 siHua 字段`);
});

chart.palaces.forEach((palace: any) => {
  expect(!('selfSihua' in palace), `${palace.name} 不应含 selfSihua 字段`);
});

const allGeneratedStars = chart.palaces.flatMap(p => p.stars) as any[];
expect(allGeneratedStars.every(star => !('incomingSihua' in star)), '星曜不应含 incomingSihua 字段');

const healthText = getTopicAnalysis(chart, 'health', { view: 'mingpan' });
expect(healthText.includes('子午流注'), '疾厄话题缺少子午流注');
expect(healthText.includes('经络'), '疾厄话题缺少经络映射');
expect(/肝|肾|脾胃|心|肺|胆|胃|膀胱|口腔|咽喉|大肠|生殖|血|骨|眼/.test(healthText), '疾厄话题缺少脏腑词');

const femaleChart = generateChart({ year: 1990, month: 3, day: 15, hour: 6, gender: 'female', longitude: 120 });
const femaleHealthText = getTopicAnalysis(femaleChart, 'health', { view: 'mingpan' });
expect(/妇科|经期|孕产/.test(femaleHealthText), '女命疾厄话题缺少妇科/经期/孕产差异内容');
expect(getTopicAnalysis(chart, 'wealth', { view: 'mingpan' }) !== getTopicAnalysis(femaleChart, 'wealth', { view: 'mingpan' }), '男女命 wealth 文本不应完全相同');

const overviewText = getTopicAnalysis(chart, 'overview', { view: 'mingpan' });
const personalityText = getTopicAnalysis(chart, 'personality', { view: 'mingpan' });
const forbiddenTopicPhrases = ['宫干四化', '自化', '来因宫', '北派飞星', '飞星派', '大限四化', '流年四化', '流月四化'];
forbiddenTopicPhrases.forEach(phrase => {
  expect(!overviewText.includes(phrase), `overview 输出含 v3 禁用字眼：${phrase}`);
});
expect(overviewText !== personalityText, '命格总览与性格全文不应雷同');
expect(!personalityText.includes('**【星曜深层特质】**') || !personalityText.includes('你天生有领导者的气场'), 'personality 不应套用 overview 深层特质段');

function validateSample(sample: any, label: string) {
  const chart = sample?.chart;
  expect(sample?.system === '倪海厦紫微斗数', `${label} system 字段错误`);
  expect(chart?.palaces?.length === 12, `${label} 不是 12 宫`);
  expect(chart?.daXians?.length === 12, `${label} 不是 12 大限`);
  if (!chart || !Array.isArray(chart.palaces) || !Array.isArray(chart.daXians)) return;

  const allStars: Star[] = chart.palaces.flatMap((p: Palace) => p.stars ?? []);
  const starNames = new Set(allStars.map(s => s.name));
  const requiredMajorStars = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
  const requiredLuckyStars = ['文昌', '文曲', '左辅', '右弼', '天魁', '天钺'];
  const requiredShaStars = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];

  requiredMajorStars.forEach(name => expect(starNames.has(name), `${label} 缺十四主星：${name}`));
  requiredLuckyStars.forEach(name => expect(starNames.has(name), `${label} 缺六吉星：${name}`));
  requiredShaStars.forEach(name => expect(starNames.has(name), `${label} 缺六煞星：${name}`));
  ['禄存', '天马'].forEach(name => expect(starNames.has(name), `${label} 缺 ${name}`));

  chart.daXians.forEach((dx: any, index: number) => {
    const palace = chart.palaces.find((p: Palace) => p.branch === dx.palaceBranch);
    expect(palace, `${label} 大限 ${index} 找不到对应宫位`);
    if (!palace) return;
    const keys = Object.keys(dx).sort().join('|');
    expect(keys === 'endAge|palaceBranch|palaceName|startAge', `${label} 大限 ${index} 字段不符合 v3：${keys}`);
    expect(!('stemIndex' in dx), `${label} 大限 ${index} 不应含 stemIndex 字段`);
    expect(!('stemName' in dx), `${label} 大限 ${index} 不应含 stemName 字段`);
    expect(!('siHua' in dx), `${label} 大限 ${index} 不应含 siHua 字段`);
  });

  chart.palaces.forEach((palace: any) => {
    expect(!('selfSihua' in palace), `${label} ${palace.name} 不应含 selfSihua 字段`);
    (palace.stars ?? []).forEach((star: any) => {
      expect(!('incomingSihua' in star), `${label} ${palace.name}/${star.name} 不应含 incomingSihua 字段`);
    });
  });

  const health = sample?.topics?.health ?? '';
  expect(health.includes('子午流注'), `${label} health 缺子午流注`);
  expect(health.includes('经络'), `${label} health 缺经络`);
  expect(/肝|肾|脾胃|心|肺|胆|胃|膀胱|口腔|咽喉|大肠|生殖|血|骨|眼/.test(health), `${label} health 缺脏腑映射`);
  if (sample?.birthInfo?.gender === 'female') {
    expect(/妇科|经期|孕产/.test(health), `${label} 女命 health 缺少妇科/经期/孕产差异内容`);
  }

  const overview = sample?.topics?.overview ?? '';
  forbiddenTopicPhrases.forEach(phrase => {
    expect(!overview.includes(phrase), `${label} overview 含 v3 禁用字眼：${phrase}`);
  });
}

async function validateSamplesOut() {
  const samplesDir = path.join(root, 'samples-out');
  const files = walkFiles(samplesDir).filter(file => file.endsWith('.jsonl') || file.endsWith('.jsonl.gz'));
  if (files.length === 0) {
    console.log('未发现 samples-out/*.jsonl 或 *.jsonl.gz，跳过样本扫描');
    return { sampleCount: 0, fileCount: 0 };
  }

  let sampleCount = 0;
  for (const file of files.sort()) {
    const input = file.endsWith('.gz')
      ? fs.createReadStream(file).pipe(createGunzip())
      : fs.createReadStream(file);
    const rl = readline.createInterface({ input, crlfDelay: Infinity });
    let lineNo = 0;

    for await (const line of rl) {
      lineNo++;
      if (!line.trim()) continue;
      try {
        validateSample(JSON.parse(line), `${path.relative(root, file)}:${lineNo}`);
        sampleCount++;
      } catch (err) {
        expect(false, `${path.relative(root, file)}:${lineNo} JSON.parse 失败：${(err as Error).message}`);
      }
    }
  }

  return { sampleCount, fileCount: files.length };
}

const scan = await validateSamplesOut();

if (failures.length > 0) {
  console.error('倪海厦体系 v3 硬约束校验失败：');
  failures.forEach(failure => console.error(`- ${failure}`));
  if (failures.length >= MAX_FAILURES) {
    console.error(`- 失败过多，仅显示前 ${MAX_FAILURES} 条`);
  }
  process.exit(1);
}

if (scan.sampleCount > 0) {
  console.log(`样本扫描通过：${scan.sampleCount.toLocaleString()} 条，${scan.fileCount} 个分片`);
}
console.log('倪海厦体系 v3 硬约束校验通过');
