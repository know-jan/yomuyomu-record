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
    fetch(url + '?action=getBooks&sheetName=' + encodeURIComponent(sheetName)).then(r=>r.json()).then(successCb).catch(failCb);
  },
  addBooks: (payload, sheetName, successCb, failCb) => {
    const url = dbDriver.getGasUrl();
    fetch(url + '?action=addBooks', {
      method: 'POST', body: JSON.stringify({sheetName: sheetName, books: payload})
    }).then(r=>r.json()).then(successCb).catch(failCb);
  },
  updateBook: (payload, sheetName, successCb, failCb) => {
    const url = dbDriver.getGasUrl();
    fetch(url + '?action=updateBook', {
      method: 'POST', body: JSON.stringify({sheetName: sheetName, book: payload})
    }).then(r=>r.json()).then(successCb).catch(failCb);
  }
};