# SHUXIN 年度題庫包

將以下內容壓縮成一個 ZIP，ZIP 根目錄不可再多包一層資料夾：

```text
manifest.json
questions.xlsx 或 questions.csv
images/
  chapter-01.png
  ...
  chapter-20.png
```

- `manifest.json` 必須包含非空白的 `academicYear`。
- 題庫表必須正好20列，Chapter為1～20且不可重複。
- 必填欄位：`Chapter`、`關卡名稱`、`正式答案`、`答案類型`、`圖片檔名`。
- `可接受答案`可留空；多個答案用逗號、分號或直線分隔。
- `答案類型`使用 `zh`、`en` 或 `number`。
- 圖片檔名必須為 `chapter-01.png`～`chapter-20.png`（亦接受 jpg、jpeg、webp）。
- CSV中的前導零答案請加單引號，例如 `'0423`；匯入時系統會移除單引號並保留前導零。
