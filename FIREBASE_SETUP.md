# SHUXIN Firebase setup

SHUXIN-Key-System 必須使用獨立的新 Firebase Project。不得使用或複製其他專案的 projectId、Firestore database、Rules、環境變數或 Firebase initialization。

## Local development

1. 在 SHUXIN 專用 Firebase Project 建立 Web App 與 Firestore database。
2. 複製 `.env.example` 為 `.env.local`，填入該 Web App 的四個 `VITE_FIREBASE_*` 值。
3. `.env.local` 已被 `.gitignore` 排除，不得 commit。

Firebase Web App config 會出現在瀏覽器 bundle 中，不能視為密碼。資料安全必須由 Firebase Auth、Firestore Rules，以及視需要啟用的 App Check 提供。

## GitHub Pages

在 SHUXIN-Key-System GitHub repository 的 Settings → Secrets and variables → Actions → Variables 建立：

- `SHUXIN_FIREBASE_API_KEY`
- `SHUXIN_FIREBASE_AUTH_DOMAIN`
- `SHUXIN_FIREBASE_PROJECT_ID`
- `SHUXIN_FIREBASE_APP_ID`

workflow 只把這四個 repository variables 映射成 Vite build-time env。不要建立或引用其他專案的同名 shared organization variables。

## Firestore Rules and Authentication

`firestore.rules` 預設拒絕未登入使用者，並只允許 Firebase Auth UID 已存在於 `/authorizedTeachers/{uid}` 的教師讀寫班級進度。`authorizedTeachers` 文件不可由瀏覽器 client 建立，須由 Firebase Console、Admin SDK 或受控管理程序建立。

正式啟用遠端續存前必須：

1. 在 SHUXIN Firebase Authentication 啟用 Google 或其他適合教師的登入方式。
2. 使用館員模式中的 Google 登入，登入狀態會由 Firebase Auth observer 自動恢復。
3. 將核准教師 UID 加入 `authorizedTeachers`。
4. 部署 Rules 時明確指定 SHUXIN project：`firebase deploy --only firestore:rules --project <SHUXIN_PROJECT_ID>`。

未登入或 UID 尚未加入 allowlist 時，安全 Rules 會拒絕遠端讀寫；系統仍保留目前瀏覽器中的 runtime state 與班級 local cache。請在 Firebase Authentication → Settings → Authorized domains 確認已加入 `easyshih-ux.github.io`，否則 GitHub Pages 的 Google 登入會被拒絕。不要為了暫時可用而改成 `allow read, write: if true`。
