/**
 * 打包分发件：把要分发的文件收成一个 zip。**不拍平、不改任何内容。**
 *
 * ## 收哪些
 *
 * 就 4 项，与实际分发口径一致：
 *
 * ```text
 * purplestar-astrology/
 * ├── SKILL.md
 * ├── package.json
 * ├── references/*.md
 * └── scripts/**          ← 多层子目录原样带走
 * ```
 *
 * **不要拍平 `scripts/`。** 内核定位走 `boot-hooks` 的 `pickRoot`（脚本自身所在目录），
 * 与目录层级无关 —— 实测原样拷贝后 `selftest` 151/151 全绿。拍平要重写 371 处
 * import 与动态 `load()` 字面量，收益零、风险全是（`load<>("@/x")` 是字符串字面量，
 * 正则抓不到，漏改的症状是「产物启动即无法加载 @/cli/dispatch」）。
 *
 * zip 顶层目录名**必须与 frontmatter 的 `name` 一致**：宿主按目录名发现技能，
 * 不一致则不触发（症状是「技能存在但永远唤不起」）。
 *
 * ## 为什么自己写 ZIP 而不调 `zip` 命令
 *
 * 1. **字节可复现**：时间戳全写固定值，同输入必然同产物字节 —— 外层 `zip` 会把
 *    文件 mtime 写进去，同一份源码打两次得到不同字节，等于没有「锁定分发件」。
 * 2. **零外部依赖**：只用 `node:zlib` + `node:fs`，Windows / 无 zip 的环境同样能跑
 *    （skill 用户的机器不保证有 Info-ZIP）。
 *
 * ## 验证
 *
 * `npm run pack` 打完后默认**自动解压到临时目录并跑一遍 `selftest`** ——
 * 「zip 能生成」不等于「装上能用」（漏文件、路径写错、解压后层级不对，都只在这一步暴露）。
 * `--no-verify` 跳过。
 *
 * ```bash
 * npm run pack              # 打 zip + 解压自检
 * npm run pack -- --no-verify
 * ```
 */

import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

/** 包名 = frontmatter 的 name = 宿主发现技能用的目录名。三者必须一致。 */
const PKG = "purplestar-astrology";
const OUT = resolve(ROOT, "dist", `${PKG}.zip`);

/** 要分发的顶层项（顺序固定 → 产物字节可复现） */
const INCLUDE = ["SKILL.md", "package.json", "references", "scripts"] as const;

/** 目录内排除项：`scripts/` 下理论上没有，但一旦有人手滑拷进来也不该进包 */
const EXCLUDE_DIRS = new Set(["node_modules", ".git", ".cache"]);

// ── 枚举（排序固定，否则产物字节随文件系统返回序漂移） ──────────────

interface Entry {
	/** zip 内的完整路径，posix 分隔符，形如 `purplestar-astrology/SKILL.md` */
	path: string;
	abs: string;
	size: number;
}

function walk(absDir: string, zipPrefix: string, acc: Entry[]): void {
	const names = readdirSync(absDir).sort(); // 排序是「字节可复现」的一半
	for (const name of names) {
		if (EXCLUDE_DIRS.has(name)) {
			continue;
		}
		const abs = join(absDir, name);
		const st = statSync(abs);
		const zipPath = `${zipPrefix}/${name}`;
		if (st.isDirectory()) {
			walk(abs, zipPath, acc);
		} else if (st.isFile()) {
			acc.push({ path: zipPath, abs, size: st.size });
		}
		// 符号链接等一律跳过：分发件不该带指向仓库的链接
	}
}

function collect(): Entry[] {
	const acc: Entry[] = [];
	for (const item of INCLUDE) {
		const abs = resolve(ROOT, item);
		const st = statSync(abs);
		if (st.isDirectory()) {
			walk(abs, `${PKG}/${item}`, acc);
		} else {
			acc.push({ path: `${PKG}/${item}`, abs, size: st.size });
		}
	}
	return acc;
}

// ── ZIP 写出（纯 node:zlib） ────────────────────────────────────

/**
 * 固定时间戳：全部条目用同一个 DOS 时间，保证同输入 → 同字节。
 * 2020-01-01 00:00:00。
 */
const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;
const DOS_TIME = 0;

/**
 * 把若干条目写成一个 zip 缓冲区。
 *
 * @remarks
 * 实现的最小 ZIP 子集：deflate 压缩 + 32 位 CRC + 无 extra field / 无 Zip64。
 * 分发件全部条目 < 4 GB、单文件 < 65535 字节名，那些都用不上 ——
 * 写它们只会增加出错面。本仓最大条目是 `scripts/corpus/data/manual/overview.ts`
 * （约 500 KB），离两个上限都很远。
 */
function buildZip(entries: Entry[]): Buffer {
	const locals: Buffer[] = [];
	const centrals: Buffer[] = [];
	let offset = 0;

	for (const e of entries) {
		const raw = readFileSync(e.abs);
		const name = Buffer.from(e.path, "utf8");
		const deflated = deflateRawSync(raw, { level: 9 });
		// 压不小（本就压缩过的内容）就存原始，省一层 deflate 无谓的开销
		const useDeflate = deflated.length < raw.length;
		const data = useDeflate ? deflated : raw;
		const method = useDeflate ? 8 : 0;
		const crc = crc32(raw);

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0); // 本地文件头签名
		local.writeUInt16LE(20, 4); // 解压所需版本 2.0
		local.writeUInt16LE(0, 6); // 通用标志位
		local.writeUInt16LE(method, 8);
		local.writeUInt16LE(DOS_TIME, 10);
		local.writeUInt16LE(DOS_DATE, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(data.length, 18); // 压缩后大小
		local.writeUInt32LE(raw.length, 22); // 原始大小
		local.writeUInt16LE(name.length, 26);
		local.writeUInt16LE(0, 28); // extra 长度
		locals.push(local, name, data);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0); // 中央目录头签名
		central.writeUInt16LE(0x031e, 4); // 由 Unix 生成，版本 3.0
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(0, 8);
		central.writeUInt16LE(method, 10);
		central.writeUInt16LE(DOS_TIME, 12);
		central.writeUInt16LE(DOS_DATE, 14);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(data.length, 20);
		central.writeUInt32LE(raw.length, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt16LE(0, 30); // extra
		central.writeUInt16LE(0, 32); // 注释
		central.writeUInt16LE(0, 34); // 起始磁盘号
		central.writeUInt16LE(0, 36); // 内部属性
		central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // 外部属性 = Unix 0644
		central.writeUInt32LE(offset, 42); // 本地头偏移
		centrals.push(central, name);

		offset += local.length + name.length + data.length;
	}

	const centralBuf = Buffer.concat(centrals);
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0); // 中央目录结束记录签名
	eocd.writeUInt16LE(0, 4); // 本磁盘号
	eocd.writeUInt16LE(0, 6); // 中央目录起始磁盘号
	eocd.writeUInt16LE(entries.length, 8); // 本磁盘条目数
	eocd.writeUInt16LE(entries.length, 10); // 总条目数
	eocd.writeUInt32LE(centralBuf.length, 12);
	eocd.writeUInt32LE(offset, 16); // 中央目录偏移
	eocd.writeUInt16LE(0, 20); // 注释长度
	return Buffer.concat([...locals, centralBuf, eocd]);
}

// ── 自检：解压 + 真跑 ────────────────────────────────────────────

/**
 * 解压刚写出的 zip 到临时目录，并跑一遍 `selftest`。
 *
 * @remarks 用 Node 自写解压（同样只依赖 zlib），不调外部 `unzip`。
 * 顺带验证两件容易漏的事：① 条目数与中央目录一致（截断会在这里暴露）；
 * ② 解压出来的字节与源文件逐字节相同（压缩/写入环节没掉数据）。
 */
function verify(zip: Buffer, entries: Entry[]): void {
	// 逐条解析中央目录（EOCD → 中央目录 → 各条目的本地头）
	const eocdIdx = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
	if (eocdIdx < 0) {
		throw new Error("产物里找不到中央目录结束记录 —— 结构损坏");
	}
	const total = zip.readUInt16LE(eocdIdx + 10);
	if (total !== entries.length) {
		throw new Error(`条目数对不上：中央目录记 ${total}，实际写入 ${entries.length}`);
	}

	let p = zip.readUInt32LE(eocdIdx + 16);
	for (let i = 0; i < total; i++) {
		if (zip.readUInt32LE(p) !== 0x02014b50) {
			throw new Error(`第 ${i} 条中央目录签名不对`);
		}
		const method = zip.readUInt16LE(p + 10);
		const compSize = zip.readUInt32LE(p + 20);
		const rawSize = zip.readUInt32LE(p + 24);
		const nameLen = zip.readUInt16LE(p + 28);
		const extraLen = zip.readUInt16LE(p + 30);
		const commentLen = zip.readUInt16LE(p + 32);
		const localOff = zip.readUInt32LE(p + 42);
		const name = zip.subarray(p + 46, p + 46 + nameLen).toString("utf8");

		if (zip.readUInt32LE(localOff) !== 0x04034b50) {
			throw new Error(`${name} 的本地文件头签名不对`);
		}
		const lNameLen = zip.readUInt16LE(localOff + 26);
		const lExtraLen = zip.readUInt16LE(localOff + 28);
		const dataStart = localOff + 30 + lNameLen + lExtraLen;
		const data = zip.subarray(dataStart, dataStart + compSize);

		// 写盘并逐字节对拍
		const expected = readFileSync(resolve(ROOT, name.replace(`${PKG}/`, "")));
		const got = method === 8 ? inflateRawSync(data) : data;
		if (!got.equals(expected)) {
			throw new Error(
				`${name} 解压后与源文件不一致（${rawSize} vs ${expected.length} 字节）`
			);
		}
		p += 46 + nameLen + extraLen + commentLen;
	}

	// 真跑：装到临时目录跑 selftest。node_modules 不在分发件里（依赖声明在 package.json，
	// 落位后用户自己 `npm install`），这里软链仓库那份只为验证「装上能不能跑」。
	// 用软链而非拷贝：4548 个文件拷一遍要好几秒，且验证完即删，拷它没有意义。
	const workDir = mkdtempSync(resolve(tmpdir(), `${PKG}-verify-`));
	try {
		extractAll(zip, workDir);
		const skillDir = resolve(workDir, PKG);
		spawnSync(
			"ln",
			["-sfn", resolve(ROOT, "node_modules"), resolve(skillDir, "node_modules")],
			{
				stdio: "ignore",
			}
		);

		const r = spawnSync(
			process.execPath,
			[resolve(skillDir, "scripts", "purple-star.ts"), "selftest"],
			{
				cwd: skillDir,
				encoding: "utf8",
				env: { ...process.env, ZIWEI_NO_CACHE: "1" },
			}
		);
		const stdout = `${r.stdout ?? ""}`;
		const first = stdout.split("\n")[0] ?? "";
		if (r.status !== 0) {
			throw new Error(
				`解压后 selftest 失败（EXIT ${r.status}）：\n${first}\n${`${r.stderr ?? ""}`
					.split("\n")
					.slice(0, 5)
					.join("\n")}`
			);
		}
		const skipped = (stdout.match(/⏭/g) ?? []).length;
		console.log(
			`  自检：解压后 selftest ${first.replace(/^.*—— 通过 /, "通过 ")}` +
				`（${skipped} 条标 ⏭ 跳过：仓库级文档不分发，属预期）`
		);
	} finally {
		rmSync(workDir, { recursive: true, force: true });
	}
}

/** 解压全条目到目标目录（仅 store/deflate，够本脚本自己写的产物用） */
function extractAll(zip: Buffer, dest: string): void {
	let p = zip.readUInt32LE(zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) + 16);
	const total = zip.readUInt16LE(zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) + 10);
	for (let i = 0; i < total; i++) {
		const method = zip.readUInt16LE(p + 10);
		const compSize = zip.readUInt32LE(p + 20);
		const nameLen = zip.readUInt16LE(p + 28);
		const extraLen = zip.readUInt16LE(p + 30);
		const commentLen = zip.readUInt16LE(p + 32);
		const localOff = zip.readUInt32LE(p + 42);
		const name = zip.subarray(p + 46, p + 46 + nameLen).toString("utf8");
		const lNameLen = zip.readUInt16LE(localOff + 26);
		const lExtraLen = zip.readUInt16LE(localOff + 28);
		const data = zip.subarray(
			localOff + 30 + lNameLen + lExtraLen,
			localOff + 30 + lNameLen + lExtraLen + compSize
		);
		const out = resolve(dest, name);
		mkdirSync(dirname(out), { recursive: true });
		writeFileSync(out, method === 8 ? inflateRawSync(data) : data);
		p += 46 + nameLen + extraLen + commentLen;
	}
}

// ── 主流程 ──────────────────────────────────────────────────────

const verifyOpt = !process.argv.includes("--no-verify");

const entries = collect();
const zip = buildZip(entries);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, zip);

const rawTotal = entries.reduce((n, e) => n + e.size, 0);
console.log(`打包完成 → dist/${PKG}.zip`);
console.log(`  条目 ${entries.length} 个（SKILL.md / package.json / references/ / scripts/）`);
console.log(`  ${(rawTotal / 1024).toFixed(0)} KB → ${(zip.length / 1024).toFixed(0)} KB`);
console.log(`  顶层目录 ${PKG}/（须与 frontmatter name 一致，宿主据此发现技能）`);
console.log(`  时间戳固定 → 同输入同字节，可复现`);

if (verifyOpt) {
	verify(zip, entries);
	console.log("自检：中央目录条目数一致 + 逐条解压字节对拍通过");
} else {
	console.log("\n下一步：node dist/<解包目录>/scripts/purple-star.ts selftest");
}
