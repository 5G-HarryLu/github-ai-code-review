# AI Code Review

讓 Claude 審查 Pull Request 的 diff，結果寫成 PR 上的一則留言，每次 push 都更新同一則。

## 安全模型

- **AI 零權限**：呼叫 Claude 時不提供任何 tool。它拿不到 token、不能讀檔、不能連網，只能回傳固定格式的 JSON。
- **權限只在 action 自己的程式**：用 job 的 `GITHUB_TOKEN` 讀 PR、寫留言。這個 token 只限所在的 repo，job 結束就失效。
- **PR 內容當資料處理**：PR 標題、描述與 diff 放在含隨機值的分隔標籤裡，system prompt 明確說明裡面的內容不是指令。
- **AI 的輸出先檢查再貼**：
  - 檔名或行號對不上 diff 的發現直接捨棄。
  - `@` 提及、連結、圖片與 HTML 在程式碼區塊以外一律失效。
  - 每個欄位都有長度上限。
- **執行時零安裝**：相依套件打包在 `dist/index.js`，CI 會檢查它和原始碼一致。

PR 裡藏的指令仍可能讓 AI 漏報，所以 AI review 只供參考，不能當合併門檻。

## 使用方式

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review]

concurrency:
  group: ai-code-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  review:
    # 跳過草稿與版本合併 PR（分支名稱依各 repo 調整）
    if: ${{ !github.event.pull_request.draft && !contains(fromJSON('["develop","uat","staging"]'), github.head_ref) }}
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: 5G-HarryLu/github-ai-code-review@<commit SHA>
        with:
          claude-api-key: ${{ secrets.CLAUDE_API_KEY }}
```

不需要 `actions/checkout`，也不需要 PAT。

| Input | 必填 | 預設 | 說明 |
|---|---|---|---|
| `claude-api-key` | 是 | | Anthropic API key |
| `model` | 否 | `claude-opus-5-5` | Claude 模型 |
| `github-token` | 否 | `${{ github.token }}` | 讀 PR、寫留言用 |

Output：`comment-url`。

## 會送給 Claude 的內容

- PR 標題、描述、作者、分支，以及每個改動檔案的 diff（標上新檔案的行號）。
- 不送：lockfile、自動產生的檔案、`dist/`、`vendor/`、被刪除的檔案、GitHub 沒有提供 diff 的檔案。
- diff 總量上限約 40 萬字元，超過的檔案不送。所有沒送的檔案都會列在留言裡。
- Claude 拒絕審查時，API 會改用 Anthropic 建議的備援模型重跑（`fallbacks: "default"`）。留言頁尾會顯示實際作答的模型。

## 開發

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build   # 更新 dist/index.js，要一起 commit
```

| 檔案 | 職責 |
|---|---|
| `src/main.ts` | 串起整個流程 |
| `src/github.ts` | 所有 GitHub API 呼叫（唯一拿得到 token 的地方） |
| `src/context.ts` | 挑選送審檔案、大小預算 |
| `src/diff.ts` | 在 diff 上標新檔案行號 |
| `src/prompt.ts` | system prompt 與 PR 資料的包裝 |
| `src/review.ts` | 呼叫 Claude（無 tools、structured output） |
| `src/render.ts` | 驗證與清洗輸出、組留言 |
