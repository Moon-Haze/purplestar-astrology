/**
 * 紫微斗数领域模型 —— 内核、CLI 与测试之间的公共类型契约。
 *
 * 本模块**只有类型，不含任何逻辑**。每个字段的取值域（索引基、是否可选、单位）在此定死：
 * `algorithm.ts` 按它产出，`cli/render.ts` 按它渲染，`test/lib/compare.ts` 按它比对。
 *
 * 贯穿全项目的三套索引约定（三者**不同域**，混用必错）：
 * - **天干索引** 0–9，序同 `constants.ts` 的 `STEMS`（0=甲 … 9=癸）
 * - **地支索引** 0–11，序同 `constants.ts` 的 `BRANCHES`（0=子 … 11=亥）
 * - **时辰序号** 0–12，见 {@link BirthInfo.timeIndex} —— 比地支索引**多一个 12**（晚子时）
 *
 * @packageDocumentation
 */

/**
 * 出生信息 —— 排盘的唯一输入。
 *
 * ⚠️ 本接口同时承载「出生时刻」与「出生地」两类数据，`timeIndex` 与 `longitude` 的单位
 * 最易混淆（一个不是钟表时，一个不是地方时），改动前先看各自的字段说明。
 */
export interface BirthInfo {
	/** 公历年（四位，如 1990） */
	year: number;
	/** 公历月（1–12） */
	month: number;
	/** 公历日（1–31）。⚠️ 若真太阳时校正跨过午夜，此值已是**校正后**的日期（`cli/birth-info.ts` 用 `shiftDate` 调整） */
	day: number;
	/**
	 * **时辰序号**，取值 **0–12**：0=子 … 11=亥，**12=晚子时**。
	 *
	 * ⚠️ 这不是 0–23 的钟表时，也**不能**直接当 `BRANCHES` 的索引用（12 会越界）。
	 * 钟表时 → 时辰序号的换算（真太阳时经度校正、可选均时差、跨午夜日期回退）全部在
	 * `cli/birth-info.ts` 的 `calcTrueSolar` / `buildBirthInfo` 里完成，本字段消费的是其结果。
	 *
	 * 12 的语义是「子时，且要求按**晚子时算次日**安星」——它对应 iztro 的 `timeIndex` 12。
	 * 同一时刻按晚子时（12）与早子时（0）排出的是**两张不同的盘**，不是微调
	 * （实测：同一生日下 12 与 0 的紫微落宫都不同）。
	 *
	 * `cli/birth-info.ts` 只在两种情况下产出 12：`--branch 12` 直接指定，或 `--time` 的
	 * 真太阳时落在 23:00–23:59 且同时给了 `--late-zi`。其余情形一律产出 0–11。
	 */
	timeIndex: number;
	/**
	 * 性别。决定大限顺逆 —— 同一张盘男女的大限可差 80 年（26-35岁 ↔ 106-115岁），
	 * 故**必填、无默认值**：缺失时 `buildBirthInfo` 一律报错，不静默兜底成 male。
	 */
	gender: "male" | "female";
	/** 姓名，仅用于输出展示，不参与排盘 */
	name?: string;
	/** 出生省份（如「河北省」）。`--province` 回退时取该省 `cities[0]`（省会）的经度，不参与安星 */
	province?: string;
	/** 出生城市（如「石家庄」）。`cli/birth-info.ts` 的 `findLongitude` 按名查经度，不参与安星 */
	city?: string;
	/**
	 * 出生地经度，**东经为正**（北京 116.4）。
	 *
	 * 用途只有一个：真太阳时的**经度校正** `(经度 − 120) × 4` 分钟。查表值见
	 * `cities.ts` 的 `PROVINCES`；未给出生地时按 120 处理（即不做经度校正）。
	 */
	longitude?: number;
}

/**
 * 农历信息 —— 由公历生日换算而来，供输出展示与虚岁换算。
 *
 * 由 `algorithm.ts` 的 `getLunarInfo` 产出，**不参与安星**（iztro 的排盘入参本身就是公历）。
 */
export interface LunarInfo {
	/** 农历年，**以正月初一为界**（不是立春、也不是生日）——`currentAge` 的虚岁换算依赖此口径 */
	lunarYear: number;
	/**
	 * 农历月（1–12），**恒为正数**。
	 *
	 * ⚠️ 闰月不在此处用负号表达：`lunar-typescript` 的 `getMonth()` 确实以**负数月份**表示闰月，
	 * 但 `getLunarInfo` 取了 `Math.abs`，闰月与否单独由 {@link isLeapMonth} 标记。
	 */
	lunarMonth: number;
	/** 农历日（1–30） */
	lunarDay: number;
	/** 年柱天干索引 0–9（0=甲 … 9=癸）。查表未命中时兜底 0 */
	yearStem: number;
	/** 年柱地支索引 0–11（0=子 … 11=亥）。查表未命中时兜底 0 */
	yearBranch: number;
	/** 该农历月是否为闰月（即 `lunar-typescript` 负数月份口径的布尔化） */
	isLeapMonth: boolean;
}

/**
 * 四化类型 —— 禄 / 权 / 科 / 忌。
 *
 * ⚠️ 本项目只认**生年干四化**（倪师《天纪》：四化星永远固定不动）。
 * 大限四化取宫干、宫干自化等飞星派口径已主动下线，见 `.claude/CLAUDE.md`。
 */
export type Mutagen = "禄" | "权" | "科" | "忌";

/**
 * 一颗星曜在某宫的状态 —— 由 `algorithm.ts` 组装，是格局判定（`patterns/`）的输入。
 */
export interface Star {
	/** 星曜中文名（如「紫微」「擎羊」）。`algorithm.ts` 的吉煞名单与 `patterns/` 的格局表都按名索引 */
	name: string;
	/**
	 * 星曜类型，四选一：
	 * - `major` 主星 —— **只能**由 iztro 的 `type` 字段给出（吉煞两张名单里没有主星）
	 * - `sha`   煞星 —— 名字命中 `algorithm.ts` 的 `TOUGH_STARS` 时优先判定
	 * - `lucky` 吉星 —— 名字命中 `SOFT_STARS` 时优先判定
	 * - `minor` 其余（杂曜）—— 兜底值
	 */
	type: "major" | "minor" | "soft" | "tough";
	/**
	 * 生年四化标记，语义为 `"禄" | "权" | "科" | "忌"`。
	 *
	 * ⚠️ 直接取自 iztro 的 `mutagen`：**无四化时它给的是空字符串 `""`**，而类型上写的是
	 * 可选（`?`）——两种「无」在运行时都会出现。判空请用真值判断
	 * （`cli/render.ts` 的 `starLine` 即 `if (s.mutagen)`），**不要**写 `=== undefined`。
	 */
	mutagen?: Mutagen;
	/**
	 * 亮度，已归并成三档：`bright` 庙/旺、`dim` 陷/不、其余（含**缺省**）`normal`。
	 *
	 * ⚠️ **只有主星会被填** —— `algorithm.ts` 仅对 iztro 的 `majorStars` 调 `mapBrightness`，
	 * 次星与杂曜此字段为 `undefined`。下判决前记得判空。
	 */
	brightness?: "bright" | "normal" | "dim";
}

/**
 * 宫干自化的一颗星（宫干四化中「被化之星恰在本宫」的那一颗）。
 *
 * ⚠️ **飞星派遗留类型，本项目（三合派）不使用。这是一个刻意留下的绊线。**
 *
 * 「绊线」是什么意思：`algorithm.ts` 已停止填充 {@link Palace.selfMutagen}（倪师不主张
 * 飞星派宫干自化论），而断言要盯的**正是「有没有被填回」** —— 字段与类型删了，就无从盯起。
 * 所以它们留着，`cli/selftest.ts` 与 `test/school.test.ts` 各有一条断言守着
 * （断言名：「宫干自化未被填充」）。
 *
 * 会**生产**它的那些函数（`sihua.ts` 的 `detectSelfSihua` / `buildAllSelfSihua`）已删除 ——
 * 它们在**全仓**没有任何调用点，删除测试判定该消失。所以本类型如今
 * 既无生产者也无消费者，唯一的存在理由是上面那条断言。**存在不等于该用**，拿它解读
 * 就是背离本项目的体系立场。
 */
export interface SelfMutagenMark {
	/** 自化的类型：禄 / 权 / 科 / 忌 */
	mutagen: Mutagen;
	/** 自化的星名 */
	starName: string;
}

/**
 * 一个宫位 —— 十二宫之一。
 *
 * 身宫不单独占宫，而是与十二宫中的某一宫同宫，由 {@link isBodyPalace} 标记
 * （故一张盘里恰有一个宫位的该字段为 true）。
 */
export interface Palace {
	/**
	 * 地支索引 0–11（0=子 … 11=亥）。
	 *
	 * ⚠️ `ZiweiChart.palaces` 数组**不是**按此值升序排的，见 {@link ZiweiChart.palaces}。
	 */
	branch: number;
	/** 宫干（天干索引 0–9），直接取自 iztro 的 `heavenlyStem`；本项目仅用于展示，**不用它做四化** */
	stem: number;
	/**
	 * 宫名，一律为**本项目口径**（如「交友宫」，而非 iztro 的「仆役」）。
	 * 映射表见 `constants.ts` 的 `IZTRO_TO_PROJECT_PALACE`；未命中会抛错，不会回退原名。
	 */
	name: string;
	/** 本宫全部星曜，顺序固定为：主星 → 次星（iztro `minorStars`）→ 杂曜（`adjectiveStars`） */
	stars: Star[];
	/** 本宫所属大限的年龄段 `[起, 讫]`（**虚岁**，闭区间）。仅 iztro 给出 `decadal.range` 时有值 */
	decadalRange?: [number, number];
	/**
	 * 小限落在本宫的**虚岁**列表（如 `[9,21,33,…]`，每宫 10 个、十二宫并集连续覆盖 1–120）。
	 *
	 * 直接取自 iztro 静态盘的 `palace.ages` —— 小限的起宫与顺逆由 iztro 按生年支与性别
	 * 推定，本项目不重复实现。**虚岁域**，与 {@link decadalRange} / `ZiweiChart.currentAge` 同域，
	 * 以农历年（正月初一）为界。
	 */
	ages?: number[];
	/** 当前虚岁是否落在 {@link decadalRange} 内，由 `algorithm.ts` 逐宫标记 */
	isCurrentDecadal?: boolean;
	/** 是否命宫。与 {@link ZiweiChart.soulBranch} 指向同一宫 */
	isSoulPalace?: boolean;
	/** 是否身宫（身宫与十二宫之一同宫，故一盘中恰一个 true） */
	isBodyPalace?: boolean;
	/**
	 * 宫干自化结果。
	 *
	 * ⚠️ **飞星派字段，本项目（三合派）不使用，仅为兼容保留。**
	 * `algorithm.ts` 已停止填充此字段（倪师不主张飞星派宫干自化论），运行时恒为 `undefined`；
	 * `cli/selftest.ts` 与 `test/school.test.ts` 有断言盯着它不被重新填回。
	 */
	selfMutagen?: SelfMutagenMark[];
	/** 对宫地支索引，由 `./palace-relations` 的 `oppositeBranch` 算出（该式为全仓单点） */
	oppositeBranch?: number;
	/** 是否空宫（本宫**无主星**，即 `stars` 里没有 `major`） */
	isEmpty?: boolean;
	/** 空宫时借自哪一宫的地支索引，恒等于 {@link oppositeBranch}；非空宫为 `undefined` */
	borrowedFromBranch?: number;
	/** 空宫时借自那一宫的宫名；非空宫为 `undefined` */
	borrowedFromName?: string;
	/**
	 * 空宫时借到的对宫**主星**名列表（结构化数据，文案层无需再从文本反查）；非空宫为 `undefined`。
	 * 无主星的对宫会借到空数组（即「借无可借」，此时该宫按无主星论）。
	 */
	borrowedStars?: string[];
}

/**
 * 一个大限的四化四星（按大限**宫干**推）。
 *
 * ⚠️ **飞星派遗留类型，本项目（三合派）不使用。同 {@link SelfMutagenMark}，是刻意留下的绊线。**
 *
 * `algorithm.ts` 已停止生成 `decadals[].mutagen`（本项目大限只看宫位移动，四化永远取生年干），
 * 而断言要盯的正是「有没有被填回」—— 字段与类型删了，就无从盯起。
 *
 * 生产者 `sihua.ts` 的 `getDecadalMutagen` 已删除（全仓零调用点）。
 * **存在不等于该用**。
 */
export interface DecadalMutagen {
	/** 大限宫的天干索引 0–9（0=甲 … 9=癸） */
	stemIndex: number;
	/** 大限宫的天干名（如「戊」） */
	stemName: string;
	/** 化禄星名 */
	lu: string;
	/** 化权星名 */
	quan: string;
	/** 化科星名 */
	ke: string;
	/** 化忌星名 */
	ji: string;
}

/**
 * 一个大限 —— 十年运程区间。
 *
 * 由 `algorithm.ts` 汇总十二宫的 `decadalRange` 生成，按起始虚岁**升序**排列。
 */
export interface Decadal {
	/** 起始虚岁（闭区间下端） */
	startAge: number;
	/** 结束虚岁（闭区间上端） */
	endAge: number;
	/** 本大限所在宫的地支索引 0–11 */
	palaceBranch: number;
	/** 本大限所在宫的宫名（项目口径） */
	palaceName: string;
	/**
	 * ⚠️ **飞星派字段，已停止生成**（`algorithm.ts` 不再填，运行时恒为 `undefined`）。
	 * 原含义：大限宫的天干索引，供大限四化取宫干用。仅为兼容旧前端保留。
	 */
	stemIndex?: number;
	/** ⚠️ **飞星派字段，已停止生成**（同 {@link stemIndex}）。原含义：大限宫的天干名 */
	stemName?: string;
	/** ⚠️ **飞星派字段，已停止生成**（同 {@link stemIndex}）。原含义：该大限的四化。类型见 {@link DecadalMutagen} */
	mutagen?: DecadalMutagen;
}

/**
 * 一张完整命盘 —— 内核的最终产物，也是 CLI 渲染、合盘、流年、格局判定的公共输入。
 *
 * 由 `algorithm.ts` 的 `generateChart` 产出：只做组装，不做推算（安星交给 iztro）。
 */
export interface ZiweiChart {
	/** 本次排盘所用的出生信息，原样回传（下游据此取经度与**已校正**的日期） */
	birthInfo: BirthInfo;
	/** 农历信息 */
	lunarInfo: LunarInfo;
	/** 命宫地支索引 0–11 */
	soulBranch: number;
	/** 身宫地支索引 0–11 */
	bodyBranch: number;
	/** 五行局局数，取值 2–6：2 水二局 / 3 木三局 / 4 金四局 / 5 土五局 / 6 火六局 */
	fiveElementsClass: number;
	/**
	 * 五行局名，iztro 原文（如「水二局」）。
	 *
	 * ⚠️ 局数 {@link fiveElementsClass} 是**取局名首字五行查表**（`constants.ts` 的 `ELEMENT_TO_JU`）
	 * 解析出来的，首字非五行时兜底成 3（木三局）；而本字段永远是 iztro 的原文。
	 * 两者可能不一致，**展示以本字段为准**。
	 */
	fiveElementsClassName: string;
	/** 紫微星所在宫的地支索引 0–11 */
	ziweiPos: number;
	/**
	 * 十二宫。
	 *
	 * ⚠️ **数组顺序不是地支升序**，而是 iztro 的原生顺序：实测 `branch` 序列恒为
	 * `2,3,4,5,6,7,8,9,10,11,0,1`（自寅宫起，绕到丑宫）。因此：
	 * - **按 `branch` 建索引**（`palaces.find(p => p.branch === b)`），不要依赖数组下标；
	 * - 要按「子→亥」或任何其它顺序展示，得自己排（`cli/render.ts` 就是显式 `sort` 后再渲染）。
	 */
	palaces: Palace[];
	/** 全部大限，按起始虚岁升序 */
	decadals: Decadal[];
	/** 命主星名（如「贪狼」）。直接取自 iztro 静态盘的 `soul`，由命宫地支查表定星 */
	mingZhu: string;
	/** 身主星名（如「火星」）。直接取自 iztro 静态盘的 `body`，由身宫地支查表定星 */
	shenZhu: string;
	/**
	 * **子年斗君**所在宫的地支索引 0–11：以子宫起正月**逆数**至生月，再以生月宫起子时
	 * **顺数**至生时，所落之宫。斗君是流月定位的基准（流年正月自斗君宫起）。
	 *
	 * ⚠️ iztro 静态盘**不带**斗君，此字段由 `algorithm.ts` 按上式自推（已用 2000-4-6 子时男
	 * = 戌、1990-05-15 巳时男 = 寅 两组样例校准）。闰月按所闰之月数计（与 `lunarInfo.lunarMonth`
	 * 的 `Math.abs` 口径一致）；晚子时（timeIndex 12）按子时论。
	 */
	douJunBranch: number;
	/** 当前**虚岁**，以农历年（正月初一）为界，与 `decadalRange` / `decadals[].startAge` **同域** */
	currentAge: number;
	/** 当前大限在 {@link decadals} 中的下标；`-1` 表示虚岁尚未落进任何大限（童限未起运） */
	currentDecadalIndex: number;
}
