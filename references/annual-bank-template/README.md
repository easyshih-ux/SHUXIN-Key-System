# SHUXIN 年度題庫包

將以下內容壓縮成一個 ZIP，ZIP 根目錄不可再多包一層資料夾：

```text
manifest.json
questions.xlsx 或 questions.csv
images/
  chapter-01.webp
  ...
  chapter-20.webp
```

- `manifest.json` 必須包含非空白的 `academicYear`。
- 題庫表必須正好20列，Chapter為1～20且不可重複。
- 必填欄位：`Chapter`、`關卡名稱`、`正式答案`、`答案類型`、`圖片檔名`。
- `可接受答案`可留空；多個答案用逗號、分號或直線分隔。
- `答案類型`使用 `zh`、`en` 或 `number`。
- 圖片檔名必須依序為 `chapter-01`～`chapter-20`，網站接受 png、jpg、jpeg、webp。
- **未來年度建議使用高品質 WebP**：寬度約 1800px、品質約 88%～90%，保留完整比例且不得裁切或修改題目內容。
- 使用 WebP 時，20張圖片與題庫的「圖片檔名」欄都必須填寫 `chapter-01.webp`～`chapter-20.webp`。
- 原始PNG請另外保存作為母檔，不必放入年度ZIP，以縮短各班電腦第一次載入的時間。
- CSV中的前導零答案請加單引號，例如 `'0423`；匯入時系統會移除單引號並保留前導零。
