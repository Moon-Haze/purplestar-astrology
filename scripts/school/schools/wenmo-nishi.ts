/**
 * @file 文墨+倪师三合派适配器。@remarks 「引用而非迁移」守 0C：wenmo-brightness.ts 不镜像（禁「内核无运行时流派旋钮」）；ANNOTATIONS 直引；scanRoot 同 citations.test.ts；见 docs/code/school.md。
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ANNOTATIONS } from "../../corpus/data/annotations.ts";
import type { SchoolAdapter } from "../types";

const HERE = dirname(fileURLToPath(import.meta.url));
// scanRoot=scripts/
const SCRIPTS_ROOT = resolve(HERE, "../..");

/** 默认流派。 */
export const wenmoNishiSchool: SchoolAdapter = {
	id: "wenmo-nishi",
	label: "文墨排盘 + 倪海厦《天纪》三合派",
	// 继承飞星派绊线
	forbiddenFeatures: ["self-mutagen", "lai-yin"],
	// checklist 直引 ANNOTATIONS
	citationRoots: [{ scanRoot: SCRIPTS_ROOT, checklist: ANNOTATIONS }],
};
