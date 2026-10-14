# distribution Specification

## Purpose

把仓库打成可拷贝到宿主技能目录的分发件，并让「zip 能生成」与「装上能用」两件事分别有证据。
分发形态是**拷贝 + `npm install`** 的单 skill 形态——不引入构建步骤、不引入外部包。

## Requirements

### Requirement: 分发件只含四项

`npm run pack` SHALL 产出 `dist/purplestar-astrology.zip`，只含四项：
`SKILL.md`、`package.json`、`references/`、`scripts/`。

仓库级文档（`CLAUDE.md` / `README.md` / `test/` / `docs/` / `db/` / `tools/` / `dist/`）
SHALL NOT 进入分发件。`dist/` SHALL 在 `.gitignore` 内。

`node_modules/` 不在包内，落位后需自行 `npm install`。

#### Scenario: 包内容核对

- **WHEN** 检查 zip 的条目清单
- **THEN** 顶层只有 `SKILL.md`、`package.json`、`references/`、`scripts/` 四项，无仓库级文档

### Requirement: 顶层目录名须与 frontmatter 一致

zip 内顶层目录 SHALL 为 `purplestar-astrology`，与 `SKILL.md` frontmatter 的 `name` 逐字一致。
宿主按目录名发现技能，不一致则技能永远唤不起。

#### Scenario: 名称不匹配

- **WHEN** zip 顶层目录名与 frontmatter `name` 不一致
- **THEN** 视为不可用分发件

### Requirement: 字节可复现

打包器 SHALL 使用固定 DOS 时间戳，使同一份源码多次构建产出**完全相同的 sha256**，
用户可据此校验包未被改动。（外层 `zip` 命令会把文件 mtime 写进包，同一份源码打两次字节就不同。）

#### Scenario: 三次构建

- **WHEN** 同一份源码连续执行三次 `npm run pack`
- **THEN** 三次产物的 sha256 完全相同

### Requirement: 零外部命令

打包器 SHALL 只依赖 `node:zlib`，不调用 `zip` / `unzip` 等外部命令，
使无 Info-ZIP 的机器与 Windows 环境同样可用。

实现范围限 deflate + 32 位 CRC，不实现 Zip64（条目 < 4 GB、名 < 64 KB，本仓离上限极远）。

#### Scenario: 无 Info-ZIP 环境

- **WHEN** 机器上没有安装 `zip` 命令
- **THEN** `npm run pack` 仍可完成

### Requirement: 打包后自检

打包器 SHALL 在打完包后自动解压到临时目录并运行 `selftest`，全绿才算成功。
`--no-verify` 可跳过该步。

**自己解压自己验不算自证**：改动打包逻辑后，须另用 `unzip -t` 或
`python -c "import zipfile"` 交叉验证。

#### Scenario: 分发形态自检

- **WHEN** 在分发形态下运行 `selftest`
- **THEN** 全绿，且仓库级断言被显式跳过并标 `⏭`（该项在分发件里读不到文件）

#### Scenario: 自检失败

- **WHEN** 解压后 `selftest` 有断言失败
- **THEN** 打包命令报错，不产出「看起来成功」的包

### Requirement: 不拍平 scripts/

`scripts/` 的多层子目录 SHALL 原样收进包，**不得**为目录扁平而拍平。

内核定位走 `boot-hooks` 的 `pickRoot`（脚本自身所在目录），与目录层级无关；拍平要重写数百处
import 与动态 `load<>("@/…")` 字符串字面量，收益为零。后者是**字符串字面量**，
正则批量替换抓不到，typecheck 也抓不到（类型参数与字符串无关），漏改只在运行时炸。

#### Scenario: 拍平的收益与风险

- **WHEN** 有人提议拍平 `scripts/` 以「符合两级目录约束」
- **THEN** 先问该约束在用户的实际分发方式（本地拷贝 zip）下是否成立；拷贝分发不适用该约束

### Requirement: 包内文件定位不写死层级

代码 SHALL 一律走 `ctx.root`（= `scripts/`）定位包内文件，不写 `ROOT/../..` 这类上溯——
目录层数一变就静默找错文件。

#### Scenario: 层级变化

- **WHEN** `scripts/` 下子目录层级调整
- **THEN** 包内文件定位仍正确，不因上溯层级失配而找错
