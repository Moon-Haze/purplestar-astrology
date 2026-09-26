// Node 侧生年四化摘要（spec §5.1 四化摘要列的验证基准，与构建 SQL 双保险）
export interface SihuaSummary {
  lu_star: string | null; lu_palace: string | null;
  quan_star: string | null; quan_palace: string | null;
  ke_star: string | null; ke_palace: string | null;
  ji_star: string | null; ji_palace: string | null;
}

export interface ZiweiChartLike {
  palaces: Array<{ name: string; stars: Array<{ name: string; siHua?: string | null }> }>;
}

export function extractSihua(chart: ZiweiChartLike): SihuaSummary {
  const out: SihuaSummary = {
    lu_star: null, lu_palace: null, quan_star: null, quan_palace: null,
    ke_star: null, ke_palace: null, ji_star: null, ji_palace: null,
  };
  for (const p of chart.palaces) {
    for (const s of p.stars) {
      const si = s.siHua ?? '';
      if (si === '') continue;
      const key = (si === '禄' ? 'lu' : si === '权' ? 'quan' : si === '科' ? 'ke' : 'ji') as 'lu' | 'quan' | 'ke' | 'ji';
      out[`${key}_star`] = s.name;
      out[`${key}_palace`] = p.name;
    }
  }
  return out;
}
