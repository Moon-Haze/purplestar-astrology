import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const catalogFile = path.join(root, 'data/nihaixia/registry/sources.catalog.jsonl');
const reportFile = path.join(root, 'data/nihaixia/reports/source-audit-report.md');
const blueprintFile = path.join(root, 'data/nihaixia/docs/EXECUTION_BLUEPRINT.md');
const rightsFile = path.join(root, 'data/nihaixia/docs/RIGHTS_POLICY.md');

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
  fetch_status?: number;
  fetched_title?: string;
};

const failures: string[] = [];
const warnings: string[] = [];

function fail(message: string) {
  failures.push(message);
}

function warn(message: string) {
  warnings.push(message);
}

function readCatalog(): SourceRecord[] {
  if (!fs.existsSync(catalogFile)) {
    fail(`缺少 catalog: ${path.relative(root, catalogFile)}`);
    return [];
  }
  return fs.readFileSync(catalogFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line) as SourceRecord;
      } catch (err) {
        fail(`catalog line ${index + 1} JSON.parse 失败：${(err as Error).message}`);
        return null as unknown as SourceRecord;
      }
    })
    .filter(Boolean);
}

function main() {
  const rows = readCatalog();
  const ids = new Set<string>();
  const urls = new Map<string, string[]>();

  rows.forEach(row => {
    if (ids.has(row.source_id)) fail(`重复 source_id: ${row.source_id}`);
    ids.add(row.source_id);

    if (!/^[a-z0-9][a-z0-9_-]+$/.test(row.source_id)) {
      fail(`${row.source_id}: source_id 不是小写 slug`);
    }
    try {
      const parsed = new URL(row.url);
      if (!['http:', 'https:', 'local:'].includes(parsed.protocol)) {
        fail(`${row.source_id}: URL 协议不允许：${parsed.protocol}`);
      }
      if (parsed.protocol !== 'local:' && row.platform !== 'local' && !parsed.hostname.includes(row.platform)) {
        warn(`${row.source_id}: platform=${row.platform} 与 hostname=${parsed.hostname} 不完全匹配`);
      }
    } catch {
      fail(`${row.source_id}: URL 无效：${row.url}`);
    }

    const list = urls.get(row.url) ?? [];
    list.push(row.source_id);
    urls.set(row.url, list);

    if (!row.collection_actions.includes('record_metadata')) {
      fail(`${row.source_id}: 缺 record_metadata`);
    }
    if (row.storage_policy !== 'fulltext_allowed' && !row.collection_actions.includes('do_not_store_fulltext')) {
      fail(`${row.source_id}: 非全文来源必须包含 do_not_store_fulltext`);
    }
    if (row.rights_status !== 'authorized_fulltext' && row.storage_policy === 'fulltext_allowed') {
      fail(`${row.source_id}: 未授权来源不能 fulltext_allowed`);
    }
    if (row.rights_status === 'unknown_needs_review') {
      if (row.human_review_status !== 'needs_license') {
        warn(`${row.source_id}: unknown_needs_review 建议 human_review_status=needs_license`);
      }
      if (!row.collection_actions.includes('manual_rights_review')) {
        fail(`${row.source_id}: unknown_needs_review 缺 manual_rights_review`);
      }
      if (!row.collection_actions.includes('request_license')) {
        fail(`${row.source_id}: unknown_needs_review 缺 request_license`);
      }
    }
    if ((row.media_type === 'video' || row.media_type === 'audio') && !row.collection_actions.includes('do_not_download_media')) {
      fail(`${row.source_id}: 音视频候选缺 do_not_download_media`);
    }
    if (row.risk_level === 'high' && row.storage_policy !== 'metadata_only') {
      fail(`${row.source_id}: high risk 来源只能 metadata_only`);
    }
    if (row.rights_status === 'prohibited') {
      if (row.storage_policy !== 'do_not_store') fail(`${row.source_id}: prohibited 来源必须 do_not_store`);
      if (row.human_review_status !== 'rejected') fail(`${row.source_id}: prohibited 来源必须 rejected`);
      if (row.risk_level !== 'blocked') fail(`${row.source_id}: prohibited 来源必须 blocked`);
    }
    if (row.fetch_status === 0) {
      warn(`${row.source_id}: 页面 title 抓取失败，需人工核验 URL`);
    }
    if (row.collection_actions.includes('fetch_public_page_title') && row.fetch_status !== undefined && row.fetch_status !== 0) {
      const ok = row.fetch_status >= 200 && row.fetch_status < 400;
      if (!ok && row.human_review_status !== 'rejected') {
        fail(`${row.source_id}: 自动 title 核验返回 HTTP ${row.fetch_status}，必须修正 URL、移除自动核验或标为 rejected/blocked`);
      }
    }
    if (row.fetched_title?.includes('视频去哪了') && row.human_review_status !== 'rejected') {
      fail(`${row.source_id}: Bilibili 不可用页面必须 rejected/blocked`);
    }
    if (row.media_type !== 'official_policy' && !['reference', 'background'].some(tag => row.topic_tags.includes(tag))) {
      const relevant = ['nihaixia', 'tianji', 'ziwei'].some(tag => row.topic_tags.includes(tag));
      if (!relevant) warn(`${row.source_id}: topic_tags 缺 nihaixia/tianji/ziwei 主题锚点`);
    }
  });

  [...urls.entries()]
    .filter(([, sourceIds]) => sourceIds.length > 1)
    .forEach(([url, sourceIds]) => warn(`URL 重复登记：${url} -> ${sourceIds.join(', ')}`));

  if (!fs.existsSync(blueprintFile)) fail('缺少 EXECUTION_BLUEPRINT.md');
  if (!fs.existsSync(rightsFile)) fail('缺少 RIGHTS_POLICY.md');

  const byRights = countBy(rows, 'rights_status');
  const byRisk = countBy(rows, 'risk_level');
  const byMedia = countBy(rows, 'media_type');
  const byReview = countBy(rows, 'human_review_status');
  const titleFetchAttempted = rows.filter(row => row.collection_actions.includes('fetch_public_page_title')).length;
  const titleFetchOk = rows.filter(row => row.collection_actions.includes('fetch_public_page_title') && row.fetch_status && row.fetch_status >= 200 && row.fetch_status < 400).length;
  const titleFetchRejected = rows.filter(row => row.collection_actions.includes('fetch_public_page_title') && row.fetch_status && (row.fetch_status < 200 || row.fetch_status >= 400) && row.human_review_status === 'rejected').length;
  const blockedForTraining = rows.filter(row => row.storage_policy !== 'fulltext_allowed').length;
  const fulltextEligible = rows.filter(row => row.storage_policy === 'fulltext_allowed').length;

  const report = [
    '# 倪海厦来源审计报告',
    '',
    `生成时间：${new Date().toISOString()}`,
    `来源总数：${rows.length}`,
    `可全文入库：${fulltextEligible}`,
    `不可全文入库/仅 metadata：${blockedForTraining}`,
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
    '## 人工复核状态',
    ...Object.entries(byReview).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## 自动 title 核验',
    `- 尝试抓取：${titleFetchAttempted}`,
    `- HTTP 成功：${titleFetchOk}`,
    `- 非 2xx/3xx 且已 rejected：${titleFetchRejected}`,
    '',
    `失败数：${failures.length}`,
    failures.length > 0 ? failures.map(x => `- ${x}`).join('\n') : '- 无',
    '',
    `警告数：${warnings.length}`,
    warnings.length > 0 ? warnings.map(x => `- ${x}`).join('\n') : '- 无',
    '',
    '## 审计结论',
    failures.length === 0
      ? '来源登记结构通过。当前只有内部约束文件可全文入库；第三方公开候选资料默认仅 metadata，不进入训练/RAG 全文库。'
      : '存在硬失败，禁止进入后续资料处理阶段。',
  ].join('\n');

  fs.writeFileSync(reportFile, `${report}\n`);
  console.log(report);
  if (failures.length > 0) process.exit(1);
}

function countBy(rows: SourceRecord[], key: keyof SourceRecord) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = String(row[key] ?? '');
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

main();
