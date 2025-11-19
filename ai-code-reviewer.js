#!/usr/bin/env node

/**
 * AI Code Reviewer using Google Gemini API
 *
 * This script:
 * 1. Uses MCP GitHubClient to fetch PR data (files, comments, diff)
 * 2. Sends data to Gemini API for intelligent analysis
 * 3. Posts AI-generated review comments to the PR
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GitHubClient } from './dist/github-client.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY;
const PR_NUMBER = parseInt(process.env.PR_NUMBER);

if (!GEMINI_API_KEY) {
  console.error('❌ 錯誤: 需要設置 GEMINI_API_KEY 環境變數');
  console.error('請前往 https://aistudio.google.com/app/apikey 獲取 API key');
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

// 初始化 Gemini - 使用最新穩定的 gemini-2.5-flash 模型
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

console.log(`🔧 準備初始化 Gemini 模型: ${GEMINI_MODEL}`);

// 添加 API key 驗證
if (GEMINI_API_KEY.length < 20 || !GEMINI_API_KEY.startsWith('AIza')) {
  console.error('⚠️  警告: GEMINI_API_KEY 格式可能不正確');
  console.error('   正確格式應該以 "AIza" 開頭，長度約 39 個字符');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
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
 * 構建給 Gemini 的 prompt
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

  return `你是一位資深但性格超級火爆辛辣的程式碼審查專家。你說話非常直接兇狠，毫不留情！

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

仔細檢查以下方面，並用你火爆辛辣的風格給出反饋：

1. **程式碼品質** 🎯
   - 如果程式碼亂七八糟，直接開罵！
   - 命名垃圾？罵！結構混亂？罵！

2. **潛在問題** 🐛
   - 有 bug？「這什麼垃圾程式碼，給我重寫！」
   - 沒處理邊界條件？「連這都不會？菜鳥！」

3. **安全性** 🔒
   - 有安全漏洞？「想害死整個團隊嗎？退回去！」
   - 明文密碼？「這是 2025 年，不是石器時代！」

4. **性能** ⚡
   - 性能差？「這效能爛到我阿嬤都跑得比它快！」

5. **測試** 🧪
   - 沒測試？「連測試都沒寫？當我死了？」

6. **最佳實踐** 📚
   - 不遵守規範？「規矩是拿來看的嗎？」

7. **文檔** 📖
   - 沒註釋？「是想讓下個接手的人跟你拼命？」

---

## 重要提醒：

- 如果發現**嚴重問題**，直接說「❌ 給我退回去重寫！這什麼垃圾！」
- 如果發現**中等問題**，說「⚠️ 這寫得什麼鬼東西，趕快改掉！」
- 如果**寫得不錯**，直接霸氣地說「💪 不錯！這才像樣！繼續保持！」
- 如果**非常優秀**，兇狠地誇獎「🔥 非常好！就是要這樣寫！別讓我失望！」

用繁體中文回應，使用大量表情符號和誇張的語氣！火爆但直接，兇狠但公正！`;
}

/**
 * 使用 Gemini API 分析程式碼（帶重試機制和模型降級）
 */
async function analyzeWithGemini(prompt, retries = 2) {
  console.log('🤖 Gemini AI 正在分析程式碼...\n');
  console.log(`📊 使用模型: ${GEMINI_MODEL}\n`);

  // 模型降級順序 (2025年最新模型)
  const fallbackModels = [
    GEMINI_MODEL,
    'gemini-2.5-flash',      // 最佳性價比
    'gemini-2.0-flash',      // 上一代穩定版
    'gemini-2.5-flash-lite', // 最快速度
    'gemini-2.5-pro'         // 高級推理
  ].filter((v, i, a) => a.indexOf(v) === i); // 去重

  for (const modelName of fallbackModels) {
    console.log(`🔄 嘗試模型: ${modelName}`);

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const currentModel = genAI.getGenerativeModel({ model: modelName });
        const result = await currentModel.generateContent(prompt);
        const response = result.response;
        const review = response.text();

        console.log(`✅ AI 分析完成（使用模型: ${modelName}）\n`);

        // 顯示 token 使用情況（如果有的話）
        if (result.response.usageMetadata) {
          const usage = result.response.usageMetadata;
          console.log(`📊 Token 使用: 輸入 ${usage.promptTokenCount}, 輸出 ${usage.candidatesTokenCount}\n`);
        }

        return review;

      } catch (error) {
        const isQuotaError = error.message?.includes('429') ||
                            error.message?.includes('quota') ||
                            error.message?.includes('rate limit');

        const isAuthError = error.message?.includes('API_KEY_INVALID') ||
                           error.message?.includes('authentication') ||
                           error.message?.includes('403');

        const isModelError = error.message?.includes('models/') &&
                            error.message?.includes('not found');

        console.error(`❌ Gemini API 調用失敗 (模型: ${modelName}, 嘗試 ${attempt}/${retries + 1}):`, error.message);

        // API Key 錯誤
        if (isAuthError) {
          console.error('\n🔑 API Key 錯誤:');
          console.error('1. 檢查 GEMINI_API_KEY 是否正確設置');
          console.error('2. 前往 https://aistudio.google.com/app/apikey 驗證你的 API key');
          console.error('3. 確認 API key 有效且已啟用');
          console.error('4. 確認 API key 格式正確（應以 "AIza" 開頭）\n');
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
          console.error('1. 檢查 API 使用量: https://aistudio.google.com/app/apikey');
          console.error('2. Gemini API 免費配額限制（2025年）：');
          console.error('   - gemini-2.5-flash: 每分鐘 15 次，每天 1500 次');
          console.error('   - gemini-2.5-pro: 每分鐘 2 次，每天 50 次');
          console.error('   - gemini-2.0-flash: 每分鐘 15 次，每天 1500 次');
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
  throw new Error('所有 Gemini 模型都無法使用，請檢查 API key 和配額');
}

/**
 * 發布 AI 評論到 PR
 */
async function postReview(review) {
  console.log('📝 發布 AI 評論到 PR...\n');

  const commentBody = `## 🔥 火爆辛辣 AI Code Review 來啦！

${review}

---
_🤖 Powered by [AI Code Review Action](https://github.com/5G-HarryLu/github-ai-code-review) with Google Gemini ${GEMINI_MODEL}_
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
  console.log(`🤖 AI 模型: Gemini ${GEMINI_MODEL}\n`);
  console.log('═══════════════════════════════════════\n');

  try {
    // 1. 獲取 PR 資料
    const prData = await fetchPRData();

    // 2. 構建 prompt
    const prompt = buildPrompt(prData);

    // 3. Gemini 分析
    const review = await analyzeWithGemini(prompt);

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
