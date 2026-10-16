/**
 * 默认流派适配器：文墨排盘 + 倪海厦《天纪》三合派（Phase 3 · SchoolAdapter 接缝）
 *
 * 现行"文墨亮度 + 倪师论断框架 + 飞星禁用"整体封进本适配器。它是 `SCHOOLS` 注册表的
 * 唯一（默认）项；加新流派时本文件不被改动，只新增一个 `schools/<id>.ts` + 一行注册。
 *
 * ⚠️ **引用而非迁移**（守住 0C 冻结红线）：
 * - `defaultBrightnessSchool: "XD2"` 只是引用冻结内核 `wenmo-brightness.ts` 的默认流派常量，
 *   **不**在本文件调用 `setBrightnessSchool`（不改内核运行时状态）；
 * - `citationRoots[].checklist` 直接 import 内核的 `ANNOTATIONS`（全局唯一核对表），
 *   **不**复制一份——避免核对表副本漂移；
 * - `scanRoot` 解析到本 skill 的 `scripts/`，与 `citations.test.ts` 原扫根完全一致，覆盖零退化。
 *
 * 三条「引用而非迁移」的完整论证（守住 0C 冻结红线），见 docs/code/school.md。
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ANNOTATIONS } from "../../corpus/data/annotations.ts";
import type { SchoolAdapter } from "../types";

const HERE = dirname(fileURLToPath(import.meta.url));
// scanRoot = 本 skill 的 scripts/（与 citations.test.ts 原扫根完全一致，覆盖零退化）
const SCRIPTS_ROOT = resolve(HERE, "../..");

/** 文墨排盘 + 倪海厦《天纪》三合派（默认流派）。 */
export const wenmoNishiSchool: SchoolAdapter = {
	id: "wenmo-nishi",
	label: "文墨排盘 + 倪海厦《天纪》三合派",
	// 引用冻结内核的默认亮度流派（wenmo-brightness.ts 默认即 XD2），不改内核状态
	defaultBrightnessSchool: "XD2",
	// 倪师三合派论断框架
	assertionFramework:
		"命宫为本，三方为用；人事努力 + 地理调整 > 先天命运（2/3 > 1/3）；大道至简，解读不停留于术语堆砌",
	// 继承飞星派绊线语义（声明式）
	forbiddenFeatures: ["self-mutagen", "lai-yin"],
	// 引文核对表引用内核 ANNOTATIONS（不复制）；扫本 skill 全 scripts/（倪师内容遍布全仓）
	citationRoots: [{ scanRoot: SCRIPTS_ROOT, checklist: ANNOTATIONS }],
};
