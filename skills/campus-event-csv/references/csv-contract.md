# 竞赛雷达 CSV 约定

依据项目 `src/main.tsx` 的 `CSV_HEADERS`、`normalizeRecord`、`importCSV` 及 `src/eventDates.ts` 整理。项目路径：`D:/Study250711/coding_projects/campus_competetion`。维护时间：2026-10-04。

## 表头与字段

必须保留全部 18 个表头，推荐沿用以下顺序：

```csv
id,title,organizer,category,tags,description,source_url,registration_start,registration_deadline,event_start,event_end,location,eligibility,status,participation_decision,priority,notes,last_verified
```

| 字段 | 写入规则 |
| --- | --- |
| id | 必填且文件内唯一。新增使用稳定 UUID 或可区分届次和阶段的 ID，旧活动保持原 ID。 |
| title | 必填，使用核实名称；需要时包含届次或阶段以消除歧义。 |
| organizer | 按通知填写，不把发布院系自动视为赛事主办方。 |
| category | 客观分类；未知用“未分类”。 |
| tags | 英文分号分隔，去除空白与重复；无标签留空。 |
| description | 依据来源概述活动内容。 |
| source_url | 主要来源的完整 URL；未知留空。当前网页拒绝文件内重复的非空 URL。 |
| registration_start | 报名开始日期，未知留空。 |
| registration_deadline | 当前报名阶段截止日期，未知留空。精确时刻和时区写入 notes。 |
| event_start | 活动开始日期，未知留空。 |
| event_end | 活动结束日期，未知留空，不因缺失而自动复制开始日期。 |
| location | 地点或线上方式，未知留空。 |
| eligibility | 原通知报名资格；不据此自动断定用户符合资格。 |
| status | CSV 仅 open（按日期自动判断）、closed（手动报名结束）、ended（手动已结束）。open 不是断言报名中：网页按日期可显示 upcoming（尚未开始）或 unknown（时间待定）。unknown/upcoming 不能写入 CSV。人工结束状态需有依据或用户明确决定。 |
| participation_decision | 必填 yes/maybe/no，分别为确定参加/不一定/确定不参加。新记录默认 maybe。 |
| priority | 新记录默认“中”，用户可指定“高”“中”“低”；保留旧值。 |
| notes | 保留个人备注，并补充必要来源、具体截止时刻、阶段差异及待核实事项。 |
| last_verified | 实际读取并核验来源的日期，不是文件生成日期。未完成外部核验时留空；部分核验须在 notes 说明范围。 |

所有非空日期必须是有效 `YYYY-MM-DD` 日历日期。不能将“十月”“待通知”等文字放入日期列，可保留于备注。合理检查同一阶段的起止先后，不机械要求报名截止早于活动开始。

## 导入语义

- 网页使用浏览器 localStorage 的 `campus-events`，项目文件夹中没有用户当前清单。
- CSV 导入全量替换，不能用仅新增 CSV 假装完成追加合并。
- 同 ID 的收藏 `starred` 由网页从当前列表保留；CSV 没有收藏列，不能通过 CSV 跨浏览器恢复收藏。新 ID 默认不收藏。
- CSV 中同 ID 或同非空 `source_url` 重复会导致整次导入失败，旧列表保持不变。
- 一份通知涵盖多个不同活动时，先查找真实独立活动页面。若没有，可在预览说明：主通知 URL 放入各条 notes，选定一条的 source_url 保留该 URL，其余留空；用户确认此映射后生成。不能添加虚假查询参数或片段来绕过重复检查。
- 状态空值被网页默认为 open，优先级空值默认为“中”，分类空值默认为“未分类”。生成时显式填写已确认状态，缺失日期明确标待核实。人工 ended 或已过活动结束日期显示已结束；人工 closed 或已过报名截止显示报名结束；未来报名开始显示尚未开始；两个报名日期都缺失显示时间待定；否则报名中。日期当天不视为已过期。
- 用 CSV 库处理逗号、引号与换行，不手工拼接。编码 UTF-8 BOM，推荐 CRLF 行尾。
