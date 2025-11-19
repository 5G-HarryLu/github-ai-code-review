#!/usr/bin/env node

/**
 * Gemini API 診斷工具
 * 測試不同的 Gemini 模型並診斷 API 問題
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ 錯誤: 需要設置 GEMINI_API_KEY 環境變數');
  console.error('使用方式: export GEMINI_API_KEY="your-api-key"');
  process.exit(1);
}

console.log('🔍 Gemini API 診斷工具\n');
console.log('═══════════════════════════════════════\n');

// 驗證 API Key 格式
console.log('1️⃣  驗證 API Key 格式');
console.log(`   API Key 長度: ${GEMINI_API_KEY.length}`);
console.log(`   開頭字符: ${GEMINI_API_KEY.substring(0, 4)}...`);

if (!GEMINI_API_KEY.startsWith('AIza')) {
  console.error('   ⚠️  警告: API Key 應該以 "AIza" 開頭');
}

if (GEMINI_API_KEY.length < 30) {
  console.error('   ⚠️  警告: API Key 長度過短');
}

console.log('   ✅ 格式檢查完成\n');

// 要測試的模型列表
const modelsToTest = [
  'gemini-2.0-flash-thinking-exp',
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b'
];

console.log('2️⃣  測試可用模型\n');

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// 簡單的測試提示
const testPrompt = '請用一句話回應：你好，這是一個 API 測試。';

const results = [];

for (const modelName of modelsToTest) {
  console.log(`\n🧪 測試模型: ${modelName}`);

  try {
    const model = genAI.getGenerativeModel({ model: modelName });

    const startTime = Date.now();
    const result = await model.generateContent(testPrompt);
    const response = await result.response;
    const text = response.text();
    const endTime = Date.now();

    const duration = endTime - startTime;

    console.log(`   ✅ 成功! 響應時間: ${duration}ms`);
    console.log(`   📝 回應: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);

    results.push({
      model: modelName,
      status: 'success',
      duration,
      response: text
    });

  } catch (error) {
    let errorType = '未知錯誤';
    let suggestion = '';

    if (error.message.includes('429') || error.message.includes('quota')) {
      errorType = '配額限制';
      suggestion = '等待幾分鐘或升級 API 計劃';
    } else if (error.message.includes('403') || error.message.includes('401')) {
      errorType = 'API Key 錯誤';
      suggestion = '檢查 API key 是否正確';
    } else if (error.message.includes('404') || error.message.includes('not found')) {
      errorType = '模型不存在';
      suggestion = '該模型可能已被移除或名稱錯誤';
    }

    console.log(`   ❌ 失敗: ${errorType}`);
    console.log(`   💡 建議: ${suggestion}`);
    console.log(`   📋 錯誤: ${error.message.substring(0, 200)}`);

    results.push({
      model: modelName,
      status: 'failed',
      error: errorType,
      message: error.message
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
      console.log(`   ${i + 1}. ${r.model} (${r.duration}ms) ${i === 0 ? '⭐ 最快' : ''}`);
    });

  const fastest = results
    .filter(r => r.status === 'success')
    .sort((a, b) => a.duration - b.duration)[0];

  console.log(`\n💡 推薦使用: ${fastest.model}`);
  console.log(`   設置方式: export GEMINI_MODEL="${fastest.model}"`);
}

if (failCount > 0) {
  console.log('\n⚠️  失敗的模型:');
  results
    .filter(r => r.status === 'failed')
    .forEach(r => {
      console.log(`   - ${r.model}: ${r.error}`);
    });
}

console.log('\n═══════════════════════════════════════');
console.log('🔗 有用的連結:\n');
console.log('   API Keys: https://aistudio.google.com/app/apikey');
console.log('   配額監控: https://aistudio.google.com/app/apikey');
console.log('   文檔: https://ai.google.dev/docs');
console.log('   定價: https://ai.google.dev/pricing\n');

// 返回狀態碼
process.exit(successCount > 0 ? 0 : 1);
