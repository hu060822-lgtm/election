# TAIWAN ELECTION WATCH 2026 · 2026 台灣選舉觀測站

朋友之間的 2026 九合一縣市長「看好度／支持度」觀測平台。

> **這不是民意調查，也不是選舉結果。** 所有數字都是加入本站的朋友各自做的非正式選擇。頁面上的 LIVE 只表示本站資料即時同步。

---

## 功能總覽

| 區塊 | 內容 |
| --- | --- |
| 選情總覽 `/` | 開場動畫、新聞跑馬燈（LIVE＝資料同步狀態）、11/28 08:00 投票倒數、參與人數、有效預測數、最受看好候選人、22 縣市互動地圖（5 種模式）、22 縣市戰況板、政黨看好度分布、選情快訊、熱門候選人排行、最新投票動態 |
| 縣市面板 | 點地圖或戰況板開啟：候選人照片／號次／政黨／參選狀態／簡介／看好度與支持度／「我看好此人當選」「我希望此人當選」按鈕／支持者名單／資料來源與更新日期 |
| 數據中心 `/analytics` | 候選人排行、縣市分布、政黨分布、政黨看好 vs 支持、參與度（各縣市人數、平均預測縣市數、尚無預測縣市、每日新增）、趨勢變化、朋友預測一致性矩陣、看好 × 支持交叉分析 |
| 開票模式 `/results` | 朋友預測與官方結果分欄呈現、朋友圈集體命中率、個人預測命中排行（例：14/22）。11/28 起自動啟動，管理員可強制開關 |
| 我的選擇 `/me` | 22 縣市兩種選擇紀錄、取消選擇、隱私開關、改暱稱、產生新找回碼、登出、永久刪除所有資料 |
| 管理後台 `/admin` | 候選人新增／編輯／刪除／照片上傳、參選狀態、政黨顏色、使用者停用／刪除、全部投票資料、投票開放／截止時間、是否允許修改、是否允許查看他人選擇、開票模式、跑馬燈公告、官方開票結果輸入、CSV 匯出、清除測試資料、操作紀錄 |

### 加入的特色功能
1. **全台選情戰況圖**：依領先差距著色。差 1 人＝膠著（紅斜線）、平手＝金色斜線、小幅領先＝淡色、穩定領先＝實色。
2. **朋友預測排行榜**：管理員輸入官方當選人後，自動計算每位朋友的命中數。
3. **選情快訊**：某縣市看好度第一名易主、出現平手或打破平手時，伺服器產生快訊，透過 WebSocket 推播到所有人頁面頂端，並寫入跑馬燈。
4. **政黨版圖**：地圖以各縣市被看好候選人的政黨加總著色。
5. **11/28 開票特別模式**：朋友預測與官方結果分開呈現，並計算準確度。
6. **看好度與支持度分離**：每個縣市分別回答「我看好誰當選？」和「我希望誰當選？」。支持度**預設不公開**，只以匿名人數計入統計，**永遠不會出現在動態消息**。地圖另有「看好 vs 支持」模式，數據中心有交叉分析。

---

## 快速開始

需求：Node.js 20+（已在 22 測試）、PostgreSQL 14+。

```bash
cp .env.example .env
```

編輯 `.env`：設定 `DATABASE_URL`，並把 `ADMIN_PASSWORD` 改成 12 字元以上的隨機字串。

```bash
npm install
```

```bash
npm run build && npm start
```

開啟 http://localhost:8787。伺服器啟動時會自動執行 migration，並建立 22 縣市、政黨與候選人基礎資料（可重複執行，不會覆蓋管理員的修改）。

### 開發模式

```bash
npm run dev
```

API 在 :8787，Vite 在 http://localhost:5173（已代理 `/api`、`/ws`、`/uploads`）。

### DEMO 測試資料（選用）

```bash
npm run seed:demo
```

建立 18 位 `DEMO-` 開頭的測試使用者與約 400 筆選擇紀錄。所有 DEMO 資料都標有 DEMO 標籤、快訊以 `[DEMO]` 開頭，可在後台「匯出與清除 → 清除 DEMO 測試資料」一鍵移除。**正式使用前請清除。**

### 所有指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 同時啟動 API（tsx watch）與 Vite |
| `npm run build` | 建置前端與後端 |
| `npm start` | 正式模式（同一個 port 提供 API、WebSocket 與前端） |
| `npm run migrate` | 套用尚未執行的 migration（可重複執行，有 advisory lock 防止並行） |
| `npm run seed` | migration + 基礎資料 |
| `npm run seed:demo` | 重建 DEMO 測試資料 |
| `npm test` | 對執行中的伺服器跑整合測試（見下方） |
| `npm run typecheck` | 前後端型別檢查 |

### 環境變數

| 變數 | 說明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 連線字串 |
| `PORT` | 預設 8787 |
| `ADMIN_PASSWORD` | 管理員密碼，至少 12 字元，否則後台登入停用 |
| `COOKIE_SECURE` | HTTPS 部署時設為 `true` |
| `UPLOAD_DIR` | 候選人照片儲存位置，預設 `./uploads` |
| `ALLOWED_ORIGINS` | 額外允許的 WebSocket 來源（開發時為 Vite 的 :5173） |
| `IDENTITY_RATE_LIMIT` | 每個 IP 每 15 分鐘可加入／找回身份的次數，預設 30 |

---

## 技術架構

```
web/      React 18 + TypeScript + Vite + Tailwind + Framer Motion + Recharts + d3-geo
server/   Node.js + Express + pg + ws + zod + multer
          migrations/*.sql   版本化 SQL migration
          src/seed/          22 縣市、政黨、候選人基礎資料；DEMO 產生器
          test/              整合測試
```

- **資料庫**：PostgreSQL。重複投票由資料庫唯一約束 `UNIQUE(user_id, county_id, kind)` 保證；候選人與縣市的對應由複合外鍵 `(candidate_id, county_id)` 保證，不能把 A 縣市的候選人選到 B 縣市。
- **即時更新**：同一個 HTTP server 上的 WebSocket（`/ws`）。伺服器只推播「哪個縣市變了」，前端收到後重新抓取資料，因此不會有推播內容與資料庫不一致的問題；斷線會指數退避重連並補抓。
- **並發一致性**：每筆選擇在一個交易中完成，並以 `pg_advisory_xact_lock(縣市)` 序列化同縣市的寫入，確保快訊判斷（誰超越誰）在多人同時操作時仍然正確。
- **地圖**：內政部國土測繪中心縣市界，經 [`taiwan-atlas`](https://github.com/dkaoster/taiwan-atlas)（MIT）轉為 TopoJSON，以 `d3-geo` Mercator 投影繪製。22 縣市全部可點擊、可用鍵盤操作（Tab + Enter）；金門縣與連江縣以插圖框呈現（金門插圖以大、小金門為範圍；距離較遠的烏坵超出插圖框不顯示，但仍屬金門縣）。支援滾輪縮放、拖曳平移與縮放按鈕。

### 資料庫 Schema（`server/migrations/001_init.sql`）

| 資料表 | 用途 |
| --- | --- |
| `counties` | 22 縣市（內政部縣市代碼為主鍵） |
| `parties` | 政黨與識別色 |
| `candidates` | 候選人資料：號次、政黨、照片與照片來源、簡介、參選狀態、現任、資料來源、資料更新日期 |
| `users` | 暱稱、session token 雜湊、找回碼雜湊、兩項公開設定、DEMO／停用旗標 |
| `picks` | 目前的選擇（`kind` = `predict` 看好／`support` 支持） |
| `pick_events` | 每次新增／修改／取消的紀錄，用於趨勢圖與每日統計 |
| `news_events` | 選情快訊 |
| `settings` | 投票時間、允許修改、允許查看他人、開票模式等 |
| `official_results`, `official_votes` | 管理員輸入的官方結果，與朋友預測分開 |
| `admin_sessions`, `audit_logs` | 管理員 session 與操作紀錄 |

### API

公開：`GET /api/state`、`GET /api/counties/:id/supporters`、`GET /api/activity`、`GET /api/analytics`、`GET /api/results`、`GET /api/health`

使用者：`GET|PATCH|DELETE /api/me`、`POST /api/me/join`、`POST /api/me/restore`、`POST /api/me/recovery`、`POST /api/me/logout`、`PUT /api/me/picks`、`DELETE /api/me/picks/:county/:kind`

管理員（全部在伺服器端驗證 session）：`POST /api/admin/login|logout`、`/api/admin/candidates[/:id[/photo]]`、`/api/admin/parties`、`/api/admin/users`、`GET /api/admin/picks`、`PUT /api/admin/settings`、`PUT|DELETE /api/admin/results/:county`、`GET /api/admin/export/{picks,tallies,users,candidates,events}.csv`、`POST /api/admin/clear`、`GET /api/admin/audit`

所有錯誤都回傳 `{ error, message }`，`message` 為可直接顯示的繁體中文。

---

## 身份識別與安全

- **加入**：輸入暱稱即可，不需要電子郵件。伺服器產生隨機 session token 放在 `httpOnly; SameSite=Lax` cookie，資料庫只存 SHA-256 雜湊。
- **不只靠 localStorage**：身份存在伺服器端，重複投票由資料庫約束防止；暱稱不分大小寫唯一。
- **換裝置**：加入時顯示一次「找回碼」，用「暱稱 + 找回碼」在新裝置恢復，舊裝置的 session 會失效。
- **CSRF**：所有寫入請求需帶自訂標頭 `X-TEW-Client`（跨站表單無法附加）。
- **管理員**：密碼以定時比較驗證、登入失敗會記錄、10 次／15 分鐘限流；session 12 小時到期，cookie 為 `SameSite=Strict`。後台每個 API 都在伺服器端檢查 session，不靠前端隱藏按鈕。
- **上傳**：只接受 JPG／PNG／WebP、3MB 以內，並檢查檔案開頭的 magic bytes，不只信任瀏覽器宣告的 MIME。
- **其他**：helmet + CSP、JSON body 64KB 上限、zod 驗證所有輸入、參數化 SQL、CSV 匯出防公式注入、IP 只在記憶體中用於限流，不寫入資料庫。

## 隱私

- 「看好誰當選」：加入時由使用者選擇是否公開（預設開啟，加入表單上有明確開關），隨時可改。
- 「希望誰當選」：**預設不公開**；不公開時只計入匿名人數，且支持度異動永遠不會出現在動態消息。
- 管理員可關閉「允許查看他人選擇」，此時所有名單、動態暱稱與一致性矩陣都會隱藏。
- 使用者可在「我的選擇」永久刪除所有資料（cascade 刪除選擇與異動紀錄，統計即時重算）。
- 不收集電子郵件、電話、真實姓名，不儲存 IP。
- 管理員看得到所有資料（包含未公開的支持對象），後台有提醒；所有管理操作都寫入操作紀錄。

## 候選人資料來源與正確性

基礎資料（`server/src/seed/data.ts`）於 **2026-10-30** 整理：

- 名單：中選會 2026-10-16 審定直轄市長 23 人、縣市長 58 人資格合格，**共 81 人**，狀態標示為「已登記・審定合格」（`registered`），不標成正式候選人。中選會正式公告候選人名單後，管理員可改為「正式候選人」。
- 號次：依媒體整理的 10/23（金門）與 10/27（其餘縣市）抽籤結果，主要來源為[中央社](https://www.cna.com.tw/news/aipl/202610275002.aspx)、[中央社（屏東花蓮台東）](https://www.cna.com.tw/news/aipl/202610270081.aspx)、[聯合報（金門）](https://udn.com/vote2026/story/124652/9833080)與[聯合報（澎湖）](https://udn.com/news/story/124652/9839289)。每位候選人都在資料庫記錄來源與更新日期。
- 參選狀態分為：正式候選人／已登記・審定合格／可能參選／未確認／已退選（已退選者無法被選擇）。

### ⚠ 需要管理員核對的項目
1. **號次留空的 4 個縣市**：新竹市、新竹縣、南投縣、嘉義市。各媒體的號次不一致，所以沒有填入，請以[中選會公告](https://www.cec.gov.tw)核對後在後台填入。
2. **候選人照片：全部未提供。** 開發環境無法連線到官方網站或 Wikimedia，所以沒有下載任何照片；目前全部顯示統一風格的預設頭像（姓氏 + 政黨色）。請在後台上傳官方或已授權的照片並填寫照片來源。本站不使用任何 AI 生成的人物影像。
3. **簡介**目前只有政黨與是否尋求連任，詳細簡介待補。
4. 少數小黨候選人的政黨歸屬（如臺南市蕭燐洪、高雄市張靜）與「現任」標記（蔣萬安、張善政、謝國樑、許淑華、周春米）來自媒體整理，建議一併核對。嘉義市張啓楷標為台灣民眾黨，並在簡介註明媒體報導為國民黨、民眾黨共同推薦。

---

## 測試

`server/test/api.test.ts` 為整合測試（17 項），對執行中的伺服器操作真實資料庫。測試建立的使用者會在結束時刪除，修改的設定也會還原。因為測試會在短時間內建立約 30 個帳號，執行時請放寬限流：

```bash
IDENTITY_RATE_LIMIT=1000 npm start
```

再開另一個終端機：

```bash
npm test
```

涵蓋：22 縣市各送出看好與支持、修改、重複送出、取消；跨縣市候選人被拒；同一使用者 10 個並發請求只產生 1 筆；16 位使用者並發投票後統計精確；領先易主產生快訊；未公開的支持者不出現在名單與動態；刪除帳號後統計回復；未登入管理員時所有後台 API 回 401；關閉修改後無法變更但可新增；截止後拒絕投票；候選人 CRUD + 已退選不可選 + 操作紀錄 + CSV；官方結果驅動命中排行。

開發過程中另以 Playwright 實測：桌面（1440px）與手機（390px）的頁面無水平捲動、無 console 錯誤；兩個瀏覽器同時開啟時，A 投票後 B 的動態即時出現；開啟 `prefers-reduced-motion` 時正常運作；重啟伺服器後資料完整保留；migration／seed 重複執行不改變資料。

## 已知限制

- 手機上地圖不支援雙指縮放，請使用右上角的縮放按鈕。
- 限流與 WebSocket 廣播都在單一 process 的記憶體中。若要部署多個實例，需要改用共用的限流儲存（如 Redis）與 Postgres `LISTEN/NOTIFY` 或 Redis pub/sub。
- 管理員只有一組共用密碼，沒有多管理員帳號與角色分級。
- 支持度雖然只顯示人數，但在參與人數很少的縣市，朋友之間仍可能推測出個人的選擇。這是小群體統計的本質限制，請在朋友圈中說明。
- 選情快訊只針對「看好度」產生，刻意不對支持度產生快訊，以免洩露個人偏好。
