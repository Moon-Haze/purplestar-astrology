/**
 * 主题论断库（data.ts）倪师引句的知识分级登记表。
 *
 * @remarks
 * 引句嵌在 data.ts 的长文案字符串内（非独立条目），故分级以**登记表**承载：
 * `quote` 是引句「」内前 12 字的定位串，selftest 对「文案中的引句 ↔ 本表」做
 * 双向匹配——文案新增引句未登记、或登记的 quote 与文案失配，都会变红。
 * 档位判定规则（与评估报告一致）：
 * - `verified`：引句带《天纪》集数出处（如「天纪 03 明言」）；
 * - `traditional`：古诀云 / 古书云 / 口诀 / 无出处的倪师转述（默认档）；
 * - `suspect`：原文案已带「未核实 / 来源存疑 / 一说非倪师原话」散注；
 * - `methodology`：描述推算方法而非断语的引句。
 *
 * 2026-10-08 实测口径：评估报告基线 28 处标记（行号 85…862）经机检正则全量复核后
 * 共抽出 52 条引句——文案中除「倪海夏说 / 言 / 描述 / 明言」外，还有「倪师评 /
 * 明言 / 警示 / 天纪 03 言」「倪海夏提醒 / 将…列为 / 体系中…代表」以及英文双引号
 * 引文等形态，且同句常在多字段重复出现（每处各登记一条）。本表覆盖全部 52 条，
 * 行号注释即 data.ts 中的定位（以 2026-10-03 评估报告行号清单为基础扩充）。
 */
export type KnowledgeGrade = "verified" | "traditional" | "suspect" | "methodology";

export interface NiGradeEntry {
	/** 引句所属主星（STAR_CONTENT_MAP 的键）；不隶属单一主星的表外条目记「—」 */
	star: string;
	/** 引句所在文案字段（mingGong / fuQi / summary.female.overview 等） */
	field: string;
	/** 引句「」内前 12 字定位串 */
	quote: string;
	grade: KnowledgeGrade;
}

export const NI_GRADES: readonly NiGradeEntry[] = [
	// ── 紫微 ──
	// L85 倪海夏言，无出处转述；L85 倪海夏描述相貌，无出处 —— 均 traditional。
	{ star: "紫微", field: "mingGong", quote: "紫微守命，贵而不富，需禄", grade: "traditional" },
	{ star: "紫微", field: "mingGong", quote: "红光满面、双目圆大、圆脸", grade: "traditional" },
	// L113 倪海夏说（summary.female.overview 复述 mingGong 同句）。
	{ star: "紫微", field: "summary.female.overview", quote: "紫微守命，贵而不富，需禄", grade: "traditional" },
	// L115 倪师论紫微女命「贵气压人」，无出处转述。
	{ star: "紫微", field: "summary.female.career", quote: "贵气压人", grade: "traditional" },
	// ── 天机 ──
	// L152 倪海夏说天机「善变」；L180 倪海夏说「天机善变」（女命综述复述）。
	{ star: "天机", field: "mingGong", quote: "善变", grade: "traditional" },
	{ star: "天机", field: "summary.female.overview", quote: "天机善变", grade: "traditional" },
	// ── 太阳 ──
	// L212 倪海夏说「太阳在女人命中，代表先生、丈夫、儿子、父亲」（父夫子三男象）。
	{ star: "太阳", field: "mingGong", quote: "太阳在女人命中，代表先生", grade: "traditional" },
	// L242 / L243「在倪海夏体系中，太阳对女命代表「丈夫、父亲、儿子…」」——体系转述，无集数。
	{ star: "太阳", field: "summary.female.overview", quote: "丈夫、父亲、儿子、兄弟", grade: "traditional" },
	{ star: "太阳", field: "summary.female.love", quote: "丈夫、父亲、儿子", grade: "traditional" },
	// L254 倪海夏说太阳化忌主眼目之灾，以及「劳而无获」——化忌格局断语转述。
	{ star: "太阳", field: "topic_mods.overview.ji", quote: "劳而无获", grade: "traditional" },
	// ── 武曲 ──
	// L276「倪海夏天纪 03 明言」——带《天纪》集数出处 → verified。
	{ star: "武曲", field: "mingGong", quote: "武曲代表武官，第二也代表", grade: "verified" },
	// L304 / L305 / L307「倪海夏将武曲女命列为「寡宿之星」」「倪师评武曲女命」——无出处转述。
	{ star: "武曲", field: "summary.female.overview", quote: "寡宿之星", grade: "traditional" },
	{ star: "武曲", field: "summary.female.overview", quote: "武曲女命，多主克夫或迟婚", grade: "traditional" },
	{ star: "武曲", field: "summary.female.love", quote: "寡宿之星", grade: "traditional" },
	{ star: "武曲", field: "summary.female.love", quote: "武曲女命，多主克夫或迟婚", grade: "traditional" },
	{ star: "武曲", field: "summary.female.wealth", quote: "寡宿之星", grade: "traditional" },
	// L332「倪师天纪 03 言」——带集数出处 → verified。
	{ star: "武曲", field: "topic_mods.wealth.lu", quote: "武曲是财星王", grade: "verified" },
	// ── 廉贞 ──
	// L397 倪海夏说廉贞「腰缠玉带，衫披桃花」；L398 倪海夏言廉贞守命者「眼神迷离…」。
	{ star: "廉贞", field: "mingGong", quote: "腰缠玉带，衫披桃花", grade: "traditional" },
	{ star: "廉贞", field: "personality", quote: "眼神迷离，见到美色未言先", grade: "traditional" },
	// L425 倪海夏说廉贞女命「贞节清秀，出污泥而不染」。
	{ star: "廉贞", field: "summary.female.overview", quote: "贞节清秀，出污泥而不染", grade: "traditional" },
	// L429 倪师体系明确警示「廉贞化忌主血光」。
	{ star: "廉贞", field: "summary.female.health", quote: "廉贞化忌主血光", grade: "traditional" },
	// ── 天府 ──
	// L481 倪海夏说「天府守命，稳健致富，不喜冒险」。
	{ star: "天府", field: "summary.female.overview", quote: "天府守命，稳健致富，不喜", grade: "traditional" },
	// ── 太阴 ──
	// L510 / L540 倪海夏说「太阴在命宫的女孩很漂亮」（mingGong 与女命综述各一处）。
	{ star: "太阴", field: "mingGong", quote: "太阴在命宫的女孩很漂亮", grade: "traditional" },
	{ star: "太阴", field: "summary.female.overview", quote: "太阴在命宫的女孩很漂亮", grade: "traditional" },
	// L534「在倪海夏体系中，太阴对男命代表「妻子、母亲、女儿」」——体系转述。
	{ star: "太阴", field: "summary.male.love", quote: "妻子、母亲、女儿", grade: "traditional" },
	// L543 / L544 倪师明言「太阴是田宅主+正财星」「月主忧愁」。
	{ star: "太阴", field: "summary.female.wealth", quote: "太阴是田宅主+正财星", grade: "traditional" },
	{ star: "太阴", field: "summary.female.health", quote: "月主忧愁", grade: "traditional" },
	// ── 贪狼 ──
	// L573 倪海夏言："贪狼除了指桃花星，也指酒色财气赌……"（英文双引号引文，无集数）。
	{ star: "贪狼", field: "mingGong", quote: "贪狼除了指桃花星，也指酒", grade: "traditional" },
	// L601 倪海夏说「贪狼早年虚华，晚年成就」。
	{ star: "贪狼", field: "summary.female.overview", quote: "贪狼早年虚华，晚年成就", grade: "traditional" },
	// L613 倪海夏提醒「不要随便乱批桃花」——对**如何下断**的操作告诫，非命主断语 → methodology。
	{ star: "贪狼", field: "topic_mods.overview.bright", quote: "不要随便乱批桃花", grade: "methodology" },
	// ── 巨门 ──
	// L634 倪海夏说巨门"化气曰暗"；L661 倪海夏说巨门「口舌是非多」。
	{ star: "巨门", field: "mingGong", quote: "化气曰暗", grade: "traditional" },
	{ star: "巨门", field: "summary.female.overview", quote: "口舌是非多", grade: "traditional" },
	// ── 天相 ──
	// L688 倪海夏说天相"位高无权"；L711 倪海夏说「天相的人位高无权」（女命综述复述）。
	{ star: "天相", field: "mingGong", quote: "位高无权", grade: "traditional" },
	{ star: "天相", field: "summary.female.overview", quote: "天相的人位高无权", grade: "traditional" },
	// ── 天梁 ──
	// L732 倪海夏说："天梁为监察御史，不宜取富……有不宜见禄之说"（英文双引号，无集数）。
	{ star: "天梁", field: "mingGong", quote: "天梁为监察御史，不宜取富", grade: "traditional" },
	// ── 七杀 ──
	// L787 / L789 / L814「七杀临身终不美」三处（mingGong / xiongDi / 女命健康）。
	{ star: "七杀", field: "mingGong", quote: "七杀临身终不美", grade: "traditional" },
	{ star: "七杀", field: "xiongDi", quote: "七杀临身终不美", grade: "traditional" },
	{ star: "七杀", field: "summary.female.health", quote: "七杀临身终不美", grade: "traditional" },
	// L788「坊间流传倪师笑言（未核实）」——原文自带未核实散注 → suspect。
	{ star: "七杀", field: "personality", quote: "如果你娶个太太是七杀入命", grade: "suspect" },
	// L810 / L811 倪海夏明示「孤独之星」、倪海夏体系中七杀女命「孤克重」。
	{ star: "七杀", field: "summary.female.overview", quote: "孤独之星", grade: "traditional" },
	{ star: "七杀", field: "summary.female.overview", quote: "孤克重", grade: "traditional" },
	{ star: "七杀", field: "summary.female.love", quote: "孤独之星", grade: "traditional" },
	{ star: "七杀", field: "summary.female.love", quote: "孤克重", grade: "traditional" },
	// ── 破军 ──
	// L835 / L862 倪海夏说："破军星是要流浪在外，走天下的……"（mingGong 与女命综述各一处）。
	{ star: "破军", field: "mingGong", quote: "破军星是要流浪在外，走天", grade: "traditional" },
	{ star: "破军", field: "summary.female.overview", quote: "破军星是要流浪在外，走天", grade: "traditional" },
	// L836 / L839 / L865 倪师明言 / 倪海夏说破军要「捧着饭碗走天下」三处。
	{ star: "破军", field: "personality", quote: "捧着饭碗走天下", grade: "traditional" },
	{ star: "破军", field: "qianYi", quote: "捧着饭碗走天下", grade: "traditional" },
	{ star: "破军", field: "summary.female.wealth", quote: "捧着饭碗走天下", grade: "traditional" },
	// ── 表外条目（不隶属单一主星，star 记「—」）──
	// L1497 倪师警示：迁移化忌「半空折翅」（TOPIC_KEY_PALACES 迁移条）。
	{ star: "—", field: "TOPIC_KEY_PALACES.move[0].ji", quote: "半空折翅", grade: "traditional" },
	// L1685 倪师提醒「命运不是人生的全部，加上地理位置和人念，才是」——论命方法论（本命盘
	// 之外还须合参地理与人念），教的是**怎么论**而非断命主 → methodology。
	{ star: "—", field: "TOPIC_SUGGESTIONS.overview[2]", quote: "命运不是人生的全部，加上", grade: "methodology" },
	// L1710 倪师明言「开刀见血光」（煞星入疾厄的断语转述）。
	{ star: "—", field: "TOPIC_SUGGESTIONS.health[2]", quote: "开刀见血光", grade: "traditional" },
	// L1724「倪师《天纪 06》原话」——带集数出处 → verified。
	{ star: "—", field: "TOPIC_SUGGESTIONS.move[1]", quote: "半空折翅", grade: "verified" },
];
