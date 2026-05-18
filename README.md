# 力行國小課後照顧班報名網頁

這是一個可部署到 GitHub Pages 的靜態報名網頁，資料儲存在 Firebase Firestore，招生簡章 PDF 可透過 Firebase Storage 更新。

## Firebase 設定

1. 到 Firebase Console 建立專案。
2. 建立 Web App，複製 Firebase config。
3. 啟用 Firestore Database。
4. 啟用 Storage。
5. 啟用 Authentication 的 Email/Password。
6. 建立一個後台管理者帳號。
7. 將 Firebase config 貼到 `firebase-config.js`。

`firebase-config.js` 目前是空白範本，未填入前可以看頁面，但無法送出報名或讀取後台資料。

## 後台密碼

後台頁面 `admin.html` 使用 Firebase Authentication 的 Email / Password 登入。

請在 Firebase Console 啟用 Authentication：

1. Authentication > Sign-in method
2. 啟用 Email/Password
3. 到 Users 新增一位後台管理者
4. 使用該 Email 與密碼登入後台

Firestore / Storage 規則已設定為：

- 家長可以新增報名資料
- 只有登入的後台帳號可以讀取報名資料
- 只有登入的後台帳號可以修改設定與上傳簡章

## Firestore 資料

- `registrations`：家長送出的報名資料。
- `settings/app`：後台設定，目前包含報名期別與招生簡章檔案資訊。

## 部署到 GitHub Pages

在 GitHub repository 的 Settings > Pages 中選擇：

- Source: Deploy from a branch
- Branch: `main`
- Folder: `/root`

## 注意

前台與後台目前都直接透過 Firebase SDK 存取資料。正式開放前，請依學校需求設定 Firebase Security Rules。
