// エラー監視ハンドラをつじつま合わせで最初期にバインド
window.onerror = function(message, source, lineno, colno, error) {
  const errorDiv = document.createElement('div');
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '0'; errorDiv.style.left = '0'; errorDiv.style.width = '100%';
  errorDiv.style.backgroundColor = '#fee2e2'; errorDiv.style.color = '#991b1b';
  errorDiv.style.padding = '16px'; errorDiv.style.borderBottom = '4px solid #f87171';
  errorDiv.style.zIndex = '99999'; errorDiv.style.fontFamily = 'monospace'; errorDiv.style.fontSize = '12px';
  errorDiv.style.whiteSpace = 'pre-wrap'; errorDiv.style.userSelect = 'text'; errorDiv.style.webkitUserSelect = 'text';
  errorDiv.innerHTML = '<strong>[JS Error]</strong> ' + message + '<br>場所: ' + source + ':' + lineno + ':' + colno;
  if (document.body) { document.body.appendChild(errorDiv); } else {
    window.addEventListener('DOMContentLoaded', () => { document.body.appendChild(errorDiv); });
  }
  return false;
};

// アプリのデータロードロジックをプロトタイプに紐付け
window.app.loadAppSettingsAndData = function() {
  if(!dbDriver.getGasUrl()) { ui.showSettingsModal(true); return; }
  ui.showLoading(true, "システム設定をよみこみ中...");
  dbDriver.getSettings(
    (settings) => {
      window.app.appSettings = settings;
      ui.renderKidTabs();
      if (window.app.appSettings.kids.length > 0) {
        window.app.fetchRegisteredBooks();
      } else {
        ui.showLoading(false);
        ui.showToast("子供の設定がありません。設定シートを確認してね！");
      }
    },
    (err) => {
      ui.showLoading(false);
      ui.showToast("設定の読み込みに失敗しました。GAS URLを確認してください。");
    }
  );
};

window.app.fetchRegisteredBooks = function() {
  if (window.app.appSettings.kids.length === 0) return;
  const kid = window.app.appSettings.kids[window.app.currentKidIndex];
  ui.showLoading(true, `${kid.name} の本棚をよみこみ中...`);
  dbDriver.getBooks(kid.sheetName, 
    (books) => {
      window.app.allRegisteredBooks = books;
      document.getElementById('dashboard-counter').textContent = books.length;
      ui.renderRegisteredBooks();
      ui.calculateAndRenderTrophies();
      ui.showLoading(false);
    },
    (err) => {
      ui.showLoading(false);
      ui.showToast("データの読み込みに失敗しました。");
    }
  );
};

// ライフサイクル初期化
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const isScannerMode = urlParams.get('mode') === 'scanner';

  if (isScannerMode) {
    document.getElementById('main-app-container').classList.add('hidden');
    document.getElementById('scanner-only-container').classList.remove('hidden');
    return;
  }

  // セレクトボックスの初期化
  const manualGenre = document.getElementById('manual-genre');
  const filterGenre = document.getElementById('filter-genre');
  const detailGenre = document.getElementById('detail-genre');
  let genreOptions = '';
  GENRE_LIST.forEach(g => { genreOptions += `<option value="${g}">${g}</option>`; });
  if(manualGenre) manualGenre.innerHTML = genreOptions;
  if(detailGenre) detailGenre.innerHTML = genreOptions;
  if(filterGenre) filterGenre.innerHTML += genreOptions;

  // 初期値セット
  document.getElementById('manual-date').value = new Date().toISOString().split('T')[0];
  ui.renderManualStars(5);

  // データロード
  window.app.loadAppSettingsAndData();
  
  // バーコード検出エンジンの初期化
  if (typeof window.BarcodeDetector !== 'undefined') {
    try { scanner.barcodeDetector = new window.BarcodeDetector({ formats: ['ean_13'] }); } catch(e){}
  }

  // 手動入力のフォーカスアウトイベントフック
  const manualTitleInput = document.getElementById('manual-title');
  if (manualTitleInput) {
    manualTitleInput.addEventListener('blur', () => ui.searchManualCoverImage(true));
  }
});