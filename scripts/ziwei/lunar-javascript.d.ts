/**
 * lunar-javascript 的最小类型声明。
 *
 * 该包不带类型，npm 上也没有 @types/lunar-javascript，所以自行声明。此处只列出
 * 本项目真正用到的成员，共两条调用链：
 *   ① 内核 getLunarInfo()：Solar.fromYmd → getLunar → 年/月/日与年干支
 *   ② CLI 的 --lunar 农历换算：Lunar.fromYmd → getSolar → 公历 年/月/日
 * 两条链互为逆运算，故两个方向的方法都要声明。将来用到更多成员，在此补充。
 *
 * 纯类型文件，运行时不存在：Node 的类型擦除会忽略它，排盘不依赖它。
 */
declare module "lunar-javascript" {
	class Lunar {
		/** 农历转公历的入口；月份为负数表示闰月 */
		static fromYmd(year: number, month: number, day: number): Lunar;
		getYear(): number;
		getMonth(): number; // 负数表示闰月
		getDay(): number;
		getYearGan(): string;
		getYearZhi(): string;
		getMonthGan(): string;
		getMonthZhi(): string;
		getDayGan(): string;
		getDayZhi(): string;
		getSolar(): Solar;
	}

	class Solar {
		static fromYmd(year: number, month: number, day: number): Solar;
		getLunar(): Lunar;
		getYear(): number;
		getMonth(): number;
		getDay(): number;
	}
}
