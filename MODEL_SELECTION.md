# 🤖 Gemini 模型選擇指南

## 📊 可用模型對比

| 模型 | 穩定性 | 速度 | 配額 | 推薦用途 |
|------|-------|------|------|---------|
| **gemini-1.5-flash** ⭐ | ✅ 穩定 | ⚡⚡⚡ 最快 | 🟢 最佳 | **推薦**：日常 PR 審查 |
| **gemini-1.5-pro** | ✅ 穩定 | ⚡⚡ 較快 | 🟡 良好 | 複雜程式碼審查 |
| **gemini-2.0-flash-exp** | ⚠️ 實驗 | ⚡⚡⚡ 最快 | 🔴 受限 | 實驗性功能測試 |

---

## ⭐ 推薦配置（默認）

### gemini-1.5-flash

**優點**：
- ✅ **穩定可靠** - 正式發布版本，經過充分測試
- ✅ **配額充足** - 免費配額最寬鬆（每天 1500 次）
- ✅ **速度極快** - 響應時間 < 3 秒
- ✅ **成本最低** - 免費或付費都是最便宜的選擇

**配額**：
- 免費：1500 次/天，15 次/分鐘
- 付費：更高配額，性價比最佳

**使用方式**：
```yaml
- uses: 5G-HarryLu/github-ai-code-review@v1
  with:
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
    gemini-model: gemini-1.5-flash  # 默認值，可省略
```

---

## 🎯 進階選項

### gemini-1.5-pro

**適用場景**：
- 🔍 複雜的程式碼邏輯審查
- 🏗️ 大型架構設計審查
- 🧪 需要更深入分析的場景

**優點**：
- ✅ 更強的理解能力
- ✅ 更詳細的分析結果
- ✅ 穩定可靠

**缺點**：
- ⚠️ 速度稍慢（5-8 秒）
- ⚠️ 配額稍緊（每天 1500 次，但 token 限制更低）
- ⚠️ 成本較高（付費時）

**使用方式**：
```yaml
- uses: 5G-HarryLu/github-ai-code-review@v1
  with:
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
    gemini-model: gemini-1.5-pro
```

---

## ⚠️ 實驗性選項

### gemini-2.0-flash-exp

**警告**：
- ❌ **不推薦用於生產環境**
- ❌ 配額限制嚴格且不穩定
- ❌ 可能隨時變更或移除
- ❌ 經常遇到 429 配額錯誤

**適用場景**：
- 🧪 測試 Gemini 2.0 新功能
- 🔬 實驗性專案
- 📚 學習和研究

**已知問題**：
```
❌ [429 Too Many Requests] You exceeded your current quota
```

**解決方案**：切換到 `gemini-1.5-flash`

**使用方式**（不推薦）：
```yaml
- uses: 5G-HarryLu/github-ai-code-review@v1
  with:
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
    gemini-model: gemini-2.0-flash-exp
```

---

## 🔧 本地測試模型選擇

```bash
# 使用默認模型（gemini-1.5-flash）
export GEMINI_API_KEY="your-key"
node ai-code-reviewer.js

# 使用 Pro 模型
export GEMINI_MODEL="gemini-1.5-pro"
node ai-code-reviewer.js

# 使用實驗性模型（不推薦）
export GEMINI_MODEL="gemini-2.0-flash-exp"
node ai-code-reviewer.js
```

---

## 📊 配額對比詳情

### 免費配額

| 模型 | 每天請求數 | 每分鐘請求數 | RPD Token 限制 |
|------|----------|-------------|---------------|
| gemini-1.5-flash | 1,500 | 15 | 1M input/天 |
| gemini-1.5-pro | 1,500 | 15 | 500K input/天 |
| gemini-2.0-flash-exp | ⚠️ 受限 | ⚠️ 受限 | ⚠️ 不穩定 |

### 成本對比（付費）

| 模型 | 輸入價格 | 輸出價格 |
|------|---------|---------|
| gemini-1.5-flash | $0.075/1M | $0.30/1M |
| gemini-1.5-pro | $1.25/1M | $5.00/1M |
| gemini-2.0-flash-exp | ⚠️ 可能變動 | ⚠️ 可能變動 |

---

## 🚨 配額錯誤處理

### 遇到 429 錯誤？

**錯誤訊息**：
```
[429 Too Many Requests] You exceeded your current quota
```

**立即解決方案**：

1. **切換到穩定模型**（推薦）
   ```yaml
   gemini-model: gemini-1.5-flash
   ```

2. **檢查使用量**
   - 前往：https://aistudio.google.com/app/apikey
   - 查看當前配額使用情況

3. **等待配額重置**
   - 每分鐘配額：等待 1 分鐘
   - 每天配額：等待到次日（UTC 時區）

4. **升級 API 計劃**
   - 如果經常超限，考慮升級到付費計劃
   - 付費計劃配額更高且更穩定

---

## 🎯 選擇建議

### 小型專案（< 10 PRs/天）
✅ **gemini-1.5-flash**（默認）
- 免費配額完全夠用
- 速度快，用戶體驗好

### 中型專案（10-50 PRs/天）
✅ **gemini-1.5-flash**（免費或付費）
- 免費配額可能不夠
- 考慮付費計劃（成本很低）

### 大型專案（> 50 PRs/天）
✅ **gemini-1.5-flash** + 付費計劃
- 速度和成本的最佳平衡
- 考慮限制 workflow 觸發條件

### 需要深度分析
✅ **gemini-1.5-pro**
- 複雜架構審查
- 安全性深度分析
- 願意接受較慢速度

---

## 📚 更多資訊

- [Gemini API 文檔](https://ai.google.dev/docs)
- [配額和限制](https://ai.google.dev/gemini-api/docs/rate-limits)
- [定價資訊](https://ai.google.dev/pricing)
- [使用量監控](https://aistudio.google.com/app/apikey)

---

## ✅ 快速總結

| 需求 | 推薦模型 |
|------|---------|
| 日常使用 | **gemini-1.5-flash** ⭐ |
| 深度分析 | gemini-1.5-pro |
| 實驗測試 | gemini-2.0-flash-exp ⚠️ |
| 配額問題 | **切換到 gemini-1.5-flash** |

**默認配置已經是最佳選擇！** 🎉
