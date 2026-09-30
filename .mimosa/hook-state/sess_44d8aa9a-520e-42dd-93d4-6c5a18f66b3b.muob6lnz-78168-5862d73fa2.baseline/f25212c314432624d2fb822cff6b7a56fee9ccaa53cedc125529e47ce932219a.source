import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const seedDir = path.join(root, 'data/nihaixia/seed');
const seedFile = path.join(root, 'data/nihaixia/seed/seed-sources.json');
const queryFile = path.join(root, 'data/nihaixia/seed/source-search-queries.json');

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
};

type SearchQuery = {
  query_id: string;
  query: string;
};

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function candidateFiles() {
  return fs.readdirSync(seedDir)
    .filter(file => /^discovered-source-candidates(?:-[a-z0-9-]+)?\.json$/.test(file))
    .sort()
    .map(file => path.join(seedDir, file));
}

function normalizeUrl(url: string) {
  return url.replace(/\/$/, '');
}

function validateRecord(record: SourceRecord) {
  const errors: string[] = [];

  if (!/^[a-z0-9][a-z0-9_-]+$/.test(record.source_id)) {
    errors.push(`${record.source_id}: source_id must be lowercase slug`);
  }
  try {
    const parsed = new URL(record.url);
    if (!['http:', 'https:', 'local:'].includes(parsed.protocol)) {
      errors.push(`${record.source_id}: unsupported URL protocol ${parsed.protocol}`);
    }
  } catch {
    errors.push(`${record.source_id}: invalid URL ${record.url}`);
  }
  if (record.rights_status !== 'authorized_fulltext' && record.storage_policy === 'fulltext_allowed') {
    errors.push(`${record.source_id}: fulltext_allowed requires authorized_fulltext`);
  }
  if (record.rights_status === 'unknown_needs_review' && !record.collection_actions.includes('manual_rights_review')) {
    errors.push(`${record.source_id}: unknown rights requires manual_rights_review`);
  }
  if ((record.media_type === 'video' || record.media_type === 'audio') && !record.collection_actions.includes('do_not_download_media')) {
    errors.push(`${record.source_id}: media source requires do_not_download_media`);
  }
  if (record.storage_policy !== 'fulltext_allowed' && !record.collection_actions.includes('do_not_store_fulltext')) {
    errors.push(`${record.source_id}: metadata/private/prohibited source requires do_not_store_fulltext`);
  }
  if (record.risk_level === 'blocked' && record.rights_status !== 'prohibited') {
    errors.push(`${record.source_id}: blocked risk requires prohibited rights_status`);
  }

  return errors;
}

function main() {
  const seed = readJson<SourceRecord[]>(seedFile);
  const files = candidateFiles();
  const candidates = files.flatMap(file => readJson<SourceRecord[]>(file));
  const queries = readJson<SearchQuery[]>(queryFile);
  const queryIds = new Set(queries.map(query => query.query_id));
  const errors = candidates.flatMap(validateRecord);

  for (const candidate of candidates) {
    const via = candidate.discovered_via ?? '';
    const queryId = via.includes(':') ? via.split(':').at(-1) : '';
    if (queryId && queryId.startsWith('q-') && !queryIds.has(queryId)) {
      errors.push(`${candidate.source_id}: discovered_via references missing query ${queryId}`);
    }
  }

  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exit(1);
  }

  const byId = new Map(seed.map(source => [source.source_id, source]));
  const byUrl = new Map(seed.map(source => [normalizeUrl(source.url), source]));
  const added: SourceRecord[] = [];
  const skipped: string[] = [];

  for (const candidate of candidates) {
    if (byId.has(candidate.source_id)) {
      skipped.push(`${candidate.source_id}: duplicate source_id`);
      continue;
    }

    const existingUrl = byUrl.get(normalizeUrl(candidate.url));
    if (existingUrl) {
      skipped.push(`${candidate.source_id}: duplicate url already used by ${existingUrl.source_id}`);
      continue;
    }

    seed.push(candidate);
    byId.set(candidate.source_id, candidate);
    byUrl.set(normalizeUrl(candidate.url), candidate);
    added.push(candidate);
  }

  fs.writeFileSync(seedFile, `${JSON.stringify(seed, null, 2)}\n`);

  console.log(`候选批次：${files.map(file => path.relative(seedDir, file)).join(', ')}`);
  console.log(`候选来源：${candidates.length}`);
  console.log(`新增来源：${added.length}`);
  console.log(`跳过来源：${skipped.length}`);
  if (skipped.length > 0) {
    console.log(skipped.map(item => `- ${item}`).join('\n'));
  }
  console.log(`seed 总数：${seed.length}`);
}

main();
