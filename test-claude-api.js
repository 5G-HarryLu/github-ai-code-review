#!/usr/bin/env node

/**
 * Claude API 診斷工具
 * 測試不同的 Claude 模型並診斷 API 問題
 */

import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

if (!CLAUDE_API_KEY) {
  console.error('❌ 錯誤: 需要設置 CLAUDE_API_KEY 環境變數');
  console.error('使用方式: export CLAUDE_API_KEY="sk-ant-..."');
  process.exit(1);
}

console.log('🔍 Claude API 診斷工具\n');
console.log('═══════════════════════════════════════\n');

// 驗證 API Key 格式
console.log('1️⃣  驗證 API Key 格式');
console.log(`   API Key 長度: ${CLAUDE_API_KEY.length}`);
console.log(`   開頭字符: ${CLAUDE_API_KEY.substring(0, 7)}...`);

if (!CLAUDE_API_KEY.startsWith('sk-ant-')) {
  console.error('   ⚠️  警告: API Key 應該以 "sk-ant-" 開頭');
}

if (CLAUDE_API_KEY.length < 40) {
  console.error('   ⚠️  警告: API Key 長度過短');
}

console.log('   ✅ 格式檢查完成\n');

// 要測試的模型列表
const modelsToTest = [
  'claude-3-7-sonnet-20250219',     // 最新 Claude 3.7 Sonnet
  'claude-3-5-sonnet-20241022',     // Claude 3.5 Sonnet (穩定)
  'claude-3-5-haiku-20241022',      // Claude 3.5 Haiku (快速)
  'claude-3-opus-20240229',         // Claude 3 Opus (強大)
];

console.log('2️⃣  測試可用模型\n');

const anthropic = new Anthropic({
  apiKey: CLAUDE_API_KEY,
});

// 簡單的測試提示
const testPrompt = '請用一句話回應：你好，這是一個 API 測試。';

const results = [];

for (const modelName of modelsToTest) {
  console.log(`\n🧪 測試模型: ${modelName}`);

  try {
    const startTime = Date.now();

    const message = await anthropic.messages.create({
      model: modelName,
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: testPrompt
      }]
    });

    const endTime = Date.now();
    const duration = endTime - startTime;
    const text = message.content[0].text;

    console.log(`   ✅ 成功! 響應時間: ${duration}ms`);
    console.log(`   📊 Token 使用: 輸入 ${message.usage.input_tokens}, 輸出 ${message.usage.output_tokens}`);
    console.log(`   📝 回應: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);

    results.push({
      model: modelName,
      status: 'success',
      duration,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      response: text
    });

  } catch (error) {
    let errorType = '未知錯誤';
    let suggestion = '';

    if (error.status === 429 || error.message?.includes('rate_limit')) {
      errorType = '配額限制 (429)';
      suggestion = '等待幾分鐘或升級 API 計劃';
    } else if (error.status === 401 || error.status === 403) {
      errorType = 'API Key 錯誤';
      suggestion = '檢查 API key 是否正確';
    } else if (error.status === 404) {
      errorType = '模型不存在';
      suggestion = '該模型可能已被移除或名稱錯誤';
    } else if (error.message?.includes('overloaded')) {
      errorType = '服務過載';
      suggestion = '稍後重試';
    }

    console.log(`   ❌ 失敗: ${errorType}`);
    console.log(`   💡 建議: ${suggestion}`);
    if (error.status) {
      console.log(`   🔢 HTTP 狀態: ${error.status}`);
    }
    console.log(`   📋 錯誤: ${error.message?.substring(0, 200) || error}`);

    results.push({
      model: modelName,
      status: 'failed',
      error: errorType,
      message: error.message,
      httpStatus: error.status
    });
  }
}

console.log('\n\n═══════════════════════════════════════');
console.log('📊 測試總結\n');

const successCount = results.filter(r => r.status === 'success').length;
const failCount = results.filter(r => r.status === 'failed').length;

console.log(`✅ 成功: ${successCount}/${results.length}`);
console.log(`❌ 失敗: ${failCount}/${results.length}\n`);

if (successCount > 0) {
  console.log('🎯 可用的模型:');
  results
    .filter(r => r.status === 'success')
    .sort((a, b) => a.duration - b.duration)
    .forEach((r, i) => {
      const costEstimate = (r.inputTokens * 3 + r.outputTokens * 15) / 1000000; // 粗略估算（美分）
      console.log(`   ${i + 1}. ${r.model}`);
      console.log(`      ⚡ 速度: ${r.duration}ms ${i === 0 ? '⭐ 最快' : ''}`);
      console.log(`      📊 Tokens: 輸入 ${r.inputTokens}, 輸出 ${r.outputTokens}`);
      console.log(`      💰 成本估算: ~$${costEstimate.toFixed(6)}/請求\n`);
    });

  const fastest = results
    .filter(r => r.status === 'success')
    .sort((a, b) => a.duration - b.duration)[0];

  console.log(`💡 推薦使用（速度最快）: ${fastest.model}`);
  console.log(`   設置方式: export CLAUDE_MODEL="${fastest.model}"`);

  const recommended = results.find(r => r.model === 'claude-3-5-sonnet-20241022' && r.status === 'success');
  if (recommended) {
    console.log(`\n💎 推薦使用（性價比最佳）: ${recommended.model}`);
    console.log(`   這是當前的默認模型，速度和質量平衡最好`);
  }
}

if (failCount > 0) {
  console.log('\n⚠️  失敗的模型:');
  results
    .filter(r => r.status === 'failed')
    .forEach(r => {
      console.log(`   - ${r.model}: ${r.error}`);
      if (r.httpStatus) {
        console.log(`     HTTP ${r.httpStatus}`);
      }
    });
}

console.log('\n═══════════════════════════════════════');
console.log('🔗 有用的連結:\n');
console.log('   API Keys: https://console.anthropic.com/settings/keys');
console.log('   配額管理: https://console.anthropic.com/settings/usage');
console.log('   文檔: https://docs.anthropic.com/');
console.log('   定價: https://www.anthropic.com/pricing\n');

console.log('📈 Claude API Tier 說明:');
console.log('   Free tier: $5 免費額度');
console.log('   Tier 1: 消費 $5-$100，RPM: 50, TPM: 40K');
console.log('   Tier 2: 消費 $100-$500，RPM: 1000, TPM: 80K');
console.log('   Tier 3: 消費 $500-$1000，RPM: 2000, TPM: 160K');
console.log('   Tier 4: 消費 > $1000，RPM: 4000, TPM: 400K\n');

// 返回狀態碼
process.exit(successCount > 0 ? 0 : 1);
