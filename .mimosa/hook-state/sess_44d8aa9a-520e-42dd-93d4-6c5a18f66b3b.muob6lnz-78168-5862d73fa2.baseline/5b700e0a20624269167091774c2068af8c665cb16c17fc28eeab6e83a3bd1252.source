import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import type { Palace, Star } from '../lib/ziwei/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const samplesDir = path.join(root, 'samples-out');

const EXPECTED_YEARS = Array.from({ length: 60 }, (_, i) => 1924 + i);
const EXPECTED_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const EXPECTED_DAYS = Array.from({ length: 30 }, (_, i) => i + 1);
const EXPECTED_HOURS = Array.from({ length: 12 }, (_, i) => i);
const EXPECTED_GENDERS = ['male', 'female'];
const EXPECTED_TOTAL = 518400;
const EXPECTED_FILES = 720;
const EXPECTED_LINES_PER_SHARD = 720;

const REQUIRED_TOPIC_KEYS = [
  'overview', 'personality', 'love', 'career', 'wealth', 'health',
  'family', 'children', 'move', 'friends', 'home', 'spirit', 'parents',
];

const REQUIRED_PALACE_NAMES = [
  '命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄',
  '迁移', '仆役', '官禄', '田宅', '福德', '父母',
];

const REQUIRED_MAJOR_STARS = [
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府',
  '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
];
const REQUIRED_LUCKY_STARS = ['文昌', '文曲', '左辅', '右弼', '天魁', '天钺'];
const REQUIRED_SHA_STARS = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];

const WARNING_PHRASES = [
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

const FORBIDDEN_OVERVIEW_RE = /宫干四化|自化|来因宫|北派飞星|飞星派|大限四化|流年四化|流月四化/;
const ORGAN_WORD_RE = /肝|肾|脾胃|心|肺|胆|胃|膀胱|口腔|咽喉|大肠|生殖|血|骨|眼|鼻|经络/;
const TARGET_ORGAN_WORD_RE = /肝|肾|脾胃/;
const FEMALE_HEALTH_RE = /妇科|经期|孕产/;

const failures: string[] = [];
const warnings: string[] = [];
const MAX_MESSAGES = 200;

function addFailure(message: string) {
  if (failures.length < MAX_MESSAGES) failures.push(message);
}

function addWarning(message: string) {
  if (warnings.length < MAX_MESSAGES) warnings.push(message);
}

function expect(condition: unknown, message: string) {
  if (!condition) addFailure(message);
}

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const p = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(p) : [p];
  });
}

function parseShard(file: string) {
  const match = file.match(/year-(\d{4})\/(\d{4})-(\d{2})\.jsonl\.gz$/);
  if (!match) return null;
  return {
    yearDir: Number(match[1]),
    year: Number(match[2]),
    month: Number(match[3]),
  };
}

function birthKey(birthInfo: any) {
  return `${birthInfo.year}-${birthInfo.month}-${birthInfo.day}-${birthInfo.hour}-${birthInfo.gender}`;
}

interface RandomAuditRow {
  label: string;
  birth: string;
  dx0HasSihua: boolean;
  dx0HasStemIndex: boolean;
  palaceSelfFieldCount: number;
  starIncomingFieldCount: number;
  overviewForbidden: boolean;
  healthTargetOrgan: boolean;
  femaleHealthTerms: boolean | null;
}

function validateSample(sample: any, label: string, shard: { year: number; month: number }) {
  const birth = sample?.birthInfo;
  const chart = sample?.chart;
  const topics = sample?.topics;

  expect(sample?.system === '倪海厦紫微斗数', `${label} system 字段错误`);
  expect(birth?.year === shard.year, `${label} birthInfo.year 与分片年份不一致`);
  expect(birth?.month === shard.month, `${label} birthInfo.month 与分片月份不一致`);
  expect(EXPECTED_DAYS.includes(birth?.day), `${label} birthInfo.day 越界`);
  expect(EXPECTED_HOURS.includes(birth?.hour), `${label} birthInfo.hour 越界`);
  expect(EXPECTED_GENDERS.includes(birth?.gender), `${label} birthInfo.gender 越界`);
  expect(birth?.longitude === 120, `${label} longitude 不是 120`);

  expect(JSON.stringify(chart?.birthInfo) === JSON.stringify(birth), `${label} chart.birthInfo 与顶层 birthInfo 不一致`);
  expect(chart?.palaces?.length === 12, `${label} 宫位数不是 12`);
  expect(chart?.daXians?.length === 12, `${label} 大限数不是 12`);
  if (!chart || !Array.isArray(chart.palaces) || !Array.isArray(chart.daXians)) return;

  const branches = new Set<number>(chart.palaces.map((p: Palace) => p.branch));
  expect(branches.size === 12 && [...branches].every(b => Number.isInteger(b) && b >= 0 && b <= 11), `${label} 宫位 branch 不完整`);

  const palaceNames = new Set(chart.palaces.map((p: Palace) => p.name));
  REQUIRED_PALACE_NAMES.forEach(name => expect(palaceNames.has(name), `${label} 缺宫位 ${name}`));

  const ming = chart.palaces.filter((p: Palace) => p.isMingGong);
  const shen = chart.palaces.filter((p: Palace) => p.isShenGong);
  expect(ming.length === 1, `${label} 命宫标记数量不是 1`);
  expect(shen.length === 1, `${label} 身宫标记数量不是 1`);
  if (ming[0]) expect(ming[0].branch === chart.mingGongBranch, `${label} mingGongBranch 与命宫标记不一致`);
  if (shen[0]) expect(shen[0].branch === chart.shenGongBranch, `${label} shenGongBranch 与身宫标记不一致`);

  expect([2, 3, 4, 5, 6].includes(chart.wuxingJu), `${label} wuxingJu 非法`);
  expect(typeof chart.wuxingJuName === 'string' && chart.wuxingJuName.length > 0, `${label} wuxingJuName 为空`);

  const allStars: Star[] = chart.palaces.flatMap((p: Palace) => p.stars ?? []);
  const starNames = new Set(allStars.map(s => s.name));
  REQUIRED_MAJOR_STARS.forEach(name => expect(starNames.has(name), `${label} 缺十四主星 ${name}`));
  REQUIRED_LUCKY_STARS.forEach(name => expect(starNames.has(name), `${label} 缺六吉星 ${name}`));
  REQUIRED_SHA_STARS.forEach(name => expect(starNames.has(name), `${label} 缺六煞星 ${name}`));
  ['禄存', '天马'].forEach(name => expect(starNames.has(name), `${label} 缺 ${name}`));

  const majorCounts = new Map<string, number>();
  allStars.filter(s => s.type === 'major').forEach(s => majorCounts.set(s.name, (majorCounts.get(s.name) ?? 0) + 1));
  REQUIRED_MAJOR_STARS.forEach(name => expect(majorCounts.get(name) === 1, `${label} 主星 ${name} 出现次数不是 1`));

  const dxBranches = new Set<number>();
  chart.daXians.forEach((dx: any, index: number) => {
    const palace = chart.palaces.find((p: Palace) => p.branch === dx.palaceBranch);
    expect(palace, `${label} 大限 ${index} 找不到对应宫位`);
    if (!palace) return;

    dxBranches.add(dx.palaceBranch);
    const keys = Object.keys(dx).sort().join('|');
    expect(keys === 'endAge|palaceBranch|palaceName|startAge', `${label} 大限 ${index} 字段不符合 v3：${keys}`);
    expect(!('stemIndex' in dx), `${label} 大限 ${index} 不应含 stemIndex 字段`);
    expect(!('stemName' in dx), `${label} 大限 ${index} 不应含 stemName 字段`);
    expect(!('siHua' in dx), `${label} 大限 ${index} 不应含 siHua 字段`);
    expect(dx.startAge <= dx.endAge, `${label} 大限 ${index} 年龄段非法`);
  });
  expect(dxBranches.size === 12, `${label} 大限没有覆盖 12 个不同宫位`);

  chart.palaces.forEach((palace: any) => {
    expect(!('selfSihua' in palace), `${label} ${palace.name} 不应含 selfSihua 字段`);
    (palace.stars ?? []).forEach((star: any) => {
      expect(!('incomingSihua' in star), `${label} ${palace.name}/${star.name} 不应含 incomingSihua 字段`);
    });
  });

  expect(topics && typeof topics === 'object', `${label} topics 缺失`);
  if (!topics || typeof topics !== 'object') return;

  const topicKeys = Object.keys(topics).sort();
  expect(topicKeys.join('|') === REQUIRED_TOPIC_KEYS.slice().sort().join('|'), `${label} topics key 不完整`);
  REQUIRED_TOPIC_KEYS.forEach(key => {
    const text = topics[key];
    expect(typeof text === 'string' && text.length > 100, `${label} topic ${key} 太短或为空`);
    expect(!text.includes('无法找到'), `${label} topic ${key} 包含无法找到`);
    expect(!text.includes('undefined'), `${label} topic ${key} 包含 undefined`);
    expect(!text.includes('NaN'), `${label} topic ${key} 包含 NaN`);
  });

  const overview = topics.overview ?? '';
  expect(!FORBIDDEN_OVERVIEW_RE.test(overview), `${label} overview 含 v3 禁用字眼`);

  const health = topics.health ?? '';
  expect(health.includes('子午流注'), `${label} health 缺子午流注`);
  expect(health.includes('经络'), `${label} health 缺经络`);
  expect(ORGAN_WORD_RE.test(health), `${label} health 缺脏腑/经络词`);
  if (birth?.gender === 'female') {
    expect(FEMALE_HEALTH_RE.test(health), `${label} 女命 health 缺少妇科/经期/孕产差异内容`);
  }

  const personality = topics.personality ?? '';
  expect(overview !== personality, `${label} overview 与 personality 全文雷同`);
}

async function main() {
  const files = walkFiles(samplesDir).filter(file => file.endsWith('.jsonl.gz')).sort();
  const fileBasenames = new Set(files.map(file => path.relative(samplesDir, file)));
  const seenBirths = new Set<string>();
  const missingShards: string[] = [];
  const shardLineCounts = new Map<string, number>();
  const warningPhraseHits = Object.fromEntries(WARNING_PHRASES.map(phrase => [phrase, 0])) as Record<string, number>;
  const randomRows: RandomAuditRow[] = [];
  const pendingWealthByBase = new Map<string, { gender: string; wealth: string; label: string }>();

  let total = 0;
  let duplicateBirths = 0;
  let healthTargetOrganHits = 0;
  let healthOrganHits = 0;
  let healthZiwuMeridianHits = 0;
  let femaleSamples = 0;
  let femaleHealthHits = 0;
  let dx0HasSihua = 0;
  let anyDxHasSihua = 0;
  let dx0HasStemIndex = 0;
  let anyDxHasStemIndex = 0;
  let samplesWithPalaceSelfField = 0;
  let palaceSelfFieldTotal = 0;
  let samplesWithStarIncomingField = 0;
  let starIncomingFieldTotal = 0;
  let overviewForbiddenHits = 0;
  let wealthPairsCompared = 0;
  let wealthPairsDifferent = 0;
  let topicLengthMin = Infinity;
  let topicLengthMax = 0;
  let topicLengthTotal = 0;
  let topicCount = 0;

  expect(files.length === EXPECTED_FILES, `压缩分片数不是 ${EXPECTED_FILES}，实际 ${files.length}`);

  EXPECTED_YEARS.forEach(year => {
    EXPECTED_MONTHS.forEach(month => {
      const rel = `year-${year}/${year}-${String(month).padStart(2, '0')}.jsonl.gz`;
      if (!fileBasenames.has(rel)) missingShards.push(rel);
    });
  });
  if (missingShards.length > 0) addFailure(`缺少分片：${missingShards.slice(0, 20).join(', ')}${missingShards.length > 20 ? ' ...' : ''}`);

  for (const file of files) {
    const rel = path.relative(samplesDir, file);
    const shard = parseShard(file);
    expect(shard, `${rel} 文件名不符合 year/YYYY-MM.jsonl.gz`);
    if (!shard) continue;
    expect(shard.yearDir === shard.year, `${rel} year 目录与文件名年份不一致`);
    expect(EXPECTED_YEARS.includes(shard.year), `${rel} 年份不在 1924-1983`);
    expect(EXPECTED_MONTHS.includes(shard.month), `${rel} 月份不在 1-12`);

    const rl = readline.createInterface({
      input: fs.createReadStream(file).pipe(createGunzip()),
      crlfDelay: Infinity,
    });

    let lineNo = 0;
    for await (const line of rl) {
      lineNo++;
      if (!line.trim()) continue;

      let sample: any;
      const label = `${rel}:${lineNo}`;
      try {
        sample = JSON.parse(line);
      } catch (err) {
        addFailure(`${label} JSON.parse 失败：${(err as Error).message}`);
        continue;
      }

      total++;
      const key = birthKey(sample.birthInfo);
      if (seenBirths.has(key)) duplicateBirths++;
      seenBirths.add(key);

      validateSample(sample, label, shard);

      const dx0 = sample.chart?.daXians?.[0];
      const sampleDx0HasSihua = Boolean(dx0 && 'siHua' in dx0);
      const sampleDx0HasStemIndex = Boolean(dx0 && 'stemIndex' in dx0);
      if (sampleDx0HasSihua) dx0HasSihua++;
      if ((sample.chart?.daXians ?? []).some((dx: any) => 'siHua' in dx)) anyDxHasSihua++;
      if (sampleDx0HasStemIndex) dx0HasStemIndex++;
      if ((sample.chart?.daXians ?? []).some((dx: any) => 'stemIndex' in dx)) anyDxHasStemIndex++;

      const palaceSelfFields = sample.chart?.palaces?.filter((p: any) => 'selfSihua' in p)?.length ?? 0;
      if (palaceSelfFields > 0) samplesWithPalaceSelfField++;
      palaceSelfFieldTotal += palaceSelfFields;

      const starIncomingFields = sample.chart?.palaces
        ?.flatMap((p: any) => p.stars ?? [])
        ?.filter((s: any) => 'incomingSihua' in s)?.length ?? 0;
      if (starIncomingFields > 0) samplesWithStarIncomingField++;
      starIncomingFieldTotal += starIncomingFields;

      const overview = sample.topics?.overview ?? '';
      const sampleOverviewForbidden = FORBIDDEN_OVERVIEW_RE.test(overview);
      if (sampleOverviewForbidden) overviewForbiddenHits++;

      const health = sample.topics?.health ?? '';
      const sampleHealthTargetOrgan = TARGET_ORGAN_WORD_RE.test(health);
      const sampleFemaleHealthTerms = sample.birthInfo?.gender === 'female' ? FEMALE_HEALTH_RE.test(health) : null;
      if (sampleHealthTargetOrgan) healthTargetOrganHits++;
      if (ORGAN_WORD_RE.test(health)) healthOrganHits++;
      if (health.includes('子午流注') && health.includes('经络')) healthZiwuMeridianHits++;
      if (sample.birthInfo?.gender === 'female') {
        femaleSamples++;
        if (sampleFemaleHealthTerms) femaleHealthHits++;
      }

      const wealthPairKey = `${sample.birthInfo?.year}-${sample.birthInfo?.month}-${sample.birthInfo?.day}-${sample.birthInfo?.hour}`;
      const wealth = sample.topics?.wealth ?? '';
      const previousWealth = pendingWealthByBase.get(wealthPairKey);
      if (previousWealth && previousWealth.gender !== sample.birthInfo?.gender) {
        wealthPairsCompared++;
        if (previousWealth.wealth !== wealth) wealthPairsDifferent++;
        pendingWealthByBase.delete(wealthPairKey);
      } else {
        pendingWealthByBase.set(wealthPairKey, { gender: sample.birthInfo?.gender, wealth, label });
      }

      const allTopicText = REQUIRED_TOPIC_KEYS.map(keyName => sample.topics?.[keyName] ?? '').join('\n');
      WARNING_PHRASES.forEach(phrase => {
        if (allTopicText.includes(phrase)) warningPhraseHits[phrase]++;
      });

      REQUIRED_TOPIC_KEYS.forEach(keyName => {
        const len = (sample.topics?.[keyName] ?? '').length;
        topicLengthMin = Math.min(topicLengthMin, len);
        topicLengthMax = Math.max(topicLengthMax, len);
        topicLengthTotal += len;
        topicCount++;
      });

      const row: RandomAuditRow = {
        label,
        birth: `${sample.birthInfo?.year}-${String(sample.birthInfo?.month).padStart(2, '0')}-${String(sample.birthInfo?.day).padStart(2, '0')} h${sample.birthInfo?.hour} ${sample.birthInfo?.gender}`,
        dx0HasSihua: sampleDx0HasSihua,
        dx0HasStemIndex: sampleDx0HasStemIndex,
        palaceSelfFieldCount: palaceSelfFields,
        starIncomingFieldCount: starIncomingFields,
        overviewForbidden: sampleOverviewForbidden,
        healthTargetOrgan: sampleHealthTargetOrgan,
        femaleHealthTerms: sampleFemaleHealthTerms,
      };
      if (randomRows.length < 20) {
        randomRows.push(row);
      } else {
        const j = Math.floor(Math.random() * total);
        if (j < 20) randomRows[j] = row;
      }
    }

    shardLineCounts.set(rel, lineNo);
    if (lineNo !== EXPECTED_LINES_PER_SHARD) addFailure(`${rel} 行数不是 ${EXPECTED_LINES_PER_SHARD}，实际 ${lineNo}`);
  }

  const missingBirths: string[] = [];
  for (const year of EXPECTED_YEARS) {
    for (const month of EXPECTED_MONTHS) {
      for (const day of EXPECTED_DAYS) {
        for (const hour of EXPECTED_HOURS) {
          for (const gender of EXPECTED_GENDERS) {
            const key = `${year}-${month}-${day}-${hour}-${gender}`;
            if (!seenBirths.has(key)) missingBirths.push(key);
          }
        }
      }
    }
  }

  expect(total === EXPECTED_TOTAL, `总样本数不是 ${EXPECTED_TOTAL}，实际 ${total}`);
  expect(seenBirths.size === EXPECTED_TOTAL, `唯一出生组合数不是 ${EXPECTED_TOTAL}，实际 ${seenBirths.size}`);
  expect(duplicateBirths === 0, `重复出生组合数 ${duplicateBirths}`);
  expect(dx0HasSihua === 0, `daXians[0] 含 siHua 的样本数 ${dx0HasSihua}`);
  expect(anyDxHasSihua === 0, `任一大限含 siHua 的样本数 ${anyDxHasSihua}`);
  expect(dx0HasStemIndex === 0, `daXians[0] 含 stemIndex 的样本数 ${dx0HasStemIndex}`);
  expect(anyDxHasStemIndex === 0, `任一大限含 stemIndex 的样本数 ${anyDxHasStemIndex}`);
  expect(samplesWithPalaceSelfField === 0, `含 palace.selfSihua 的样本数 ${samplesWithPalaceSelfField}`);
  expect(samplesWithStarIncomingField === 0, `含 star.incomingSihua 的样本数 ${samplesWithStarIncomingField}`);
  expect(overviewForbiddenHits === 0, `overview 含 v3 禁用字眼样本数 ${overviewForbiddenHits}`);
  expect(femaleHealthHits === femaleSamples, `女命 health 缺少妇科/经期/孕产差异内容：${femaleSamples - femaleHealthHits}`);
  expect(wealthPairsCompared === EXPECTED_TOTAL / 2, `男女命 wealth 配对数不是 ${EXPECTED_TOTAL / 2}，实际 ${wealthPairsCompared}`);
  expect(wealthPairsDifferent === wealthPairsCompared, `男女命 wealth 完全相同的配对数 ${wealthPairsCompared - wealthPairsDifferent}`);
  if (missingBirths.length > 0) addFailure(`缺少出生组合：${missingBirths.slice(0, 20).join(', ')}${missingBirths.length > 20 ? ' ...' : ''}`);

  WARNING_PHRASES.forEach(phrase => {
    if (warningPhraseHits[phrase] === 0) addWarning(`全样本 topics 未出现警示语：${phrase}`);
  });

  const pct = (n: number, d = total) => d === 0 ? '0.00%' : `${(n * 100 / d).toFixed(2)}%`;
  const report = [
    '全样本 v3 审计报告',
    '='.repeat(72),
    `分片数：${files.length}/${EXPECTED_FILES}`,
    `样本总数：${total}/${EXPECTED_TOTAL}`,
    `唯一出生组合：${seenBirths.size}/${EXPECTED_TOTAL}`,
    `重复出生组合：${duplicateBirths}`,
    `缺失出生组合：${missingBirths.length}`,
    `每分片行数异常：${[...shardLineCounts].filter(([, count]) => count !== EXPECTED_LINES_PER_SHARD).length}`,
    `daXians[0] 含 siHua：${dx0HasSihua}/${total} (${pct(dx0HasSihua)})`,
    `任一 daXian 含 siHua：${anyDxHasSihua}/${total} (${pct(anyDxHasSihua)})`,
    `daXians[0] 含 stemIndex：${dx0HasStemIndex}/${total} (${pct(dx0HasStemIndex)})`,
    `任一 daXian 含 stemIndex：${anyDxHasStemIndex}/${total} (${pct(anyDxHasStemIndex)})`,
    `含 palace.selfSihua 的样本：${samplesWithPalaceSelfField}/${total} (${pct(samplesWithPalaceSelfField)})`,
    `palace.selfSihua 字段总数：${palaceSelfFieldTotal}`,
    `含 star.incomingSihua 的样本：${samplesWithStarIncomingField}/${total} (${pct(samplesWithStarIncomingField)})`,
    `star.incomingSihua 字段总数：${starIncomingFieldTotal}`,
    `overview 禁用字眼命中：${overviewForbiddenHits}/${total} (${pct(overviewForbiddenHits)})`,
    `health 含「肝/肾/脾胃」：${healthTargetOrganHits}/${total} (${pct(healthTargetOrganHits)})`,
    `health 含任一脏腑/经络词：${healthOrganHits}/${total} (${pct(healthOrganHits)})`,
    `health 含「子午流注」且含「经络」：${healthZiwuMeridianHits}/${total} (${pct(healthZiwuMeridianHits)})`,
    `女命 health 含「妇科/经期/孕产」：${femaleHealthHits}/${femaleSamples} (${pct(femaleHealthHits, femaleSamples)})`,
    `男女命 wealth 配对不同：${wealthPairsDifferent}/${wealthPairsCompared} (${pct(wealthPairsDifferent, wealthPairsCompared)})`,
    `topic 文本长度：min=${topicLengthMin}, max=${topicLengthMax}, avg=${(topicLengthTotal / Math.max(topicCount, 1)).toFixed(1)}`,
    '',
    '随机 20 条抽查：',
    ...randomRows.map((row, i) =>
      `${String(i + 1).padStart(2, '0')}. ${row.label} ${row.birth} | dx0.siHua=${row.dx0HasSihua ? 'FAIL' : 'OK'} | dx0.stemIndex=${row.dx0HasStemIndex ? 'FAIL' : 'OK'} | palace.selfSihua=${row.palaceSelfFieldCount} | star.incomingSihua=${row.starIncomingFieldCount} | overview禁词=${row.overviewForbidden ? 'FAIL' : 'OK'} | health肝肾脾胃=${row.healthTargetOrgan ? 'OK' : 'MISS'} | 女命健康=${row.femaleHealthTerms === null ? 'N/A' : row.femaleHealthTerms ? 'OK' : 'MISS'}`
    ),
    '',
    '12 条警示语在全样本 topics 中的命中样本数：',
    ...WARNING_PHRASES.map(phrase => `- ${phrase}: ${warningPhraseHits[phrase]}`),
    '',
    `失败数：${failures.length}`,
    `警告数：${warnings.length}`,
  ];

  if (failures.length > 0) {
    report.push('', '失败样例：', ...failures.map(x => `- ${x}`));
  }
  if (warnings.length > 0) {
    report.push('', '警告样例：', ...warnings.map(x => `- ${x}`));
  }

  console.log(report.join('\n'));
  fs.writeFileSync(path.join(root, 'full-samples-audit-report.txt'), `${report.join('\n')}\n`);

  if (failures.length > 0) process.exit(1);
}

await main();
