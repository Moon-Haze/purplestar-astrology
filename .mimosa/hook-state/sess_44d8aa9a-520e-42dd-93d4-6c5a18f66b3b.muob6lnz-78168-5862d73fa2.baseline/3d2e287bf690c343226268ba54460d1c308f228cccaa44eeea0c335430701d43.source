import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const catalogFile = path.join(root, 'data/nihaixia/registry/sources.catalog.jsonl');
const reportFile = path.join(root, 'data/nihaixia/reports/source-review-backlog.md');

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
  author_or_speaker?: string;
};

function readCatalog() {
  return fs.readFileSync(catalogFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as SourceRecord);
}

function topRows(rows: SourceRecord[], limit = 25) {
  return rows.slice(0, limit).map(row => (
    `- \`${row.source_id}\` | ${row.media_type} | ${row.platform} | ${row.title}`
  ));
}

function countBy(rows: SourceRecord[], key: keyof SourceRecord) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = String(row[key] ?? '');
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function main() {
  const rows = readCatalog();
  const needsLicense = rows
    .filter(row => row.human_review_status === 'needs_license')
    .sort(comparePriority);
  const blocked = rows
    .filter(row => row.risk_level === 'blocked' || row.rights_status === 'prohibited')
    .sort((a, b) => a.platform.localeCompare(b.platform) || a.source_id.localeCompare(b.source_id));
  const metadataOnly = rows
    .filter(row => row.rights_status === 'metadata_only' && row.human_review_status === 'pending')
    .sort(comparePriority);
  const primaryLike = rows
    .filter(row => row.author_or_speaker === '倪海厦' && row.human_review_status === 'needs_license')
    .sort(comparePriority);
  const secondHand = rows
    .filter(row => row.topic_tags.includes('study_note') || row.topic_tags.includes('case_study') || row.topic_tags.includes('bilibili_read'))
    .filter(row => row.author_or_speaker !== '倪海厦')
    .sort(comparePriority);

  const report = [
    '# 来源复核队列',
    '',
    `生成时间：${new Date().toISOString()}`,
    `来源总数：${rows.length}`,
    '',
    '## 总览',
    ...Object.entries(countBy(rows, 'human_review_status')).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## 优先授权队列',
    '',
    '这些来源最可能承载倪海厦本人课程/音视频/文字稿，但未授权前只能 metadata-only。',
    '',
    ...topRows(primaryLike, 40),
    '',
    '## 待授权全文/转写队列',
    '',
    ...topRows(needsLicense, 40),
    '',
    '## 二手笔记/案例队列',
    '',
    '这些来源只能作为人工标注和交叉核验线索，不能和倪师原话混作同级证据。',
    '',
    ...topRows(secondHand, 40),
    '',
    '## metadata-only 待人工核验队列',
    '',
    ...topRows(metadataOnly, 30),
    '',
    '## blocked 风险隔离队列',
    '',
    ...topRows(blocked, 40),
    '',
    '## 下一步动作',
    '',
    '- 对优先授权队列建立版权方/上传者联系状态表。',
    '- 对 Bilibili/音频平台只做 episode-level metadata，不抓字幕、不下载媒体。',
    '- 对二手笔记加专家审校层级，不直接进入原话证据。',
    '- 对 blocked 队列保持 do_not_store，不访问下载按钮、不抓附件。',
  ].join('\n');

  fs.writeFileSync(reportFile, `${report}\n`);
  console.log(report);
}

function comparePriority(a: SourceRecord, b: SourceRecord) {
  const score = (row: SourceRecord) => {
    let value = 0;
    if (row.author_or_speaker === '倪海厦') value -= 50;
    if (row.media_type === 'video' || row.media_type === 'audio') value -= 20;
    if (row.topic_tags.includes('transcript_candidate')) value -= 15;
    if (row.topic_tags.includes('sihua') || row.topic_tags.includes('huaji')) value -= 10;
    if (row.topic_tags.includes('health_mapping')) value -= 10;
    if (row.risk_level === 'high') value += 5;
    return value;
  };
  return score(a) - score(b) || a.platform.localeCompare(b.platform) || a.source_id.localeCompare(b.source_id);
}

main();
