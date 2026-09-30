import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const catalogFile = path.join(root, 'data/nihaixia/registry/sources.catalog.jsonl');
const reportFile = path.join(root, 'data/nihaixia/reports/source-coverage-report.md');

type SourceRecord = {
  source_id: string;
  platform: string;
  media_type: string;
  topic_tags: string[];
  rights_status: string;
  storage_policy: string;
  human_review_status: string;
  risk_level: string;
};

function readCatalog() {
  return fs.readFileSync(catalogFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as SourceRecord);
}

function countBy(rows: SourceRecord[], picker: (row: SourceRecord) => string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = picker(row);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function topEntries(counts: Record<string, number>, limit = 30) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function yesNo(condition: boolean) {
  return condition ? 'yes' : 'no';
}

function main() {
  const rows = readCatalog();
  const byPlatform = countBy(rows, row => row.platform);
  const byMedia = countBy(rows, row => row.media_type);
  const byRisk = countBy(rows, row => row.risk_level);
  const byRights = countBy(rows, row => row.rights_status);
  const byReview = countBy(rows, row => row.human_review_status);
  const byTag = rows.reduce<Record<string, number>>((acc, row) => {
    for (const tag of row.topic_tags) acc[tag] = (acc[tag] ?? 0) + 1;
    return acc;
  }, {});

  const hasVideo = rows.some(row => row.media_type === 'video');
  const hasAudio = rows.some(row => row.media_type === 'audio');
  const hasArticle = rows.some(row => row.media_type === 'article');
  const hasPdf = rows.some(row => row.media_type === 'pdf' || row.topic_tags.includes('pdf_candidate'));
  const hasBlocked = rows.some(row => row.risk_level === 'blocked');
  const hasInternalAuthority = rows.some(row => row.rights_status === 'authorized_fulltext');
  const platforms = Object.keys(byPlatform).length;
  const fulltextAllowed = rows.filter(row => row.storage_policy === 'fulltext_allowed').length;
  const blocked = rows.filter(row => row.risk_level === 'blocked').length;

  const report = [
    '# 倪海厦来源覆盖报告',
    '',
    `生成时间：${new Date().toISOString()}`,
    `来源总数：${rows.length}`,
    `平台数：${platforms}`,
    `可全文入库：${fulltextAllowed}`,
    `blocked/rejected 风险来源：${blocked}`,
    '',
    '## 覆盖检查',
    `- 视频候选：${yesNo(hasVideo)}`,
    `- 音频候选：${yesNo(hasAudio)}`,
    `- 文字/文章候选：${yesNo(hasArticle)}`,
    `- PDF/讲义候选：${yesNo(hasPdf)}`,
    `- 风险来源显式 blocked：${yesNo(hasBlocked)}`,
    `- 内部授权规则源：${yesNo(hasInternalAuthority)}`,
    '',
    '## 媒介类型',
    ...topEntries(byMedia).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## 风险等级',
    ...topEntries(byRisk).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## 权利状态',
    ...topEntries(byRights).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## 人工复核状态',
    ...topEntries(byReview).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## 平台分布 Top 30',
    ...topEntries(byPlatform, 30).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## 主题标签 Top 40',
    ...topEntries(byTag, 40).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## 下一轮优先补强',
    '- 原始授权源：需要授权文件、版权所有人许可或明确开放许可，才能进入全文/RAG。',
    '- 目录化：对已登记的视频/音频合集建立 episode-level metadata，但仍不下载媒体。',
    '- 专家审校：把二手学习笔记与倪师原话分层，避免混作同等证据。',
    '- OCR/转写：只在授权后处理 PDF、字幕、音频转写。',
  ].join('\n');

  fs.writeFileSync(reportFile, `${report}\n`);
  console.log(report);
}

main();
