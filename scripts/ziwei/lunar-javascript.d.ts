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
 *
 * ⚠️ 与上文「只列出真正用到的成员」略有出入：`getMonthGan` / `getMonthZhi` / `getDayGan` /
 *    `getDayZhi` 四个成员**目前全项目 0 处调用**（`grep -rn "getMonthGan(" scripts/` 可证），
 *    属预留声明——月/日干支不在当前输出里。删掉这四个不影响任何运行行为。
 */
declare module "lunar-javascript" {
	class Lunar {
		/** 农历转公历的入口。**月份传负数表示闰月**（如 -4 = 闰四月） */
		static fromYmd(year: number, month: number, day: number): Lunar;
		/** 农历年 */
		getYear(): number;
		/** 农历月。⚠️ **负数表示闰月**（-4 = 闰四月），取 `Math.abs` 才得月份数 */
		getMonth(): number;
		/** 农历日 */
		getDay(): number;
		/** 年干，单字（甲…癸） */
		getYearGan(): string;
		/** 年支，单字（子…亥） */
		getYearZhi(): string;
		/** 月干，单字。**预留：目前无人调用** */
		getMonthGan(): string;
		/** 月支，单字。**预留：目前无人调用** */
		getMonthZhi(): string;
		/** 日干，单字。**预留：目前无人调用** */
		getDayGan(): string;
		/** 日支，单字。**预留：目前无人调用** */
		getDayZhi(): string;
		/** 转为对应的公历日期（{@link Solar}） */
		getSolar(): Solar;
	}

	class Solar {
		/** 公历日期入口，用于排盘与农历反查 */
		static fromYmd(year: number, month: number, day: number): Solar;
		/** 转为对应的农历日期（{@link Lunar}） */
		getLunar(): Lunar;
		/** 公历年 */
		getYear(): number;
		/** 公历月（1–12，**恒为正**——闰月是农历概念，公历没有） */
		getMonth(): number;
		/** 公历日 */
		getDay(): number;
	}
}
