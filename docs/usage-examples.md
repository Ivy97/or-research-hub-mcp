# Usage Examples

## Example 1: 今日推送（港口/AGV/码头）
调用：
```json
{
  "name": "daily_push",
  "arguments": {
    "query": "港口 AGV 码头 调度",
    "keywords": ["港口", "码头", "AGV", "调度", "port", "terminal", "quay", "yard", "scheduling"],
    "limit": 5,
    "includeFulltext": true,
    "refresh": true
  }
}
```

返回字段重点：
- `today`
- `scanned`
- `pushed`
- `filePath`

## Example 2: 检索 2025 文献并生成结构化分析
调用：
```json
{
  "name": "intelligence_search",
  "arguments": {
    "yearFrom": 2025,
    "yearTo": 2025,
    "keywords": ["港口", "码头", "AGV", "调度", "port", "terminal", "quay", "yard", "scheduling"],
    "limit": 8,
    "includeSAR": true,
    "includeFulltext": true,
    "refresh": false
  }
}
```

返回字段重点：
- `total`
- `results[].title`
- `results[].evidenceSource`
- `results[].sar.structured`

## Example 3: 快速查询缓存
调用：
```json
{
  "name": "query_subscribed_papers",
  "arguments": {
    "query": "quay crane scheduling",
    "limit": 10,
    "sinceDays": 365,
    "refresh": false
  }
}
```

返回字段重点：
- `total`
- `returned`
- `results[]`
