# 🔥 AI Code Review GitHub Action

基於 Google Gemini AI 的自動化程式碼審查 GitHub Action，提供火爆直接的程式碼審查反饋。

## ✨ 特色功能

- 🤖 **Google Gemini 2.0 驅動**：使用最新的 Gemini 2.0 Flash Experimental 模型
- 🔥 **火爆辛辣風格**：直接、犀利的審查反饋，不拐彎抹角
- 📊 **全方位審查**：涵蓋程式碼品質、安全性、性能、測試等多個維度
- 🚀 **自動化執行**：PR 創建或更新時自動觸發審查
- 💬 **智能評論**：自動在 PR 中發布詳細的審查評論
- 🆓 **免費使用**：基於 Google Gemini 免費配額（每天 1500 次請求）

## 🚀 快速開始

### 1. 獲取 Gemini API Key

前往 [Google AI Studio](https://makersuite.google.com/app/apikey) 獲取免費的 API key。

### 2. 設置 Repository Secret

在你的 GitHub repository 中：
1. 進入 `Settings` → `Secrets and variables` → `Actions`
2. 點擊 `New repository secret`
3. 名稱：`GEMINI_API_KEY`
4. 值：貼上你的 Gemini API key

### 3. 創建 Workflow 文件

在你的 repository 中創建 `.github/workflows/ai-code-review.yml`：

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: AI Code Review
        uses: BBsBrezz/Gitlab-MCP@v1
        with:
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

完成！🎉 現在每次創建或更新 PR 時，AI 都會自動進行程式碼審查。

## 📋 進階配置

### 完整參數說明

```yaml
- name: AI Code Review
  uses: BBsBrezz/Gitlab-MCP@v1
  with:
    # 必填：Gemini API Key
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}

    # 選填：GitHub Token（默認使用內建 token）
    github-token: ${{ secrets.GITHUB_TOKEN }}

    # 選填：Repository 名稱（默認為當前 repo）
    repository: ${{ github.repository }}

    # 選填：PR 編號（默認為當前 PR）
    pr-number: ${{ github.event.pull_request.number }}
```

### 自定義觸發條件

只在特定分支審查：
```yaml
on:
  pull_request:
    types: [opened, synchronize]
    branches:
      - main
      - develop
```

排除草稿 PR：
```yaml
on:
  pull_request:
    types: [opened, synchronize, ready_for_review]

jobs:
  ai-review:
    if: github.event.pull_request.draft == false
    # ...
```

### 使用輸出

```yaml
- name: AI Code Review
  id: review
  uses: BBsBrezz/Gitlab-MCP@v1
  with:
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}

- name: Check review result
  if: steps.review.outputs.review-posted == 'true'
  run: |
    echo "Review posted successfully!"
    echo "Comment URL: ${{ steps.review.outputs.comment-url }}"
```

## 🎯 審查項目

AI 會從以下方面進行審查：

1. **程式碼品質** 🎯
   - 命名規範
   - 程式碼結構
   - 可讀性

2. **潛在問題** 🐛
   - Bug 檢測
   - 邊界條件處理
   - 錯誤處理

3. **安全性** 🔒
   - 安全漏洞
   - 敏感資訊洩露
   - 輸入驗證

4. **性能** ⚡
   - 演算法效率
   - 資源使用
   - 優化建議

5. **測試覆蓋** 🧪
   - 測試完整性
   - 測試品質

6. **最佳實踐** 📚
   - 程式設計規範
   - 設計模式
   - 架構建議

7. **文檔註釋** 📖
   - 程式碼註釋
   - API 文檔
   - 可維護性

## 💡 審查風格

### 有問題時（火爆模式）🔥
- 😡 直接批評，毫不留情
- 💢 使用「垃圾」、「菜鳥」等犀利詞彙
- 🔥 要求「退回去重寫」、「這什麼鬼東西」
- 😤 尖銳犀利，直擊要害

### 寫得好時（霸氣誇獎）💪
- 💪 「不錯，這才像樣！」
- 🔥 「寫得很好，繼續保持！」
- 😤 「這次做得可以，別讓我失望！」
- 💯 「非常好！就是要這樣寫！」

## 🔧 本地開發

### 克隆專案
```bash
git clone https://github.com/BBsBrezz/Gitlab-MCP.git
cd Gitlab-MCP
```

### 安裝依賴
```bash
npm install
```

### 構建專案
```bash
npm run build
```

### 測試 Action（需要環境變數）
```bash
export GEMINI_API_KEY="your-api-key"
export GITHUB_ACCESS_TOKEN="your-github-token"
export GITHUB_REPOSITORY="owner/repo"
export PR_NUMBER="1"

node ai-code-reviewer.js
```

## 📊 使用限制

### Gemini API 免費配額
- **每天**：1500 次請求
- **每分鐘**：15 次請求
- **完全免費**，無需信用卡

### 建議
- 小型團隊：完全夠用
- 大型團隊：考慮限制觸發條件或升級 API 配額

## 🛠️ MCP Server 模式

除了作為 GitHub Action 使用，本專案也可以作為 MCP Server 在 Claude Desktop 中使用：

```json
{
  "mcpServers": {
    "github-mcp": {
      "command": "node",
      "args": ["/path/to/Gitlab-MCP/dist/index.js"],
      "env": {
        "GITHUB_ACCESS_TOKEN": "your-token"
      }
    }
  }
}
```

## 📝 範例

### 審查評論示例

```markdown
## 🔥 火爆辛辣 AI Code Review 來啦！

### 📋 總體評價
⚠️ 這程式碼有些問題，需要改進！

### 🎯 程式碼品質
❌ **auth.js 第 45 行**：這什麼垃圾命名？`getData` 能再模糊一點嗎？改成 `fetchUserAuthData` ！

💪 **config.js 第 12 行**：不錯！環境變數處理得很專業，繼續保持！

### 🐛 潛在問題
😡 **api.js 第 78 行**：連錯誤處理都不寫？菜鳥！加上 try-catch 給我！

### 🔒 安全性
🚨 **database.js 第 23 行**：SQL 注入漏洞！這是 2025 年，不是石器時代！用 prepared statements！

### 💡 總結
整體還行，但有幾個嚴重問題必須修正。改完再來！
```

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 授權

MIT License

## 🔗 相關連結

- [Google Gemini API](https://ai.google.dev/)
- [GitHub Actions 文檔](https://docs.github.com/en/actions)
- [MCP Protocol](https://modelcontextprotocol.io/)

---

🤖 由 [BBsBrezz](https://github.com/BBsBrezz) 開發維護
