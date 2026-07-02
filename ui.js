const ui = {
  showLoading: (show, text = "通信中...") => {
    const overlay = document.getElementById('loading-overlay');
    if(document.getElementById('loading-text')) document.getElementById('loading-text').textContent = text;
    show ? overlay.classList.remove('opacity-0','pointer-events-none') : overlay.classList.add('opacity-0','pointer-events-none');
  },

  showToast: (msg) => {
    const toast = document.getElementById('toast-container');
    document.getElementById('toast-text').textContent = msg;
    toast.classList.remove('translate-y-24','opacity-0');
    setTimeout(()=> toast.classList.add('translate-y-24','opacity-0'), 3000);
  },

  switchTab: (tabId) => {
    ['tab-scan', 'tab-manual', 'tab-gallery'].forEach(id => {
      const el = document.getElementById(id);
      const navBtn = document.getElementById(id.replace('tab-', 'nav-btn-'));
      if(el) el.classList.add('hidden');
      if(navBtn) navBtn.className = "flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 py-4 px-3 sm:px-6 rounded-2xl font-bold text-lg transition-all text-brand-700 bg-brand-50/50 hover:bg-brand-100/50 border border-brand-200/60";
    });
    const targetTab = document.getElementById(tabId);
    const targetBtn = document.getElementById(tabId.replace('tab-', 'nav-btn-'));
    if(targetTab) targetTab.classList.remove('hidden');
    if(targetBtn) targetBtn.className = "flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 py-4 px-3 sm:px-6 rounded-2xl font-black text-lg transition-all transform scale-102 bg-brand-500 text-white shadow-lg border border-brand-400";
    
    if(tabId !== 'tab-scan' && window.scanner && window.scanner.isCameraRunning) window.scanner.stopCamera();
    if(tabId === 'tab-gallery') ui.renderRegisteredBooks();
  },

  showSettingsModal: (show) => {
    const modal = document.getElementById('settings-modal');
    const input = document.getElementById('settings-gas-url-input');
    if (show) {
      input.value = dbDriver.getGasUrl();
      modal.classList.remove('opacity-0', 'pointer-events-none');
    } else {
      modal.classList.add('opacity-0', 'pointer-events-none');
    }
  },

  saveGasUrlSettings: () => {
    const input = document.getElementById('settings-gas-url-input');
    const url = input.value.trim();
    if (!url.startsWith("https://script.google.com/")) { ui.showToast("有効なGASのURLではありません"); return; }
    window.app.safeStorage.setItem('yomuyomu_gas_url', url);
    ui.showToast("設定を保存したよ！");
    ui.showSettingsModal(false);
    window.app.loadAppSettingsAndData();
  },

  renderKidTabs: () => {
    const container = document.getElementById('kid-tabs-container');
    if(!container) return;
    let html = '';
    window.app.appSettings.kids.forEach((kid, idx) => {
      const isActive = idx === window.app.currentKidIndex;
      const baseClass = isActive ? 'bg-white shadow-sm rounded-t-xl text-brand-800 border-b-2 border-brand-500' : 'text-slate-500 hover:bg-slate-200/50';
      html += `
        <button type="button" onclick="ui.switchKid(${idx})" class="px-6 py-3 font-black text-sm flex-shrink-0 transition-all ${baseClass}">
          <span class="inline-block w-3 h-3 rounded-full mr-2" style="background-color: ${kid.color || '#ccc'}"></span>${kid.name}
        </button>
      `;
    });
    container.innerHTML = html;
    ui.applyKidTheme();
  },

  switchKid: (idx) => {
    if (window.app.currentKidIndex === idx) return;
    window.app.currentKidIndex = idx;
    ui.renderKidTabs();
    ui.applyKidTheme();
    window.app.fetchRegisteredBooks();
  },

  applyKidTheme: () => {
    if (window.app.appSettings.kids.length === 0) return;
    const kid = window.app.appSettings.kids[window.app.currentKidIndex];
    const color = kid.color || '#f59e0b';
    document.documentElement.style.setProperty('--theme-500', color);
    document.documentElement.style.setProperty('--kid-bg-gradient', `linear-gradient(to bottom right, #fff, ${color}22, #fff)`);
  },

  renderRegisteredBooks: () => {
    const container = document.getElementById('registered-list-container');
    if(!container) return;
    const sort = document.getElementById('sort-by').value;
    const fGenre = document.getElementById('filter-genre').value;
    const fOwner = document.getElementById('filter-owner').value;

    let list = (window.app.allRegisteredBooks || []).filter(b => {
      return (fGenre==='すべて' || b.genre===fGenre) && (fOwner==='すべて' || b.ownerType===fOwner);
    });

    list.sort((a,b)=>{
      if(sort==='date-desc') return new Date(b.date) - new Date(a.date);
      if(sort==='date-asc') return new Date(a.date) - new Date(b.date);
      if(sort==='rating-desc') return b.rating - a.rating;
      if(sort==='readCount-desc') return (b.readCount||1) - (a.readCount||1);
      if(sort==='publish-desc') return new Date(b.publishedDate||'1900-01-01') - new Date(a.publishedDate||'1900-01-01');
      return 0;
    });

    if(list.length===0) { container.innerHTML = '<div class="col-span-full text-center py-10 text-slate-500 font-bold">みつからないよ</div>'; return; }

    let html = '';
    list.forEach(b => {
      const rc = b.readCount || 1;
      html += `
        <div onclick="ui.openBookDetail('${b.id}')" class="bg-white rounded-[24px] p-3 shadow-sm border border-slate-100 active:scale-95 transition-transform cursor-pointer relative overflow-hidden">
          ${b.rating===5 ? '<div class="absolute -top-4 -right-4 w-12 h-12 bg-amber-400 rotate-45 z-10 flex items-end justify-center pb-1"><i class="fa-solid fa-star text-white text-[10px]"></i></div>' : ''}
          <div class="w-full h-32 flex justify-center mb-2">
            <div class="w-24 h-full rounded shadow overflow-hidden bg-slate-100">
              ${b.coverUrl ? `<img src="${b.coverUrl}" class="w-full h-full object-cover">` : '<div class="flex h-full items-center justify-center"><i class="fa-solid fa-book text-slate-300"></i></div>'}
            </div>
          </div>
          <div class="text-[9px] px-2 py-0.5 bg-slate-100 rounded-full inline-block mb-1 font-bold text-slate-600 truncate max-w-full">${b.genre}</div>
          <h4 class="font-black text-xs text-slate-800 line-clamp-2 leading-tight">${b.title}</h4>
          <div class="flex justify-between items-center mt-2">
            <div class="text-amber-400 text-[10px]">${'<i class="fa-solid fa-star"></i>'.repeat(b.rating)}</div>
            ${rc>1 ? `<span class="text-[10px] font-black text-brand-600 bg-brand-50 px-1 rounded">読${rc}回</span>` : ''}
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  },

  calculateAndRenderTrophies: () => {
    const container = document.getElementById('trophy-container');
    if(!container || !window.app.appSettings.trophies) return;
    const books = window.app.allRegisteredBooks || [];
    const totalCount = books.length;
    const genreCounts = {}; GENRE_LIST.forEach(g => genreCounts[g] = 0);
    let favCount = 0, repeatCount = 0;

    books.forEach(b => {
      if(genreCounts[b.genre] !== undefined) genreCounts[b.genre]++;
      if(b.rating === 5) favCount++;
      if((b.readCount || 1) >= 3) repeatCount++;
    });
    const uniqueDays = new Set(books.map(b => (b.date||'').split(' ')[0])).size;

    const kid = window.app.appSettings.kids[window.app.currentKidIndex];
    const storageKey = `trophy_unlocked_${kid.name}`;
    let unlockedIds = JSON.parse(window.app.safeStorage.getItem(storageKey) || '[]');
    let newUnlocked = false, latestTrophy = null;
    let html = '';

    window.app.appSettings.trophies.forEach(t => {
      let isUnlocked = false, progress = 0;
      if (t.conditionType === 'total_books') progress = totalCount;
      else if (t.conditionType === 'consecutive_days') progress = uniqueDays;
      else if (t.conditionType === 'review_count') progress = favCount;
      else if (t.conditionType === 'repeat_count') progress = repeatCount;
      else if (t.conditionType.startsWith('genre_')) {
        const targetG = GENRE_LIST.find(g => g.includes(t.conditionType.split('_')[1]));
        progress = targetG ? genreCounts[targetG] : 0;
      }

      isUnlocked = progress >= t.required;
      if (isUnlocked && !unlockedIds.includes(t.id)) {
        unlockedIds.push(t.id); newUnlocked = true; latestTrophy = t;
      }

      if (isUnlocked) {
        html += `<div class="flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-100 to-amber-200 border-2 border-amber-400 shadow-md cursor-pointer active:scale-95 transition-transform" onclick="ui.showToast('${t.name}: ${t.desc}')"><span class="text-2xl">${t.icon}</span></div>`;
      } else {
        html += `<div class="flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 border-2 border-slate-200 opacity-60 cursor-pointer active:scale-95 transition-transform" onclick="ui.showToast('あと ${t.required - progress} 冊で解放！')"><span class="text-2xl grayscale opacity-30">🔒</span></div>`;
      }
    });
    container.innerHTML = html || '<div class="text-xs text-slate-400">トロフィーはまだないよ</div>';

    if (newUnlocked) {
      window.app.safeStorage.setItem(storageKey, JSON.stringify(unlockedIds));
      ui.showCelebrationModal(latestTrophy);
    }
  },

  showCelebrationModal: (t) => {
    document.getElementById('celeb-icon').textContent = t.icon;
    document.getElementById('celeb-name').textContent = t.name;
    document.getElementById('celeb-desc').textContent = t.desc;
    const modal = document.getElementById('trophy-celebration-modal');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    setTimeout(() => document.getElementById('trophy-celebration-content').classList.remove('scale-50'), 50);
    if(window.scanner) window.scanner.playBeep();
  },
  
  closeTrophyModal: () => {
    document.getElementById('trophy-celebration-content').classList.add('scale-50');
    setTimeout(() => document.getElementById('trophy-celebration-modal').classList.add('opacity-0', 'pointer-events-none'), 300);
  },

  renderTempBooks: () => {
    const container = document.getElementById('temp-list-container');
    const badge = document.getElementById('temp-count-badge');
    const btnContainer = document.getElementById('batch-submit-btn-container');
    
    if(!container) return;
    if(!window.app.tempBooks) window.app.tempBooks = [];
    
    if(window.app.tempBooks.length === 0){
      container.innerHTML = '<div class="text-center py-16 px-4 bg-white/50 rounded-3xl"><i class="fa-solid fa-barcode text-4xl text-slate-300 mb-2"></i><p class="font-bold text-slate-500">スキャンしてね</p></div>';
      if(btnContainer) btnContainer.classList.add('hidden');
    } else {
      let html = '';
      window.app.tempBooks.forEach(b => {
        html += `
          <div class="bg-white p-4 rounded-[20px] shadow-sm border border-slate-200 flex gap-4 relative ${b.isLoading?'opacity-60':''}">
            <button onclick="ui.removeTemp('${b.tempId}')" class="absolute -top-2 -right-2 bg-rose-500 text-white w-8 h-8 rounded-full shadow z-10"><i class="fa-solid fa-xmark"></i></button>
            <div class="w-16 h-24 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
              ${b.coverUrl ? `<img src="${b.coverUrl}" class="w-full h-full object-cover">` : '<div class="text-slate-300"><i class="fa-solid fa-book text-2xl"></i></div>'}
            </div>
            <div class="flex-grow space-y-2 overflow-hidden">
              <input type="text" value="${b.title || ''}" onchange="ui.updateTemp('${b.tempId}','title',this.value)" class="w-full font-bold border-b border-dashed border-slate-300 outline-none text-sm text-slate-800">
              <select onchange="ui.updateTemp('${b.tempId}','genre',this.value)" class="w-full text-xs p-1.5 bg-slate-50 rounded border border-slate-200 font-bold text-slate-700">
                ${GENRE_LIST.map(g => `<option value="${g}" ${b.genre===g?'selected':''}>${g}</option>`).join('')}
              </select>
            </div>
          </div>
        `;
      });
      container.innerHTML = html;
      if(badge) badge.textContent = window.app.tempBooks.length;
      if(btnContainer) btnContainer.classList.remove('hidden');
    }
  },

  updateTemp: (id, key, val) => { const b=window.app.tempBooks.find(x=>x.tempId===id); if(b) b[key]=val; },
  removeTemp: (id) => { window.app.tempBooks = window.app.tempBooks.filter(x=>x.tempId!==id); ui.renderTempBooks(); },
  clearTempListConfirm: () => { if(confirm("からにする？")){ window.app.tempBooks=[]; ui.renderTempBooks(); } },

  // ★「まとめて登録」成功時に、シートから最新の本棚データを即座に引き抜いてリロードするよう修正
// ★エラーガード＆即時コレクション反映を完璧にした「まとめて登録」処理
  submitBatchBooks: function() {
    if (!window.app.tempBooks || window.app.tempBooks.length === 0) return;
    
    // 未入力（タイトルが「しらべているよ...」のまま）のガード
    const invalid = window.app.tempBooks.find(b => !b.title || b.title.trim() === "" || b.title === "しらべているよ...");
    if (invalid) {
      ui.showToast("本のなまえを入力していないものがあるよ。書いてね！");
      return;
    }

    // 安全弁：子供の設定配列自体が存在しないか、空の場合のクラッシュ防止
    if (!window.app.appSettings || !window.app.appSettings.kids || window.app.appSettings.kids.length === 0) {
      ui.showToast("子供の設定データがまだよみこめていません。すこし待ってね！");
      return;
    }

    const kid = window.app.appSettings.kids[window.app.currentKidIndex];
    if (!kid || !kid.sheetName) {
      ui.showToast("えらんだ子供のシート名がみつかりません。設定をたしかめてね！");
      return;
    }

    ui.showLoading(true, "スプレッドシートにほぞん中...");
    
    // 送信データの形をバックエンドの受け口（13列）に完全同期
    const booksPayload = window.app.tempBooks.map(b => ({
      isbn: b.isbn || "",
      title: b.title,
      author: b.author || "（著者不明）",
      coverUrl: b.coverUrl || "",
      ownerType: b.ownerType || "おうちの本",
      genre: b.genre || "📦 その他",
      comment: b.comment || "",
      rating: Number(b.rating || 5),
      readCount: Number(b.readCount || 1),
      description: b.description || "",
      published: b.publishedDate || b.published || ""
    }));
    
    dbDriver.addBooks(booksPayload, kid.sheetName, function(res) {
      if (res && res.success) {
        if (typeof playBeep === 'function') playBeep("coin");
        if (typeof animateCoinCounter === 'function') animateCoinCounter(true);
        ui.showToast("本棚に登録したよ！📚✨");
        
        // 一時リストをきれいに初期化
        window.app.tempBooks = [];
        if (typeof saveTempBooksToStorage === 'function') saveTempBooksToStorage();
        if (typeof renderTempListEmpty === 'function') {
          renderTempListEmpty();
        } else {
          ui.renderTempBooks();
        }
        updateTempCountBadge();
        
        // ページ全体をリロードせず、選択中の子供の最新コレクションを即座に裏で再取得して描画
        if (typeof window.app.fetchRegisteredBooks === 'function') {
          window.app.fetchRegisteredBooks();
        }
        ui.switchTab('tab-gallery');
      } else {
        ui.showLoading(false);
        ui.showToast("登録にしっぱいしちゃった。");
      }
    }, function(err) {
      ui.showLoading(false);
      console.error("addBooks通信エラー:", err);
      ui.showToast("データベースとの通信に失敗しました。");
    });
  },




  
  renderManualStars: (rating) => {
    const container = document.getElementById('manual-stars-container');
    if(!container) return;
    let html = '';
    for (let i = 1; i <= 5; i++) {
      const isGold = i <= rating;
      const colorClass = isGold ? 'text-amber-400 scale-110' : 'text-slate-200';
      html += `<button type="button" onclick="ui.setManualRating(${i})" class="text-3xl focus:outline-none transition-transform active:scale-125 px-1"><i class="fa-solid fa-star ${colorClass}"></i></button>`;
    }
    container.innerHTML = html;
    document.getElementById('manual-rating').value = rating;
  },
  
  setManualRating: (rating) => { ui.renderManualStars(rating); },

  searchManualCoverImage: (isSilent = false) => {
    const title = document.getElementById('manual-title').value.trim();
    const author = document.getElementById('manual-author').value.trim();
    const statusEl = document.getElementById('manual-cover-status');
    
    if (!title) { if (!isSilent) ui.showToast("本の名前を書いてね！"); return; }
    if (statusEl && !isSilent) statusEl.textContent = "インターネットで表紙をさがしています...";

    let url = "";
    const gasUrl = dbDriver.getGasUrl();
    if (gasUrl) {
      url = `${gasUrl}?action=fetchBookInfoBySearch&title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`;
    } else {
      url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}+inauthor:${encodeURIComponent(author)}&maxResults=5`;
    }
    
    fetch(url).then(res => res.json()).then(data => {
      window.app.manualCoverCandidates = []; window.app.currentCoverCandidateIndex = 0;
      const isFromGas = Array.isArray(data);
      if (isFromGas) { window.app.manualCoverCandidates = data; }
      else if (data && data.items) {
        data.items.forEach(item => {
          if (item.volumeInfo && item.volumeInfo.imageLinks) {
            let t = item.volumeInfo.imageLinks.thumbnail || item.volumeInfo.imageLinks.smallThumbnail;
            if (t) window.app.manualCoverCandidates.push(t.replace("http://", "https://"));
          }
        });
      }
      if (window.app.manualCoverCandidates.length > 0) {
        ui.updateCoverPreview();
        if (statusEl) statusEl.textContent = `画像が ${window.app.manualCoverCandidates.length}件 みつかったよ！`;
        if (!isSilent) ui.showToast("表紙の候補がみつかりました！");
      } else {
        ui.clearManualCoverImage();
        if (statusEl) statusEl.textContent = "画像がみつかりませんでした。";
        if (!isSilent) ui.showToast("画像が見つかりませんでした");
      }
    }).catch(err => { if (!isSilent) ui.showToast("検索エラーがおきました"); });
  },

  updateCoverPreview: () => {
    const img = document.getElementById('manual-cover-preview-img');
    const placeholder = document.getElementById('manual-cover-preview-placeholder');
    const input = document.getElementById('manual-cover-url');
    const btnClear = document.getElementById('btn-manual-cover-clear');
    const container = document.getElementById('manual-cover-candidates-container');
    const info = document.getElementById('manual-cover-candidate-info');
    
    if (window.app.manualCoverCandidates.length > 0) {
      const url = window.app.manualCoverCandidates[window.app.currentCoverCandidateIndex];
      img.src = url; img.classList.remove('hidden'); placeholder.classList.add('hidden');
      input.value = url; btnClear.classList.remove('hidden');
      if (window.app.manualCoverCandidates.length > 1) {
        container.classList.remove('hidden');
        info.textContent = `候補 ${window.app.currentCoverCandidateIndex + 1} / ${window.app.manualCoverCandidates.length}`;
      } else { container.classList.add('hidden'); }
    } else { ui.clearManualCoverImage(); }
  },

  clearManualCoverImage: () => {
    document.getElementById('manual-cover-preview-img').classList.add('hidden');
    document.getElementById('manual-cover-preview-placeholder').classList.remove('hidden');
    document.getElementById('manual-cover-url').value = "";
    document.getElementById('btn-manual-cover-clear').classList.add('hidden');
    document.getElementById('manual-cover-candidates-container').classList.add('hidden');
    document.getElementById('manual-cover-status').textContent = "本のなまえを入力すると、自動でさがすよ！";
    window.app.manualCoverCandidates = []; window.app.currentCoverCandidateIndex = 0;
  },

  prevCoverCandidate: () => {
    if (window.app.manualCoverCandidates.length <= 1) return;
    window.app.currentCoverCandidateIndex = (window.app.currentCoverCandidateIndex - 1 + window.app.manualCoverCandidates.length) % window.app.manualCoverCandidates.length;
    ui.updateCoverPreview();
  },
  
  nextCoverCandidate: () => {
    if (window.app.manualCoverCandidates.length <= 1) return;
    window.app.currentCoverCandidateIndex = (window.app.currentCoverCandidateIndex + 1) % window.app.manualCoverCandidates.length;
    ui.updateCoverPreview();
  },

  submitManualForm: (event) => {
    event.preventDefault();
    const title = document.getElementById('manual-title').value.trim();
    const author = document.getElementById('manual-author').value.trim();
    const genre = document.getElementById('manual-genre').value;
    const ownerType = document.getElementById('manual-owner').value;
    const dateVal = document.getElementById('manual-date').value;
    const rating = Number(document.getElementById('manual-rating').value);
    const comment = document.getElementById('manual-comment').value.trim();
    const coverUrl = document.getElementById('manual-cover-url').value;

    if (!title) { ui.showToast("本の名前を書いてね！"); return; }
    ui.showLoading(true, "ほぞん中...");
    
    const singlePayload = [{
      isbn: "", title: title, author: author, coverUrl: coverUrl || "",
      ownerType: ownerType, genre: genre, date: dateVal, comment: comment, rating: rating, readCount: 1, description: "", publishedDate: ""
    }];
    
    const kid = window.app.appSettings.kids[window.app.currentKidIndex];
    dbDriver.addBooks(singlePayload, kid.sheetName, function(res) {
      if (res.success) {
        ui.showToast("本を登録したよ！📖");
        document.getElementById('manual-title').value = "";
        document.getElementById('manual-author').value = "";
        document.getElementById('manual-comment').value = "";
        document.getElementById('manual-date').value = new Date().toISOString().split('T')[0];
        ui.renderManualStars(5);
        ui.clearManualCoverImage();
        if(typeof window.app.fetchRegisteredBooks === 'function') {
          window.app.fetchRegisteredBooks();
        }
        ui.switchTab('tab-gallery');
      } else { 
        ui.showLoading(false);
        ui.showToast("登録にしっぱいしちゃった。"); 
      }
    }, function(err) { ui.showLoading(false); ui.showToast("通信エラーです"); });
  },

  submitManualIsbn: () => {
    const input = document.getElementById('manual-isbn-input');
    if(!input) return;
    const isbn = input.value.trim().replace(/[-\s]/g, '');
    if (!/^\d{10}$|^\d{13}$/.test(isbn)) { ui.showToast("バーコードは10けたか13けたで入れてね！"); return; }
    
    input.value = ""; 
    if(window.scanner) { window.scanner.initAudio(); window.scanner.playBeep(); }
    ui.showToast("しらべています..."); 
    
    if(window.scanner && typeof window.scanner.addTempBookPlaceholder === 'function') { 
      window.scanner.addTempBookPlaceholder(isbn); 
    } else {
      ui.showToast("スキャナーがじゅんびできていません");
    }
  },

  drawGacha: () => {
    const homeBooks = (window.app.allRegisteredBooks || []).filter(b => b.ownerType === "おうちの本");
    if(homeBooks.length === 0){ ui.showToast("おうちの本を登録してから遊んでね！"); return; }
    ui.showLoading(true, "ガチャをまわしているよ... 🎁");
    setTimeout(() => {
      ui.showLoading(false);
      const rand = homeBooks[Math.floor(Math.random() * homeBooks.length)];
      ui.openBookDetail(rand.id);
      setTimeout(() => ui.showToast("✨ 今日のラッキー本はこれ！ ✨"), 300);
    }, 1500);
  },

  currentDetailBook: null,
  openBookDetail: (id) => {
    const book = window.app.allRegisteredBooks.find(b => b.id === id);
    if(!book) return;
    ui.currentDetailBook = book;

    document.getElementById('detail-id').value = book.id;
    document.getElementById('detail-isbn').value = book.isbn || "";
    document.getElementById('detail-title').value = book.title;
    document.getElementById('detail-author').value = book.author || "";
    document.getElementById('detail-genre').value = book.genre;
    document.getElementById('detail-owner').value = book.ownerType;
    document.getElementById('detail-date').value = (book.date || "").split(' ')[0].replace(/\//g,'-');
    document.getElementById('detail-comment').value = book.comment || "";
    document.getElementById('detail-description').value = book.description || "";
    document.getElementById('detail-published').value = book.publishedDate || "";
    
    const rc = book.readCount || 1;
    document.getElementById('detail-read-count').value = rc;
    document.getElementById('detail-read-count-display').textContent = rc;
    
    const coverHtml = book.coverUrl ? `<img src="${book.coverUrl}" class="w-full h-full object-cover">` : '<div class="flex h-full items-center justify-center"><i class="fa-solid fa-book text-slate-300 text-4xl"></i></div>';
    document.getElementById('detail-cover-container').innerHTML = coverHtml;
    
    ui.renderDetailStars(book.rating || 3);
    
    const modal = document.getElementById('book-detail-modal');
    const content = document.getElementById('book-detail-content');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    setTimeout(()=> content.classList.remove('scale-95'), 50);
  },
  
  closeBookDetail: () => {
    const modal = document.getElementById('book-detail-modal');
    const content = document.getElementById('book-detail-content');
    content.classList.add('scale-95');
    setTimeout(()=> modal.classList.add('opacity-0', 'pointer-events-none'), 300);
  },

  renderDetailStars: (rating) => {
    document.getElementById('detail-rating').value = rating;
    let html = '';
    for(let i=1; i<=5; i++){
      html += `<i onclick="ui.renderDetailStars(${i})" class="fa-solid fa-star text-2xl px-1 cursor-pointer transition-transform active:scale-125 ${i<=rating ? 'text-amber-400':'text-slate-200'}"></i>`;
    }
    document.getElementById('detail-stars-container').innerHTML = html;
  },

  incrementReadCount: () => {
    const el = document.getElementById('detail-read-count');
    const disp = document.getElementById('detail-read-count-display');
    let val = parseInt(el.value) + 1;
    el.value = val; disp.textContent = val;
    const btn = window.event.currentTarget;
    btn.classList.add('scale-110', 'bg-pink-500');
    setTimeout(()=> btn.classList.remove('scale-110', 'bg-pink-500'), 200);
    if(window.scanner) window.scanner.playBeep();
  },

  saveBookDetail: () => {
    if(!ui.currentDetailBook) return;
    const kid = window.app.appSettings.kids[window.app.currentKidIndex];
    const updatedBook = {
      id: document.getElementById('detail-id').value,
      isbn: document.getElementById('detail-isbn').value,
      title: document.getElementById('detail-title').value,
      author: document.getElementById('detail-author').value,
      genre: document.getElementById('detail-genre').value,
      ownerType: document.getElementById('detail-owner').value,
      date: document.getElementById('detail-date').value.replace(/-/g, '/') + " 00:00:00",
      comment: document.getElementById('detail-comment').value,
      rating: parseInt(document.getElementById('detail-rating').value),
      readCount: parseInt(document.getElementById('detail-read-count').value),
      description: document.getElementById('detail-description').value,
      publishedDate: document.getElementById('detail-published').value,
      coverUrl: ui.currentDetailBook.coverUrl
    };

    ui.showLoading(true, "ほぞん中...");
    dbDriver.updateBook(updatedBook, kid.sheetName, (res) => {
      ui.showLoading(false);
      if(res.success){
        ui.showToast("保存したよ！");
        ui.closeBookDetail();
        window.app.fetchRegisteredBooks(); 
      } else { ui.showToast("エラーがおきました"); }
    }, (e)=>{ ui.showLoading(false); ui.showToast("通信エラー"); });
  }
};