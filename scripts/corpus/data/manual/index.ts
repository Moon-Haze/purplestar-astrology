/**
 * 断语手册数据（analysis/manual/）的查询入口 —— 按主题懒加载。
 *
 * ⚠️ 本目录是**生成数据**（内核域 analysis/manual，不在 analysis/index.ts 公开面）：CLI 主链路不
 * import 这些文件（零启动开销），需要消费时经本入口动态引入。
 *
 * ⚠️ 生成文件 —— 由 `npx tsx tools/db/export-manual.ts code` 生成，**不要手改**。
 */
import type { TopicKey } from "../../../analysis/data";
import type { OracleStar } from "./types.ts";

export type { OracleStar, SanFangEntry, SihuaEntry } from "./types.ts";
/** 一个主题的断语全集：主星 → 分类断语集（mods/summary/patterns/mainPalace/sanFang/…）。 */
export type StarTopicOracle = Readonly<Record<string, OracleStar>>;
export type { ComboFrequency } from "./combo-frequency.ts";
export { COMBO_FREQUENCY } from "./combo-frequency.ts";

const LOADERS: Record<TopicKey, () => Promise<{ ORACLE: StarTopicOracle }>> = {
	overview: () => import("./overview.ts"),
	personality: () => import("./personality.ts"),
	love: () => import("./love.ts"),
	career: () => import("./career.ts"),
	wealth: () => import("./wealth.ts"),
	health: () => import("./health.ts"),
	family: () => import("./family.ts"),
	children: () => import("./children.ts"),
	move: () => import("./move.ts"),
	friends: () => import("./friends.ts"),
	home: () => import("./home.ts"),
	spirit: () => import("./spirit.ts"),
	parents: () => import("./parents.ts"),
	study: () => import("./study.ts"),
};

/** 加载一个主题的断语全集；文件缺失（未导出）时抛带指引的错误。 */
export async function loadTopicOracle(topic: TopicKey): Promise<StarTopicOracle> {
	try {
		return (await LOADERS[topic]()).ORACLE;
	} catch (e) {
		throw new Error(
			`断语数据 ${topic} 未生成。先 npx tsx tools/db/export-manual.ts code（前置：npm run build:db）。` +
				` 原始错误：${e instanceof Error ? e.message : String(e)}`
		);
	}
}
