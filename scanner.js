const scanner = {
  html5QrCode: null,
  isCameraRunning: false,
  isScanningPaused: false,
  lastScannedIsbn: "",
  lastScannedTime: 0,
  barcodeDetector: null,
  autoScanInterval: null,
  cropYOffsetPercent: 0,
  audioCtx: null,

  initAudio: () => { 
    if(!scanner.audioCtx) scanner.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
    if(scanner.audioCtx.state === 'suspended') scanner.audioCtx.resume(); 
  },
  
  playBeep: () => {
    try {
      scanner.initAudio(); if (!scanner.audioCtx) return;
      const now = scanner.audioCtx.currentTime;
      const osc1 = scanner.audioCtx.createOscillator(); const gain1 = scanner.audioCtx.createGain();
      osc1.connect(gain1); gain1.connect(scanner.audioCtx.destination);
      osc1.type = 'sine'; osc1.frequency.setValueAtTime(1000, now); gain1.gain.setValueAtTime(0.08, now); gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc1.start(now); osc1.stop(now + 0.08);
      const osc2 = scanner.audioCtx.createOscillator(); const gain2 = scanner.audioCtx.createGain();
      osc2.connect(gain2); gain2.connect(scanner.audioCtx.destination);
      osc2.type = 'sine'; osc2.frequency.setValueAtTime(1300, now + 0.09); gain2.gain.setValueAtTime(0.08, now + 0.09); gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
      osc2.start(now + 0.09); osc2.stop(now + 0.18);
    } catch(e){}
  },

  getSupportedFormats: () => {
    if (typeof window.Html5Qrcode !== 'undefined' && window.Html5Qrcode.SupportedFormats) return [ window.Html5Qrcode.SupportedFormats.EAN_13 ];
    if (typeof window.Html5QrcodeSupportedFormats !== 'undefined') return [ window.Html5QrcodeSupportedFormats.EAN_13 ];
    return [ 10 ];
  },

  toggleCamera: async () => {
    scanner.initAudio();
    const btn = document.getElementById('camera-toggle-btn');
    const readerDiv = document.getElementById('reader');
    if (scanner.isCameraRunning) { await scanner.stopCamera(); } 
    else {
      scanner.isCameraRunning = true; scanner.isScanningPaused = false;
      readerDiv.classList.remove('hidden');
      document.getElementById('scan-area-overlay').classList.remove('hidden');
      btn.innerHTML = '<i class="fa-solid fa-circle-stop text-xl animate-pulse"></i> カメラをとめる';
      btn.classList.replace('bg-brand-500', 'bg-rose-500');
      
      scanner.html5QrCode = new Html5Qrcode("reader", { formatsToSupport: scanner.getSupportedFormats() });
      const config = { fps: 12, videoConstraints: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" }};
      
      const observer = new MutationObserver(() => {
        const v = readerDiv.querySelector('video');
        if(v) { v.setAttribute('playsinline','true'); v.setAttribute('autoplay','true'); v.play(); setTimeout(()=>scanner.startAutoScanLoop(v),500); observer.disconnect(); }
      });
      observer.observe(readerDiv, { childList: true, subtree: true });

      try { await scanner.html5QrCode.start({ facingMode: "environment" }, config, scanner.onScanSuccess, ()=>{}); } 
      catch(e) { await scanner.html5QrCode.start({}, config, scanner.onScanSuccess, ()=>{}); }
    }
  },
  
  stopCamera: async () => {
    scanner.stopAutoScanLoop();
    if(scanner.html5QrCode && scanner.isCameraRunning) { try{ await scanner.html5QrCode.stop(); }catch(e){} scanner.html5QrCode=null; }
    scanner.isCameraRunning=false; scanner.isScanningPaused=false;
    document.getElementById('reader').classList.add('hidden');
    document.getElementById('scan-area-overlay').classList.add('hidden');
    const btn = document.getElementById('camera-toggle-btn');
    btn.innerHTML = '<i class="fa-solid fa-camera-retro text-xl"></i> カメラをスタート！';
    btn.classList.replace('bg-rose-500', 'bg-brand-500');
  },

  startAutoScanLoop: (videoEl) => {
    if(scanner.autoScanInterval) clearInterval(scanner.autoScanInterval);
    if(!scanner.barcodeDetector) return;
    scanner.autoScanInterval = setInterval(async () => {
      if(!scanner.isCameraRunning || scanner.isScanningPaused) return;
      const vW = videoEl.videoWidth || 0, vH = videoEl.videoHeight || 0;
      if(vW===0) return;
      let cY = Math.floor((vH - (vH*0.28))/2);
      const cvs = document.createElement('canvas'); cvs.width=vW; cvs.height=Math.floor(vH*0.28);
      const ctx = cvs.getContext('2d');
      try {
        ctx.drawImage(videoEl, 0, cY, vW, cvs.height, 0, 0, vW, cvs.height);
        const res = await scanner.barcodeDetector.detect(cvs);
        if(res.length>0 && res[0].rawValue.startsWith("978")) scanner.onScanSuccess(res[0].rawValue);
      }catch(e){}
    }, 120);
  },

  stopAutoScanLoop: () => { if(scanner.autoScanInterval) clearInterval(scanner.autoScanInterval); },

  onScanSuccess: (isbnText) => {
    if (scanner.isScanningPaused) return;
    const isbn = String(isbnText).trim();
    if(!isbn.startsWith("978")) return;
    if(window.app.allRegisteredBooks.some(b=>b.isbn===isbn) || window.app.tempBooks.some(b=>b.isbn===isbn)) return;
    const now = Date.now();
    if(isbn===scanner.lastScannedIsbn && now-scanner.lastScannedTime<5000) return;
    
    scanner.isScanningPaused = true; scanner.lastScannedIsbn = isbn; scanner.lastScannedTime = now;
    if(scanner.html5QrCode) { try{ scanner.html5QrCode.pause(true); }catch(e){} }
    scanner.playBeep(); ui.showToast("みつけたよ！");
    document.getElementById('scan-status-isbn').textContent = isbn;
    
    scanner.addTempBookPlaceholder(isbn);
    
    setTimeout(()=>{
      if(!scanner.isCameraRunning) return;
      if(scanner.html5QrCode){ try{scanner.html5QrCode.resume();}catch(e){} }
      scanner.isScanningPaused=false;
      document.getElementById('scan-status-isbn').textContent = "----";
    }, 1500);
  },

  addTempBookPlaceholder: (isbn) => {
    const tId = 'temp_'+Date.now();
    const nBook = { tempId: tId, isbn: isbn, title: "検索中...", author:"", coverUrl:"", ownerType: "おうちの本", genre: "📕 おはなし・めいろ", comment:"", rating:5, readCount:1, isLoading:true };
    window.app.tempBooks.unshift(nBook);
    ui.renderTempBooks();
    
    scanner.fetchBookInfoExt(isbn).then(info => {
      const b = window.app.tempBooks.find(x=>x.tempId===tId);
      if(b){
        b.title = info.title || "不明"; b.author = info.author; b.coverUrl = info.coverUrl; b.description = info.description; b.publishedDate = info.publishedDate; b.isLoading = false;
        let predictedGenre = "";
        for(const rule of window.app.appSettings.themeRules) {
          if(info.description && info.description.includes(rule.keyword)){ predictedGenre = rule.genre; break; }
        }
        if(predictedGenre) { b.genre = predictedGenre; ui.showToast(`「${predictedGenre}」を自動セットしたよ！`); }
        ui.renderTempBooks();
      }
    });
  },



  fetchBookInfoExt: async (isbn) => {
    return new Promise((resolve) => {
      dbDriver.fetchBookInfo(isbn,
        (info) => resolve(info || {}),
        (err)  => { console.warn('fetchBookInfo失敗:', err); resolve({}); }
      );
    });
  },

  toggleDebugPanel: () => {
    const p = document.getElementById('camera-debug-panel');
    if(p) p.classList.toggle('hidden');
  },
  
  updateCropOffsetFromSlider: (val) => {
    scanner.cropYOffsetPercent = parseInt(val) || 0;
    document.getElementById('debug-crop-offset-val').textContent = (scanner.cropYOffsetPercent>0?'+':'') + scanner.cropYOffsetPercent + '%';
  },
  
  async captureAndTestDecode() {
    const v = document.querySelector('#reader video');
    if(!v) return ui.showToast("カメラが動いていません");
    const cvs = document.getElementById('debug-canvas');
    const resDiv = document.getElementById('debug-capture-result');
    document.getElementById('debug-capture-preview-container').classList.remove('hidden');
    
    const vW = v.videoWidth, vH = v.videoHeight;
    let cY = Math.floor((vH - (vH*0.28))/2) + Math.floor(vH*(scanner.cropYOffsetPercent/100));
    cvs.width = vW; cvs.height = Math.floor(vH*0.28);
    const ctx = cvs.getContext('2d');
    ctx.drawImage(v, 0, cY, vW, cvs.height, 0, 0, vW, cvs.height);
    
    resDiv.textContent = "解析中...";
    try {
      if(scanner.barcodeDetector) {
        const res = await scanner.barcodeDetector.detect(cvs);
        if(res.length>0) {
          resDiv.textContent = "成功: " + res[0].rawValue;
          scanner.onScanSuccess(res[0].rawValue);
        } else { resDiv.textContent = "失敗"; }
      } else { resDiv.textContent = "ネイティブエンジン非対応"; }
    } catch(e) { resDiv.textContent = "エラー"; }
  }
};