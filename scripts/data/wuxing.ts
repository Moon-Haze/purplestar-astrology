/**
 * 五行数据：纳音五行、五行局局数与局名（从 `constants.ts` 拆出，逐字迁移）。
 * ⚠️ `ELEMENT_TO_JU` 已消费、`JU_NAMES` 仅数据留存，状态不对等是刻意的，不必补齐。
 * 口径见 docs/code/data-tables.md。
 * @file 五行数据
 *
 * @packageDocumentation
 */

/**
 * 纳音五行（30 组干支对）。索引为六十甲子组号（甲子序号÷2），第 n 项对应第 2n/2n+1
 * 组（index 0 = 甲子/乙丑 → 「金」），值为「金」「火」「木」「土」「水」之一。
 * ⚠️ `scripts/`/`test/` 无消费者（排盘由 iztro 完成，纳音不安星），仅数据留存，改它
 * 不影响输出。
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
 * 五行 → 局数。键为「水」「木」「金」「土」「火」，值 2–6。消费者：`algorithm.ts`
 * 的 `parseWuxingJu` 取局名首字查表。
 * ⚠️ 改表会变 `ZiweiChart.fiveElementsClass`，动 385 条基准。两处预言机盯此映射：
 * `test/invariants.test.ts` 的「五行局取值 2-6 且名称与数字对应」用表外字面量表，
 * `test/lib/compare.ts` 比对的 `fiveElementsClass` 来自 fixtures（v4 数据集与本仓同源，
 * 独立性由血统链与指纹对账保证）。
 */
export const ELEMENT_TO_JU: Record<string, number> = {
	水: 2,
	木: 3,
	金: 4,
	土: 5,
	火: 6,
};

/**
 * 局数 → 局名（2 → 「水二局」）。⚠️ 无消费者：运行时展示 iztro 的
 * `ZiweiChart.fiveElementsClassName`，不经本表。与 {@link ELEMENT_TO_JU} 成对，
 * 仅数据留存，状态不对等是刻意的。
 */
export const JU_NAMES: Record<number, string> = {
	2: "水二局",
	3: "木三局",
	4: "金四局",
	5: "土五局",
	6: "火六局",
};
