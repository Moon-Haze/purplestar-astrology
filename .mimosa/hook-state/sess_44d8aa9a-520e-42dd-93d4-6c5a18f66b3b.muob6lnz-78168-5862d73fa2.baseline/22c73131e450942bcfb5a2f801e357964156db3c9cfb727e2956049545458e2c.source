import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const catalogFile = path.join(root, 'data/nihaixia/registry/sources.catalog.jsonl');
const evidenceFile = path.join(root, 'data/nihaixia/evidence/constraint-evidence-map.json');
const reportFile = path.join(root, 'data/nihaixia/reports/evidence-audit-report.md');

const requiredClaims = [
  'rule-daxian-sihua-palace-stem',
  'rule-flow-month-five-tiger',
  'rule-self-sihua-and-laiyin',
  'rule-health-ziwu-liuzhu',
  'rule-22-patterns-complete',
  'rule-12-warning-quotes-exact',
];

type CatalogRow = {
  source_id: string;
  rights_status: string;
  storage_policy: string;
  human_review_status: string;
};

type EvidenceSource = {
  source_id: string;
  role: string;
  path?: string;
  rights_gate?: string;
};

type EvidenceClaim = {
  claim_id: string;
  claim: string;
  implementation_status: string;
  primary_sources: EvidenceSource[];
  candidate_external_sources: EvidenceSource[];
  verification_commands: string[];
};

type EvidenceMap = {
  version: string;
  generated_at: string;
  claims: EvidenceClaim[];
};

const failures: string[] = [];
const warnings: string[] = [];

function fail(message: string) {
  failures.push(message);
}

function warn(message: string) {
  warnings.push(message);
}

function readCatalog() {
  return fs.readFileSync(catalogFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as CatalogRow);
}

function main() {
  const catalog = readCatalog();
  const bySourceId = new Map(catalog.map(row => [row.source_id, row]));
  const evidence = JSON.parse(fs.readFileSync(evidenceFile, 'utf8')) as EvidenceMap;
  const claimIds = new Set(evidence.claims.map(claim => claim.claim_id));

  for (const claimId of requiredClaims) {
    if (!claimIds.has(claimId)) fail(`缺少必审 claim: ${claimId}`);
  }

  const duplicateClaims = evidence.claims
    .map(claim => claim.claim_id)
    .filter((claimId, index, all) => all.indexOf(claimId) !== index);
  for (const claimId of duplicateClaims) fail(`重复 claim_id: ${claimId}`);

  for (const claim of evidence.claims) {
    if (!claim.primary_sources.some(source => source.source_id === 'internal-nihaixia-constraints')) {
      fail(`${claim.claim_id}: 缺 internal-nihaixia-constraints`);
    }
    if (claim.verification_commands.length === 0) {
      fail(`${claim.claim_id}: 缺 verification_commands`);
    }

    for (const source of claim.primary_sources) {
      if (source.source_id.startsWith('local-')) {
        if (!source.path) fail(`${claim.claim_id}: ${source.source_id} 缺 path`);
        if (source.path && !fs.existsSync(path.join(root, source.path))) {
          fail(`${claim.claim_id}: 本地证据不存在 ${source.path}`);
        }
        continue;
      }
      const catalogRow = bySourceId.get(source.source_id);
      if (!catalogRow) fail(`${claim.claim_id}: primary source 不在 catalog: ${source.source_id}`);
      if (source.source_id === 'internal-nihaixia-constraints' && catalogRow?.rights_status !== 'authorized_fulltext') {
        fail(`${claim.claim_id}: internal constraints 必须 authorized_fulltext`);
      }
    }

    for (const source of claim.candidate_external_sources) {
      const catalogRow = bySourceId.get(source.source_id);
      if (!catalogRow) {
        fail(`${claim.claim_id}: candidate source 不在 catalog: ${source.source_id}`);
        continue;
      }
      if (catalogRow.storage_policy === 'fulltext_allowed') {
        warn(`${claim.claim_id}: candidate ${source.source_id} 已 fulltext_allowed，可考虑升级为 primary source`);
      }
      if (!source.rights_gate?.includes('needs_license')) {
        fail(`${claim.claim_id}: candidate ${source.source_id} 缺 needs_license rights_gate`);
      }
      if (catalogRow.human_review_status === 'rejected') {
        fail(`${claim.claim_id}: candidate ${source.source_id} 已 rejected，不得作为候选证据`);
      }
    }
  }

  const report = [
    '# 倪海厦证据链审计报告',
    '',
    `生成时间：${new Date().toISOString()}`,
    `claim 总数：${evidence.claims.length}`,
    `必审 claim 覆盖：${requiredClaims.filter(claimId => claimIds.has(claimId)).length}/${requiredClaims.length}`,
    '',
    `失败数：${failures.length}`,
    failures.length ? failures.map(item => `- ${item}`).join('\n') : '- 无',
    '',
    `警告数：${warnings.length}`,
    warnings.length ? warnings.map(item => `- ${item}`).join('\n') : '- 无',
    '',
    '## 审计结论',
    failures.length === 0
      ? '证据链结构通过。当前硬规则以内部授权约束、代码和全量样本审计为 primary evidence；第三方资料只作为授权前候选线索。'
      : '证据链存在硬失败，禁止进入 claim-level 展示。'
  ].join('\n');

  fs.writeFileSync(reportFile, `${report}\n`);
  console.log(report);
  if (failures.length > 0) process.exit(1);
}

main();
