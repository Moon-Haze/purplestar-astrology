# review-gate —— 代码评审闸门（tools/review-gate.ts）

本篇覆盖 `tools/review-gate.ts` 的逐字节对拍区块注释。分类判据见 [README.md](README.md)。
条目为源码长注释的**原文搬迁**（2026-11-01，enforce-code-style-checker change）。

---

## 一、逐字节对拍：三条实测教训

> 本会话手工做过三次，每次都踩坑，故固化成工具：
>   ① 快照落 /tmp → 它会被清空 → cmp 对**两个都不存在**的文件返回失败
>      → 9 个场景全报 DIFFERS，差点当成「改动破坏了全部输出」否掉一次正确改动。
>      故快照落**仓库内** .review-tmp/（已 .gitignore），并逐个校验快照非空。
>   ② `cmd | grep -c X && next` 在零匹配时 grep 返回 1、next 根本不执行 ——
>      闸门"跑过"是假的。故比对前**显式校验每个快照**，校验不过报「验证手段失准」
>      并以失败退出，**绝不**报成 DIFFERS。
>   ③ stash 必须保证还原。故用 try/finally，并核对还原后的工作区与 stash 前一致。
