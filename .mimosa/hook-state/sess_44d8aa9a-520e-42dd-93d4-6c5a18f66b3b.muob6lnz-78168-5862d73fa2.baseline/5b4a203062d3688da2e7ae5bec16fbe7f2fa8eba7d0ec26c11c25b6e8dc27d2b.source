import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const catalogFile = path.join(root, 'data/nihaixia/registry/sources.catalog.jsonl');
const reportDir = path.join(root, 'data/nihaixia/reports');
const outFile = path.join(reportDir, 'license-outreach-drafts.md');

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

function readCatalog() {
  return fs.readFileSync(catalogFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as SourceRecord);
}

function isPriority(row: SourceRecord) {
  if (row.risk_level === 'blocked' || row.rights_status === 'prohibited') return false;
  if (row.human_review_status !== 'needs_license') return false;
  if (row.author_or_speaker === '倪海厦') return true;
  return row.topic_tags.some(tag => ['sihua', 'huaji', 'health_mapping', 'da_xian', 'liu_nian', 'liu_yue'].includes(tag));
}

function requestedRights(row: SourceRecord) {
  if (row.media_type === 'video' || row.media_type === 'audio') {
    return '引用 metadata、人工转写/校对、建立短摘录证据片段、在产品中展示不超过授权范围的引用。';
  }
  if (row.media_type === 'pdf') {
    return 'OCR/文本提取、建立短摘录证据片段、在产品中展示不超过授权范围的引用。';
  }
  return '全文入库、建立短摘录证据片段、在产品中展示不超过授权范围的引用。';
}

function template(row: SourceRecord) {
  return [
    `### ${row.source_id}`,
    '',
    `- 平台：${row.platform}`,
    `- 标题：${row.title}`,
    `- URL：${row.url}`,
    `- 媒介：${row.media_type}`,
    `- 申请范围：${requestedRights(row)}`,
    '',
    '```text',
    '您好，',
    '',
    `我们正在建设“倪海厦紫微斗数体系”的资料证据库，看到贵方页面/作品《${row.title}》与倪海厦《天纪》体系研究相关。`,
    '',
    '我们希望在明确授权范围内使用该资料，用途包括：',
    '1. 建立来源 metadata 与引用链接；',
    '2. 在授权范围内进行人工转写、OCR 或文本整理；',
    '3. 将短摘录片段绑定到具体紫微斗数规则，作为可追溯证据；',
    '4. 在产品中展示来源引用，不进行未授权转载或分发原始音视频/PDF。',
    '',
    `本次拟申请范围：${requestedRights(row)}`,
    '',
    '如您是版权方或授权代表，烦请确认可授权范围、署名方式、是否允许商业使用、是否允许 RAG/检索增强使用，以及是否有费用或其他条件。',
    '',
    '在取得明确授权前，我们只保留公开 metadata，不下载音视频、不保存全文、不抓取字幕、不进入训练或 RAG 语料。',
    '',
    '谢谢。',
    '```',
  ].join('\n');
}

function main() {
  fs.mkdirSync(reportDir, { recursive: true });
  const rows = readCatalog()
    .filter(isPriority)
    .sort((a, b) => {
      const aNi = a.author_or_speaker === '倪海厦' ? 0 : 1;
      const bNi = b.author_or_speaker === '倪海厦' ? 0 : 1;
      return aNi - bNi || a.platform.localeCompare(b.platform) || a.source_id.localeCompare(b.source_id);
    });

  const report = [
    '# 授权请求草稿',
    '',
    `生成时间：${new Date().toISOString()}`,
    `草稿数量：${rows.length}`,
    '',
    '## 使用原则',
    '',
    '- 未授权前只保留 metadata。',
    '- 不下载音视频，不保存字幕全文，不转存 PDF/网页全文。',
    '- 授权必须记录版权方、授权范围、署名方式、期限和证明文件路径。',
    '',
    ...rows.slice(0, 60).map(template),
    '',
  ].join('\n');

  fs.writeFileSync(outFile, report);
  console.log(report.split('\n').slice(0, 80).join('\n'));
  if (rows.length > 60) console.log(`\n... 已写入 ${rows.length} 条草稿，终端仅预览前 60 条。`);
}

main();
