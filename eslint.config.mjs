// ESLint v10 flat config（取代旧的 .eslintrc.json）
//
// 说明：
// 1. 项目使用 TypeScript 7（原生编译器）。typescript-eslint 家族包在加载时会
//    硬性拒绝 TS 7 并抛错，且其解析核心依赖 TS 6 的 JS API，无法在 TS 7 下工作。
//    因此使用 @babel/eslint-parser（Babel 的 TypeScript 语法插件）解析 .ts 文件，
//    与 TypeScript 版本完全解耦。
// 2. 不使用 eslint-plugin-prettier：它与 @babel/eslint-parser 的 worker 线程
//    组合会在 ESLint 10 下死锁（实测挂起）。格式化请用独立命令：
//    `npm run format`（prettier --write）。eslint-config-prettier 仍保留，
//    用于关闭与 Prettier 冲突的格式类 lint 规则。
// 3. 仅支持语法级规则（curly 等），不含 TS 语义规则（如类型相关的
//    no-unused-vars 变体），待 typescript-eslint 官方支持 TS 7 后再接入。
import js from "@eslint/js";
import babelParser from "@babel/eslint-parser";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
	{
		ignores: ["node_modules/**", "db/**", "html/**", "dist/**", "**/*.min.*", ".history/**", "office-sleep-poster_assets/**"],
	},
	js.configs.recommended,
	eslintConfigPrettier,
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
		languageOptions: {
			parser: babelParser,
			parserOptions: {
				requireConfigFile: false,
				babelOptions: {
					parserOpts: {
						// 启用 TypeScript 语法解析
						plugins: ["typescript"],
					},
				},
			},
			sourceType: "module",
			globals: {
				console: "readonly",
				process: "readonly",
				Buffer: "readonly",
				URL: "readonly",
				setTimeout: "readonly",
				clearTimeout: "readonly",
				setInterval: "readonly",
				clearInterval: "readonly",
			},
		},
		rules: {
			// 强制所有语句块使用大括号：单行 if / for / while 不允许省略 {}，--fix 可自动补全
			curly: ["error", "all"],
			// TS 文件关闭以下核心规则，均交给 TypeScript 编译器负责：
			// - no-undef：作用域分析不覆盖 TS 类型语法
			// - no-unused-vars：会把 `import type` 及类型注解中的引用误报为未使用
			//   （实测本项目 169 处全是此类误报）。待 typescript-eslint 官方支持
			//   TS 7 后，换用其 @typescript-eslint/no-unused-vars 接管。
			"no-undef": "off",
			"no-unused-vars": "off",
			// 存量代码中全角空格等不可见空白为刻意排版，不按错误处理
			"no-irregular-whitespace": "off",
			// ESLint 10 新规则：catch 中重抛错误建议携带 cause。存量代码 10 处，
			// 以警告提示、不阻塞 lint，后续按需补 `cause` 后消除
			"preserve-caught-error": "warn",
		},
	},
];
