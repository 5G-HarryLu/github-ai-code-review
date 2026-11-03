# AI Code Review

讓 Claude 審查 Pull Request 的 diff，結果寫成 PR 上的一則留言，每次 push 都更新同一則。

留言的結構（短句，沒看過這個 repo 的人也看得懂）：

1. **結論**：這次修改造成的 ⛔ 必須改善幾項、💡 建議改善幾項，加上兩句總評。base 本來就有的問題只附註數量，不算進結論。
2. **問題清單**：必須改善的排在前面。每則包含短標題、位置連結、所屬面向（程式設計、意圖與正確性、並行與交易一致性、安全性、時間與空間複雜度、coding style），最多三句說明，以及「目前」與「改善後」兩個 code block。「目前」的程式碼由 action 從 diff 或原始碼直接截取，不經過模型。
   - **📦 既有問題**：不是這次修改造成、但在 diff 或呼叫端片段裡看得到的問題，只報會造成錯誤結果的，摺疊在問題清單後面。修改讓既有問題更容易發生或影響更大的，算這次造成的。
3. **Call stack**：action 從 diff 找出被修改的函式，在 PR head 用 `git grep` 找出誰呼叫它，以及修改的程式碼呼叫了哪些函式，畫成呼叫樹，再附上 AI 對呼叫端與被呼叫端影響的評語。目前支援 Go、C#、TypeScript / JavaScript；依名稱比對，同名函式可能被誤認。
4. **審查範圍**：送審與未送審的檔案數、未送審的原因，以及 **沒有判斷的部分**：AI 考慮過、但因為超出 PR 目的或缺少資訊（設定檔、schema、沒送審的檔案）而沒有下結論的行為，最多 5 則。

留言超過 GitHub 的長度上限時，依序從既有問題、建議改善開始省略，並註明省略了幾則。

## 安全模型

- **AI 零權限**：呼叫 Claude 時不提供任何 tool。它拿不到 token、不能讀檔、不能連網，只能回傳固定格式的 JSON。
- **權限只在 action 自己的程式**：用 job 的 `GITHUB_TOKEN` 讀 PR、寫留言。這個 token 只限所在的 repo，job 結束就失效。
- **PR 內容當資料處理**：PR 標題、描述、diff 與 call stack 程式片段放在含隨機值的分隔標籤裡，system prompt 明確說明裡面的內容不是指令。要讀哪些程式碼由 action 決定，AI 無法要求讀其他檔案。
- **AI 的輸出先檢查再貼**：
  - 只有指向 action 實際讀過的行（diff 或 call stack 片段）的發現才附連結與引用程式碼，其餘只顯示位置。
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
      # 追 call stack 用；固定在 PR head，且不把 token 留在工作目錄
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          persist-credentials: false
      - uses: 5G-HarryLu/github-ai-code-review@<commit SHA>
        with:
          claude-api-key: ${{ secrets.CLAUDE_API_KEY }}
```

checkout 只用來讓 action 在本機搜尋呼叫關係，`persist-credentials: false` 讓工作目錄裡不留 token。不需要 PAT。

| Input | 必填 | 預設 | 說明 |
|---|---|---|---|
| `claude-api-key` | 是 | | Anthropic API key |
| `model` | 否 | `claude-opus-5-5` | Claude 模型 |
| `github-token` | 否 | `${{ github.token }}` | 讀 PR、寫留言用 |

Output：`comment-url`。

## 會送給 Claude 的內容

- PR 標題、描述、作者、分支，以及每個改動檔案的 diff（標上新檔案的行號）。
- 被修改的函式的呼叫端與被呼叫端的程式片段（由 action 搜尋，AI 不能自己讀檔）。
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
| `src/callgraph.ts` | 在 PR head 搜尋被修改函式的呼叫端與被呼叫端 |
| `src/prompt.ts` | system prompt 與 PR 資料的包裝 |
| `src/review.ts` | 呼叫 Claude（無 tools、structured output） |
| `src/markdown.ts` | 清洗模型輸出的 markdown |
| `src/render.ts` | 組留言 |
