/**
 * 五行数据 —— 纳音五行、五行局局数与局名（2026-10-11 从 `constants.ts` 拆出，逐字迁移）。
 *
 * ⚠️ `ELEMENT_TO_JU` 与 `JU_NAMES` 的**状态不对等是刻意的**（前者已被消费、后者仅为
 *    数据留存），见到这处不对称不必"顺手补齐"。
 *
 * 完整口径见 docs/code/data-tables.md。
 *
 * @packageDocumentation
 */

/**
 * 纳音五行（30 组干支对的五行）。
 *
 * 索引为六十甲子的**组号**，即甲子序号（0 起）÷ 2：第 n 项对应第 2n、2n+1 两组干支的
 * 纳音五行（如 index 0 = 甲子/乙丑 → 「金」）。值为单个汉字五行
 * （「金」「火」「木」「土」「水」）。
 *
 * ⚠️ 当前 `scripts/` 与 `test/` 中**无消费者**：排盘由 iztro 完成，纳音不参与安星，
 * 也没有任何渲染或断言读它。仅为数据留存，**改它不会影响现有输出**。
 */
export const NAYIN_ELEMENTS = [
	"金",
	"火",
	"木",
	"土",
	"金",
	"火",
	"水",
	"土",
	"金",
	"木",
	"水",
	"土",
	"火",
	"木",
	"水",
	"金",
	"火",
	"木",
	"土",
	"金",
	"火",
	"水",
	"土",
	"金",
	"木",
	"水",
	"土",
	"火",
	"木",
	"水",
];

/**
 * 五行 → 五行局局数。
 *
 * 键是单个汉字五行（「水」「木」「金」「土」「火」），值为局数 2–6。
 *
 * 消费者：`algorithm.ts` 的 `parseWuxingJu` —— 取局名首字五行查本表得出局数。
 *
 * ⚠️ 改本表会改变 `ZiweiChart.fiveElementsClass`，从而改变 300 条基准的对标结果。两处独立预言机
 * 盯着这条映射：`test/invariants.test.ts` 的「五行局取值 2-6 且名称与数字对应」用的是
 * 表外自带的字面量表，`test/lib/compare.ts` 比对的 `fiveElementsClass` 则来自 toolkit 的样本快照。
 */
export const ELEMENT_TO_JU: Record<string, number> = {
	水: 2,
	木: 3,
	金: 4,
	土: 5,
	火: 6,
};

/**
 * 五行局局数 → 局名（如 2 → 「水二局」）。
 *
 * ⚠️ 当前无消费者：运行时展示的是 iztro 的原文 `ZiweiChart.fiveElementsClassName`，不经本表。
 * 它与 {@link ELEMENT_TO_JU} 成对（五行 ↔ 局数 ↔ 局名），仅为数据留存 ——
 * 两表的状态不对等是刻意的，不必"顺手补齐"。
 */
export const JU_NAMES: Record<number, string> = {
	2: "水二局",
	3: "木三局",
	4: "金四局",
	5: "土五局",
	6: "火六局",
};
