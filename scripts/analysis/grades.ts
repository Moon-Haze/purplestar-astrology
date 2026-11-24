/**
 * 倪师引句知识分级登记表。
 * ⚠️ 「倪师…说」须登记：**占位或自撰绝不可挂倪师引语**（伪造引文，见
 * docs/code/README.md）；selftest 对「文案中的引句 ↔ 本表」**双向匹配**，
 * 未登记或失配即红。档位规则见 docs/code/analysis.md。
 * @file 倪师引句知识分级登记表
 */
/**
 * 档位运行期展示序（尾注序）：verified / traditional / methodology / suspect。
 * @remarks `KnowledgeGrade` 运行期擦除，尾注两份（--topic / --report）与 guard legal
 * Set 原靠手抄对齐；改名调序只改本常量：类型派生、尾注拼装，selftest 对拍钉住「尾注 ↔ 常量」。
 */
export const KNOWLEDGE_GRADE_ORDER = ["verified", "traditional", "methodology", "suspect"] as const;

/** 知识来源四档：verified / traditional / methodology / suspect。 */
export type KnowledgeGrade = (typeof KNOWLEDGE_GRADE_ORDER)[number];

/** 一条引句登记：字段、定位串与档位。 */
export interface NiGradeEntry {
	/** 所属主星（STAR_CONTENT_MAP 键）；表外条目记「—」 */
	star: string;
	/** 引句文案字段（mingGong / fuQi / summary.female.overview 等） */
	field: string;
	/** 引句「」内前 12 字定位串 */
	quote: string;
	/** 档位：verified 带《天纪》集数出处 / traditional 古诀或转述 / methodology 推算方法 / suspect 存疑 */
	grade: KnowledgeGrade;
}

/** 全部倪师引句的档位登记表，与 `data.ts` 的文案引句双向对拍。 */
export const NI_GRADES: readonly NiGradeEntry[] = [
	// ── 紫微 ──
	// L85 二处无出处 —— traditional。
	{ star: "紫微", field: "mingGong", quote: "紫微守命，贵而不富，需禄", grade: "traditional" },
	{ star: "紫微", field: "mingGong", quote: "红光满面、双目圆大、圆脸", grade: "traditional" },
	// L113（overview 复述同句）。
	{
		star: "紫微",
		field: "summary.female.overview",
		quote: "紫微守命，贵而不富，需禄",
		grade: "traditional",
	},
	// L115 紫微女命「贵气压人」，无出处转述。
	{ star: "紫微", field: "summary.female.career", quote: "贵气压人", grade: "traditional" },
	// ── 天机 ──
	// L152 天机「善变」；L180「天机善变」（女命复述）。
	{ star: "天机", field: "mingGong", quote: "善变", grade: "traditional" },
	{ star: "天机", field: "summary.female.overview", quote: "天机善变", grade: "traditional" },
	// ── 太阳 ──
	// L212「太阳在女人命中，代表先生、丈夫、儿子、父亲」（三男象）。
	{ star: "太阳", field: "mingGong", quote: "太阳在女人命中，代表先生", grade: "traditional" },
	// L242/L243「在倪海厦体系中，太阳对女命代表「丈夫、父亲、儿子…」」——转述，无集数。
	{
		star: "太阳",
		field: "summary.female.overview",
		quote: "丈夫、父亲、儿子、兄弟",
		grade: "traditional",
	},
	{ star: "太阳", field: "summary.female.love", quote: "丈夫、父亲、儿子", grade: "traditional" },
	// L254 太阳化忌眼目之灾、「劳而无获」——化忌转述。
	{ star: "太阳", field: "topic_mods.overview.ji", quote: "劳而无获", grade: "traditional" },
	// ── 武曲 ──
	// L276「倪海厦天纪 03 明言」——带集数 → verified。
	{ star: "武曲", field: "mingGong", quote: "武曲代表武官，第二也代表", grade: "verified" },
	// L304/305/307「倪海厦将武曲女命列为「寡宿之星」」「倪师评武曲女命」——无出处转述。
	{ star: "武曲", field: "summary.female.overview", quote: "寡宿之星", grade: "traditional" },
	{
		star: "武曲",
		field: "summary.female.overview",
		quote: "武曲女命，多主克夫或迟婚",
		grade: "traditional",
	},
	{ star: "武曲", field: "summary.female.love", quote: "寡宿之星", grade: "traditional" },
	{
		star: "武曲",
		field: "summary.female.love",
		quote: "武曲女命，多主克夫或迟婚",
		grade: "traditional",
	},
	{ star: "武曲", field: "summary.female.wealth", quote: "寡宿之星", grade: "traditional" },
	// L332「倪师天纪 03 言」——带集数 → verified。
	{ star: "武曲", field: "topic_mods.wealth.lu", quote: "武曲是财星王", grade: "verified" },
	// ── 廉贞 ──
	// L397 廉贞「腰缠玉带，衫披桃花」；L398「眼神迷离…」。
	{ star: "廉贞", field: "mingGong", quote: "腰缠玉带，衫披桃花", grade: "traditional" },
	{ star: "廉贞", field: "personality", quote: "眼神迷离，见到美色未言先", grade: "traditional" },
	// L425 廉贞女命「贞节清秀，出污泥而不染」。
	{
		star: "廉贞",
		field: "summary.female.overview",
		quote: "贞节清秀，出污泥而不染",
		grade: "traditional",
	},
	// L429 警示「廉贞化忌主血光」。
	{ star: "廉贞", field: "summary.female.health", quote: "廉贞化忌主血光", grade: "traditional" },
	// ── 天府 ──
	// L481「天府守命，稳健致富，不喜冒险」。
	{
		star: "天府",
		field: "summary.female.overview",
		quote: "天府守命，稳健致富，不喜",
		grade: "traditional",
	},
	// ── 太阴 ──
	// L510/L540「太阴在命宫的女孩很漂亮」（两处）。
	{ star: "太阴", field: "mingGong", quote: "太阴在命宫的女孩很漂亮", grade: "traditional" },
	{
		star: "太阴",
		field: "summary.female.overview",
		quote: "太阴在命宫的女孩很漂亮",
		grade: "traditional",
	},
	// L534「在倪海厦体系中，太阴对男命代表「妻子、母亲、女儿」」——转述。
	{ star: "太阴", field: "summary.male.love", quote: "妻子、母亲、女儿", grade: "traditional" },
	// L543/544「太阴是田宅主+正财星」「月主忧愁」。
	{
		star: "太阴",
		field: "summary.female.wealth",
		quote: "太阴是田宅主+正财星",
		grade: "traditional",
	},
	{ star: "太阴", field: "summary.female.health", quote: "月主忧愁", grade: "traditional" },
	// ── 贪狼 ──
	// L573 "贪狼除了指桃花星，也指酒色财气赌……"（无集数）。
	{ star: "贪狼", field: "mingGong", quote: "贪狼除了指桃花星，也指酒", grade: "traditional" },
	// L601「贪狼早年虚华，晚年成就」。
	{
		star: "贪狼",
		field: "summary.female.overview",
		quote: "贪狼早年虚华，晚年成就",
		grade: "traditional",
	},
	// L613「不要随便乱批桃花」——告诫**如何下断**，非断命 → methodology。
	{
		star: "贪狼",
		field: "topic_mods.overview.bright",
		quote: "不要随便乱批桃花",
		grade: "methodology",
	},
	// ── 巨门 ──
	// L634 巨门"化气曰暗"；L661「口舌是非多」。
	{ star: "巨门", field: "mingGong", quote: "化气曰暗", grade: "traditional" },
	{ star: "巨门", field: "summary.female.overview", quote: "口舌是非多", grade: "traditional" },
	// ── 天相 ──
	// L688 天相"位高无权"；L711「天相的人位高无权」（女命复述）。
	{ star: "天相", field: "mingGong", quote: "位高无权", grade: "traditional" },
	{
		star: "天相",
		field: "summary.female.overview",
		quote: "天相的人位高无权",
		grade: "traditional",
	},
	// ── 天梁 ──
	// L732 "天梁为监察御史，不宜取富……有不宜见禄之说"（无集数）。
	{ star: "天梁", field: "mingGong", quote: "天梁为监察御史，不宜取富", grade: "traditional" },
	// ── 七杀 ──
	// L787/789/814「七杀临身终不美」三处。
	{ star: "七杀", field: "mingGong", quote: "七杀临身终不美", grade: "traditional" },
	{ star: "七杀", field: "xiongDi", quote: "七杀临身终不美", grade: "traditional" },
	{ star: "七杀", field: "summary.female.health", quote: "七杀临身终不美", grade: "traditional" },
	// L788「坊间流传倪师笑言（未核实）」——自带散注 → suspect。
	{ star: "七杀", field: "personality", quote: "如果你娶个太太是七杀入命", grade: "suspect" },
	// L810/811「孤独之星」、七杀女命「孤克重」。
	{ star: "七杀", field: "summary.female.overview", quote: "孤独之星", grade: "traditional" },
	{ star: "七杀", field: "summary.female.overview", quote: "孤克重", grade: "traditional" },
	{ star: "七杀", field: "summary.female.love", quote: "孤独之星", grade: "traditional" },
	{ star: "七杀", field: "summary.female.love", quote: "孤克重", grade: "traditional" },
	// ── 破军 ──
	// L835/862 "破军星是要流浪在外，走天下的……"（两处）。
	{ star: "破军", field: "mingGong", quote: "破军星是要流浪在外，走天", grade: "traditional" },
	{
		star: "破军",
		field: "summary.female.overview",
		quote: "破军星是要流浪在外，走天",
		grade: "traditional",
	},
	// L836/839/865「捧着饭碗走天下」三处。
	{ star: "破军", field: "personality", quote: "捧着饭碗走天下", grade: "traditional" },
	{ star: "破军", field: "qianYi", quote: "捧着饭碗走天下", grade: "traditional" },
	{ star: "破军", field: "summary.female.wealth", quote: "捧着饭碗走天下", grade: "traditional" },
	// ── 表外条目（不隶属单一主星，star 记「—」）──
	// L1497 迁移化忌「半空折翅」（TOPIC_KEY_PALACES 迁移条）。
	{ star: "—", field: "TOPIC_KEY_PALACES.move[0].ji", quote: "半空折翅", grade: "traditional" },
	// L1685「命运不是人生的全部，加上地理位置和人念，才是」——**怎么论** → methodology。
	{
		star: "—",
		field: "TOPIC_SUGGESTIONS.overview[2]",
		quote: "命运不是人生的全部，加上",
		grade: "methodology",
	},
	// L1710「开刀见血光」（天纪 07 @00:11:38 擎羊陀罗病灾论；views/health.ts 有同源引语，
	// 对拍只扫 analysis/data.ts，views 层不在对拍面——留档）。
	{ star: "—", field: "TOPIC_SUGGESTIONS.health[2]", quote: "开刀见血光", grade: "traditional" },
	// L1724「倪师《天纪 06》原话」——带集数 → verified。
	{ star: "—", field: "TOPIC_SUGGESTIONS.move[1]", quote: "半空折翅", grade: "verified" },
	// ZI_WU_ORGAN_VERSE：《天纪 05》引《内经》歌诀（B 站 BV1KJsLekEfA p3 §11 @00:45:45
	// 逐字可溯）——秒级出处 → verified。
	{
		star: "—",
		field: "PALACE_BRANCH_ORGAN.verse",
		quote: "肺寅大卯胃辰宫，脾巳心午",
		grade: "verified",
	},
];
