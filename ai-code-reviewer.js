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
const REPO = process.env.GITHUB_REPOSITORY; // e.g., "BBsBrezz/Gitlab-MCP"
const PR_NUMBER = parseInt(process.env.PR_NUMBER);

if (!GEMINI_API_KEY) {
  console.error('❌ 錯誤: 需要設置 GEMINI_API_KEY 環境變數');
  console.error('請前往 https://makersuite.google.com/app/apikey 獲取 API key');
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

// 初始化 Gemini - 支持通過環境變數選擇模型
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash"; // 默認使用穩定的 1.5-flash
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
 * 使用 Gemini API 分析程式碼（帶重試機制）
 */
async function analyzeWithGemini(prompt, retries = 2) {
  console.log('🤖 Google Gemini AI 正在分析程式碼...\n');
  console.log(`📊 使用模型: ${GEMINI_MODEL}\n`);

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const review = response.text();

      console.log('✅ AI 分析完成\n');
      return review;

    } catch (error) {
      const isQuotaError = error.message.includes('429') ||
                          error.message.includes('quota') ||
                          error.message.includes('rate limit');

      console.error(`❌ Gemini API 調用失敗 (嘗試 ${attempt}/${retries + 1}):`, error.message);

      if (isQuotaError) {
        console.error('\n⚠️  配額限制錯誤建議:');
        console.error('1. 檢查 API 使用量: https://aistudio.google.com/app/apikey');
        console.error('2. 等待幾分鐘後重試（每分鐘 15 次限制）');
        console.error('3. 考慮切換到 gemini-1.5-flash 模型（更穩定的配額）');
        console.error('4. 檢查是否需要升級 API 計劃\n');

        // 配額錯誤不重試，直接失敗
        throw error;
      }

      // 非配額錯誤，且還有重試次數
      if (attempt <= retries) {
        const waitTime = attempt * 2; // 指數退避：2秒、4秒
        console.log(`⏳ ${waitTime} 秒後重試...\n`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      } else {
        // 最後一次嘗試也失敗了
        if (error.response) {
          console.error('錯誤詳情:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
      }
    }
  }
}

/**
 * 發布 AI 評論到 PR
 */
async function postReview(review) {
  console.log('📝 發布 AI 評論到 PR...\n');

  const commentBody = `## 🔥 火爆辛辣 AI Code Review 來啦！

${review}

---
_🤖 Powered by [AI Code Review Action](https://github.com/5G-HarryLu/github-ai-code-review) with Google Gemini 2.0_
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
  console.log(`🤖 AI 模型: ${GEMINI_MODEL}\n`);
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
    process.exit(1);
  }
}

// 執行
main();
