# AI Code Review

讓 Claude 審查 Pull Request 的 diff，結果寫成 PR 上的一則留言，每次 push 都更新同一則。

留言的結構（用簡單的短句，沒看過這個 repo 的人也看得懂）：

1. **結論列**：合併建議與各嚴重度的問題數。
2. **總體評價**：最多 5 句，加上六個面向的評等表，每個面向一兩句評語。六個面向是程式設計、意圖與正確性、並行與交易一致性、安全性、時間與空間複雜度、coding style 一致性。
3. **流程走查**：從這次變更的進入點一步步追到出口，標出每一步可能壞掉的地方。
4. **發現的問題**：嚴重與重要的直接展開，建議類收合。每則附上「目前的程式碼」與「建議改法」兩個 code block。目前的程式碼由 action 從 diff 直接截取，不經過模型。
5. **最終評語**：合併前必須處理的事。

留言超過 GitHub 的長度上限時，從最輕微的發現開始省略，並註明省略了幾則。

## 安全模型

- **AI 零權限**：呼叫 Claude 時不提供任何 tool。它拿不到 token、不能讀檔、不能連網，只能回傳固定格式的 JSON。
- **權限只在 action 自己的程式**：用 job 的 `GITHUB_TOKEN` 讀 PR、寫留言。這個 token 只限所在的 repo，job 結束就失效。
- **PR 內容當資料處理**：PR 標題、描述與 diff 放在含隨機值的分隔標籤裡，system prompt 明確說明裡面的內容不是指令。
- **AI 的輸出先檢查再貼**：
  - 只有指向 diff 中實際存在的行的發現才附連結與引用程式碼，其餘只顯示位置。
  - 模型的文字先用 GFM 解析器轉成語法樹，只保留段落、條列、強調、表格與程式碼，再轉回 markdown。程式碼以外的 `@` 提及、`#123` 參照、連結、圖片與 HTML 一律失效。
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
| `src/markdown.ts` | 清洗模型輸出的 markdown |
| `src/render.ts` | 組留言 |
