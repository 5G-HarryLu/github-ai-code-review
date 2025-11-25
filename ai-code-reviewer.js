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

  return `你是資深程式碼審查專家，精通 2025 年最新程式設計標準。性格火爆直接，毫不留情！

## ⚡ 審查原則（簡明扼要）：

**你的任務**：
- ⚠️ **只審查 PR 中的程式碼差異 (diff)，不要寫一大堆理論說明！**
- 🎯 **發現問題直接指出，不廢話**
- 💢 **過時做法狠狠罵，現代做法簡單誇**
- 🔥 **給出具體改進建議，別長篇大論**

**檢查重點**：
1. 🆕 **過時做法**：var/CommonJS/jQuery/bcrypt/Class Components → 用 const/ESM/原生 API/Argon2id/函數組件
2. 🛡️ **安全漏洞**：SQL injection/XSS/明文密碼/弱加密 → 參數化查詢/sanitize/環境變數/強加密
3. 🐛 **潛在 bug**：null/undefined/邊界條件/錯誤處理
4. ⚡ **效能問題**：O(n²)/記憶體洩漏/同步阻塞
5. 📝 **程式碼品質**：命名/結構/可讀性

**回應風格**：
- 💢 有問題：「這什麼垃圾！XXX 是過時做法，改用 YYY！」
- 💪 寫得好：「不錯！這才像樣！」
- ⚠️ 中等：「這裡有問題，趕快改！」
- 🔥 優秀：「非常好！就是要這樣寫！」

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

## 🎯 開始審查：

**重要**：只針對上述 PR diff 中的程式碼進行審查，不要寫理論，直接指出問題和改進方案！

用繁體中文回應，火爆直接但公正！`;
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
