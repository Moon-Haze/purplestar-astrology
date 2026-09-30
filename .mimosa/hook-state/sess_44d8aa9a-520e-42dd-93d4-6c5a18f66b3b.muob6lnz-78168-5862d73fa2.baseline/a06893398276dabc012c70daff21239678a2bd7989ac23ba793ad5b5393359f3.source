import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const seedFile = path.join(root, 'data/nihaixia/seed/seed-sources.json');
const outDir = path.join(root, 'data/nihaixia/registry');
const reportDir = path.join(root, 'data/nihaixia/reports');
const outFile = path.join(outDir, 'sources.catalog.jsonl');
const reportFile = path.join(reportDir, 'source-collection-report.md');

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
  published_at?: string;
  discovered_at: string;
  discovered_via?: string;
  notes?: string;
  fetch_status?: number;
  fetched_title?: string;
  content_type?: string;
  checked_at?: string;
};

const requiredFields = [
  'source_id', 'title', 'url', 'platform', 'media_type', 'topic_tags',
  'rights_status', 'storage_policy', 'collection_actions',
  'human_review_status', 'risk_level', 'discovered_at',
];

const htmlTitleRe = /<title[^>]*>([\s\S]*?)<\/title>/i;

function decodeHtml(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPublicTitle(source: SourceRecord): Promise<Partial<SourceRecord>> {
  if (!source.url.startsWith('http')) return {};
  if (!source.collection_actions.includes('fetch_public_page_title')) return {};

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(source.url, {
      headers: {
        'user-agent': 'ziwei-samples-toolkit-source-registry/1.0 metadata-only',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.1',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    const contentType = res.headers.get('content-type') ?? '';
    let fetchedTitle = '';

    if (contentType.includes('text/html')) {
      const body = await res.text();
      const match = body.match(htmlTitleRe);
      if (match?.[1]) fetchedTitle = decodeHtml(match[1]);
    }

    return {
      fetch_status: res.status,
      content_type: contentType,
      fetched_title: fetchedTitle,
    };
  } catch (err) {
    return {
      fetch_status: 0,
      content_type: '',
      fetched_title: `FETCH_ERROR: ${(err as Error).message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function validateSource(source: SourceRecord, index: number): string[] {
  const errors: string[] = [];
  requiredFields.forEach(field => {
    if ((source as any)[field] === undefined || (source as any)[field] === '') {
      errors.push(`seed[${index}] missing ${field}`);
    }
  });

  if (source.rights_status !== 'authorized_fulltext' && source.storage_policy === 'fulltext_allowed') {
    errors.push(`${source.source_id} fulltext_allowed requires authorized_fulltext`);
  }
  if (source.rights_status === 'unknown_needs_review' && !source.collection_actions.includes('manual_rights_review')) {
    errors.push(`${source.source_id} unknown rights requires manual_rights_review`);
  }
  if ((source.media_type === 'video' || source.media_type === 'audio') && !source.collection_actions.includes('do_not_download_media')) {
    errors.push(`${source.source_id} media source must include do_not_download_media unless authorized`);
  }

  return errors;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(reportDir, { recursive: true });

  const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8')) as SourceRecord[];
  const validationErrors = seed.flatMap((source, index) => validateSource(source, index));
  const now = new Date().toISOString();
  const catalog: SourceRecord[] = [];

  for (const source of seed) {
    const fetched = await fetchPublicTitle(source);
    catalog.push({
      ...source,
      ...fetched,
      checked_at: now,
    });
  }

  fs.writeFileSync(outFile, catalog.map(row => JSON.stringify(row)).join('\n') + '\n');

  const byRights = countBy(catalog, 'rights_status');
  const byRisk = countBy(catalog, 'risk_level');
  const byMedia = countBy(catalog, 'media_type');

  const report = [
    '# 倪海厦来源采集报告',
    '',
    `生成时间：${now}`,
    `种子来源数：${seed.length}`,
    `输出目录：${path.relative(root, outFile)}`,
    '',
    '## 权利状态',
    ...Object.entries(byRights).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## 风险等级',
    ...Object.entries(byRisk).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## 媒介类型',
    ...Object.entries(byMedia).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## 校验错误',
    validationErrors.length > 0 ? validationErrors.map(x => `- ${x}`).join('\n') : '- 无',
    '',
    '## 采集边界',
    '- 本脚本只保存 metadata、状态码、content-type、页面 title。',
    '- 未保存网页正文、字幕、音视频或 PDF 全文。',
    '- `unknown_needs_review` 和 `metadata_only` 来源不得进入训练/RAG 全文库。',
  ].join('\n');

  fs.writeFileSync(reportFile, `${report}\n`);
  console.log(report);

  if (validationErrors.length > 0) process.exit(1);
}

function countBy(rows: SourceRecord[], key: keyof SourceRecord) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = String(row[key] ?? '');
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

await main();

