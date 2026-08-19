# dingtalk-leave

> 来源分类：**待确认** ｜ 导出批次：review

钉钉 OA 审批「请假」自动化发起。当用户想在钉钉提交请假审批、用对话发起请假、或说"钉钉请假/发起请假/提交请假单/请假到钉钉"时使用。封装钉钉 topapi/processinstance/create API,实现从 WorkBuddy 对话一键把请假单提交到钉钉,领导在钉钉端即可审批。

## 安装

把本文件夹整体复制到 WorkBuddy 技能目录：

```bash
cp -r . ~/.workbuddy/skills/dingtalk-leave        # 用户级
# 或
cp -r . <项目>/.workbuddy/skills/dingtalk-leave   # 项目级
```

重启/刷新 WorkBuddy 后即可在对话中触发。

## 说明

- 本技能从本地 WorkBuddy 环境导出，**所有真实密钥已脱敏为占位符**，使用前请配置你自己的 API Key。
- 若来自技能市场（文件夹名以 `__skillhub` 结尾），版权归原作者，请遵守其许可证。
