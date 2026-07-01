// ジャンル定義リスト
const GENRE_LIST = [
  "📕 おはなし・めいろ",
  "🐱 どうぶつ・きょうりゅう",
  "🚡 のりもの",
  "🚀 うちゅう・かがく",
  "🗾 にほん・せかい",
  "👗 おしゃれ・おしごと",
  "🔮 ファンタジー・ようせい",
  "🏫 くらし・べんきょう",
  "🦸 ヒーヒーロー・アニメ",
  "📦 その他"
];

// アプリのグローバル状態管理オブジェクト (window.appに集約してつじつまを合わせる)
window.app = {
  appSettings: { kids: [], trophies: [], themeRules: [] },
  currentKidIndex: 0,
  tempBooks: [],
  allRegisteredBooks: [],
  manualCoverCandidates: [],
  currentCoverCandidateIndex: 0,
  webAppUrl: '',
  
  // 安全なStorageアクセサ
  safeStorage: {
    getItem: (k) => { try { return localStorage.getItem(k); } catch(e){ return null; } },
    setItem: (k,v) => { try { localStorage.setItem(k,v); } catch(e){} }
  }
};