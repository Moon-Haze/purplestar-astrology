import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const catalogFile = path.join(root, 'data/nihaixia/registry/sources.catalog.jsonl');
const reportDir = path.join(root, 'data/nihaixia/reports');
const mdFile = path.join(reportDir, 'source-quality-scorecard.md');
const csvFile = path.join(reportDir, 'source-quality-scorecard.csv');

type SourceRecord = {
  source_id: string;
  title: string;
  url: string;
  platform: string;
  media_type: string;
  topic_tags: string[];
  rights_status: string;
  storage_policy: string;
  collection_actions: string[];
  human_review_status: string;
  risk_level: string;
  publisher?: string;
  author_or_speaker?: string;
  fetch_status?: number;
  fetched_title?: string;
};

type ScoreRow = {
  source_id: string;
  score: number;
  tier: 'A' | 'B' | 'C' | 'D' | 'BLOCKED';
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'BLOCKED';
  platform: string;
  media_type: string;
  title: string;
  rights_status: string;
  risk_level: string;
  reason: string;
  url: string;
};

const coreRuleTags = new Set([
  'sihua',
  'huaji',
  'health_mapping',
  'da_xian',
  'liu_nian',
  'liu_yue',
  'ziwu_liuzhu',
  'case_study',
  'san_fang_si_zheng',
  'ziwei_star',
]);

function readCatalog() {
  return fs.readFileSync(catalogFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as SourceRecord);
}

function hasAny(row: SourceRecord, tags: Iterable<string>) {
  for (const tag of tags) {
    if (row.topic_tags.includes(tag)) return true;
  }
  return false;
}

function priority(row: SourceRecord): ScoreRow['priority'] {
  if (row.risk_level === 'blocked' || row.rights_status === 'prohibited') return 'BLOCKED';
  if (row.author_or_speaker === '倪海厦' && ['video', 'audio'].includes(row.media_type)) return 'P0';
  if (row.author_or_speaker === '倪海厦' && row.topic_tags.includes('transcript_candidate')) return 'P0';
  if (row.author_or_speaker === '倪海厦') return 'P1';
  if (hasAny(row, coreRuleTags)) return 'P1';
  if (row.topic_tags.includes('study_note') || row.topic_tags.includes('bilibili_read')) return 'P2';
  return 'P3';
}

function score(row: SourceRecord): ScoreRow {
  if (row.risk_level === 'blocked' || row.rights_status === 'prohibited') {
    return {
      source_id: row.source_id,
      score: 0,
      tier: 'BLOCKED',
      priority: 'BLOCKED',
      platform: row.platform,
      media_type: row.media_type,
      title: row.title,
      rights_status: row.rights_status,
      risk_level: row.risk_level,
      reason: 'blocked/prohibited source, kept only to prevent accidental ingestion',
      url: row.url,
    };
  }

  const reasons: string[] = [];
  let value = 0;

  if (row.author_or_speaker === '倪海厦') {
    value += 25;
    reasons.push('倪海厦本人');
  }
  if (row.topic_tags.includes('tianji')) {
    value += 15;
    reasons.push('天纪');
  }
  if (row.topic_tags.includes('ziwei')) {
    value += 15;
    reasons.push('紫微斗数');
  }
  if (hasAny(row, coreRuleTags)) {
    value += 15;
    reasons.push('核心规则/案例');
  }
  if (row.media_type === 'video' || row.media_type === 'audio') {
    value += 10;
    reasons.push('原始音视频候选');
  } else if (row.media_type === 'article' || row.media_type === 'pdf') {
    value += 8;
    reasons.push('文本/讲义候选');
  } else if (row.media_type === 'official_policy') {
    value += 8;
    reasons.push('权利/政策参考');
  }
  if (row.collection_actions.includes('request_license')) {
    value += 8;
    reasons.push('已进入授权队列');
  }
  if (row.fetch_status !== undefined && row.fetch_status >= 200 && row.fetch_status < 400) {
    value += 5;
    reasons.push('URL title 可核验');
  }
  if (row.rights_status === 'authorized_fulltext') {
    value += 20;
    reasons.push('已授权全文');
  } else if (row.rights_status === 'metadata_only') {
    value += 3;
    reasons.push('metadata-only');
  }

  if (row.risk_level === 'high') value -= 12;
  if (row.risk_level === 'medium') value -= 5;
  if (row.author_or_speaker !== '倪海厦' && row.topic_tags.includes('not_nihaixia_primary')) value -= 12;

  const normalized = Math.max(0, Math.min(100, value));
  const tier: ScoreRow['tier'] = normalized >= 70 ? 'A' : normalized >= 50 ? 'B' : normalized >= 25 ? 'C' : 'D';

  return {
    source_id: row.source_id,
    score: normalized,
    tier,
    priority: priority(row),
    platform: row.platform,
    media_type: row.media_type,
    title: row.title,
    rights_status: row.rights_status,
    risk_level: row.risk_level,
    reason: reasons.join('; ') || 'low-context reference',
    url: row.url,
  };
}

function countBy<T extends string>(rows: ScoreRow[], picker: (row: ScoreRow) => T) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = picker(row);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function csvEscape(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function main() {
  fs.mkdirSync(reportDir, { recursive: true });
  const rows = readCatalog();
  const scored = rows.map(score).sort((a, b) => b.score - a.score || a.priority.localeCompare(b.priority) || a.source_id.localeCompare(b.source_id));
  const byTier = countBy(scored, row => row.tier);
  const byPriority = countBy(scored, row => row.priority);
  const platforms = new Set(rows.map(row => row.platform)).size;
  const p0p1 = scored.filter(row => row.priority === 'P0' || row.priority === 'P1');
  const aTier = scored.filter(row => row.tier === 'A');
  const authorized = rows.filter(row => row.rights_status === 'authorized_fulltext').length;
  const blocked = rows.filter(row => row.risk_level === 'blocked').length;

  const headers = ['source_id', 'score', 'tier', 'priority', 'platform', 'media_type', 'title', 'rights_status', 'risk_level', 'reason', 'url'] as const;
  const csv = [
    headers.join(','),
    ...scored.map(row => headers.map(key => csvEscape(row[key])).join(',')),
  ].join('\n');
  fs.writeFileSync(csvFile, `${csv}\n`);

  const report = [
    '# 来源质量评分卡',
    '',
    `生成时间：${new Date().toISOString()}`,
    `来源总数：${rows.length}`,
    `平台数：${platforms}`,
    `P0/P1 高优先级来源：${p0p1.length}`,
    `A 档证据候选：${aTier.length}`,
    `已授权全文来源：${authorized}`,
    `blocked 隔离来源：${blocked}`,
    '',
    '## 评分说明',
    '',
    '- 分数衡量“成为证据链候选”的优先级，不代表已经授权。',
    '- A/B/C/D 用于排序授权、审校和后续转写，不改变 `rights_status`。',
    '- blocked/prohibited 来源计 0 分，只保留为风险隔离记录。',
    '',
    '## Tier 统计',
    ...['A', 'B', 'C', 'D', 'BLOCKED'].map(key => `- ${key}: ${byTier[key] ?? 0}`),
    '',
    '## Priority 统计',
    ...['P0', 'P1', 'P2', 'P3', 'BLOCKED'].map(key => `- ${key}: ${byPriority[key] ?? 0}`),
    '',
    '## Top 40 证据候选',
    ...scored.slice(0, 40).map(row => (
      `- ${row.score} | ${row.tier} | ${row.priority} | \`${row.source_id}\` | ${row.platform} | ${row.media_type} | ${row.title}`
    )),
    '',
    '## 输出',
    '',
    `- CSV：\`${path.relative(root, csvFile)}\``,
  ].join('\n');

  fs.writeFileSync(mdFile, `${report}\n`);
  console.log(report);
}

main();
