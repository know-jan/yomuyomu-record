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
 */

// HTTP GET リクエスト処理 (Web App画面表示、またはAPIデータ取得)
function doGet(e) {
  var action = e.parameter.action;
  
  // API経由での書籍データ全件取得
  if (action === "getBooks") {
    var books = getBooks();
    return ContentService.createTextOutput(JSON.stringify(books))
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

// バックエンド用の書籍情報フェッチ関数
function fetchBookInfoBackend(isbn) {
  var url = 'https://www.googleapis.com/books/v1/volumes?q=isbn=' + isbn;
  try {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      var data = JSON.parse(response.getContentText());
      if (data.totalItems > 0 && data.items && data.items[0]) {
        var volumeInfo = data.items[0].volumeInfo;
        var coverUrl = "";
        if (volumeInfo.imageLinks) {
          coverUrl = volumeInfo.imageLinks.thumbnail || volumeInfo.imageLinks.smallThumbnail || "";
          if (coverUrl.indexOf("http://") === 0) {
            coverUrl = coverUrl.replace("http://", "https://");
          }
        }
        return {
          title: volumeInfo.title || "",
          author: volumeInfo.authors ? volumeInfo.authors.join(", ") : "",
          coverUrl: coverUrl
        };
      }
    }
  } catch (e) {
    Logger.log("fetchBookInfoBackend error: " + e.message);
  }
  return { title: "", author: "", coverUrl: "" };
}
