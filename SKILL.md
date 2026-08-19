---
name: dingtalk-leave
description: 钉钉 OA 审批「请假」自动化发起。当用户想在钉钉提交请假审批、用对话发起请假、或说"钉钉请假/发起请假/提交请假单/请假到钉钉"时使用。封装钉钉 topapi/processinstance/create API,实现从 WorkBuddy 对话一键把请假单提交到钉钉,领导在钉钉端即可审批。
---

# 钉钉请假 (dingtalk-leave)

通过钉钉开放平台「发起审批实例」API,在 WorkBuddy 对话里直接提交请假单到钉钉 OA 审批,领导在钉钉端即可审批。这是 WorkBuddy→钉钉请假「全自动化」路线的落地 skill(`dws oa` 当前未暴露发起审批命令,故直连钉钉审批发起 API)。

## 前置依赖
- Node.js 22+(内置 fetch,无需安装依赖)。
- 钉钉应用凭证(用于换取 access_token):
  - `DINGTALK_APPKEY` — 钉钉应用 AppKey
  - `DINGTALK_APPSECRET` — 钉钉应用 AppSecret
  - 该应用需具备「审批」相关权限,且发起人/模板在该应用可见范围内。
- 环境变量(可选/必填):
  - `DINGTALK_PROCESS_CODE` — 请假模板 processCode,默认 `PROC-A343C419-9DBC-41B8-A25F-095CBCD6C232`(测试demo「请假」模板)
  - `DINGTALK_USER_ID` — 发起人 userId(submit 必填)

## 工作流
1. **确认模板字段**(首次或模板变更时):
   ```
   DINGTALK_APPKEY=xxx DINGTALK_APPSECRET=your_dingtalk_appsecret_here node dingtalk_leave.js describe
   ```
   返回该模板的字段列表(`name`/`alias`/`type`/`required`)。记录 `name`(表单标题),submit 时用它作 form_component_values 的 name。
2. **收集请假信息**(对话中向用户索取,或用户直接给出):
   - 请假类型(如 事假/病假/年假/调休)
   - 开始时间、结束时间(ISO8601 或模板要求的格式)
   - 请假时长(天/小时,按模板字段)
   - 请假事由
   - (可选)审批人、抄送人
3. **发起审批**:
   ```
   DINGTALK_APPKEY=xxx DINGTALK_APPSECRET=your_dingtalk_appsecret_here DINGTALK_USER_ID=用户ID node dingtalk_leave.js submit --fields '[{"name":"请假类型","value":"事假"},{"name":"开始时间","value":"2026-08-05 09:00"},{"name":"结束时间","value":"2026-08-05 18:00"},{"name":"请假事由","value":"家中有事"}]'
   ```
   返回 `processInstanceId` 即提交成功。
4. **反馈与跟踪**:把 processInstanceId 和"已在钉钉提交,等待审批"告知用户;可配合 `dws oa approval list-initiated --process-code <code>` 跟踪进度,或 `dws oa approval list-pending` + `approve` 帮领导在钉钉审批侧处理。

## 注意事项
- 外部写操作(提交审批)执行前**必须先向用户确认**请假信息无误,且用户已配置好凭证。
- 凭证切勿硬编码/写入仓库,一律走环境变量。
- form_component_values 的 `name` 必须与模板字段标题一致(用 describe 输出核对);字段名不对会报 `form_field_not_match`。
- 测试demo 为测试企业,审批人链路可能不完整;真实请假请用对应企业的应用凭证与模板 processCode。
- 钉钉 API 文档参考: https://open.dingtalk.com/document/orgapp/initiate-approval
