# Bruno Debugger Scripts (AI 輔助診斷工具集)

這個目錄包含了專門為 `bruno-debugger` 技能打造的輔助診斷腳本。主要用於排查 Bruno 在與 Laravel API (或其他需要 CSRF 保護與複雜 URL 編碼的後端) 互動時，最常遭遇的 **419 (CSRF Token mismatch)** 與 **422 (Double Encoding)** 等棘手問題。

這些工具不但能由開發者手動執行，更是 AI Agent 在面對已知錯誤時，快速定位問題的核心武器。

---

## 🛠️ 包含的工具箱清單

### 1. 深度連線診斷工具 (`diagnose_csrf.js`)

- **用途**：當發生 `419 Page Expired`，且你不確定是伺服器根本沒給 Cookie，還是 Bruno 底層的 Axios 在解析時錯誤整合了陣列，此腳本可以發送最原始的 Node.js HTTP 請求直接與目標端點交談。
- **如何操作**：
  打開終端機，執行並帶入目標 API：
  ```bash
  node .agents/skills/bruno-debugger/scripts/diagnose_csrf.js http://localhost/ownjy/login
  ```
- **驗證與判讀**：
  腳本會回傳目標伺服器的狀態，並印出原生的 `Set-Cookie` 結構型別（是 String 還是 Array）。如果在「🛠️ 模擬 Axios/Bruno 環境陷阱測試」區塊中，腳本顯示 `✅ 成功捕捉 XSRF-TOKEN`，代表伺服器是健康的，問題 100% 出在 Bruno 的 YAML 腳本寫法老舊。此時請參考 `Bruno_CSRF_419_Troubleshooting.md` 中的「強固型防呆腳本」更新你的要求檔。

### 2. 專案巡檢掃描器 (`check_bruno_scripts.js`)

- **用途**：大規模從 Postman 過渡到 Bruno 後，用來找出埋藏在專案內的高風險腳本。它能揪出那些：
  - 殘留著 Postman 的過期與不支援語法（例如：`pm.environment`, `.upsert()`）。
  - 使用了容易因 Axios 版本而壞掉的 `Array.filter` 擷取方式。
  - 缺少了 `await bru.cookies.jar().clear()` 這個阻斷舊 Session 污染的防呆機制。
  - 存在「雙重編碼危險」：有複雜參數卻沒有關閉 `encodeUrl`。
- **如何操作**：
  打開終端機，傳入掃描的目標資料夾路徑（若路徑有包含空白，請務必加上引號）：

  ```bash
  # 範例一：掃描整體金流平台
  node .agents/skills/bruno-debugger/scripts/check_bruno_scripts.js "金流平台"

  # 範例二：掃描其他特定模組或第三方
  node .agents/skills/bruno-debugger/scripts/check_bruno_scripts.js "銀行帳號監控"
  node .agents/skills/bruno-debugger/scripts/check_bruno_scripts.js "金流平台 (三方)"
  ```

- **驗證與判讀**：
  腳本會自動忽略沒有夾帶程式碼邏輯的純 API 呼叫。如果有高風險檔案，它會列出清單與「需改原因」。只要把這些被點名的檔案，依據專案核心指引 **`GEMINI.md`** 中的規範直接換上最新的防呆寫法即可，無需由你或 AI 再重複造輪子自己寫出奇怪的修復邏輯！

---

## 🤖 AI Agent 協作指引

如果你是來協助開發的 AI Agent，當使用者抱怨 **「Bruno 登入失敗」**、**「API 噴 419」** 或 **「URL 上好像怪怪的 422 錯誤」** 時：

1. **第一時間**利用 `node` 呼叫這些腳本，作為事實根基 (Ground Truth)。
2. 確認問題範圍是 Cookie 還是 URL 編碼。
3. 利用 `replace_file_content` 結合專案根目錄下的最佳實踐 Markdown 文件，對那些出錯的 `.yml` 要求檔進行手術級的精準修復。
