# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- 新增 `.gitignore` 檔案，包含 macOS、Bruno CLI、Node.js 及相關環境變數的忽略規範。

### Changed

- 全面優化 `README.md` 教學文件：
  - **去識別化**：將私有機密代稱替換為通用佔位符（如 `API-Project-Name`）。
  - **視覺化增強**：加入 Mermaid 流程圖與類別圖，強化架構呈現。
  - **質感提升**：採用標準 GitHub Alerts 與 Badges，並加入作者簽名標記。
- 優化 `GEMINI.md` 開發規範：
  - **穩定性提示**：針對 `bru.cookies.jar().clear()` 未公開方法加入風險警告。
  - **去識別化**：修正掃描腳本範例中的特定專案名稱。
  - **語法修復**：修正 Markdown 程式碼區塊的多餘反引號。
