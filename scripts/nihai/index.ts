/**
 * 倪海厦 天纪 / 地纪 / 人纪 — 统一导出
 *
 * 倪海厦（1954-2012），美国汉唐中医学院创办人，
 * 当代少见的「命、相、卜、山、医」五术兼备之旷世奇人。
 *
 * 三纪体系：
 *   天纪 —— 上知天文（紫微斗数、易经、堪舆、推命、面相、测字）
 *   地纪 —— 下知地理（国家地理志、风水与国运）
 *   人纪 —— 中知人事（针灸、黄帝内经、神农本草经、伤寒论、金匮要略）
 *
 * @remarks
 * 本模块是「三纪」的**聚合入口**：各纪的分册数据（`tianji.ts` / `renji.ts` / `diji.ts`）
 * 在此统一转出，调用方只需 import 本文件。三纪的分工是**按「知什么」切分**——
 * 天纪管术数（本项目排盘与解读的体系依据就在此纪）、地纪管地理风水、人纪管中医经典；
 * `nihai` 命令按 `--category tianji|diji|renji` 分组列出这三份模块清单。
 *
 * @packageDocumentation
 */

/** 类型转出：三纪共用类型（见 `./types`） */
export * from "./types";
/**
 * 天纪数据转出 —— 上知天文，1994 年录制。
 *
 * 含课程模块（{@link TIANJI_MODULES}）、易经六十四卦（{@link HEXAGRAMS}）、
 * 堪舆条目（{@link FENGSHUI_ENTRIES}）、课程集数结构（{@link TIANJI_EPISODES}）、
 * 倪师语录（{@link TIANJI_QUOTES}）与汇总统计（{@link TIANJI_STATS}）。
 */
export {
	TIANJI_MODULES,
	HEXAGRAMS,
	FENGSHUI_ENTRIES,
	TIANJI_EPISODES,
	TIANJI_QUOTES,
	TIANJI_STATS,
} from "./tianji";
/**
 * 人纪数据转出 —— 中知人事，2004-2005 年完成。
 *
 * 含课程模块（{@link RENJI_MODULES}）、针灸经验穴位（{@link ACU_EXPERIENCES}）、
 * 透针透穴法（{@link TRANS_NEEDLING}）、汉唐方剂（{@link HANTANG_FORMULAS}）、
 * 经典经方（{@link CLASSIC_FORMULAS}）与汇总统计（{@link RENJI_STATS}）。
 */
export {
	RENJI_MODULES,
	ACU_EXPERIENCES,
	TRANS_NEEDLING,
	HANTANG_FORMULAS,
	CLASSIC_FORMULAS,
	RENJI_STATS,
} from "./renji";
/**
 * 地纪数据转出 —— 下知地理，倪师未竟之业。
 *
 * 只有课程模块（{@link DIJI_MODULES}）与汇总统计（{@link DIJI_STATS}）两项，
 * 无卦象 / 方剂一类的细目数据（见 `diji.ts` 顶部说明）。
 */
export { DIJI_MODULES, DIJI_STATS } from "./diji";

/**
 * 倪海厦完整传记 —— 生平、师承、理念、大事记、著作与人格特征。
 *
 * @remarks
 * 供 `nihai --bio` 命令原样 JSON 输出，也是解读中介绍倪师时的统一口径来源。
 * `nameVariant` 记录项目内外并用的另一种写法（「倪海厦」/「倪海夏」），
 * 两者指同一人，非笔误。
 */
export const NI_HAIXIA_BIO = {
	/** 姓名（本技能文档与代码统一使用的写法） */
	name: "倪海厦",
	/** 姓名的另一种通行写法，与 `name` 指同一人 */
	nameVariant: "倪海夏",
	/** 早年算命看相所用化名 */
	alias: "梵宇龙",
	/** 出生日期（1954 年 1 月 1 日） */
	birth: "1954年1月1日",
	/** 辞世日期（2012 年 1 月 31 日） */
	death: "2012年1月31日",
	/** 出生地 */
	birthPlace: "台北市",
	/** 祖籍 */
	ancestry: "浙江瑞安",
	/** 家中排行 */
	family: "七个兄弟姊妹，排行第五",
	/** 学历 */
	education: "东吴大学政治系",
	/** 最常引用的头衔（完整头衔见 `titles`） */
	title: "美国汉唐中医学院创办人",
	/** 头衔全表 */
	titles: [
		"命、相、卜、山、医 五术兼备之旷世奇人",
		"美国汉唐中医学院院长",
		"美国加州中医药大学博士指导教授",
		"佛罗里达州卫生署中医委员会最高委员（2000-2003）",
		"佛州针灸委员会委员及副主席",
		"经方派现代继承者",
		"天纪、人纪教学体系创立者",
		"海外优秀华人奖获得者",
	],
	/** 师承关系，每项形如 `{ name 师名, background 出身, subject 所授科目, period 从学时间 }` */
	teachers: [
		{
			name: "周左宇",
			background: "北京四代家传名医，1949年后移居台湾",
			subject: "针灸",
			period: "1977-1981",
		},
		{ name: "徐济民", background: "江苏籍上海名医", subject: "针灸", period: "1970s" },
		{
			name: "姜佐景传承",
			background: "师承曹颖甫的经方家",
			subject: "经方",
			period: "基隆中药行学徒期间",
		},
	],
	/** 核心理念 —— 逐条是倪师原话式的短句（与 `TIANJI_QUOTES` 部分重合） */
	corePhilosophy: [
		"大道至简——飞星飞来飞去太复杂，不搞这个",
		"命宫为本，三方为用",
		"人事努力+地理调整 > 先天命运（2/3 > 1/3）",
		"中医是物理医学，从物理角度分析人体",
		"辨证不辨病——中医看的是证型而非病名",
		"经方一剂知，二剂已",
		"不希望中华文化失传，所以教了许多学生",
		"算命就是一个讨论果的哲学",
		"文字只是船，真理才是彼岸",
	],
	/** 人生大事记，按时间先后排列，每项形如 `{ year 年份（可为 "1970s" 这类区间写法）, event 事件 }` */
	timeline: [
		{ year: "1954", event: "出生于台北市，祖籍浙江瑞安" },
		{ year: "1970s", event: "高中时以《医宗金鉴》治愈二姐月经痛，立志习医" },
		{ year: "1977-1981", event: "向周左宇医师学习针灸" },
		{ year: "1978", event: '军旅服役马祖军医部，获"马祖神医"称号，时年24岁' },
		{ year: "1979", event: '退伍后以化名"梵宇龙"开始算命看相事业' },
		{ year: "1980", event: "移民美国" },
		{ year: "1988", event: '在台北金山南路开办"天文地理班"，传授紫微斗数和阳宅风水' },
		{ year: "1991", event: "成为美国佛罗里达州注册针灸师" },
		{ year: "1993", event: "在佛州Merritt Island选定汉唐中医学院地产" },
		{ year: "1994", event: "完成《天纪》系列著作录制，共24集" },
		{ year: "1995", event: "创办汉唐中医学院" },
		{ year: "2000-2003", event: "任佛州卫生署中医委员会最高委员" },
		{ year: "2004", event: "在台北开设《人纪》中医教学班" },
		{ year: "2005", event: "《人纪》系列教学DVD出版" },
		{ year: "2007", event: "开始撰写《地纪》" },
		{ year: "2010", event: "成立台北汉唐经方中医诊所；受邀第三届扶阳论坛整天演讲" },
		{ year: "2011", event: "成立深圳汉唐经方中医馆" },
		{ year: "2012", event: "1月31日因心肺衰竭在台北辞世，享年59岁" },
	],
	/** 著作体系 */
	publications: {
		/** 原典八部（倪师讲授所本的八部经典） */
		originalBooks8: [
			"黄帝内经素问",
			"黄帝内经",
			"神农本草经",
			"针灸",
			"伤寒论",
			"金匮",
			"人间道",
			"天机道·地脉道",
		],
		/** 著作总册数（含注解版教材、医案全集、穴位精解等） */
		totalBooks: "26-44册（含注解版教材、医案全集、穴位精解等）",
		/** 汉唐方剂数量 —— 讲义口径的**硬编码值**；`HANTANG_FORMULAS` 实收 97 条，两者不一致（详见 `renji.ts`） */
		hantangFormulas: "汉唐100方",
		/** 经典经方数量 —— 讲义口径的**硬编码值**；`CLASSIC_FORMULAS` 实收 25 条精选，非全量（详见 `renji.ts`） */
		classicFormulas: "259个经典配方",
		/** 医案全集册数 */
		medicalCases: "医案全集7本",
		/** 教学视频总时长（三纪合计） */
		totalVideoHours: "200+小时",
	},
	/** 三纪体系 —— 各纪的纲要（细目见 `scripts/nihai/` 下的分册数据） */
	sanJi: {
		/** 天纪：上知天文，1994 年录制 */
		tianji: {
			/** 纪名 */
			name: "天纪",
			/** 一句话定位 */
			meaning: "上知天文",
			/** 涵盖的术数门类 */
			content: "紫微斗数、易经64卦、堪舆学、推命学、面相学、测字术",
			/** 录制年份 */
			recordYear: 1994,
			/** 原始集数（每集 2 小时） */
			episodes: 24,
			/** 高清版集数（与 `episodes` 不是同一口径，数值不同） */
			hdEpisodes: 83,
			/** 每集时长（小时） */
			hoursPerEpisode: 2,
			/** 总时长（小时）= episodes × hoursPerEpisode */
			totalHours: 48,
			/** 配套讲义 */
			books: ["天机道", "人间道", "地脉道", "64卦易图"],
			/** 各门类所属学派 */
			schools: [
				"三合派（紫微斗数）",
				"象数派（易经）",
				"九星派（堪舆）",
				"河洛数理派（推命）",
			],
			/** 课程编排 */
			structure: "前一小时讲命学，后一小时讲易经",
		},
		/** 人纪：中知人事，2004-2005 年完成 */
		renji: {
			/** 纪名 */
			name: "人纪",
			/** 一句话定位 */
			meaning: "中知人事",
			/** 五门经典课程及各自集数 */
			content: "针灸大成(44集)、黄帝内经(20集)、神农本草经(46集)、伤寒论、金匮要略(20集)",
			/** 完成年份 */
			completionYear: "2004-2005",
			/** 课程总集数 */
			totalLessons: "150+集",
			/** 建议学习顺序 */
			learningOrder: "针灸→黄帝内经→神农本草经→伤寒论→金匮要略",
			/** 针灸经验穴位数 —— 讲义口径的**硬编码值**；`ACU_EXPERIENCES` 实收 120 条，两者不一致（详见 `renji.ts`） */
			acuExperience: 215,
			/** 透针透穴法条数 —— 与 `TRANS_NEEDLING` 的实收条数一致（31） */
			transNeedling: 31,
			/** 汉唐方剂数 —— 讲义口径的**硬编码值**；`HANTANG_FORMULAS` 实收 97 条，两者不一致（详见 `renji.ts`） */
			hantangFormulas: 100,
		},
		/** 地纪：下知地理，倪师未竟之业 */
		diji: {
			/** 纪名 */
			name: "地纪",
			/** 一句话定位 */
			meaning: "下知地理",
			/** 涵盖内容 */
			content: "国家地理志（未完成）",
			/** 完成状态 */
			status: "倪师未竟之业",
			/** 未竟原因 */
			note: "原计划60岁后著述，2012年辞世",
			/** 着手年份 */
			startYear: 2007,
			/** 现存内容的来源 */
			existingContent: "天纪课程中堪舆学部分 + 后人整理遗稿",
		},
	},
	/**
	 * 人格特征。
	 *
	 * @remarks
	 * 字段名用的是中文键（本对象独有，其余对象的键都是英文）。
	 */
	personality: {
		/** 断命时的说话风格 */
		算命风格: "铁口直断不留余地",
		/** 个人音乐偏好 */
		音乐爱好: "最喜老鹰乐队《加州旅馆》",
		/** 生活自理能力 */
		生活技能: "做饭洗衣样样精通，一手面点功夫人人喊赞",
		/** 临证与治学态度 */
		工作态度: "床头经年放纸笔，遭遇疑难杂症时向先师祝祷",
		/** 作息 */
		睡眠: "多年夜间睡眠不足三小时",
		/** 患者对他的评价 */
		患者评价: '常被美国病患称为"最后的希望（The last hope）"',
	},
	/** 传人选拔标准 */
	discipleStandards: ["心性好", "个性强", "主见强", "敏锐观察力", "勇于批判错误理论"],
};

/**
 * 三纪导航 —— 天纪 / 地纪 / 人纪 三个入口的展示元数据。
 *
 * @remarks
 * 数组顺序为天纪 → 地纪 → 人纪（与文件顶部说明的行文次序一致），展示端按此顺序渲染。
 * `key` 与 {@link SanJiCategory} 同域；`href` 指向线上站点的对应栏目，
 * **本 skill 的 CLI 不用本常量**（CLI 走 `nihai --category tianji|diji|renji`）。
 */
export const SANJI_CATEGORIES = [
	{
		/** 分类键，与 {@link SanJiCategory} 同域 */
		key: "tianji" as const,
		/** 中文名 */
		name: "天纪",
		/** 英文名 */
		nameEn: "Tian Ji",
		/** 展示用图标字符 */
		icon: "⊙",
		/** 一句话定位 */
		meaning: "上知天文",
		/** 主题色（十六进制） */
		color: "#d4a843",
		/** 线上站点路由 */
		href: "/tianji",
	},
	{
		/** 分类键，与 {@link SanJiCategory} 同域 */
		key: "diji" as const,
		/** 中文名 */
		name: "地纪",
		/** 英文名 */
		nameEn: "Di Ji",
		/** 展示用图标字符 */
		icon: "⊞",
		/** 一句话定位 */
		meaning: "下知地理",
		/** 主题色（十六进制） */
		color: "#6b8a5e",
		/** 线上站点路由 */
		href: "/diji",
	},
	{
		/** 分类键，与 {@link SanJiCategory} 同域 */
		key: "renji" as const,
		/** 中文名 */
		name: "人纪",
		/** 英文名 */
		nameEn: "Ren Ji",
		/** 展示用图标字符 */
		icon: "⊕",
		/** 一句话定位 */
		meaning: "中知人事",
		/** 主题色（十六进制） */
		color: "#8b6b9e",
		/** 线上站点路由 */
		href: "/renji",
	},
] as const;
