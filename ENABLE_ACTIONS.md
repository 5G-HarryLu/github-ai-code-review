# 🚀 啟用 GitHub Actions 指南

## 問題：Actions 頁面沒有顯示 workflows

如果你訪問 `https://github.com/5G-HarryLu/github-ai-code-review/actions` 沒有看到任何 workflows，這是因為：

1. **Private 倉庫的 Actions 預設可能未啟用**
2. **需要手動啟用或創建第一個 PR 來觸發**

---

## 🔧 解決方法

### 方法 1：手動啟用 GitHub Actions（推薦）

1. **前往倉庫 Settings**
   ```
   https://github.com/5G-HarryLu/github-ai-code-review/settings/actions
   ```

2. **啟用 Actions**
   - 在 "Actions permissions" 部分
   - 選擇 **"Allow all actions and reusable workflows"**
   - 或選擇 **"Allow select actions and reusable workflows"**（更安全）

3. **保存設置**
   - 點擊 "Save" 按鈕

4. **返回 Actions 頁面**
   ```
   https://github.com/5G-HarryLu/github-ai-code-review/actions
   ```
   - 你應該會看到 3 個 workflows：
     - ✅ AI Code Review
     - ✅ Test AI Code Review Action
     - ✅ PR MCP Automation

---

### 方法 2：創建 PR 來觸發 workflows

如果方法 1 不行，創建一個 PR 會自動觸發 workflows：

```bash
# 這個分支已經為你創建好了
git checkout test/enable-github-actions

# 推送到 GitHub
git push -u origin test/enable-github-actions
```

然後在 GitHub 上創建 PR：
```
https://github.com/5G-HarryLu/github-ai-code-review/compare/master...test/enable-github-actions
```

創建 PR 後：
- ✅ GitHub Actions 會自動啟用
- ✅ Workflows 會開始運行
- ✅ 你會在 Actions 頁面看到運行記錄

---

## 📋 需要的 Secrets

在 workflows 可以運行之前，你需要設置以下 secret：

### 必須設置：

**`GEMINI_API_KEY`** - Gemini API Key

1. 前往 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 創建 API key
3. 在 GitHub 設置 Secret：
   ```
   https://github.com/5G-HarryLu/github-ai-code-review/settings/secrets/actions
   ```
4. 點擊 "New repository secret"
5. Name: `GEMINI_API_KEY`
6. Secret: 你的 API key
7. 點擊 "Add secret"

### 自動提供（無需設置）：

- ✅ `GITHUB_TOKEN` - 由 GitHub 自動提供

---

## ✅ 驗證 Actions 已啟用

啟用後，你應該能看到：

1. **Actions 頁面有 workflows**
   ```
   https://github.com/5G-HarryLu/github-ai-code-review/actions
   ```

2. **3 個可用的 workflows**：
   - AI Code Review
   - Test AI Code Review Action
   - PR MCP Automation

3. **創建 PR 時會自動觸發**

---

## 🎯 下一步

1. ✅ 啟用 Actions（方法 1 或 2）
2. ✅ 設置 `GEMINI_API_KEY` secret
3. ✅ 創建測試 PR
4. ✅ 查看 AI Code Review 評論

---

## 🐛 故障排除

### 問題：Workflow 運行失敗

**原因**：沒有設置 `GEMINI_API_KEY`

**解決**：按照上面的步驟設置 Secret

### 問題：Actions 頁面還是空的

**嘗試**：
1. 刷新頁面（Cmd/Ctrl + R）
2. 清除瀏覽器緩存
3. 創建一個 PR（方法 2）
4. 檢查倉庫 Settings → Actions 是否啟用

### 問題：Private repo 的 Actions 配額

**說明**：
- Private repo 有免費的 Actions 配額
- GitHub Free：2000 分鐘/月
- 通常足夠小型專案使用

---

## 📞 需要幫助？

如有問題，請查看：
- [GitHub Actions 文檔](https://docs.github.com/en/actions)
- [本專案 Issues](https://github.com/5G-HarryLu/github-ai-code-review/issues)
