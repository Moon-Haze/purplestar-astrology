/**
 * lunar-javascript 的最小类型声明。
 *
 * 该包不带类型，npm 上也没有 @types/lunar-javascript，所以自行声明。此处只列出
 * 内核真正用到的成员——即 getLunarInfo() 的那条调用链：
 * Solar.fromYmd → getLunar → 年/月/日与年干支。将来内核若用到更多成员，在此补充。
 *
 * 纯类型文件，运行时不存在：Node 的类型擦除会忽略它，排盘不依赖它。
 */
declare module "lunar-javascript" {
	class Lunar {
		getYear(): number;
		getMonth(): number; // 负数表示闰月
		getDay(): number;
		getYearGan(): string;
		getYearZhi(): string;
		getMonthGan(): string;
		getMonthZhi(): string;
		getDayGan(): string;
		getDayZhi(): string;
	}

	class Solar {
		static fromYmd(year: number, month: number, day: number): Solar;
		getLunar(): Lunar;
	}
}
