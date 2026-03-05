---
name: bruno-debugger
description: 專門用於診斷與驗證 Bruno / Laravel API 介接時發生的 CSRF 419 錯誤、Session 丟失與 Cookie 解析陷阱的自動化診斷技能。
---

# Bruno API 診斷技能 (Bruno Debugger Skill)

這個技能庫賦予 AI 自動化診斷 Laravel API (Sail 環境) 與 Bruno 介接問題的能力。

## 觸發時機 (When to use)

當使用者回報以下狀況時，你必須主動觸發此技能：

1. **API 回覆 419 Page Expired** 或 CSRF Token mismatch。
2. Bruno 腳本執行 `Error: not a function`。
3. 登入後重整卻遺失 Session / 變成未登入狀態。
4. **API 回覆 422 Unprocessable Content**，尤其發現網址中有 `%252F` 等夾帶雙重百分號的狀況。

## 執行流程 (Workflow)

1. **環境檢測 (Environment Check)**
   立刻使用 `list_dir` 或終端機確認 `bruno-test` 專案下是否有該 API 的 YAML 檔案。
2. **自動化驗證腳本 (Diagnostics Check)**
   利用附帶的 `scripts/diagnose_csrf.js`，你可以直接在終端機中透過 Node.js 對指定的目標 API 發送原生的 GET 請求，並分析其 `Set-Cookie` 在原生的解析下，究竟是丟出陣列 (Array) 還是被組裝成了字串 (String)。
   - **指令**：`node .agents/skills/bruno-debugger/scripts/diagnose_csrf.js http://localhost/ownjy/login`

3. **讀取最佳實踐 (Remediation)**
   如果在診斷腳本中發現 Cookie 被降級為字串，或缺乏憑證，請將預設的強固腳本套入目標 yaml 中（參考 `Bruno_CSRF_419_Troubleshooting.md`）。
   **若是 422 錯誤**，請先利用終端機（如 `curl -i` 或詳閱使用者錯誤日誌），檢查網址是否遭到雙重編碼 (`%25`)，並參考 `Bruno_422_Double_Encoding_Troubleshooting.md` 提供的方針解決。

4. **主動修復 (Proactive Fix)**
   - **419/Cookie 問題**：利用 `replace_file_content` 導入正則防呆模組並清空 jar。
   - **422/參數問題**：透過 `replace_file_content` 將目標 YAML 檔底下 `settings:` 區塊中的 `encodeUrl: true` 改為 `encodeUrl: false`，強行迴避重複編碼邏輯。
