# Bruno 專案開發協定 (Bruno Project Guidelines)

本專案主要用於儲存與管理 API 的測試與文件化工作，主要使用 **Bruno** 作為 API Client。為了避免在撰寫自動化腳本或處理認證流程時產生預期外的錯誤，AI Agent 與開發者必須共同遵守以下核心規範。

---

## 🔒 1. 認證與 Cookie 管理機制 (Authentication & Session Flow)

當需要與具備 CSRF 保護機制 (如 Laravel Sanctum、Web Guard 等) 的系統互動時，Bruno 底層的 Cookie Jar 經常會因為殘留了過期 Session 而覆蓋我們傳入的 Header，導致 `419 Unknown Status / Page Expired` 錯誤。

✅ **標準解法：清空 Jar + 覆蓋 Header (Single-File Flow)**
雖然官方論壇建議使用分兩個 Request 處理，但實務上我們可以透過在 `Before Request` 腳本中引用未公開的 `bru.cookies.jar().clear()` 方法，強行清除擾人的快取，並在取得新 Token 時手動組裝：

> [!WARNING]
> **穩定性風險提示**：`bru.cookies.jar().clear()` 為 Bruno 目前版本中的「未公開內部方法」。雖然目前能有效解決 Session 蓋台問題，但該方法在 Bruno 未來升級時有失效風險。若發生錯誤，請優先檢查開發者社群或回歸官方推薦的雙 Request 流程。

- **Step 1: 強制清除原生 Cookie Jar**
  利用 `await bru.cookies.jar().clear()` 避免舊的 Session 干擾。
- **Step 2: 發送 GET 取新憑證**
  在同一個腳本用 `bru.sendRequest()` 取回 `set-cookie` 內的 Header。
- **Step 3: 強固的 Cookie 擷取解析 (避免 Axios 轉型陷阱)**
  由於底層 Axios 或框架版本差異，回傳的 `set-cookie` 在部分情況下可能會是字串 (String) 而非陣列 (Array)。若直接對其使用 `for` 迴圈迭代會導致變數錯亂（把字串逐字拆解），因而丟失憑證並造成 419 錯誤。建議一律將提取結果正規化後 `.join(';')`，再用 Regex 統一提取。
- **Step 4: 攔截並強行塞入目前的請求**
  直接將解析完的 Token 與 Session 手動覆蓋進該次的 `req.setHeader('Cookie', ...)`。

**✅ 核心腳本範例 (防呆強固版)：**

```javascript
const jar = bru.cookies.jar();
if (typeof jar.clear === "function") {
  await jar.clear(); // 清空干擾，避免舊 Session 殘留
}

try {
  const response = await bru.sendRequest({
    url: "http://localhost/your_prefix", // 請換成能夠取得 CSRF Cookie 的 GET URL
    method: "GET",
  });

  // 1. 處理大小寫與 Axios 陣列轉字串陷阱
  let setCookies = response.headers
    ? response.headers["set-cookie"] || response.headers["Set-Cookie"] || []
    : [];
  if (typeof setCookies === "string") setCookies = [setCookies];

  let token = "",
    sessionMatch = "",
    xsrfToken = "";

  if (setCookies && setCookies.length > 0) {
    // 2. 全部組合為單一字串，並利用 Regex 一次性捕捉 (避免逗號、空白導致的問題)
    const cookieString = setCookies.join(";");

    let matchXSRF = cookieString.match(/XSRF-TOKEN=([^;,\s"]+)/);
    if (matchXSRF && matchXSRF[1]) {
      xsrfToken = matchXSRF[1];
      token = decodeURIComponent(xsrfToken);
    }

    let matchSession = cookieString.match(/laravel_session=([^;,\s"]+)/);
    if (matchSession && matchSession[1]) {
      sessionMatch = matchSession[1];
    }
  }

  // 3. 只有同時取得 Token 與 Session 才會去設定 Header
  if (token && sessionMatch) {
    req.setHeader("X-XSRF-TOKEN", token);
    req.setHeader(
      "Cookie",
      `XSRF-TOKEN=${xsrfToken}; laravel_session=${sessionMatch}`,
    );
    bru.setEnvVar("token", token);
    console.log("CSRF Token 與 Session 已成功擷取並寫入。");
  } else {
    console.warn(
      "未能取得完整的 XSRF-TOKEN 或 laravel_session，送出後可能遭遇 419 Page Expired 錯誤。",
    );
  }
} catch (err) {
  console.error("取得 CSRF Token 時發生錯誤：", err);
}
```

---

## 🛑 1.5 URL 參數的雙重編碼防護 (422 Double Encoding)

從 Postman 轉換為 Bruno 時，極度容易因為 Request URL 或 Params 中已經自帶 URLEncode（例如 `/` 變成 `%2F`），而與 Bruno 預設的防護機制發生衝突，導致後端拋出 `422 Unprocessable Content` 錯誤。

**問題成因**：當字串已含 `%2F` 時，若 Bruno 的設定中又開啟了 `encodeUrl: true`，則百分號 `%` 會被二次編碼為 `%25`，變成 `%252F`，導致後端無法識別。

✅ **標準解法 (二選一)**：

1. **關閉編碼 (推薦，可無腦轉移)**：直接在該 YAML 設定檔的底部，將 `settings` 區塊中的 `encodeUrl` 強制設為 `false`。
2. **淨化參數**：保持 `encodeUrl: true`，但把 URL 上冗長的 Querystring 拆掉，並將編碼過的亂碼還原成真正的純文字（如 `/`），放進 YAML 的 `params` 節點內。

---

## ⚙️ 2. Bruno 腳本生命週期關鍵字 (Script Type Definition)

當需要直接編輯或生成 `.yml` 檔案時，**絕對禁止憑直覺生造關鍵字**。
Bruno YAML 結構中，對於腳本執行時機的定義極為嚴格。

- ❌ 錯誤使用：`pre-request`, `post-response`, `script: res:`
- ✅ 正確定義：
  在 `runtime: scripts:` 節點下，`type` 欄位**僅接受以下兩種實值**：
  1. `before-request`：在請求送出**前**執行的環境變數或資料準備腳本。
  2. `after-response`：在取得伺服器回應**後**執行的斷言或資料萃取腳本。

**標準 YAML 範例：**

```yaml
runtime:
  scripts:
    - type: after-response
      code: |-
        // 若要處理 Cookie 與回傳資料，請寫在這裡
        console.log("Response headers:", res.getHeader('set-cookie'));
```

---

## 🛡️ 3. 測試除錯策略 (Debugging & Validation)

1. 若在設定完畢後依然遇到登入無效、Session 遺失等狀況，請**第一時間**點擊 Bruno 介面左下角的「Cookies」按鈕，手動清掉殘留的 Domain Cookies (例如 `localhost`)。
2. 發送除錯日誌時，多利用 `console.log()`，並且在測試遇到阻礙時，直接切換到 **Timeline** 分頁，檢查實際**「送出」**與**「接收」**的 Header 狀態。
3. **主動掃描潛藏的舊語法與 419/422 漏洞**：
   專案內建了自動化掃描腳本，如果你剛匯入新資料，或想檢查特定目錄（例如 `Auth` 或 `Payment-Gateway`），你可以直接在終端機執行：
   ```bash
   node .agents/skills/bruno-debugger/scripts/check_bruno_scripts.js "你想掃描的目錄名稱或路徑"
   ```
   腳本會幫你找出所有缺乏防呆機制、或有 URL encode 問題的高風險 API，你再依據本文件的規範（第 1 點與 1.5 點）修正即可，不需要重複造輪子除錯！

---

## ⚠️ 4. Postman 轉移至 Bruno 常見陷阱 (Error: not a function)

當把 Postman 的腳本直接貼到 Bruno 時，最常遇到 `Error: not a function` 報錯。
這是因為 Bruno 底層使用的是 Axios 且語法不相容所導致，**常見的 3 大踩雷點與修正方式**如下：

1. ❌ **`response.headers.filter is not a function`** (取 Cookie 時崩潰)
   - **原因**：Postman 的 `headers` 是陣列；Bruno 的 `headers` 是物件 (Object)，不能使用 `.filter()`。
   - **正解**：直接從物件屬性裡抓陣列 👉 `const setCookies = response.headers ? response.headers['set-cookie'] : [];`

2. ❌ **`req.getHeaders().upsert is not a function`** (塞 Token 時崩潰)
   - **原因**：Postman 有提供便利的 `.upsert()` 方法；但 Bruno 沒有。
   - **正解**：直接使用 Bruno 的原生物件設值方法 👉 `req.setHeader("X-XSRF-TOKEN", token);`

3. ❌ **混用 Callback 與 Promise (非同步處理踩雷)**
   - **原因**：Bruno 的 `bru.sendRequest()` 預設回傳的是 `Promise`，不能再像舊式寫法一樣把 function (err, res) 塞成第二個參數。
   - **正解**：使用現代的 `async / await` 與 `try...catch`。 👉 `const response = await bru.sendRequest({...});`
