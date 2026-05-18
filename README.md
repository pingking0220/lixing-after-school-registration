# 力行國小課後照顧班報名網頁

這是一個可部署到 GitHub Pages 的課後照顧班報名網站，資料寫入 Firebase Firestore，後台可登入查看報名狀況、設定報名學期、匯出 CSV，並更換招生簡章 PDF。

## 目前功能

- 家長需先另開閱讀招生簡章，才能勾選確認並送出。
- 家長按「送出報名」後會先看到摘要，按「確認報名」才會正式寫入資料庫。
- 家長完成報名後會看到明確完成訊息，也可用學生姓名與家長電話查詢是否報名成功。
- 班級可輸入 `二年三班`、`2 年 3 班`、`203`，系統會自動判讀目前年級。
- 後台可設定報名學期：
  - 學年與學期：顯示在前台摘要與後台名冊，例如 `115學年上學期`。
  - 下一學年度上學期：學生升一個年級後報名。
  - 本學年度下學期：學生不升級，依目前年級報名。
- 年段可選日數：
  - 低年級：星期一、三、四、五。
  - 中年級：星期三、五。
  - 高年級：星期三。
- 後台可查看名冊、統計、搜尋與匯出 CSV。
- 後台可更換簡章 PDF；目前使用 Firestore 儲存小型 PDF，不需要啟用 Firebase Storage。

## Firebase 設定

專案 ID：`after-school-registration`

已完成：

- Firestore Database 已建立。
- Firestore Security Rules 已部署。
- 網頁已接上 Firebase Web App 設定。

還需要在 Firebase Console 手動完成：

Firebase Authentication 已啟用 Email/Password。後台管理帳號為：

`k79204@gmail.com`

Firestore 規則只允許這個 Email 讀取後台報名資料與修改設定。若要新增管理者，需要先在 Firebase Authentication 新增使用者，再把 Email 加進 `firestore.rules` 的管理員清單並重新部署規則。

Firestore 規則設計：

- 家長報名頁只能新增 `registrations`。
- 後台登入後才能讀取報名資料。
- `settings/app` 可公開讀取，登入後台後才能修改。

## 簡章檔案

預設簡章放在：

`brochures/115-1課後照顧班招生簡章(二到六年級).pdf`

後台上傳新簡章時，PDF 會寫入 Firestore 的 `settings/app`。Firestore 單筆文件有大小限制，所以後台限制 PDF 小於 650 KB。若未來簡章檔案較大，建議改用 Google Drive 分享連結，或再啟用 Firebase Storage。

## GitHub Pages

GitHub Pages 設定建議：

- Source：Deploy from a branch
- Branch：`main`
- Folder：`/root`

部署後網址：

https://pingking0220.github.io/lixing-after-school-registration/
