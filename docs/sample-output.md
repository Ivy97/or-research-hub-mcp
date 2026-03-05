# Sample Outputs

## Sample A: `refresh_subscriptions`
```json
{
  "total": 23,
  "success": 23,
  "failed": 0,
  "updatedCount": 23
}
```

## Sample B: `daily_push`（严格港口/AGV条件）
```json
{
  "today": "2026-03-05",
  "scanned": 0,
  "pushed": 0,
  "filePath": "E:\\Desktop\\sanctions on job posting\\complete_process\\Daily_Pulse_OR_2026-03-05.md"
}
```

> 注：`scanned=0` 表示“该日+该检索条件”未命中，不代表 MCP 不可用。

## Sample C: `intelligence_search`（宽松条件）
```json
{
  "total": 3,
  "results": [
    {
      "title": "Electric vehicle scheduling problem considering time-of-use electricity price",
      "evidenceSource": "openalex",
      "sar": {
        "structured": {
          "researchProblem": "...",
          "researchMotivation": "...",
          "method": { "framework": "...", "components": [] },
          "experimentDesign": { "researchQuestionAndMotivation": "..." },
          "experimentResults": { "positiveFindings": "..." },
          "insights": { "futureWork": "..." }
        }
      }
    }
  ]
}
```
