import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const vaultDir = path.join(root, 'data/nihaixia/private-vault');
const sourceCatalogFile = path.join(vaultDir, 'registry/private-sources.catalog.jsonl');
const chunkFile = path.join(vaultDir, 'chunks/private-evidence-chunks.jsonl');
const reportFile = path.join(vaultDir, 'reports/private-vault-audit-report.md');

type PrivateSource = {
  source_id: string;
  title: string;
  original_path: string;
  relative_path: string;
  media_type: string;
  text_ingest_status: string;
  storage_scope: string;
  sha256: string;
  byte_size: number;
  chunk_count: number;
};

type PrivateChunk = {
  chunk_id: string;
  source_id: string;
  chunk_index: number;
  text: string;
  sha256: string;
  tags: string[];
};

const claimTags: Array<[string, string[]]> = [
  ['rule-daxian-sihua-palace-stem', ['daxian', 'sihua', 'palace_stem']],
  ['rule-flow-month-five-tiger', ['five_tiger', 'liu_yue']],
  ['rule-self-sihua-and-laiyin', ['self_sihua', 'laiyin']],
  ['rule-health-ziwu-liuzhu', ['health_mapping']],
  ['rule-22-patterns-complete', ['patterns']],
  ['rule-12-warning-quotes-exact', ['warning_phrase']],
];

const failures: string[] = [];
const warnings: string[] = [];

function readJsonl<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line) as T;
      } catch (err) {
        failures.push(`${path.relative(root, file)}:${index + 1} JSON.parse failed: ${(err as Error).message}`);
        return null as T | null;
      }
    })
    .filter(Boolean) as T[];
}

function main() {
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  const sources = readJsonl<PrivateSource>(sourceCatalogFile);
  const chunks = readJsonl<PrivateChunk>(chunkFile);
  const bySource = new Map(sources.map(source => [source.source_id, source]));
  const chunkCountBySource = new Map<string, number>();

  for (const source of sources) {
    if (source.storage_scope !== 'private_user_scope_only') {
      failures.push(`${source.source_id}: storage_scope must be private_user_scope_only`);
    }
    if (!fs.existsSync(source.original_path)) {
      warnings.push(`${source.source_id}: original file no longer exists: ${source.relative_path}`);
    }
    if (source.text_ingest_status === 'ingested' && source.chunk_count === 0) {
      failures.push(`${source.source_id}: ingested source has zero chunks`);
    }
  }

  const chunkIds = new Set<string>();
  for (const chunk of chunks) {
    if (chunkIds.has(chunk.chunk_id)) failures.push(`duplicate chunk_id: ${chunk.chunk_id}`);
    chunkIds.add(chunk.chunk_id);
    if (!bySource.has(chunk.source_id)) failures.push(`${chunk.chunk_id}: source_id not found: ${chunk.source_id}`);
    if (!chunk.text.trim()) failures.push(`${chunk.chunk_id}: empty text`);
    chunkCountBySource.set(chunk.source_id, (chunkCountBySource.get(chunk.source_id) ?? 0) + 1);
  }

  for (const source of sources) {
    const actual = chunkCountBySource.get(source.source_id) ?? 0;
    if (actual !== source.chunk_count) {
      failures.push(`${source.source_id}: chunk_count=${source.chunk_count}, actual=${actual}`);
    }
  }

  const claimCoverage = claimTags.map(([claimId, requiredTags]) => {
    const hits = chunks.filter(chunk => requiredTags.every(tag => chunk.tags.includes(tag))).length;
    return { claimId, hits };
  });

  const report = [
    '# 私有学习资料审计报告',
    '',
    `生成时间：${new Date().toISOString()}`,
    `私有来源数：${sources.length}`,
    `文本切片数：${chunks.length}`,
    `已导入文本来源：${sources.filter(source => source.text_ingest_status === 'ingested').length}`,
    `metadata-only/PDF/媒体来源：${sources.filter(source => source.text_ingest_status === 'unsupported_binary').length}`,
    '',
    '## Claim 标签覆盖',
    ...claimCoverage.map(row => `- ${row.claimId}: ${row.hits}`),
    '',
    `失败数：${failures.length}`,
    failures.length ? failures.map(item => `- ${item}`).join('\n') : '- 无',
    '',
    `警告数：${warnings.length}`,
    warnings.length ? warnings.map(item => `- ${item}`).join('\n') : '- 无',
    '',
    '## 审计结论',
    failures.length === 0
      ? '私有学习资料库结构通过。没有私有文件时表示导入管线就绪；放入 inbox 后可复跑生成证据切片。'
      : '私有学习资料库存在结构失败，需修复后再使用。',
  ].join('\n');

  fs.writeFileSync(reportFile, `${report}\n`);
  console.log(report);
  if (failures.length > 0) process.exit(1);
}

main();
