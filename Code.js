/**
 * よむよむレコード (読書管理アプリ) - GAS バックエンドスクリプト
 * 
 * スプレッドシートのカラム構成 (A列〜J列):
 * A列: ID (一意のキー)
 * B列: 登録日時 (yyyy/MM/dd HH:mm:ss)
 * C列: ISBN (13桁のバーコード数値)
 * D列: タイトル (本の名前)
 * E列: 著者 (作者)
 * F列: 表紙画像URL (本のカバー画像)
 * G列: 所有区分 (「図書館で借りた本」または「おうちの本」)
 * H列: ジャンル (「物語」「図鑑・科学」「伝記」「絵本」「その他」など)
 * I列: 一言コメント (子供の感想)
 * J列: 評価 (★1〜★5の数値1〜5)
 *//**
 * よむよむぶっくん (読書管理アプリ) - GAS バックエンドスクリプト
 * 
 * データシートのカラム構成 (A列〜M列):
 * A列: ID (一意のキー)
 * B列: 登録日時 (yyyy/MM/dd HH:mm:ss)
 * C列: ISBN (13桁のバーコード数値)
 * D列: タイトル (本の名前)
 * E列: 著者 (作者)
 * F列: 表紙画像URL (本のカバー画像)
 * G列: 所有区分 (「図書館で借りた本」または「おうちの本」)
 * H列: ジャンル
 * I列: 一言コメント (子供の感想)
 * J列: 評価 (★1〜★5の数値)
 * K列: 読んだ回数 (新規)
 * L列: あらすじ (新規)
 * M列: 発売日 (新規)
 */

function doGet(e) {
  var action = e.parameter.action;
  
  if (action === "getSettings") {
    return ContentService.createTextOutput(JSON.stringify(getSettings()))
        .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "getBooks") {
    var sheetName = e.parameter.sheetName;
    return ContentService.createTextOutput(JSON.stringify(getBooks(sheetName)))
        .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "fetchBookInfo") {
    var isbn = e.parameter.isbn;
    return ContentService.createTextOutput(JSON.stringify(fetchBookInfoBackend(isbn)))
        .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "fetchBookInfoBySearch") {
    var title = e.parameter.title || "";
    var author = e.parameter.author || "";
    return ContentService.createTextOutput(JSON.stringify(fetchBookInfoBySearchBackend(title, author)))
        .setMimeType(ContentService.MimeType.JSON);
  }

  // Web App表示用
  var mode = e.parameter.mode || "";
  var webAppUrl = ScriptApp.getService().getUrl();
  var html = HtmlService.createHtmlOutputFromFile('index');
  var content = html.getContent();
  
  content = content.replace("const isScannerMode = false;", "const isScannerMode = " + (mode === "scanner") + ";");
  content = content.replace("let webAppUrl = '';", "let webAppUrl = '" + webAppUrl + "';");
  
  return HtmlService.createHtmlOutput(content)
      .setTitle('よむよむぶっくん 📚')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  var responseData = { success: false, message: "" };
  try {
    var action = e.parameter.action;
    var postData = JSON.parse(e.postData.contents);
    
    if (action === "addBooks") {
      var res = addBooks(postData.books, postData.sheetName);
      responseData = { success: true, count: res.count };
    } else if (action === "updateBook") {
      var res = updateBook(postData.book, postData.sheetName);
      responseData = { success: true };
    } else {
      responseData.message = "無効なアクションです";
    }
  } catch (err) {
    responseData.message = "エラーが発生しました: " + err.message;
  }
  
  return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// 初期化・設定読み込み
// ==========================================
function getSpreadsheet() {
  var ss;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (!ss) throw new Error("スプレッドシートが見つかりません。");
  return ss;
}

function getSettings() {
  var ss = getSpreadsheet();
  initSettingsSheets(ss);
  
  var kidsSheet = ss.getSheetByName("設定_子供");
  var trophySheet = ss.getSheetByName("設定_トロフィー");
  var themeSheet = ss.getSheetByName("設定_テーマ判定");
  
  var settings = {
    kids: [],
    trophies: [],
    themeRules: []
  };
  
  // 子供の設定
  if (kidsSheet.getLastRow() > 1) {
    var kData = kidsSheet.getRange(2, 1, kidsSheet.getLastRow() - 1, 3).getValues();
    kData.forEach(function(row) {
      if (row[0]) {
        settings.kids.push({ name: String(row[0]), color: String(row[1]), sheetName: String(row[2]) });
        initDataSheet(ss, String(row[2])); // 指定されたシート名がなければ作成
      }
    });
  }
  
  // トロフィー設定
  if (trophySheet.getLastRow() > 1) {
    var tData = trophySheet.getRange(2, 1, trophySheet.getLastRow() - 1, 6).getValues();
    tData.forEach(function(row) {
      if (row[0]) {
        settings.trophies.push({
          id: String(row[0]),
          name: String(row[1]),
          conditionType: String(row[2]),
          required: Number(row[3]),
          icon: String(row[4]),
          desc: String(row[5])
        });
      }
    });
  }
  
  // テーマ判定ルール
  if (themeSheet.getLastRow() > 1) {
    var thData = themeSheet.getRange(2, 1, themeSheet.getLastRow() - 1, 2).getValues();
    thData.forEach(function(row) {
      if (row[0] && row[1]) {
        settings.themeRules.push({ keyword: String(row[0]), genre: String(row[1]) });
      }
    });
  }
  
  return settings;
}

function initSettingsSheets(ss) {
  // 子供設定シート
  if (!ss.getSheetByName("設定_子供")) {
    var sheet = ss.insertSheet("設定_子供");
    sheet.getRange(1, 1, 1, 3).setValues([["子供の名前", "表示カラー", "連動するシート名"]]);
    sheet.getRange(2, 1, 2, 3).setValues([
      ["🌸 おねえちゃん", "#f472b6", "読書データ_長女"],
      ["🐥 いもうと", "#fbbf24", "読書データ_次女"]
    ]);
    sheet.setFrozenRows(1);
  }
  
  // トロフィー設定シート
  if (!ss.getSheetByName("設定_トロフィー")) {
    var sheet = ss.insertSheet("設定_トロフィー");
    sheet.getRange(1, 1, 1, 6).setValues([["トロフィーID", "トロフィー名", "条件タイプ", "必要数", "アイコン", "説明文"]]);
    sheet.getRange(2, 1, 14, 6).setValues([
      ["tf_count_1", "はじめての一歩", "total_books", 1, "🍀", "はじめて本を登録できた！"],
      ["tf_count_5", "読書たんけんたい", "total_books", 5, "🎒", "5冊の本を読んだよ！"],
      ["tf_count_10", "読書ルーキー", "total_books", 10, "🥉", "10冊突破！"],
      ["tf_count_30", "読書ベテラン", "total_books", 30, "🥈", "30冊突破！すごい！"],
      ["tf_count_50", "読書マスター", "total_books", 50, "🥇", "50冊突破！"],
      ["tf_count_77", "ラッキーセブン", "total_books", 77, "🎉", "77冊！いいことあるかも！"],
      ["tf_count_100", "読書ゴッド", "total_books", 100, "👑", "夢の100冊達成！"],
      ["tf_genre_story_5", "ものがたりルーキー", "genre_物語", 5, "📕", "物語を5冊読んだよ！"],
      ["tf_genre_story_15", "ものがたりハンター", "genre_物語", 15, "🏹", "物語を15冊読んだよ！"],
      ["tf_genre_science_5", "ちいさな科学者", "genre_図鑑・科学", 5, "🥦", "図鑑・科学を5冊読んだ！"],
      ["tf_review_5", "本のソムリエ", "review_count", 5, "💎", "星5つの本が5冊になった！"],
      ["tf_repeat_3", "ぼくの愛読書", "repeat_count", 3, "💖", "同じ本を3回以上読んだ！"],
      ["tf_speed_5", "読書熱中賞", "total_books", 150, "🔥", "150冊！とまらない！"],
      ["tf_count_300", "本の守護者", "total_books", 300, "🌌", "伝説の300冊達成！"]
    ]);
    sheet.setFrozenRows(1);
  }
  
  // テーマ判定シート
  if (!ss.getSheetByName("設定_テーマ判定")) {
    var sheet = ss.insertSheet("設定_テーマ判定");
    sheet.getRange(1, 1, 1, 2).setValues([["判定キーワード（この言葉が入っていたら）", "割り当てるテーマ名"]]);
    sheet.getRange(2, 1, 11, 2).setValues([
      ["プリンセス", "🔮 ファンタジー・ようせい"],
      ["魔法", "🔮 ファンタジー・ようせい"],
      ["おばけ", "🔮 ファンタジー・ようせい"],
      ["ケーキ", "👗 おしゃれ・おしごと"],
      ["おしゃれ", "👗 おしゃれ・おしごと"],
      ["いぬ", "🐱 どうぶつ・きょうりゅう"],
      ["ねこ", "🐱 どうぶつ・きょうりゅう"],
      ["恐竜", "🐱 どうぶつ・きょうりゅう"],
      ["新幹線", "🚡 のりもの"],
      ["宇宙", "🚀 うちゅう・かがく"],
      ["おはなし", "📕 おはなし・めいろ"]
    ]);
    sheet.setFrozenRows(1);
  }
}

function initDataSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = ["ID", "登録日時", "ISBN", "タイトル", "著者", "表紙画像URL", "所有区分", "ジャンル", "一言コメント", "評価", "読んだ回数", "あらすじ", "発売日"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ==========================================
// データの読み書き
// ==========================================
function getBooks(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  var data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  return data.map(function(row) {
    return {
      id: String(row[0] || ""),
      date: row[1] ? (row[1] instanceof Date ? Utilities.formatDate(row[1], Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss") : String(row[1])) : "",
      isbn: String(row[2] || ""),
      title: String(row[3] || ""),
      author: String(row[4] || ""),
      coverUrl: String(row[5] || ""),
      ownerType: String(row[6] || "おうちの本"),
      genre: String(row[7] || "その他"),
      comment: String(row[8] || ""),
      rating: Number(row[9] || 3),
      readCount: Number(row[10] || 1),
      description: String(row[11] || ""),
      publishedDate: String(row[12] || "")
    };
  });
}

function addBooks(books, sheetName) {
  if (!books || books.length === 0) return { success: true, count: 0 };
  
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("シートが存在しません");
  
  var lastRow = sheet.getLastRow();
  var now = new Date();
  var timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
  
  var rows = books.map(function(book) {
    var id = "id_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
    var bookDate = book.date ? book.date.replace(/-/g, "/") + " 00:00:00" : timestamp;
    return [
      id,
      bookDate,
      book.isbn || "",
      book.title || "（タイトルなし）",
      book.author || "（著者不明）",
      book.coverUrl || "",
      book.ownerType || "おうちの本",
      book.genre || "その他",
      book.comment || "",
      book.rating || 5,
      book.readCount || 1,
      book.description || "",
      book.publishedDate || ""
    ];
  });
  
  sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
  return { success: true, count: books.length };
}

function updateBook(book, sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("シートが存在しません");
  
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false };
  
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === book.id) {
      var row = i + 2;
      sheet.getRange(row, 2, 1, 12).setValues([[
        book.date,
        book.isbn,
        book.title,
        book.author,
        book.coverUrl,
        book.ownerType,
        book.genre,
        book.comment,
        book.rating,
        book.readCount,
        book.description,
        book.publishedDate
      ]]);
      return { success: true };
    }
  }
  return { success: false, message: "対象が見つかりません" };
}

// ==========================================
// APIフェッチ
// ==========================================
function fetchBookInfoBackend(isbn) {
  var result = { title: "", author: "", coverUrl: "", description: "", publishedDate: "" };
  
  try {
    var openBdUrl = 'https://api.openbd.jp/v1/get?isbn=' + isbn;
    var response = UrlFetchApp.fetch(openBdUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      var data = JSON.parse(response.getContentText());
      if (data && data[0] && data[0].summary) {
        var summary = data[0].summary;
        result.title = summary.title || "";
        result.author = summary.author || "";
        result.coverUrl = summary.cover || "";
        result.publishedDate = summary.pubdate || "";
      }
    }
  } catch (e) {}

  var googleUrl = 'https://www.googleapis.com/books/v1/volumes?q=isbn=' + isbn;
  try {
    var response = UrlFetchApp.fetch(googleUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      var data = JSON.parse(response.getContentText());
      if (data.totalItems > 0 && data.items && data.items[0]) {
        var volumeInfo = data.items[0].volumeInfo;
        
        if (!result.title) result.title = volumeInfo.title || "";
        if (!result.author) result.author = volumeInfo.authors ? volumeInfo.authors.join(", ") : "";
        if (!result.description) result.description = volumeInfo.description || "";
        if (!result.publishedDate) result.publishedDate = volumeInfo.publishedDate || "";
        
        if (!result.coverUrl && volumeInfo.imageLinks) {
          var cover = volumeInfo.imageLinks.thumbnail || volumeInfo.imageLinks.smallThumbnail || "";
          result.coverUrl = cover.replace("http://", "https://");
        }
      }
    }
  } catch (e) {}

  return result;
}

function fetchBookInfoBySearchBackend(title, author) {
  var covers = [];
  if (!title) return covers;
  
  var queryClean = title.replace(/[・\-\/]/g, ' ').trim();
  var query = 'intitle:' + queryClean;
  if (author && author !== "（著者不明）" && author !== "著者不明") {
    query += '+inauthor:' + author.replace(/[・\-\/]/g, ' ').trim();
  }
  
  var url = 'https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(query) + '&maxResults=5';
  try {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      var data = JSON.parse(response.getContentText());
      if (data && data.items) {
        data.items.forEach(function(item) {
          if (item.volumeInfo && item.volumeInfo.imageLinks) {
            var thumb = item.volumeInfo.imageLinks.thumbnail || item.volumeInfo.imageLinks.smallThumbnail;
            if (thumb) {
              covers.push(thumb.replace("http://", "https://"));
            }
          }
        });
      }
    }
  } catch (e) {}
  return covers;
}

// HTTP GET リクエスト処理 (Web App画面表示、またはAPIデータ取得)
function doGet(e) {
  var action = e.parameter.action;
  
  // API経由での書籍データ全件取得
  if (action === "getBooks") {
    var books = getBooks();
    return ContentService.createTextOutput(JSON.stringify(books))
        .setMimeType(ContentService.MimeType.JSON);
  }
  
  // API経由での書籍情報検索 (CORS回避のためのバックエンド経由フェッチ)
  if (action === "fetchBookInfo") {
    var isbn = e.parameter.isbn;
    var info = fetchBookInfoBackend(isbn);
    return ContentService.createTextOutput(JSON.stringify(info))
        .setMimeType(ContentService.MimeType.JSON);
  }
  
  // API経由でのキーワード（タイトル・著者）による書籍画像検索
  if (action === "fetchBookInfoBySearch") {
    var title = e.parameter.title || "";
    var author = e.parameter.author || "";
    var covers = fetchBookInfoBySearchBackend(title, author);
    return ContentService.createTextOutput(JSON.stringify(covers))
        .setMimeType(ContentService.MimeType.JSON);
  }

  
  // 通常のウェブアプリ画面表示 (Netlifyを使わず直接GASで開く場合のフォールバック)
  var mode = e.parameter.mode || "";
  var webAppUrl = ScriptApp.getService().getUrl();
  var html = HtmlService.createHtmlOutputFromFile('index');
  var content = html.getContent();
  
  // サーバーサイドでの簡易インジェクション
  content = content.replace("const isScannerMode = false;", "const isScannerMode = " + (mode === "scanner") + ";");
  content = content.replace("let webAppUrl = '';", "let webAppUrl = '" + webAppUrl + "';");
  
  return HtmlService.createHtmlOutput(content)
      .setTitle('よむよむレコード 📚')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// HTTP POST リクエスト処理 (API経由での書籍登録)
function doPost(e) {
  var responseData = { success: false, message: "" };
  try {
    var action = e.parameter.action;
    var postData = JSON.parse(e.postData.contents);
    
    if (action === "addBooks") {
      var res = addBooks(postData);
      responseData = { success: true, count: res.count };
    } else {
      responseData.message = "無効なアクションです";
    }
  } catch (err) {
    responseData.message = "エラーが発生しました: " + err.message;
  }
  
  // CORSを回避するため JSON MimeType でテキスト出力として返却
  return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);
}

// アクティブなスプレッドシートの「読書管理」シートを取得する（なければ作成する）
function getSheet() {
  var ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    // コンテナバインドでない場合のハンドリング
  }
  
  if (!ss) {
    throw new Error(
      "スプレッドシートが見つかりません。このスクリプトをスプレッドシートの「拡張機能」>「Apps Script」から作成し直すか、スプレッドシートと連携してください。"
    );
  }
  
  var sheetName = "読書管理";
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initSheet(sheet);
  }
  return sheet;
}

// シート初期化（ヘッダー行の設定）
function initSheet(sheet) {
  var headers = [
    "ID",
    "登録日時",
    "ISBN",
    "タイトル",
    "著者",
    "表紙画像URL",
    "所有区分",
    "ジャンル",
    "一言コメント",
    "評価"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1); // 1行目を固定
}

// スプレッドシートから登録済みの本をすべて読み込む
function getBooks() {
  try {
    var sheet = getSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return []; // ヘッダー行しかない場合は空配列を返す
    }
    
    var data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
    return data.map(function(row) {
      return {
        id: row[0] ? String(row[0]) : "",
        date: row[1] ? (row[1] instanceof Date ? Utilities.formatDate(row[1], Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss") : String(row[1])) : "",
        isbn: row[2] ? String(row[2]) : "",
        title: row[3] ? String(row[3]) : "",
        author: row[4] ? String(row[4]) : "",
        coverUrl: row[5] ? String(row[5]) : "",
        ownerType: row[6] ? String(row[6]) : "図書館で借りた本",
        genre: row[7] ? String(row[7]) : "その他",
        comment: row[8] ? String(row[8]) : "",
        rating: row[9] ? Number(row[9]) : 3
      };
    });
  } catch (e) {
    Logger.log("getBooksでエラーが発生しました: " + e.message);
    throw new Error("データの読み込みに失敗しました: " + e.message);
  }
}

// 複数の本を一括追加する
function addBooks(books) {
  try {
    if (!books || books.length === 0) {
      return { success: true, count: 0 };
    }
    
    var sheet = getSheet();
    var lastRow = sheet.getLastRow();
    var now = new Date();
    var timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
    
    var rows = books.map(function(book) {
      // 一意なIDの生成 (タイムスタンプ + ランダム値)
      var id = "id_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
      // カスタムの日付が指定されていればそれを使用し、なければ現在のタイムスタンプを使用する
      var bookDate = timestamp;
      if (book.date) {
        // YYYY-MM-DDをYYYY/MM/DDの形式に変換
        bookDate = book.date.replace(/-/g, "/") + " 00:00:00";
      }
      return [
        id,
        bookDate,
        book.isbn || "",
        book.title || "（タイトルなし）",
        book.author || "（著者不明）",
        book.coverUrl || "",
        book.ownerType || "図書館で借りた本",
        book.genre || "その他",
        book.comment || "",
        book.rating || 3
      ];
    });
    
    sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    return { success: true, count: books.length };
  } catch (e) {
    Logger.log("addBooksでエラーが発生しました: " + e.message);
    throw new Error("データの書き込みに失敗しました: " + e.message);
  }
}

// スプレッドシート編集時の自動トリガー
function onEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  if (sheet.getName() !== "読書管理") return;
  
  var row = range.getRow();
  var col = range.getColumn();
  
  // ISBN列（C列、すなわち第3列）が編集された場合
  if (col === 3 && row > 1) {
    var isbn = range.getValue().toString().trim().replace(/[-\s]/g, '');
    if (!isbn || !/^\d{10}$|^\d{13}$/.test(isbn)) return;
    
    // タイトル列（D列）が既に埋まっている場合は処理スキップ（二重書き込み防止）
    var titleCell = sheet.getRange(row, 4);
    if (titleCell.getValue().toString().trim() !== "") return;
    
    // 書籍情報をフェッチ
    var info = fetchBookInfoBackend(isbn);
    if (!info.title) {
      // APIで見つからない場合はプレースホルダーを設定
      info.title = "バーコードの本 (" + isbn + ")";
      info.author = "（著者不明）";
    }
    
    // シートに書き込む
    // D列: タイトル, E列: 著者, F列: 表紙画像URL
    sheet.getRange(row, 4).setValue(info.title);
    sheet.getRange(row, 5).setValue(info.author);
    sheet.getRange(row, 6).setValue(info.coverUrl);
    
    // 他のメタデータ初期値の設定（A列: ID, B列: 登録日時, G列: 所有区分, H列: ジャンル, J列: 評価）
    if (sheet.getRange(row, 1).getValue() === "") {
      var id = "id_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
      sheet.getRange(row, 1).setValue(id);
    }
    if (sheet.getRange(row, 2).getValue() === "") {
      var now = new Date();
      var timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
      sheet.getRange(row, 2).setValue(timestamp);
    }
    if (sheet.getRange(row, 7).getValue() === "") {
      sheet.getRange(row, 7).setValue("図書館で借りた本");
    }
    if (sheet.getRange(row, 8).getValue() === "") {
      sheet.getRange(row, 8).setValue("その他");
    }
    if (sheet.getRange(row, 10).getValue() === "") {
      sheet.getRange(row, 10).setValue(5);
    }
  }
}

// バックエンド用の書籍情報フェッチ関数 (openBD + Google Books API 二段構え)
function fetchBookInfoBackend(isbn) {
  var result = { title: "", author: "", coverUrl: "" };
  
  // 1. まずは日本国内に強い openBD API を試す
  try {
    var openBdUrl = 'https://api.openbd.jp/v1/get?isbn=' + isbn;
    var response = UrlFetchApp.fetch(openBdUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      var data = JSON.parse(response.getContentText());
      if (data && data[0] && data[0].summary) {
        var summary = data[0].summary;
        result.title = summary.title || "";
        result.author = summary.author || "（著者不明）";
        result.coverUrl = summary.cover || "";
      }
    }
  } catch (e) {
    Logger.log("openBD fetch error: " + e.message);
  }

  // 2. 本が見つからなかった、または表紙画像が見つからなかった場合、Google Books APIで補完する
  if (!result.title || !result.coverUrl) {
    var googleUrl = 'https://www.googleapis.com/books/v1/volumes?q=isbn=' + isbn;
    try {
      var response = UrlFetchApp.fetch(googleUrl, { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
        var data = JSON.parse(response.getContentText());
        if (data.totalItems > 0 && data.items && data.items[0]) {
          var volumeInfo = data.items[0].volumeInfo;
          var googleCoverUrl = "";
          if (volumeInfo.imageLinks) {
            googleCoverUrl = volumeInfo.imageLinks.thumbnail || volumeInfo.imageLinks.smallThumbnail || "";
            if (googleCoverUrl.indexOf("http://") === 0) {
              googleCoverUrl = googleCoverUrl.replace("http://", "https://");
            }
          }
          
          // 書籍情報がまだなければGoogle Booksのもので補完
          if (!result.title) {
            result.title = volumeInfo.title || "";
          }
          if (!result.author || result.author === "（著者不明）" || result.author === "著者不明") {
            result.author = volumeInfo.authors ? volumeInfo.authors.join(", ") : "（著者不明）";
          }
          // 画像があればGoogle Booksのものを採用
          if (googleCoverUrl) {
            result.coverUrl = googleCoverUrl;
          }
        }
      }
    } catch (e) {
      Logger.log("Google Books API error: " + e.message);
    }
  }

  return result;
}


// GASのクライアントから直接呼び出すためのラッパー関数
function fetchBookInfoFromBackend(isbn) {
  return fetchBookInfoBackend(isbn);
}

// バックエンドでのキーワード（タイトル・著者）による表紙検索
function fetchBookInfoBySearchBackend(title, author) {
  var covers = [];
  if (!title) return covers;
  
  // クエリの単純化（記号などを取り除いてスペースでつなぐ）
  var queryClean = title.replace(/[・\-\/]/g, ' ').trim();
  var query = 'intitle:' + queryClean;
  if (author && author !== "（著者不明）" && author !== "著者不明") {
    var authorClean = author.replace(/[・\-\/]/g, ' ').trim();
    query += '+inauthor:' + authorClean;
  }
  
  var url = 'https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(query) + '&maxResults=5';
  try {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      var data = JSON.parse(response.getContentText());
      if (data && data.items) {
        data.items.forEach(function(item) {
          if (item.volumeInfo && item.volumeInfo.imageLinks) {
            var thumb = item.volumeInfo.imageLinks.thumbnail || item.volumeInfo.imageLinks.smallThumbnail;
            if (thumb) {
              if (thumb.indexOf("http://") === 0) {
                thumb = thumb.replace("http://", "https://");
              }
              covers.push(thumb);
            }
          }
        });
      }
    }
  } catch (e) {
    Logger.log("fetchBookInfoBySearchBackend error: " + e.message);
  }
  return covers;
}

