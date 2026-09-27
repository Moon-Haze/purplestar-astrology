/**
 * 「倪师引用」文献核对记录 —— 本仓内核中所有「倪师/倪海夏」引用的文献核对表。
 *
 * 数据源：reference/ziwei-samples-toolkit/corpus/annotations.json（针对 v2 核对，
 * 该快照未随仓库分发）。本仓的 v3 已清掉全部 fabricated，存活 suspect 的强归属也已
 * 清修为「古诀云 / 紫微斗数有云 / 一说」—— 本模块因此转为**防回流禁语清单**，
 * 由 `scripts/cli/selftest.ts` 的「未核实引文不得冒充倪师原话」断言消费。
 *
 * ⚠️ 行号是**上游核对时的坐标**（v2 的 db-analysis.ts），不是本仓当前行号 ——
 *    它是历史记录，不随本仓重构而更新。
 */

export type AnnotationStatus =
  | "verified"
  | "traditional"
  | "suspect"
  | "fabricated"
  | "methodology";

/** 一条引文核对记录。 */
export interface AnnotationEntry {
  /** 引文原文 */
  text: string;
  status: AnnotationStatus;
  /** 核对结论与处置建议（2 条早期记录未填） */
  note?: string;
  /** 出处线索（部分条目有） */
  source?: string;
}

export const ANNOTATIONS: AnnotationEntry[] = [
  {
    text: "紫微斗数分析数据库 v2 — 倪海夏三合派体系",
    status: "suspect",
    note: "倪师偏北派飞星（大学时接触隐传），不是三合派。应改为『倪海厦体系（三合为基 + 北派四化融合）』",
  },
  {
    text: "倪海夏言：「紫微守命，贵而不富，需禄配合方全美」",
    status: "traditional",
    note: "传统口诀，非倪师原话。应改为『古诀云』或『紫微传统论断』",
  },
  {
    text: "倪海夏描述：「红光满面、双目圆大、圆脸、皮肤白皙、中等身材偏壮实」",
    status: "verified",
    note: "倪师确实这样描述太阳星身形，但这里用到紫微描述上——**位置错误**，应该只在太阳条目",
    source: "天纪 03",
  },
  {
    text: "倪海夏说「紫微在迁移，外地逢贵人」",
    status: "suspect",
    note: "倪师原话更偏『紫微在外地代表孤君』(天纪 05)，这里『逢贵人』不确切",
  },
  {
    text: "倪海夏提醒：「化忌主是非」",
    status: "traditional",
    note: "传统口诀。倪师天纪 03 原话是『化忌代表劫杀』『化忌代表想不开』",
  },
  {
    text: "倪海夏说天机「善变」",
    status: "methodology",
    note: "概念正确但非原话摘录。倪师在天纪 03 说『反应很快，聪明，智慧很高』",
  },
  {
    text: "倪海夏说：「太阳在女人命中，代表先生、丈夫、儿子、父亲」",
    status: "verified",
    note: "倪师原话相近：『太阳星，指的是父亲，丈夫、儿子』",
    source: "天纪 03",
  },
  {
    text: "倪海夏说「田宅宫太阳化忌，上不见父、下不见子、中不见夫」",
    status: "suspect",
    note: "整句口诀形式未在已抓集数直接确证，疑似后人整理",
  },
  {
    text: '倪海夏描述："至刚至毅，执掌金山"',
    status: "fabricated",
    note: "这句是改编，倪师原话更直白：『代表武官，第二也代表财星，而且是财星王』(天纪 03)",
  },
  {
    text: "倪海夏原话：「武曲化忌，为刑囚之星」",
    status: "traditional",
    note: "传统口诀。称『倪海夏原话』是错的",
  },
  {
    text: '倪海夏说："坐食天禄，有福可享"',
    status: "suspect",
    note: "口诀风格，来源未证实",
  },
  {
    text: "倪海夏说廉贞「腰缠玉带，衫披桃花」",
    status: "traditional",
    note: "古诀修辞，非倪师原创",
  },
  {
    text: "倪海夏言廉贞守命者「眼神迷离，见到美色未言先笑，长相清秀」",
    status: "methodology",
    note: "倪师确实说廉贞『眯眯眼，眼睛看过去一条线』『长相清秀』，但『见到美色未言先笑』属于扩写",
    source: "天纪 03",
  },
  {
    text: "倪海夏明言廉贞化忌主血光官非与色情纠纷",
    status: "methodology",
    note: "概念对，但不是倪师某集的原话",
  },
  {
    text: '倪海夏言："天府是守财星，不是生财星"',
    status: "traditional",
    note: "紫微共识，非倪师独创",
  },
  {
    text: "倪海夏说：「太阴在命宫的女孩很漂亮」",
    status: "verified",
    note: "倪师原话：『女孩子命宫坐太阴星，啊，这个女孩子很漂亮，比得上月里嫦娥』",
    source: "天纪 03",
  },
  {
    text: '倪海夏说："男人的命，最怕太阴化忌，婆媳不和，太太跟妈妈一定不和"',
    status: "suspect",
    note: "倪师风格但未在已抓集数确证。有可能来自未抓到的集数",
  },
  {
    text: '倪海夏言："贪狼除了指桃花星，也指酒色财气赌，统统在贪狼里面"',
    status: "verified",
    note: "倪师原话。但缺少关键限定：『贪狼以在亥子宫才是正格桃花星，在午宫是武官星』",
    source: "天纪 04",
  },
  {
    text: "倪海夏提醒「不要随便乱批桃花」",
    status: "methodology",
    note: "倪师确实强调过贪狼在不同宫位不同性质",
    source: "天纪 04、05",
  },
  {
    text: '倪海夏说巨门"化气曰暗"',
    status: "traditional",
    note: "古书语，非倪师独创",
  },
  {
    text: "倪海夏说「巨门在朋友宫，跟朋友合伙会朋友变仇人」",
    status: "suspect",
    note: "倪师风格强，但原话未确证",
  },
  {
    text: '倪海夏说天相"位高无权"',
    status: "traditional",
    note: "传统对天相的定性，非倪师独创。倪师原话是『天相是佐才星』『适合做助理秘书师爷』(天纪 03)",
  },
  {
    text: '倪海夏说："天梁为监察御史，不宜取富，遇化禄者贪图名利，有不宜见禄之说"',
    status: "traditional",
    note: "此为古书《紫微斗数全书》类口诀，非倪师原创",
  },
  {
    text: "古书明载「女人得此（天梁）为孤独，克夫刑子守冷房」——倪海夏在这方面有明确的告诫",
    status: "traditional",
    note: "古诀用词准确，倪师『告诫』为方法论表述",
  },
  {
    text: '倪海夏言"七杀临身终不美"',
    status: "verified",
    note: "倪师原话直接命中",
    source: "天纪 04",
  },
  {
    text: "倪海夏笑言：「如果你娶个太太是七杀入命，那你就差不多毁了一半了，很累啊，草木皆兵」",
    status: "suspect",
    note: "倪师风格极强且口语化，大概率是真实原话，但未在已抓集数直接确证",
  },
  {
    text: '倪海夏说："破军星是要流浪在外，走天下的，专业技术专长，她要捧着饭碗走天下"',
    status: "verified",
    note: "倪师原话，完全吻合",
    source: "天纪 04",
  },
  {
    text: "「怎么养都不胖」（倪海夏语）",
    status: "verified",
    note: "倪师原话",
    source: "天纪 04",
  },
  {
    text: "倪海夏说破军要「捧着饭碗走天下」",
    status: "verified",
    note: "倪师原话",
    source: "天纪 04",
  },
  {
    text: "子午流注脏腑对应（倪师体系的疾厄论断核心）",
    status: "fabricated",
    note: "⚠️ 重大错误：倪师疾厄论断以『宫位（地支）→ 脏腑』为主，不是按星曜五行。此 ZIWU_LIUZHU 按星曜映射方法论本身就是偏离倪师体系的。需要重建",
  },
  {
    text: "倪海夏警示：「福德宫化忌，夫妻宫未见生离，必定死别」",
    status: "suspect",
    note: "⚠️ 疑似北派钦天体系口诀，非倪师原话。需慎重",
  },
  {
    text: "倪师警示：迁移化忌「半空折翅」",
    status: "verified",
    note: "倪师案例中明确使用『半空折翅』描述迁移对冲命宫的凶象",
    source: "天纪 06",
  },
  {
    text: "倪师说「田宅宫化忌，家破财散」",
    status: "suspect",
    note: "传统口诀归属到倪师，未确证",
  },
  {
    text: "倪海夏说「爵禄荣昌」",
    status: "verified",
    note: "倪师原话（描述七杀朝斗格 / 紫府同宫格）",
    source: "天纪 07",
  },
  {
    text: "倪海夏说「做事情左右逢源，一辈子做事情荣华」",
    status: "verified",
    note: "倪师原话（日月并明格）",
    source: "天纪 07",
  },
  {
    text: "倪海夏说「男人非常英挺，威震边疆」",
    status: "verified",
    note: "倪师对英星入庙男命原话",
    source: "天纪 10",
  },
  {
    text: "倪海夏说「女人瘦瘦干干，婚姻都会晚」",
    status: "verified",
    note: "倪师对英星入庙女命原话",
    source: "天纪 10",
  },
  {
    text: "倪海夏列为武职大贵格",
    status: "verified",
    note: "倪师对日丽中天的定性",
    source: "天纪 07、08",
  },
  {
    text: "倪海夏说「火贪格，出将入相，武贵之路」",
    status: "traditional",
    note: "『出将入相』为传统，倪师原话『火贪格出武贵』(天纪 04)更贴切",
  },
  {
    text: "倪海夏说「魁钺夹命，官至极品」",
    status: "suspect",
    note: "『官至极品』为传统口诀，归倪师存疑",
  },
  { text: "倪海夏说「化忌主是非」", status: "traditional", note: "传统口诀" },
  {
    text: "倪海夏说「擎羊入命，刑克自伤」",
    status: "traditional",
    note: "传统口诀",
  },
  { text: "倪师称为「双禄交流」", status: "traditional", note: "传统格局名" },
  { text: "倪师说「禄马最喜交驰」", status: "traditional", note: "古诀" },
  { text: "倪师说「魁钺夹命，贵人在旁」", status: "traditional", note: "古诀" },
  {
    text: "倪师警示：「火铃夹命，性急刑伤」",
    status: "traditional",
    note: "古诀",
  },
  {
    text: "倪师说「羊陀夹命，刑克逃不掉」",
    status: "traditional",
    note: "古诀",
  },
  {
    text: "倪师警示：「迁移化忌，半空折翅」",
    status: "verified",
    source: "天纪 06",
  },
  { text: "倪师说「马落空亡，徒劳奔波」", status: "traditional", note: "古诀" },
  { text: "倪师说「昌曲化忌，文书暗亏」", status: "traditional", note: "古诀" },
  {
    text: "倪师强调：大限四化以大限宫干为准，非本命年干",
    status: "methodology",
    note: "⚠️ 注意：这其实是**北派飞星**的核心方法，倪师《天纪》讲的是『本命四化永远固定，是流年宫位在动，不是星在重新化』(天纪 03 原话)。当前 db-analysis 混合了北派飞星 × 倪师三合论。需要在 README 说明",
  },
  {
    text: "倪师说「空宫必借对宫论事」",
    status: "methodology",
    note: "概念是倪师体系的，但这句原话未在已抓集数直接确证",
  },
  {
    text: "倪师体系中，本命/大限/流年同一星的四化叠加",
    status: "methodology",
    note: "方法论概念，北派 × 倪师融合",
  },
  {
    text: "倪师精准推月法",
    status: "fabricated",
    note: "『精准推月法』是我加的名字，不是倪师术语",
  },
  {
    text: "倪师说「自化者，能量自耗或自成」",
    status: "fabricated",
    note: "这句是我编的，应改为『北派四化论』",
  },
  {
    text: "倪师说「找到来因宫，才能找到问题的根」",
    status: "fabricated",
    note: "这句是我编的，应改为『北派四化派有云』",
  },
  {
    text: "子午流注脏腑映射（倪师体系特色）",
    status: "fabricated",
    note: "⚠️ 方法论偏离：倪师疾厄论以『宫位（地支）→ 脏腑』为主，星曜五行为辅",
  },
  {
    text: "倪海夏将疾厄宫与子午流注结合",
    status: "suspect",
    note: "倪师确实讲过紫微 × 中医，但『14 主星 × 子午流注对应表』是我的组合",
  },
  {
    text: "倪师反复强调：迁移化忌「半空折翅」",
    status: "verified",
    source: "天纪 06",
  },
  { text: "倪师说「田宅化忌，家破财散」", status: "suspect", note: "传统口诀" },
  {
    text: "倪师重点警示：「福德宫化忌，夫妻宫未见生离，必定死别」",
    status: "suspect",
    note: "⚠️ 疑似北派钦天，非倪师",
  },
];
