export default function About() {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="panel"><div className="panel-head"><h2 className="panel-title">{title}</h2></div><div className="space-y-2 p-4 text-sm leading-relaxed text-text-2">{children}</div></section>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="border-b border-rule pb-5">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">說明與隱私</h1>
        <p className="mt-2 text-sm text-text-3">這是朋友之間的私人觀測站。以下說明數字的意義、資料來源，以及你的資料如何被處理。</p>
      </header>
      <Section title="這些數字代表什麼">
        <p><b className="text-text">看好度</b>：朋友回答「我看好誰當選？」的比例——是對選舉結果的預測。</p>
        <p><b className="text-text">支持度</b>：朋友回答「我希望誰當選？」的比例——是個人的期望，與預測可以不同。</p>
        <p>樣本只來自加入本站的朋友，人數少、非隨機抽樣，<b className="text-text">不是民意調查，也不能代表任何選民群體，更不是選舉結果</b>。頁面上的 LIVE 只表示本站資料即時同步。</p>
        <p>「政黨看好度分布」是各黨候選人被選擇次數的加總（一人最多 22 次），不是政黨支持率。</p>
      </Section>
      <Section title="候選人資料來源">
        <p>候選人名單依中央選舉委員會 2026 年 10 月 16 日資格審定結果（直轄市長 23 人、縣市長 58 人）建立，狀態標示為「已登記・審定合格」；號次依媒體整理之 10/23、10/27 抽籤結果。各媒體號次不一致的縣市暫時留空，待管理員以中選會正式公告核對。</p>
        <p>每位候選人都標示資料來源與更新日期。本站不使用 AI 生成或來源不明的人物照片；沒有照片時顯示統一的預設頭像，管理員可上傳經授權的照片並記錄來源。</p>
        <p>候選人狀態分為：正式候選人、已登記・審定合格、可能參選、未確認、已退選。</p>
      </Section>
      <Section title="你的資料與隱私">
        <ul className="list-disc space-y-1 pl-5">
          <li>只需要暱稱，不收集電子郵件、電話或真實姓名；不儲存 IP 位址（僅在記憶體中做防濫用限流）。</li>
          <li>身份以 httpOnly cookie 中的隨機憑證維持，資料庫只存其雜湊值；換裝置時用「暱稱 + 找回碼」恢復。</li>
          <li>每人每個縣市、每種問題只能有一筆選擇，由資料庫唯一約束在伺服器端保證。</li>
          <li>「希望誰當選」預設不公開，只以匿名人數計入統計，永遠不會出現在動態消息中。</li>
          <li>你可以隨時修改公開設定、取消任何選擇，或在「我的選擇」頁永久刪除所有資料。</li>
          <li>管理員可以看到所有選擇（包含未公開者），以便維護資料正確性；所有管理操作都會留下紀錄。</li>
        </ul>
      </Section>
      <Section title="地圖">
        <p>縣市界線來自內政部國土測繪中心開放資料（經 taiwan-atlas 套件轉為 TopoJSON，MIT 授權），包含 6 直轄市、13 縣、3 市共 22 縣市；金門縣與連江縣以插圖框呈現。</p>
      </Section>
      <Section title="DEMO 測試資料">
        <p>暱稱以「DEMO-」開頭、帶有 DEMO 標籤的使用者與「[DEMO]」開頭的快訊皆為測試資料，不代表任何真實朋友的看法，管理員可一鍵清除。</p>
      </Section>
    </div>
  );
}
