const http = require('http');
const url = require('url');

const targetUrl = process.argv[2] || 'http://localhost';

console.log(`[🔎 Bruno 診斷工具] 正在對目標發起原始請求: ${targetUrl}`);

const parsedUrl = url.parse(targetUrl);

const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 80,
    path: parsedUrl.path,
    method: 'GET',
};

const req = http.request(options, (res) => {
    console.log(`\n[📊 狀態分析] HTTP Status: ${res.statusCode}`);
    
    const setCookies = res.headers['set-cookie'];
    
    if (!setCookies) {
        console.log('\n[❌ 致命錯誤] 目標伺服器未回傳任何 Set-Cookie Header！(可能是路由錯誤或不需要 CSRF 保護)');
        process.exit(1);
    }

    console.log('\n[📦 Header 型態解析]');
    console.log(`資料結構型別: ${typeof setCookies} / 是否為陣列: ${Array.isArray(setCookies)}`);
    console.log('原始內容:', setCookies);

    console.log('\n[🛠️ 模擬 Axios/Bruno 環境陷阱測試]');
    
    // 模擬有時候 Axios 轉成字串的情況
    let testCookieVar = typeof setCookies === 'string' ? setCookies : setCookies.join(';(Simulated_Concat);');
    
    let token = '';
    let matchXSRF = testCookieVar.match(/XSRF-TOKEN=([^;,\s"]+)/);
    if (matchXSRF && matchXSRF[1]) {
        token = decodeURIComponent(matchXSRF[1]);
        console.log(`✅ [成功] 透過增強型 Regex 成功捕捉 XSRF-TOKEN: ${token.substring(0, 15)}...`);
    } else {
        console.log(`❌ [失敗] 增強型 Regex 無法捕捉 XSRF-TOKEN (可能是 Cookie 格式不符或被截斷)`);
    }
    
    let session = '';
    let matchSession = testCookieVar.match(/laravel_session=([^;,\s"]+)/);
    if (matchSession && matchSession[1]) {
        session = matchSession[1];
        console.log(`✅ [成功] 透過增強型 Regex 成功捕捉 laravel_session!`);
    } else {
         console.log(`❌ [失敗] 無法捕捉 laravel_session!`);
    }

    console.log('\n[💡 AI Agent 建議行動]');
    if (token && session) {
        console.log('診斷結果: 伺服器回傳正常。如果 Bruno 仍報錯 419，請 100% 確保已將 .yml 替換為 `Bruno_CSRF_419_Troubleshooting.md` 中的「強固型防呆腳本」，並確保使用 `bru.cookies.jar().clear()` 清空快取。');
    }

});

req.on('error', (e) => {
    console.error(`\n[❌ 連線錯誤] 請求遭遇問題: ${e.message}`);
});

req.end();
