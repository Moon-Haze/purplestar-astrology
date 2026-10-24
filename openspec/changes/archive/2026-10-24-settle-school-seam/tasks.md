# Tasks

## 1. 接口收窄

- [x] 1.1 全仓 grep `defaultBrightnessSchool` 与 `assertionFramework` 引用，确认除定义处外零消费（判据：grep 记录附于勾选，若有隐性消费者先停下重新评估）
  - 复核记录：scripts/ test/ tools/ 全树 grep，除 school/types.ts 与 schools/wenmo-nishi.ts 定义处外零命中
- [x] 1.2 从 `SchoolAdapter` 接口与 `schools/wenmo-nishi.ts` 删两字段（判据：`npm run typecheck` 零错误）
- [x] 1.3 `SchoolId` 去 `(string & {})` 逃生舱，新流派路径显式化（types 联合 + registry 加一行）（判据：typecheck 零错误；`test/school.test.ts` 全绿）
  - 附带：`SCHOOL_IDS` 的 `Object.keys` 在封闭联合下需 `as SchoolId[]` 断言（键域由 `Record<SchoolId, …>` 保证，TS 的 keys 签名历史问题）；school.test 7 pass

## 2. 如实化收尾

- [x] 2.1 guard.ts 空分支注释如实化：lai-yin 守护由 `test/school.test.ts` 绊线断言承担，guard 不做运行时检查（判据：注释与实际行为一致；`forbiddenFeatures` 两特征声明保留不动）
- [x] 2.2 `DEFAULT_SCHOOL_ID` 与 SCHOOLS 键名的手写重复单点化（判据：同值字面量全仓仅一处定义，typecheck 零错误）
  - 实现：`DEFAULT_SCHOOL_ID = SCHOOL_IDS[0]`（注册表首键派生，键序即概览顺序的既有语义）
- [x] 2.3 五闸门：typecheck / selftest / npm test / lint / format（判据：全绿；`test/school.test.ts` 绊线断言一字未动且通过）
  - 实测：typecheck 0 错、selftest 159/159、npm test 605/605、lint 0 errors（9 条既有警告）、format 干净

## Workflow follow-up

- 归档前：`openspec validate` 通过；确认 extensibility 需求折回后「插件引用而非迁移」新 scenario（适配器镜像内核默认值）在册
- docs/code/school.md 若仍描述被删字段，随归档同步（检查项，非本任务范围）
