#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

// 从同目录 .env 加载凭证(若存在),避免明文传入命令行
function loadDotEnv() {
  try {
    const txt = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch (e) { /* 无 .env 则忽略,回退到系统环境变量 */ }
}

// 钉钉 OA 审批发起 - 请假 (新版「应用」模型: api.dingtalk.com/v1.0)
// 子命令:
//   describe : 拉取审批模板字段结构(确认表单 name)
//   submit   : 发起审批实例
// 环境变量:
//   DINGTALK_APP_ID       (新版必填) 应用 AppId(GUID)
//   DINGTALK_APPKEY       (兼容) 原 AppKey / Client ID
//   DINGTALK_APPSECRET    (必填) 应用 Secret / Client Secret
//   DINGTALK_PROCESS_CODE (可选) 请假模板 processCode, 默认测试demo「请假」
//   DINGTALK_USER_ID      (submit/describe 必填) 发起人 userId
//   DINGTALK_DEPT_ID      (submit 可选) 发起人部门ID, 缺省 -1(根部门)

const DEFAULT_PROCESS_CODE = 'PROC-A343C419-9DBC-41B8-A25F-095CBCD6C232';
const GATEWAY = 'https://api.dingtalk.com/v1.0';

function env(name, fallback) {
  const v = process.env[name];
  return (v === undefined || v === '') ? fallback : v;
}

// 新版鉴权: oauth2/accessToken (appKey + appSecret)
async function getToken(appKey, appSecret) {
  const res = await fetch(`${GATEWAY}/oauth2/accessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appKey, appSecret })
  });
  const j = await res.json();
  const token = j.accessToken || j.access_token;
  if (!token) throw new Error(`oauth2/accessToken 失败: ${JSON.stringify(j)}`);
  return token;
}

async function apiGet(token, path) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: 'GET',
    headers: { 'x-acs-dingtalk-access-token': token, 'Content-Type': 'application/json' }
  });
  return res.json();
}

async function apiPost(token, path, body) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: 'POST',
    headers: { 'x-acs-dingtalk-access-token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function describe(token, processCode) {
  // 新版: GET /workflow/forms/schemas/processCodes?processCode=...  (获取表单 schema)
  const j = await apiGet(token, `/workflow/forms/schemas/processCodes?processCode=${encodeURIComponent(processCode)}`);
  return j;
}

async function submit(token, processCode, originator, fields, deptId) {
  // 新版: POST /workflow/processInstances
  const body = {
    processCode,
    originatorUserId: originator,
    formComponentValueList: fields.map(f => ({ name: f.name, value: f.value }))
  };
  if (deptId !== undefined && deptId !== '') body.deptId = Number(deptId);
  const j = await apiPost(token, '/workflow/processInstances', body);
  return j;
}

async function readStdin() {
  const chunks = [];
  for await (const ch of process.stdin) chunks.push(ch);
  return Buffer.concat(chunks).toString('utf8').trim();
}

function extractFields(j) {
  // 新版 process 详情里表单字段可能在多个位置, 尽力提取
  const candidates = [
    j && j.result && j.result.formComponents,
    j && j.result && j.result.processFields,
    j && j.formComponents,
    j && j.processFields,
    j && j.data && j.data.formComponents
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return null;
}

async function main() {
  loadDotEnv();
  const cmd = process.argv[2];
  if (!cmd) {
    console.error('用法: node dingtalk_leave.js <describe|submit>');
    process.exit(2);
  }
  const appKey = env('DINGTALK_APPKEY');
  const appSecret = env('DINGTALK_APPSECRET');
  if (!appKey || !appSecret) {
    console.error('缺少环境变量 DINGTALK_APPKEY / DINGTALK_APPSECRET');
    process.exit(1);
  }
  const processCode = env('DINGTALK_PROCESS_CODE', DEFAULT_PROCESS_CODE);
  const userId = env('DINGTALK_USER_ID');
  const token = await getToken(appKey, appSecret);

  if (cmd === 'describe') {
    const j = await describe(token, processCode);
    const fields = extractFields(j);
    const out = {
      processCode,
      rawResult: j,
      fields: fields ? fields.map(c => ({
        id: c.id,
        name: c.name,
        bizAlias: c.bizAlias,
        componentType: c.componentType,
        required: c.required
      })) : '未能自动定位表单字段, 请查看 rawResult'
    };
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (cmd === 'submit') {
    if (!userId) { console.error('submit 需要环境变量 DINGTALK_USER_ID(发起人 userId)'); process.exit(1); }
    let fieldsArg = null;
    let deptId = env('DINGTALK_DEPT_ID');
    for (let i = 3; i < process.argv.length; i++) {
      if (process.argv[i] === '--fields') { fieldsArg = process.argv[i + 1]; i++; }
      if (process.argv[i] === '--dept-id') { deptId = process.argv[i + 1]; i++; }
    }
    if (!fieldsArg) fieldsArg = await readStdin();
    if (!fieldsArg) { console.error('submit 需要 --fields \'[{"name":"...","value":"..."}]\' 或从 stdin 读取'); process.exit(1); }
    let fields;
    try { fields = JSON.parse(fieldsArg); }
    catch (e) { console.error('fields 不是合法 JSON:', e.message); process.exit(1); }
    const j = await submit(token, processCode, userId, fields, deptId);
    console.log(JSON.stringify({ success: !j.code && j.code !== 0 ? false : (j.code === 0 || j.success === true), raw: j }, null, 2));
    return;
  }

  console.error('未知子命令:', cmd);
  process.exit(2);
}

main().catch(e => { console.error('错误:', e.message); process.exit(1); });
