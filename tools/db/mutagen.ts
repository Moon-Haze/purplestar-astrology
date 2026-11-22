/**
 * @file 数据库星曜四化标记的映射与校验工具。
 */
// Node 侧生年四化摘要（spec §5.1 四化摘要列的验证基准，与构建 SQL 双保险）
/** 生年四化摘要：禄权科忌各自的星名与落宫，无化出为 null。 */
export interface SihuaSummary {
	/** 化禄星名（对应 samples.sihua_lu_star）；无化禄为 null */
	lu_star: string | null;
	/** 化禄落宫宫名（展开形，带「宫」字，如「命宫」）；无化禄为 null */
	lu_palace: string | null;
	/** 化权星名（对应 samples.sihua_quan_star）；无化权为 null */
	quan_star: string | null;
	/** 化权落宫宫名；无化权为 null */
	quan_palace: string | null;
	/** 化科星名（对应 samples.sihua_ke_star）；无化科为 null */
	ke_star: string | null;
	/** 化科落宫宫名；无化科为 null */
	ke_palace: string | null;
	/** 化忌星名（对应 samples.sihua_ji_star）；无化忌为 null */
	ji_star: string | null;
	/** 化忌落宫宫名；无化忌为 null */
	ji_palace: string | null;
}

/** 只声明取四化所需的命盘形状（宫名 + 星名的四化标记）。 */
export interface ZiweiChartLike {
	/** 十二宫列表；每宫只取宫名与星曜的 mutagen（禄 / 权 / 科 / 忌，未化为空或 null） */
	palaces: Array<{ name: string; stars: Array<{ name: string; mutagen?: string | null }> }>;
}

/**
 * 从命盘提取生年四化摘要，作为构建 SQL 的对照基准。
 *
 * @param chart - 本仓内核排盘产物（只读 palaces 与 stars）
 * @returns 四化摘要：每种四化各记星名与所在宫名，无该四化时为 `null`
 */
export function extractSihua(chart: ZiweiChartLike): SihuaSummary {
	const out: SihuaSummary = {
		lu_star: null,
		lu_palace: null,
		quan_star: null,
		quan_palace: null,
		ke_star: null,
		ke_palace: null,
		ji_star: null,
		ji_palace: null,
	};
	for (const p of chart.palaces) {
		for (const s of p.stars) {
			const si = s.mutagen ?? "";
			if (si === "") {
				continue;
			}
			const key = (si === "禄" ? "lu" : si === "权" ? "quan" : si === "科" ? "ke" : "ji") as
				"lu" | "quan" | "ke" | "ji";
			out[`${key}_star`] = s.name;
			out[`${key}_palace`] = p.name;
		}
	}
	return out;
}
