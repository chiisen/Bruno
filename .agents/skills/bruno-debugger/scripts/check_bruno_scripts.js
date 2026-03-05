const fs = require('fs');
const path = require('path');

/**
 * ==============================================================================
 * 腳本名稱: check_bruno_scripts.js
 * 功能描述: 遞迴掃描指定目錄下的 .yml/.bru 檔案，找出「有撰寫腳本內容，但包含舊版漏洞 (如 419) 或缺少 jar.clear 防呆機制」的目標，協助開發者列出待改清單。
 * ==============================================================================
 */

console.log("\x1b[1;33m>>> Bruno 舊腳本掃描工具\x1b[0m");
console.log("\x1b[0;37m功能：檢查是否有未妥善處理 419 錯誤、或帶有過期 Postman callback 語法的檔案...\x1b[0m\n");

// 第一個參數接收目標路徑，預設檢查「金流平台」目錄
const directoryToScan = process.argv[2] && fs.existsSync(process.argv[2]) 
    ? process.argv[2] 
    : path.join(__dirname, '金流平台');

// 遞迴遍歷目錄找尋 yaml / bru
function scanDirectory(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            scanDirectory(filePath, fileList);
        } else if (filePath.endsWith('.yml') || filePath.endsWith('.bru')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

const allFiles = scanDirectory(directoryToScan);
let filesToFix = [];
let skippedEmpty = 0;

allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    
    // 條件 1：檔案必須要定義了 `scripts:` 並且底下有 `code: |-` 才算真正的「有內容」
    const hasScriptBlock = content.includes('scripts:');
    const hasCodeBlock = content.includes('code: |-');
    
    // 如果檔案沒有寫腳本，或者內容是空的，直接跳過不做計算
    if (!hasScriptBlock || !hasCodeBlock) {
        skippedEmpty++;
        return;
    }
    
    // 條件 2：檢查是否包含高風險的舊寫法
    const hasAxiosFilterError = content.includes('.filter(header');
    const hasUpsertError = content.includes('.upsert(');
    const hasPostmanLegacy = content.includes('pm.environment.get');
    
    // 條件 3：只要有寫 CSRF 的請求，有沒有正確加入我們最新的防呆清空機制
    const isMissingCookieProtection = (content.includes('XSRF-TOKEN') || content.includes('bru.sendRequest')) && !content.includes('jar.clear()');

    // 條件 4：檢查是否有 422 Double Encoding 風險 (如果網址有 % 且沒有關閉 encodeUrl)
    const hasUrlParamsRisk = content.includes('type: query') && content.includes('%2');
    const isEncodeUrlClosed = content.includes('encodeUrl: false');
    const isDoubleEncodingRisk = hasUrlParamsRisk && !isEncodeUrlClosed;

    if (hasAxiosFilterError || hasUpsertError || hasPostmanLegacy || isMissingCookieProtection || isDoubleEncodingRisk) {
        filesToFix.push({
            name: file,
            reasons: [
                hasAxiosFilterError ? '使用錯誤的 .filter() 擷取陣列' : null,
                hasUpsertError ? '使用過期的 .upsert() 設定標頭' : null,
                hasPostmanLegacy ? '殘留 Postman 語法 (pm.*)' : null,
                isMissingCookieProtection ? '缺少 jar.clear() 防呆清空機制' : null,
                isDoubleEncodingRisk ? '存在 422 Double Encoding 風險 (未關閉 encodeUrl)' : null
            ].filter(Boolean)
        });
    }
});

console.log(`📊 掃描總結：`);
console.log(`- 總共掃描 API 檔案：${allFiles.length}`);
console.log(`- 無腳本 / 空白跳過：${skippedEmpty}`);

if (filesToFix.length > 0) {
    console.log(`\n⚠️ 發現 [${filesToFix.length}] 個需要修改的 API 檔案：`);
    filesToFix.forEach((info, idx) => {
        console.log(`  ${idx + 1}. ${info.name}`);
        console.log(`     👉 需改原因: ${info.reasons.join(', ')}`);
    });
    console.log(`\n💡 建議行動：將上述檔案內的腳本替換回 \`Bruno_CSRF_419_Troubleshooting.md\` 裡記載的防呆安全版本，再將有 422 雙重編碼的 encodeUrl 設為 false！`);
} else {
    console.log(`\n✅ 太棒了！在目前有內容的腳本中，沒有發現任何舊版風險代碼。`);
}
