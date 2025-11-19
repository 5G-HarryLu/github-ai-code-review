# 📦 Release Guide - 發布指南

將 GitHub Action 發布到 GitHub，讓其他人可以使用。

## 🚀 發布步驟

### 1. 確認所有變更已提交

```bash
# 檢查 git 狀態
git status

# 如果有未提交的變更
git add .
git commit -m "feat: convert to reusable GitHub Action"
```

### 2. 推送到 GitHub

```bash
# 推送到 master 分支
git push origin master
```

### 3. 創建版本 Tag

```bash
# 創建詳細版本 tag (v1.0.0)
git tag -a v1.0.0 -m "Release v1.0.0: Initial GitHub Action release

Features:
- AI Code Review with Google Gemini 2.0
- Aggressive and direct feedback style
- Automatic PR comment posting
- Complete GitHub API integration
- MCP server support
"

# 創建主要版本 tag (v1) - 推薦！
# 這樣用戶可以使用 @v1 自動獲取最新的 1.x.x 版本
git tag -a v1 -m "Release v1: Initial major version"

# 推送 tags 到 GitHub
git push origin v1.0.0
git push origin v1
```

### 4. 創建 GitHub Release（可選但推薦）

1. 前往 GitHub repository
2. 點擊 "Releases" → "Create a new release"
3. 選擇 tag：`v1.0.0`
4. 填寫 Release 標題：`v1.0.0 - Initial Release`
5. 填寫描述：

```markdown
## 🎉 Initial Release

### 🚀 Features
- 🤖 AI Code Review powered by Google Gemini 2.0 Flash Experimental
- 🔥 Aggressive and direct feedback style for clear code improvement guidance
- 💬 Automatic PR comment posting with detailed review
- 📊 Comprehensive code analysis (quality, security, performance, testing)
- 🔧 Full GitHub API integration via MCP
- 🆓 Free to use with Gemini API free tier

### 📖 Usage

Add to your repository's `.github/workflows/ai-code-review.yml`:

\`\`\`yaml
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
      - uses: actions/checkout@v4
      - uses: BBsBrezz/Gitlab-MCP@v1
        with:
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
\`\`\`

### 📚 Documentation
See [ACTION_README.md](./ACTION_README.md) for complete documentation.

### 🔗 Links
- [Google Gemini API](https://ai.google.dev/)
- [Get API Key](https://makersuite.google.com/app/apikey)
```

6. 點擊 "Publish release"

## 📝 版本號規範

遵循 [Semantic Versioning](https://semver.org/)：

- `v1.0.0` - 主要版本.次要版本.修訂版本
- `v1` - 主要版本 tag（指向最新的 1.x.x）

### 版本更新規則

**修訂版本（Patch）** - `v1.0.x`
- Bug 修復
- 文檔更新
- 微小改進

```bash
git tag -a v1.0.1 -m "Fix: bug fixes"
git tag -f -a v1 -m "Update v1 to v1.0.1"
git push origin v1.0.1
git push origin v1 --force
```

**次要版本（Minor）** - `v1.x.0`
- 新增功能（向後相容）
- 功能增強

```bash
git tag -a v1.1.0 -m "Feature: new capabilities"
git tag -f -a v1 -m "Update v1 to v1.1.0"
git push origin v1.1.0
git push origin v1 --force
```

**主要版本（Major）** - `vx.0.0`
- 破壞性變更
- API 重大改版

```bash
git tag -a v2.0.0 -m "Breaking: major update"
git tag -a v2 -m "Release v2"
git push origin v2.0.0
git push origin v2
```

## ✅ 發布後驗證

### 1. 在其他 Repository 測試

創建一個測試 repository，添加 workflow：

```yaml
name: Test AI Review

on:
  pull_request:
    types: [opened]

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: BBsBrezz/Gitlab-MCP@v1
        with:
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
```

### 2. 檢查 Action Marketplace

前往 https://github.com/marketplace 搜尋你的 Action（可能需要幾分鐘）

### 3. 驗證版本 Tag

```bash
# 確認 tags 已推送
git ls-remote --tags origin

# 應該看到：
# refs/tags/v1
# refs/tags/v1.0.0
```

## 🔄 更新主要版本 Tag

當發布新版本時，更新主要版本 tag：

```bash
# 假設發布了 v1.2.3，更新 v1 tag
git tag -f -a v1 -m "Update v1 to v1.2.3"
git push origin v1 --force
```

這樣使用 `@v1` 的用戶會自動獲得最新的 1.x.x 版本。

## 📋 發布檢查清單

- [ ] 所有測試通過
- [ ] 文檔已更新（ACTION_README.md）
- [ ] CHANGELOG 已更新（如果有）
- [ ] 版本號已確定
- [ ] Git tag 已創建並推送
- [ ] GitHub Release 已創建
- [ ] 在測試 repository 驗證
- [ ] README 中的範例已更新

## 🎯 首次發布快速命令

```bash
# 一次性執行所有命令
git add .
git commit -m "feat: initial GitHub Action release"
git push origin master

git tag -a v1.0.0 -m "Release v1.0.0: Initial release"
git tag -a v1 -m "Release v1: Initial major version"
git push origin v1.0.0
git push origin v1

echo "✅ Release v1.0.0 published!"
echo "📖 Next: Create GitHub Release at https://github.com/BBsBrezz/Gitlab-MCP/releases/new"
```

## 🌟 推廣你的 Action

1. **在 README 添加徽章**
```markdown
![GitHub Action](https://img.shields.io/badge/GitHub%20Action-v1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
```

2. **在 GitHub Marketplace 發布**
   - 添加 action.yml 中的 branding
   - 確保 README 清晰易懂
   - 提供使用範例

3. **分享到社群**
   - GitHub Discussions
   - Twitter/X
   - Dev.to
   - Reddit r/github

---

🎉 恭喜！你的 GitHub Action 現在可以被全世界使用了！
