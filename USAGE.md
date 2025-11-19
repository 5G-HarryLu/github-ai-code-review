# 🚀 快速使用指南

3 個步驟讓你的 GitHub Repository 擁有 AI Code Review！

## 步驟 1：獲取 API Key (2 分鐘)

前往 [Google AI Studio](https://makersuite.google.com/app/apikey)：
1. 使用 Google 帳號登入
2. 點擊 "Create API Key"
3. 複製生成的 API key

💡 **完全免費**：每天 1500 次請求，小型團隊完全夠用！

## 步驟 2：設置 Secret (1 分鐘)

在你的 GitHub Repository：
1. 進入 `Settings` → `Secrets and variables` → `Actions`
2. 點擊 `New repository secret`
3. 名稱：`GEMINI_API_KEY`
4. 值：貼上你的 API key
5. 點擊 `Add secret`

## 步驟 3：創建 Workflow (2 分鐘)

在你的 repository 創建文件：`.github/workflows/ai-code-review.yml`

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
      - name: Checkout
        uses: actions/checkout@v4

      - name: AI Review
        uses: BBsBrezz/Gitlab-MCP@v1
        with:
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
```

## ✅ 完成！

現在每次創建或更新 PR，AI 就會自動審查你的程式碼並發布評論！

---

## 🎯 進階設定

### 只審查特定分支

```yaml
on:
  pull_request:
    types: [opened, synchronize]
    branches:
      - main
      - develop
```

### 排除草稿 PR

```yaml
jobs:
  ai-review:
    if: github.event.pull_request.draft == false
    # ... rest of config
```

### 只審查特定文件變更

```yaml
on:
  pull_request:
    types: [opened, synchronize]
    paths:
      - 'src/**'
      - '**.js'
      - '**.ts'
```

---

## 📖 完整文檔

詳細功能和配置請參考 [ACTION_README.md](./ACTION_README.md)

## ❓ 常見問題

**Q: 費用如何？**
A: 使用 Google Gemini 免費配額，完全免費！

**Q: 會審查什麼？**
A: 程式碼品質、安全性、性能、測試覆蓋、最佳實踐、文檔等全方位審查

**Q: 審查風格如何？**
A: 火爆直接，有問題會嚴厲批評，寫得好會霸氣誇獎！

**Q: 可以關閉嗎？**
A: 可以，刪除 workflow 文件或暫時 disable workflow

**Q: 支援哪些語言？**
A: 支援所有程式語言！AI 會自動識別

---

🤖 由 [BBsBrezz/Gitlab-MCP](https://github.com/BBsBrezz/Gitlab-MCP) 提供
