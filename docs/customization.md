# Customization Guide

## 1) 修改期刊源（直接编辑）
文件：`packages/or-research-hub-mcp/subscriptions.json`

格式示例：
```json
{
  "id": "transportation-science",
  "name": "Transportation Science",
  "group": "INFORMS",
  "enabled": true,
  "url": "https://pubsonline.informs.org/action/showFeed?jc=trsc&type=etoc"
}
```

建议：
- `id` 保持稳定且唯一。
- `url` 先用浏览器验证可访问。
- 修改后调用 `refresh_subscriptions` 强制刷新。

## 2) 动态增删期刊（工具调用）
- 增加：`subscribe_journal`
- 删除：`unsubscribe_journal`
- 查看：`list_subscriptions`

## 3) 调整抓取规模
在 `refresh_subscriptions`、`daily_push`、`intelligence_search` 中调：
- `maxFeeds`
- `limitPerFeed`
- `concurrency`

## 4) 调整摘要深度
在检索/推送中调：
- `includeFulltext: true/false`
- `includeSAR: true/false`
- `limit`

## 5) 修改输出位置
`daily_push` / `save_brief_markdown` 传 `outputDir` 可定向输出目录。

## 6) 常见问题
- 返回为空：一般是检索条件过严或当天无新增；可先放宽 `keywords` 验证链路。
- 刷新失败：通常是源站超时或临时反爬；可降低并发并重试。
