import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const catalogFile = path.join(root, 'data/nihaixia/registry/sources.catalog.jsonl');
const reportDir = path.join(root, 'data/nihaixia/reports');
const mdFile = path.join(reportDir, 'license-contact-backlog.md');
const csvFile = path.join(reportDir, 'license-contact-backlog.csv');

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
};

type ContactRow = {
  source_id: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  platform: string;
  media_type: string;
  title: string;
  url: string;
  publisher: string;
  author_or_speaker: string;
  requested_rights: string;
  contact_owner: string;
  contact_status: string;
  notes: string;
};

function readCatalog() {
  return fs.readFileSync(catalogFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as SourceRecord);
}

function priority(row: SourceRecord): ContactRow['priority'] {
  if (row.author_or_speaker === '倪海厦' && (row.media_type === 'video' || row.media_type === 'audio')) return 'P0';
  if (row.author_or_speaker === '倪海厦' && row.topic_tags.includes('transcript_candidate')) return 'P0';
  if (row.author_or_speaker === '倪海厦') return 'P1';
  if (row.topic_tags.includes('sihua') || row.topic_tags.includes('huaji') || row.topic_tags.includes('health_mapping')) return 'P1';
  if (row.topic_tags.includes('case_study') || row.topic_tags.includes('bilibili_read')) return 'P2';
  return 'P3';
}

function requestedRights(row: SourceRecord) {
  if (row.media_type === 'video' || row.media_type === 'audio') {
    return 'metadata + citation + manual transcript permission + excerpt display permission';
  }
  if (row.media_type === 'pdf' || row.topic_tags.includes('pdf_candidate')) {
    return 'metadata + OCR/text extraction permission + excerpt display permission';
  }
  return 'metadata + fulltext ingest permission + excerpt display permission';
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function main() {
  fs.mkdirSync(reportDir, { recursive: true });
  const rows = readCatalog()
    .filter(row => row.human_review_status === 'needs_license')
    .filter(row => row.risk_level !== 'blocked' && row.rights_status !== 'prohibited')
    .map<ContactRow>(row => ({
      source_id: row.source_id,
      priority: priority(row),
      platform: row.platform,
      media_type: row.media_type,
      title: row.title,
      url: row.url,
      publisher: row.publisher ?? '',
      author_or_speaker: row.author_or_speaker ?? '',
      requested_rights: requestedRights(row),
      contact_owner: 'unassigned',
      contact_status: 'not_started',
      notes: row.storage_policy === 'metadata_only'
        ? 'Do not ingest fulltext/media before permission.'
        : 'Review rights before use.',
    }))
    .sort((a, b) => a.priority.localeCompare(b.priority) || a.platform.localeCompare(b.platform) || a.source_id.localeCompare(b.source_id));

  const csvHeader = Object.keys(rows[0] ?? {
    source_id: '', priority: '', platform: '', media_type: '', title: '', url: '', publisher: '',
    author_or_speaker: '', requested_rights: '', contact_owner: '', contact_status: '', notes: '',
  });
  const csv = [
    csvHeader.join(','),
    ...rows.map(row => csvHeader.map(key => csvEscape(String(row[key as keyof ContactRow] ?? ''))).join(',')),
  ].join('\n');
  fs.writeFileSync(csvFile, `${csv}\n`);

  const byPriority = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.priority] = (acc[row.priority] ?? 0) + 1;
    return acc;
  }, {});

  const md = [
    '# 授权联系待办表',
    '',
    `生成时间：${new Date().toISOString()}`,
    `待授权来源：${rows.length}`,
    '',
    '## 优先级统计',
    ...['P0', 'P1', 'P2', 'P3'].map(key => `- ${key}: ${byPriority[key] ?? 0}`),
    '',
    '## 字段说明',
    '',
    '- `P0`：最优先，倪海厦本人音视频/音频/文字稿候选。',
    '- `P1`：核心规则主题，如四化、化忌、疾厄脏腑映射。',
    '- `P2`：案例、Bilibili 专栏、二手学习笔记。',
    '- `P3`：通用参考或边界资料。',
    '',
    '## 输出',
    '',
    `- CSV：\`${path.relative(root, csvFile)}\``,
    '',
    '## P0 样例',
    '',
    ...rows.filter(row => row.priority === 'P0').slice(0, 30).map(row => (
      `- \`${row.source_id}\` | ${row.platform} | ${row.media_type} | ${row.title}`
    )),
  ].join('\n');
  fs.writeFileSync(mdFile, `${md}\n`);
  console.log(md);
}

main();
