const dbDriver = {
  getGasUrl: () => {
    return window.app.webAppUrl || window.app.safeStorage.getItem('yomuyomu_gas_url') || '';
  },
  
  getSettings: (successCb, failCb) => {
    const url = dbDriver.getGasUrl();
    if(!url) return failCb(new Error("No URL"));
    fetch(url + '?action=getSettings').then(r=>r.json()).then(successCb).catch(failCb);
  },
  
  getBooks: (sheetName, successCb, failCb) => {
    const url = dbDriver.getGasUrl();
    if(!url) return failCb(new Error("No URL"));
    fetch(url + '?action=getBooks&sheetName=' + encodeURIComponent(sheetName)).then(r=>r.json()).then(successCb).catch(failCb);
  },
  
  // ★不具合を修正した書籍情報取得処理
  fetchBookInfo: (isbn, successCb, failCb) => {
    const url = dbDriver.getGasUrl();
    if (!url) { failCb(new Error("GAS URL not set")); return; }
    
    // 安定バージョンの実績に合わせ、確実に「?」からパラメータを結合する構造に修正
    // もしURL末尾にすでに「?」や「/」がある場合の表記揺れも安全に吸収します
    let baseUrl = url;
    if (baseUrl.includes('?')) {
      // すでにURL側にパラメータがある場合は一度削るか、適切に結合できるように分離
      baseUrl = baseUrl.split('?')[0];
    }
    
    const targetUrl = `${baseUrl}?action=fetchBookInfo&isbn=${encodeURIComponent(isbn)}`;
    
    fetch(targetUrl, {
      method: 'GET',
      mode: 'cors'
    })
    .then(response => {
      if (!response.ok) throw new Error("fetchBookInfo failed: " + response.status);
      return response.json();
    })
    .then(data => successCb(data))
    .catch(err => failCb(err));
  },
  
  addBooks: (payload, sheetName, successCb, failCb) => {
    const url = dbDriver.getGasUrl();
    if(!url) return failCb(new Error("No URL"));
    
    let baseUrl = url.includes('?') ? url.split('?')[0] : url;
    
    fetch(baseUrl + '?action=addBooks', {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' }, // CORS事前フライト回避のためtext/plainを推奨
      body: JSON.stringify({
        sheetName: sheetName,
        books: payload
      })
    })
    .then(r => r.json())
    .then(successCb)
    .catch(failCb);
  },
  
  updateBook: (payload, sheetName, successCb, failCb) => {
    const url = dbDriver.getGasUrl();
    if(!url) return failCb(new Error("No URL"));
    
    let baseUrl = url.includes('?') ? url.split('?')[0] : url;
    
    fetch(baseUrl + '?action=updateBook', {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        sheetName: sheetName,
        book: payload
      })
    })
    .then(r => r.json())
    .then(successCb)
    .catch(failCb);
  }
};