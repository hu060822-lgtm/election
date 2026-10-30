/**
 * 基礎資料：22 縣市、政黨、2026 縣市長候選人。
 *
 * 候選人來源：中選會於 2026-10-16 審定直轄市長 23 人、縣市長 58 人資格合格（共 81 人），
 * 號次於 2026-10-23（金門）與 2026-10-27（其餘縣市）抽籤。以下名單依媒體整理之抽籤結果彙整。
 * 媒體間號次有出入的縣市（新竹市、新竹縣、南投縣、嘉義市）號次留空，請管理員以
 * 中選會正式公告（https://www.cec.gov.tw）核對後填入。照片一律留空，不使用未經授權或 AI 生成的影像。
 */

export const COUNTIES = [
  { id: '63000', name: '臺北市', name_en: 'Taipei City', kind: 'municipality', region: 'north' },
  { id: '65000', name: '新北市', name_en: 'New Taipei City', kind: 'municipality', region: 'north' },
  { id: '68000', name: '桃園市', name_en: 'Taoyuan City', kind: 'municipality', region: 'north' },
  { id: '66000', name: '臺中市', name_en: 'Taichung City', kind: 'municipality', region: 'central' },
  { id: '67000', name: '臺南市', name_en: 'Tainan City', kind: 'municipality', region: 'south' },
  { id: '64000', name: '高雄市', name_en: 'Kaohsiung City', kind: 'municipality', region: 'south' },
  { id: '10017', name: '基隆市', name_en: 'Keelung City', kind: 'city', region: 'north' },
  { id: '10018', name: '新竹市', name_en: 'Hsinchu City', kind: 'city', region: 'north' },
  { id: '10020', name: '嘉義市', name_en: 'Chiayi City', kind: 'city', region: 'south' },
  { id: '10004', name: '新竹縣', name_en: 'Hsinchu County', kind: 'county', region: 'north' },
  { id: '10005', name: '苗栗縣', name_en: 'Miaoli County', kind: 'county', region: 'central' },
  { id: '10007', name: '彰化縣', name_en: 'Changhua County', kind: 'county', region: 'central' },
  { id: '10008', name: '南投縣', name_en: 'Nantou County', kind: 'county', region: 'central' },
  { id: '10009', name: '雲林縣', name_en: 'Yunlin County', kind: 'county', region: 'central' },
  { id: '10010', name: '嘉義縣', name_en: 'Chiayi County', kind: 'county', region: 'south' },
  { id: '10013', name: '屏東縣', name_en: 'Pingtung County', kind: 'county', region: 'south' },
  { id: '10002', name: '宜蘭縣', name_en: 'Yilan County', kind: 'county', region: 'east' },
  { id: '10015', name: '花蓮縣', name_en: 'Hualien County', kind: 'county', region: 'east' },
  { id: '10014', name: '臺東縣', name_en: 'Taitung County', kind: 'county', region: 'east' },
  { id: '10016', name: '澎湖縣', name_en: 'Penghu County', kind: 'county', region: 'islands' },
  { id: '09020', name: '金門縣', name_en: 'Kinmen County', kind: 'county', region: 'islands' },
  { id: '09007', name: '連江縣', name_en: 'Lienchiang County', kind: 'county', region: 'islands' },
] as const;

export const PARTIES = [
  { id: 'kmt', name: '中國國民黨', short_name: '國民黨', color: '#3D6BE0', sort_order: 1 },
  { id: 'dpp', name: '民主進步黨', short_name: '民進黨', color: '#1FA35A', sort_order: 2 },
  { id: 'tpp', name: '台灣民眾黨', short_name: '民眾黨', color: '#2CC4C4', sort_order: 3 },
  { id: 'tsu', name: '台灣團結聯盟', short_name: '台聯', color: '#B5835A', sort_order: 4 },
  { id: 'labor', name: '台灣工黨', short_name: '工黨', color: '#D0533F', sort_order: 10 },
  { id: 'sor', name: '台灣SoR無法黨', short_name: 'SoR無法黨', color: '#9C7BEA', sort_order: 11 },
  { id: 'mahjong', name: '台灣麻將最大黨', short_name: '麻將黨', color: '#D9738F', sort_order: 12 },
  { id: 'sanshi', name: '三勢團結促進聯盟', short_name: '三勢聯盟', color: '#E08A3C', sort_order: 13 },
  { id: 'justice', name: '司法正義黨', short_name: '司法正義黨', color: '#C7C25A', sort_order: 14 },
  { id: 'judreform', name: '司法改革黨', short_name: '司法改革黨', color: '#E0679A', sort_order: 15 },
  { id: 'ind', name: '無黨籍', short_name: '無黨籍', color: '#8E9AAF', sort_order: 99 },
] as const;

/** Distinct colours for independents so two 無黨籍 candidates in one county never share a map colour. */
export const INDEPENDENT_PALETTE = ['#E8A33D', '#B07CF0', '#E56B8C', '#5FC9E8', '#C9C24F', '#F08A5D', '#8FD694'];

const CNA_DRAW = { source_name: '中央社〈2026九合一選舉 縣市長參選人抽籤號次一覽〉', source_url: 'https://www.cna.com.tw/news/aipl/202610275002.aspx' };
const CNA_EAST = { source_name: '中央社〈屏東花蓮台東縣長選舉之爭 參選人號次出爐〉', source_url: 'https://www.cna.com.tw/news/aipl/202610270081.aspx' };
const UDN_KINMEN = { source_name: '聯合報〈金門縣長候選人號次抽籤〉2026-10-23', source_url: 'https://udn.com/vote2026/story/124652/9833080' };
const UDN_PENGHU = { source_name: '聯合報〈澎湖縣長、議員選舉號次出爐〉', source_url: 'https://udn.com/news/story/124652/9839289' };
const CNA_TAIPEI = { source_name: '中央社〈九合一選舉登記截止 6人參選台北市長〉', source_url: 'https://cna.com.tw/news/aipl/202609040292.aspx' };

type Seed = { name: string; party: string; ballot: number | null; incumbent?: boolean; note?: string; src?: typeof CNA_DRAW };

/** null ballot = 媒體號次不一致，待以中選會公告核對 */
export const CANDIDATES: Record<string, Seed[]> = {
  '63000': [
    { name: '郭璽', party: 'mahjong', ballot: 1, src: CNA_TAIPEI },
    { name: '林志成', party: 'ind', ballot: 2, src: CNA_TAIPEI },
    { name: '沈伯洋', party: 'dpp', ballot: 3, src: CNA_TAIPEI },
    { name: '蕭文乾', party: 'sor', ballot: 4, src: CNA_TAIPEI },
    { name: '蔣萬安', party: 'kmt', ballot: 5, incumbent: true, src: CNA_TAIPEI },
    { name: '唐新民', party: 'sanshi', ballot: 6, src: CNA_TAIPEI },
  ],
  '65000': [
    { name: '蘇巧慧', party: 'dpp', ballot: 1 },
    { name: '蘇輝湟', party: 'ind', ballot: 2 },
    { name: '李四川', party: 'kmt', ballot: 3 },
  ],
  '68000': [
    { name: '黃世杰', party: 'dpp', ballot: 1 },
    { name: '張善政', party: 'kmt', ballot: 2, incumbent: true },
  ],
  '66000': [
    { name: '何欣純', party: 'dpp', ballot: 1 },
    { name: '洪麗華', party: 'justice', ballot: 2 },
    { name: '江啟臣', party: 'kmt', ballot: 3 },
  ],
  '67000': [
    { name: '蕭燐洪', party: 'sor', ballot: 1 },
    { name: '謝龍介', party: 'kmt', ballot: 2 },
    { name: '陳亭妃', party: 'dpp', ballot: 3 },
    { name: '葉人文', party: 'ind', ballot: 4 },
  ],
  '64000': [
    { name: '張靜', party: 'judreform', ballot: 1 },
    { name: '王肇民', party: 'ind', ballot: 2 },
    { name: '柯志恩', party: 'kmt', ballot: 3 },
    { name: '洪方隆', party: 'ind', ballot: 4 },
    { name: '賴瑞隆', party: 'dpp', ballot: 5 },
  ],
  '10017': [
    { name: '童子瑋', party: 'dpp', ballot: 1 },
    { name: '魏造文', party: 'ind', ballot: 2 },
    { name: '謝國樑', party: 'kmt', ballot: 3, incumbent: true },
  ],
  '10018': [
    { name: '高虹安', party: 'ind', ballot: null },
    { name: '何志勇', party: 'ind', ballot: null },
    { name: '莊競程', party: 'dpp', ballot: null },
  ],
  '10020': [
    { name: '王義成', party: 'ind', ballot: null },
    { name: '陳愷璜', party: 'ind', ballot: null },
    { name: '張啓楷', party: 'tpp', ballot: null, note: '媒體報導為國民黨、民眾黨共同推薦。' },
    { name: '王美惠', party: 'dpp', ballot: null },
    { name: '黃宏成台灣阿成世界偉人財神總統', party: 'ind', ballot: null },
  ],
  '10004': [
    { name: '鄭朝方', party: 'dpp', ballot: null },
    { name: '徐欣瑩', party: 'kmt', ballot: null },
    { name: '朱定瑀', party: 'ind', ballot: null },
  ],
  '10005': [
    { name: '陳品安', party: 'dpp', ballot: 1 },
    { name: '鍾東錦', party: 'kmt', ballot: 2 },
  ],
  '10007': [
    { name: '陳素月', party: 'dpp', ballot: 1 },
    { name: '魏平政', party: 'kmt', ballot: 2 },
    { name: '邱建富', party: 'ind', ballot: 3 },
    { name: '陳重嘉', party: 'ind', ballot: 4 },
  ],
  '10008': [
    { name: '許淑華', party: 'kmt', ballot: null, incumbent: true },
    { name: '温世政', party: 'dpp', ballot: null },
  ],
  '10009': [
    { name: '吳炳輝', party: 'ind', ballot: 1 },
    { name: '張嘉郡', party: 'kmt', ballot: 2 },
    { name: '劉建國', party: 'dpp', ballot: 3 },
    { name: '林佳瑜', party: 'ind', ballot: 4 },
  ],
  '10010': [
    { name: '吳品叡', party: 'ind', ballot: 1 },
    { name: '蔡易餘', party: 'dpp', ballot: 2 },
  ],
  '10013': [
    { name: '蘇清泉', party: 'kmt', ballot: 1, src: CNA_EAST },
    { name: '周春米', party: 'dpp', ballot: 2, incumbent: true, src: CNA_EAST },
  ],
  '10002': [
    { name: '林國漳', party: 'dpp', ballot: 1 },
    { name: '陳宏毅', party: 'ind', ballot: 2 },
    { name: '吳宗憲', party: 'kmt', ballot: 3 },
    { name: '劉燦輝', party: 'ind', ballot: 4 },
    { name: '楊鉯婷', party: 'ind', ballot: 5 },
  ],
  '10015': [
    { name: '魏嘉賢', party: 'ind', ballot: 1, src: CNA_EAST },
    { name: '張峻', party: 'ind', ballot: 2, src: CNA_EAST },
    { name: '游淑貞', party: 'kmt', ballot: 3, src: CNA_EAST },
    { name: '羅佩秦', party: 'labor', ballot: 4, src: CNA_EAST },
  ],
  '10014': [
    { name: '李吳穎智', party: 'ind', ballot: 1, src: CNA_EAST },
    { name: '陳瑩', party: 'dpp', ballot: 2, src: CNA_EAST },
    { name: '王志偉', party: 'ind', ballot: 3, src: CNA_EAST },
    { name: '吳秀華', party: 'kmt', ballot: 4, src: CNA_EAST },
  ],
  '10016': [
    { name: '許智富', party: 'ind', ballot: 1, src: UDN_PENGHU },
    { name: '周倪安', party: 'tsu', ballot: 2, src: UDN_PENGHU },
    { name: '葉竹林', party: 'ind', ballot: 3, src: UDN_PENGHU },
    { name: '吳淑瑾', party: 'dpp', ballot: 4, src: UDN_PENGHU },
    { name: '陳振中', party: 'kmt', ballot: 5, src: UDN_PENGHU },
    { name: '陳盡川', party: 'ind', ballot: 6, src: UDN_PENGHU },
  ],
  '09020': [
    { name: '張國威', party: 'ind', ballot: 1, src: UDN_KINMEN },
    { name: '李文良', party: 'ind', ballot: 2, src: UDN_KINMEN },
    { name: '洪和成', party: 'ind', ballot: 3, src: UDN_KINMEN },
    { name: '張火木', party: 'ind', ballot: 4, src: UDN_KINMEN },
    { name: '陳玉珍', party: 'kmt', ballot: 5, src: UDN_KINMEN },
    { name: '梁文韜', party: 'ind', ballot: 6, src: UDN_KINMEN },
    { name: '黃世團', party: 'ind', ballot: 7, src: UDN_KINMEN },
  ],
  '09007': [
    { name: '王忠銘', party: 'kmt', ballot: 1 },
    { name: '曹爾元', party: 'ind', ballot: 2 },
  ],
};

export function candidateSource(s: Seed) {
  return s.src ?? CNA_DRAW;
}

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  voting_opens_at: null,                    // null = 立即開放
  voting_closes_at: '2026-11-28T08:00:00+08:00', // 投票日開始投票前截止
  allow_changes: true,
  allow_view_others: true,
  election_mode: 'auto',                    // auto | on | off（auto = 11/28 起自動切換開票特別模式）
  election_date: '2026-11-28',
  site_notice: '',
};
