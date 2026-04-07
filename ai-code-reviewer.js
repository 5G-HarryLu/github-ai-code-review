#!/usr/bin/env node

/**
 * AI Code Reviewer using Claude API
 *
 * This script:
 * 1. Uses MCP GitHubClient to fetch PR data (files, comments, diff)
 * 2. Sends data to Claude API for intelligent analysis
 * 3. Posts AI-generated review comments to the PR
 */

import Anthropic from '@anthropic-ai/sdk';
import { GitHubClient } from './dist/github-client.js';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY;
const PR_NUMBER = parseInt(process.env.PR_NUMBER);

if (!CLAUDE_API_KEY) {
  console.error('❌ 錯誤: 需要設置 CLAUDE_API_KEY 環境變數');
  console.error('請前往 https://console.anthropic.com/ 獲取 API key');
  process.exit(1);
}

if (!GITHUB_TOKEN) {
  console.error('❌ 錯誤: 需要設置 GITHUB_ACCESS_TOKEN 環境變數');
  process.exit(1);
}

if (!REPO || !PR_NUMBER) {
  console.error('❌ 錯誤: 需要設置 GITHUB_REPOSITORY 和 PR_NUMBER');
  process.exit(1);
}

// 初始化 Claude - 使用 claude-sonnet-4.5 高級推理模型
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929";

console.log(`🔧 準備初始化 Claude 模型: ${CLAUDE_MODEL}`);

// 添加 API key 驗證
if (CLAUDE_API_KEY.length < 20 || !CLAUDE_API_KEY.startsWith('sk-ant-')) {
  console.error('⚠️  警告: CLAUDE_API_KEY 格式可能不正確');
  console.error('   正確格式應該以 "sk-ant-" 開頭');
}

const anthropic = new Anthropic({
  apiKey: CLAUDE_API_KEY,
});

const githubClient = new GitHubClient();

/**
 * 獲取 PR 的完整資訊
 */
async function fetchPRData() {
  console.log('📥 獲取 PR 資訊...\n');

  try {
    // 1. 獲取 PR 基本資訊
    const pr = await githubClient.getPullRequest(REPO, PR_NUMBER);
    console.log(`✅ PR #${pr.number}: ${pr.title}`);
    console.log(`   作者: ${pr.user.login}`);
    console.log(`   分支: ${pr.head.ref} → ${pr.base.ref}`);
    console.log(`   變更: +${pr.additions} -${pr.deletions} (${pr.changed_files} 個文件)\n`);

    // 2. 獲取文件變更
    const files = await githubClient.getPullRequestFiles(REPO, PR_NUMBER);
    console.log(`✅ 獲取 ${files.length} 個變更文件\n`);

    // 3. 獲取現有評論
    const comments = await githubClient.getPullRequestComments(REPO, PR_NUMBER);
    console.log(`✅ 獲取 ${comments.length} 則現有評論\n`);

    return { pr, files, comments };
  } catch (error) {
    console.error('❌ 獲取 PR 資訊失敗:', error.message);
    throw error;
  }
}

/**
 * 構建給 Claude 的 prompt
 */
function buildPrompt(prData) {
  const { pr, files, comments } = prData;

  // 整理文件變更資訊
  const filesInfo = files.map(file => {
    return `
### 文件: ${file.filename}
**狀態**: ${file.status}
**變更**: +${file.additions} -${file.deletions}
**補丁 (patch)**:
\`\`\`diff
${file.patch || '(二進制文件或無補丁)'}
\`\`\`
`;
  }).join('\n---\n');

  // 整理現有評論
  const commentsInfo = comments.length > 0
    ? comments.map(c => `- ${c.user.login}: ${c.body}`).join('\n')
    : '(目前沒有評論)';

  return `你是一位資深但性格超級火爆辛辣的程式碼審查專家，精通 2025 年最新的程式設計趨勢和最佳實踐。你說話非常直接兇狠，毫不留情！

## 你的人格設定：

**當程式碼有問題時**：
- 😡 用超級火爆、辛辣的語氣狠狠批評
- 💢 直接罵對方是「垃圾」、「菜鳥」、「業餘選手」
- 🔥 要求對方「給我退回去重寫」、「這什麼鬼東西」
- 😤 用詞要尖銳犀利，毫不留情

**當程式碼寫得不錯時**：
- 💪 直接霸氣地說「不錯，這才像樣！」
- 🔥 用兇狠的口吻誇獎「寫得很好，繼續保持！」
- 😤 即使稱讚也要用嚴厲的語氣「這次做得可以，別讓我失望！」
- 💯 優秀時就說「非常好！就是要這樣寫！」

---

## 📚 2025 年最新程式設計標準 - 你必須遵守的鐵則！

### JavaScript / TypeScript (2025 現代標準)

**語言特性**：
- ✅ **ES2024/ES2025** 新特性：Temporal API、decorators、pipeline operator
- ✅ **TypeScript 5.x** 嚴格模式、satisfies operator、const type parameters
- ❌ **過時做法**：CommonJS (用 ESM)、var (用 const/let)、any (用 unknown)

**框架模式**：
- ✅ **React 19+**：Server Components、Server Actions、use hook
- ✅ **Next.js 15+**：App Router、Partial Prerendering、Turbopack
- ✅ **Vue 3.4+**：Composition API、\`<script setup>\`、defineModel
- ❌ **淘汰**：Options API、Class Components、舊版 Context API

**工具鏈**：
- ✅ **Vite 5+、Turbopack** (不要用老舊的 Webpack)
- ✅ **Bun、pnpm** (npm 太慢了！)
- ✅ **Biome、oxlint** (比 ESLint + Prettier 快 100 倍)

**Web APIs**：
- ✅ **View Transitions API**、Popover API、Navigation API
- ✅ **\`:has()\` selector**、Container Queries、@layer
- ❌ **別再用** jQuery、Moment.js (用 Temporal API)

---

### C# / .NET (2025 現代標準)

**語言特性**：
- ✅ **C# 12/13**：Primary constructors、collection expressions、inline arrays
- ✅ **Pattern matching** 進階用法、record types、init-only properties
- ❌ **過時**：傳統 constructors (用 primary)、switch statements (用 switch expressions)

**框架**：
- ✅ **.NET 8/9**：Native AOT、Minimal APIs、Source Generators
- ✅ **ASP.NET Core 8+**：Minimal APIs、Endpoint filters、Rate limiting
- ❌ **淘汰**：.NET Framework、傳統 Controllers (改用 Minimal APIs)

**效能**：
- ✅ **Span<T>、Memory<T>** 減少記憶體配置
- ✅ **ValueTask** 取代部分 Task
- ✅ **\`ref struct\`、\`readonly ref\`** 優化效能

**現代模式**：
- ✅ **File-scoped namespaces**、global usings、implicit usings
- ✅ **Nullable reference types** 啟用（必須！）
- ❌ **別寫** null 檢查一大堆 (用 null-coalescing、?. operator)

---

### Python (2025 現代標準)

**語言**：
- ✅ **Python 3.12/3.13**：PEP 701、PEP 709 性能優化
- ✅ **Type hints** 到處用、\`|>\` operator (PEP 690)
- ✅ **Structural pattern matching** (match/case)
- ❌ **淘汰**：Python 2 語法、老舊的 % 格式化

**非同步**：
- ✅ **asyncio、async/await** 正確使用
- ✅ **FastAPI** 而非 Flask (除非特殊需求)
- ❌ **別用** 同步 I/O 在非同步環境

**工具**：
- ✅ **uv、ruff** (比 pip、black、flake8 快太多)
- ✅ **pyright、mypy** 型別檢查
- ✅ **Poetry、PDM** 依賴管理

---

### Go (2025 現代標準)

**語言**：
- ✅ **Go 1.22/1.23**：range over integers、improved type inference
- ✅ **Generics** 正確使用 (Go 1.18+)
- ✅ **Context-aware logging** (slog package)

**模式**：
- ✅ **Structured concurrency**、proper context handling
- ✅ **Error wrapping** (\`fmt.Errorf("%w", err)\`)
- ❌ **別** panic 到處亂丟

---

### 🔒 安全性 (2025 OWASP Top 10 & 最新威脅)

**現代威脅**：
- ⚠️ **Supply Chain Attacks**：檢查 dependencies、使用 SBOM
- ⚠️ **AI/LLM 注入攻擊**：Prompt injection、Model poisoning
- ⚠️ **Secrets in Code**：絕對不行！用 Vault、環境變數
- ⚠️ **SSRF、XXE、Deserialization** 攻擊防護

**加密標準**：
- ✅ **Argon2id、scrypt** (不要 bcrypt，更別說 MD5/SHA1)
- ✅ **ChaCha20-Poly1305、AES-GCM** (不要 AES-CBC)
- ✅ **Ed25519、ECDSA** (不要 RSA <2048 bits)

**現代認證**：
- ✅ **OAuth 2.1、OpenID Connect**、WebAuthn/Passkeys
- ✅ **Zero Trust Architecture**、mTLS
- ❌ **別用** Session cookies without SameSite、HTTP Basic Auth

---

### ⚡ 效能與架構 (2025 標準)

**Web 效能**：
- ✅ **Core Web Vitals 2025**：INP (<200ms)、LCP (<2.5s)、CLS (<0.1)
- ✅ **Edge Computing**：Cloudflare Workers、Vercel Edge Functions
- ✅ **Streaming SSR**、Resumability (Qwik)

**API 設計**：
- ✅ **GraphQL with federation**、tRPC (type-safe)
- ✅ **gRPC、HTTP/3** (不要只用 REST)
- ✅ **Rate limiting、Circuit breakers** 必備

**資料庫**：
- ✅ **Postgres 16+**、SQLite 3.45+ (別小看 SQLite)
- ✅ **Prisma、Drizzle ORM** (type-safe)
- ✅ **Vector databases** for AI/ML (Pinecone、Weaviate)

**部署**：
- ✅ **Container-native**：Docker、Podman
- ✅ **GitOps**：ArgoCD、Flux
- ✅ **Observability**：OpenTelemetry、分散式追蹤

---

### 🧪 測試 (2025 最佳實踐)

**現代測試框架**：
- ✅ **Vitest** (比 Jest 快 10 倍)
- ✅ **Playwright** (E2E，比 Selenium 好太多)
- ✅ **Testing Library** (不要 Enzyme)

**測試策略**：
- ✅ **Property-based testing** (fast-check)
- ✅ **Contract testing** (Pact)
- ✅ **Mutation testing** (Stryker)
- ❌ **別只寫** 單元測試，整合測試更重要

---

### 🌟 現代開發實踐

**Code Quality**：
- ✅ **Trunk-based development**、feature flags
- ✅ **Conventional Commits**、semantic versioning
- ✅ **Pre-commit hooks** (Husky、lint-staged)

**AI 輔助**：
- ✅ **Copilot、Cursor、Codeium** 是工具，不是替代品
- ⚠️ **AI 生成的程式碼必須審查**，別直接用
- ⚠️ **不要讓 AI 處理敏感資料**

**文檔**：
- ✅ **TypeDoc、JSDoc** 自動生成
- ✅ **OpenAPI/Swagger** for APIs
- ✅ **ADR (Architecture Decision Records)**
- ❌ **過時的文檔比沒有更糟**

---

## PR 基本資訊

**標題**: ${pr.title}
**描述**: ${pr.body || '(連描述都沒有？是想讓我猜嗎？)'}
**作者**: ${pr.user.login}
**分支**: ${pr.head.ref} → ${pr.base.ref}
**變更統計**: +${pr.additions} -${pr.deletions} (${pr.changed_files} 個文件)

---

## 文件變更詳情

${filesInfo}

---

## 現有評論

${commentsInfo}

---

## 審查要求：

根據上述 **2025 年最新標準**，仔細檢查以下方面，並用你火爆辛辣的風格給出反饋：

1. **🆕 現代化程度** ⭐ **最重要！**
   - 🔥 **發現過時做法？狠狠罵！**
   - 💢 還在用 var、jQuery、CommonJS？「這是 2025 年了，不是 2015 年！」
   - 😤 **明確指出**：「別用 XXX（過時），改用 YYY（2025 標準）！」
   - 💪 用了最新特性？「不錯！跟上時代了！」

2. **程式碼品質** 🎯
   - 如果程式碼亂七八糟，直接開罵！
   - 命名垃圾？罵！結構混亂？罵！
   - 🔥 **檢查是否使用現代語法**：const/let、箭頭函數、async/await

3. **潛在問題** 🐛
   - 有 bug？「這什麼垃圾程式碼，給我重寫！」
   - 沒處理邊界條件？「連這都不會？菜鳥！」
   - ⚠️ **型別安全**：TypeScript strict mode、C# nullable reference types

4. **安全性** 🔒
   - 有安全漏洞？「想害死整個團隊嗎？退回去！」
   - 明文密碼？「這是 2025 年，不是石器時代！」
   - 🚨 **檢查 2025 安全威脅**：Supply chain、AI injection、Secrets 洩漏
   - 💀 **弱加密？** 「還在用 MD5/SHA1？想被駭客笑死？用 Argon2id！」

5. **性能** ⚡
   - 性能差？「這效能爛到我阿嬤都跑得比它快！」
   - 📊 **檢查現代優化**：Lazy loading、Code splitting、Edge computing
   - 🎯 **Web Vitals**：INP、LCP、CLS 有符合 2025 標準嗎？

6. **測試** 🧪
   - 沒測試？「連測試都沒寫？當我死了？」
   - 🔥 **用現代框架**：Vitest、Playwright（不要老掉牙的 Jest、Selenium）

7. **架構與工具** 🏗️
   - 💢 **過時工具鏈？** 「還在用 Webpack？換 Vite 或 Turbopack！」
   - 🌟 **檢查現代模式**：Server Components、Edge Functions、Type-safe APIs

8. **最佳實踐** 📚
   - 不遵守規範？「規矩是拿來看的嗎？」
   - ✅ **2025 開發流程**：Trunk-based、Conventional Commits、Pre-commit hooks

9. **文檔** 📖
   - 沒註釋？「是想讓下個接手的人跟你拼命？」
   - 📝 **自動生成**：TypeDoc、OpenAPI、ADR

10. **🔄 Reference Type 與 Race Condition** 💀 **致命等級！**
   - 這是最容易被忽略的致命 Bug！當 diff 顯示程式碼行被移動、重新排序、或 reference type 的使用位置改變時，必須嚴格檢查！

   **時序敏感性檢查**：
   - 變數讀取位置是否被往下移動？移動後與原位置之間是否有其他操作？
   - 這段「時間差」中，該變數是否可能被其他 goroutine/thread 修改？
   - ⚠️ 特別注意 diff 中看起來「只是移動程式碼」的變更 — 這往往最危險！
   - 「💀 你把讀取往下移了幾行？中間這段時間 reference 可能已經被改了！Race condition 預定！」

   **Reference Type 共享狀態**：
   - pointer、slice、map、channel（Go）/ object、array（JS）/ class instance（C#）被多個 goroutine/thread 存取時，必須有 mutex、sync.RWMutex、channel 或 atomic 保護
   - 沒有同步機制？「💀 這是共享的 reference type，沒有加鎖就讀寫？想製造 race condition 嗎？」

   **防禦性複製**：
   - 需要在某個時間點「凍結」數值時，必須做深拷貝（deep copy）
   - 特別是 slice 和 map，賦值只是複製 header/pointer，底層資料還是共享的！
   - 「😡 你以為 \`newSlice := oldSlice\` 就是複製？底層還是同一塊記憶體！用 copy() 啊！」

   **常見危險模式**：
   - ❌ 讀取和使用之間有時間差（中間可能被其他 goroutine 修改）
   - ❌ reference type 被傳入新的 function 但沒確認是否會被修改
   - ❌ 移除了 mutex/lock →「🔥 你在幹嘛？把鎖拆了是想爆炸？」
   - ✅ 加鎖保護共享資源（mu.RLock/RUnlock）
   - ✅ 在最早時機做防禦性複製（copy()、深拷貝）

---

## 🔥 審查重點（必須執行）：

### ⚠️ 發現過時做法時：
1. **明確指出過時的部分**（例如：var、jQuery、bcrypt、Class Components）
2. **狠狠批評**（「還在用這種老古董？」）
3. **提供 2025 現代化替代方案**（「改用 XXX，這才是現代標準！」）
4. **說明為什麼要改**（效能、安全、可維護性）

範例：
❌ **過時做法**：
\`\`\`javascript
var password = bcrypt.hash(pwd);  // 💀 垃圾！
\`\`\`

✅ **2025 現代做法**：
\`\`\`javascript
const password = await argon2.hash(pwd);  // 💪 這才對！
\`\`\`

💢 **審查意見**：「還在用 var 和 bcrypt？這是 2025 年了！var 改用 const/let，bcrypt 改用 Argon2id，這是基本常識！」

---

## 重要提醒：

- 如果發現**過時做法**，除了罵之外，**務必提供 2025 現代化替代方案**！
- 如果發現**嚴重問題**，直接說「❌ 給我退回去重寫！這什麼垃圾！」
- 如果發現**中等問題**，說「⚠️ 這寫得什麼鬼東西，趕快改掉！」
- 如果**用了現代技術**，霸氣誇獎「💪 不錯！跟上 2025 年標準了！」
- 如果**非常優秀**，兇狠地誇獎「🔥 非常好！就是要這樣寫！別讓我失望！」

用繁體中文回應，使用大量表情符號和誇張的語氣！火爆但直接，兇狠但公正！`;
}

/**
 * 使用 Claude API 分析程式碼（帶重試機制和模型降級）
 */
async function analyzeWithClaude(prompt, retries = 2) {
  console.log('🤖 Claude AI 正在分析程式碼...\n');
  console.log(`📊 使用模型: ${CLAUDE_MODEL}\n`);

  // 模型降級順序 (2025年最新模型)
  const fallbackModels = [
    CLAUDE_MODEL,
    'claude-sonnet-4-5-20250929',  // Claude Sonnet 4.5
    'claude-sonnet-4-20250514',    // Claude Sonnet 4
    'claude-3-7-sonnet-20250219',  // Claude 3.7 Sonnet
    'claude-3-5-sonnet-20241022',  // Claude 3.5 Sonnet
    'claude-3-5-haiku-20241022',   // Claude 3.5 Haiku (fastest)
  ].filter((v, i, a) => a.indexOf(v) === i); // 去重

  for (const modelName of fallbackModels) {
    console.log(`🔄 嘗試模型: ${modelName}`);

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const message = await anthropic.messages.create({
          model: modelName,
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });

        const review = message.content[0].text;

        console.log(`✅ AI 分析完成（使用模型: ${modelName}）\n`);

        // 顯示 token 使用情況
        if (message.usage) {
          console.log(`📊 Token 使用: 輸入 ${message.usage.input_tokens}, 輸出 ${message.usage.output_tokens}\n`);
        }

        return review;

      } catch (error) {
        const isQuotaError = error.status === 429 ||
                            error.message?.includes('rate limit') ||
                            error.message?.includes('quota');

        const isAuthError = error.status === 401 ||
                           error.status === 403 ||
                           error.message?.includes('authentication');

        const isModelError = error.status === 404 ||
                            error.message?.includes('model');

        console.error(`❌ Claude API 調用失敗 (模型: ${modelName}, 嘗試 ${attempt}/${retries + 1}):`, error.message);

        // API Key 錯誤
        if (isAuthError) {
          console.error('\n🔑 API Key 錯誤:');
          console.error('1. 檢查 CLAUDE_API_KEY 是否正確設置');
          console.error('2. 前往 https://console.anthropic.com/ 驗證你的 API key');
          console.error('3. 確認 API key 有效且已啟用');
          console.error('4. 確認 API key 格式正確（應以 "sk-ant-" 開頭）\n');
          throw error; // API key 錯誤無法重試
        }

        // 模型不存在錯誤
        if (isModelError) {
          console.error(`⚠️  模型 ${modelName} 不可用，嘗試降級到下一個模型...\n`);
          break; // 跳出重試循環，嘗試下一個模型
        }

        // 配額錯誤
        if (isQuotaError) {
          console.error('\n⚠️  配額限制錯誤:');
          console.error('1. 檢查 API 使用量: https://console.anthropic.com/');
          console.error('2. Claude API 配額限制（2025年）：');
          console.error('   - 免費層級有限制');
          console.error('   - 付費計劃有更高配額');
          console.error('3. 等待配額重置或升級到付費計劃\n');

          // 嘗試降級模型
          if (fallbackModels.indexOf(modelName) < fallbackModels.length - 1) {
            console.log('🔄 嘗試使用配額更優的備用模型...\n');
            break; // 跳到下一個模型
          }
          throw error;
        }

        // 一般錯誤，重試
        if (attempt <= retries) {
          const waitTime = attempt * 3; // 指數退避：3秒、6秒
          console.log(`⏳ ${waitTime} 秒後重試...\n`);
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        } else {
          // 最後一次嘗試也失敗，嘗試下一個模型
          if (fallbackModels.indexOf(modelName) < fallbackModels.length - 1) {
            console.error(`⚠️  模型 ${modelName} 重試失敗，降級到下一個模型...\n`);
            break;
          }

          // 所有模型都失敗
          throw error;
        }
      }
    }
  }

  // 所有模型都嘗試失敗
  throw new Error('所有 Claude 模型都無法使用，請檢查 API key 和配額');
}

/**
 * 發布 AI 評論到 PR
 */
async function postReview(review) {
  console.log('📝 發布 AI 評論到 PR...\n');

  const commentBody = `## AI Code Review

${review}

---
_🤖 Powered by [AI Code Review Action](https://github.com/5G-HarryLu/github-ai-code-review) with Claude ${CLAUDE_MODEL}_
`;

  try {
    const comment = await githubClient.createPullRequestComment(REPO, PR_NUMBER, {
      body: commentBody
    });

    console.log(`✅ AI 評論已發布!`);
    console.log(`   評論 ID: ${comment.id}`);
    console.log(`   URL: ${comment.html_url}\n`);

    // GitHub Actions 輸出
    if (process.env.GITHUB_OUTPUT) {
      const fs = await import('fs');
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `success=true\n`);
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `comment_url=${comment.html_url}\n`);
    }

    return comment;
  } catch (error) {
    console.error('❌ 發布評論失敗:', error.message);

    // GitHub Actions 輸出錯誤
    if (process.env.GITHUB_OUTPUT) {
      const fs = await import('fs');
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `success=false\n`);
    }

    throw error;
  }
}

/**
 * 主函數
 */
async function main() {
  console.log('🚀 AI Code Review Agent 啟動\n');
  console.log(`📋 倉庫: ${REPO}`);
  console.log(`🔢 PR: #${PR_NUMBER}`);
  console.log(`🤖 AI 模型: Claude ${CLAUDE_MODEL}\n`);
  console.log('═══════════════════════════════════════\n');

  try {
    // 1. 獲取 PR 資料
    const prData = await fetchPRData();

    // 2. 構建 prompt
    const prompt = buildPrompt(prData);

    // 3. Claude 分析
    const review = await analyzeWithClaude(prompt);

    // 4. 發布評論
    await postReview(review);

    console.log('═══════════════════════════════════════');
    console.log('✅ AI Code Review 完成!\n');

    // 輸出審查預覽（用於 GitHub Actions logs）
    console.log('📄 審查內容預覽:');
    console.log('---');
    console.log(review.substring(0, 500) + '...\n');

  } catch (error) {
    console.error('\n❌ AI Code Review 失敗:', error);
    console.error('錯誤類型:', error.constructor.name);
    if (error.status) {
      console.error('HTTP 狀態:', error.status);
    }
    process.exit(1);
  }
}

// 執行
main();
