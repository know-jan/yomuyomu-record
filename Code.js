/**
 * よむよむレコード (読書管理アプリ) - GAS バックエンドスクリプト
 * * スプレッドシートのカラム構成 (A列〜M列):
 * A列: ID (一意のキー)
 * B列: 登録日時 (yyyy/MM/dd HH:mm:ss)
 * C列: ISBN (13桁のバーコード数値)
 * D列: タイトル (本の名前)
 * E列: 著者 (作者)
 * F列: 表紙画像URL (本のカバー画像)
 * G列: 所有区分 (「図書館で借りた本」または「おうちの本」)
 * H列: ジャンル (「📕 おはなし・めいろ」「🐱 どうぶつ・きょうりゅう」など)
 * I列: 一言コメント (子供の感想)
 * J列: 評価 (★1〜★5の数値1〜5)
 * K列: 読んだ回数 (再読数)
 * L列: あらすじ (書籍の紹介・詳細)
 * M列: 発売日 (YYYY-MM-DD)
 */

// HTTP GET リクエスト処理 (Web App画面表示、またはAPIデータ取得)
function doGet(e) {
  var action = e.parameter.action;
  
  // API経由での設定データ一括取得
  if (action === "getSettings") {
    return ContentService.createTextOutput(JSON.stringify(getSettings()))
        .setMimeType(ContentService.MimeType.JSON);
  }
  
  // API経由での書籍データ全件取得 (シート名指定対応)
  if (action === "getBooks") {
    var sheetName = e.parameter.sheetName || "読書管理";
    return ContentService.createTextOutput(JSON.stringify(getBooks(sheetName)))
        .setMimeType(ContentService.MimeType.JSON);
  }
  
  // API経由での書籍情報検索 (CORS回避のためのバックエンド経由フェッチ、テーマ予測機能付き)
  if (action === "fetchBookInfo") {
    var isbn = e.parameter.isbn;
    return ContentService.createTextOutput(JSON.stringify(fetchBookInfoBackend(isbn)))
        .setMimeType(ContentService.MimeType.JSON);
  }
  
  // API経由でのキーワード（タイトル・著者）による書籍画像検索
  if (action === "fetchBookInfoBySearch") {
    var title = e.parameter.title || "";
    var author = e.parameter.author || "";
    return ContentService.createTextOutput(JSON.stringify(fetchBookInfoBySearchBackend(title, author)))
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
      .setTitle('よむよむぶっくん 📚')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// HTTP POST リクエスト処理 (API経由での書籍登録・更新)
function doPost(e) {
  var responseData = { success: false, message: "" };
  try {
    var action = e.parameter.action;
    var postData = JSON.parse(e.postData.contents);
    
    if (action === "addBooks") {
      var sheetName = postData.sheetName || "読書管理";
      var res = addBooks(postData.books, sheetName);
      responseData = { success: true, count: res.count };
    } else if (action === "updateBook") {
      var sheetName = postData.sheetName || "読書管理";
      var res = updateBook(postData.book, sheetName);
      responseData = { success: res.success };
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

// アクティブなスプレッドシートを取得する
function getActiveSpreadsheet() {
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
  return ss;
}

// 指定した名前のシートを取得する（なければ作成し、13列構成にする）
function getSheet(sheetName) {
  var ss = getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initSheet(sheet);
  } else {
    // 既存シートの列数が10列の場合などに自動で13列に拡張する
    var lastCol = sheet.getLastColumn();
    if (lastCol > 0 && lastCol < 13) {
      // 不足しているヘッダーを追加
      var newHeaders = ["読んだ回数", "あらすじ", "発売日"];
      var headersToSet = newHeaders.slice(lastCol - 10);
      if (headersToSet.length > 0) {
        sheet.getRange(1, lastCol + 1, 1, headersToSet.length).setValues([headersToSet]);
      }
    }
  }
  return sheet;
}

// シート初期化（ヘッダー行の設定 - 13列構成）
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
    "評価",
    "読んだ回数",
    "あらすじ",
    "発売日"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1); // 1行目を固定
}

// スプレッドシートから登録済みの本をすべて読み込む (13列対応)
function getBooks(sheetName) {
  try {
    var sheet = getSheet(sheetName || "読書管理");
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return []; // ヘッダー行しかない場合は空配列を返す
    }
    
    // A列〜M列（13列）を取得
    var data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
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
        rating: row[9] ? Number(row[9]) : 3,
        readCount: row[10] ? Number(row[10]) : 1, // デフォルト1回
        description: row[11] ? String(row[11]) : "",
        publishedDate: row[12] ? String(row[12]) : ""
      };
    });
  } catch (e) {
    Logger.log("getBooksでエラーが発生しました: " + e.message);
    throw new Error("データの読み込みに失敗しました: " + e.message);
  }
}

// 複数の本を一括追加する (13列対応)
function addBooks(books, sheetName) {
  try {
    if (!books || books.length === 0) {
      return { success: true, count: 0 };
    }
    
    var sheet = getSheet(sheetName || "読書管理");
    var lastRow = sheet.getLastRow();
    var now = new Date();
    var timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
    
    var rows = books.map(function(book) {
      var id = book.id || ("id_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000));
      var bookDate = timestamp;
      if (book.date) {
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
        book.rating || 5,
        book.readCount || 1,
        book.description || "",
        book.publishedDate || ""
      ];
    });
    
    sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    return { success: true, count: books.length };
  } catch (e) {
    Logger.log("addBooksでエラーが発生しました: " + e.message);
    throw new Error("データの書き込みに失敗しました: " + e.message);
  }
}

// 本の情報を更新する (ID一致による上書き)
function updateBook(book, sheetName) {
  try {
    if (!book || !book.id) {
      return { success: false, message: "IDが指定されていません" };
    }
    var sheet = getSheet(sheetName || "読書管理");
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { success: false, message: "データが存在しません" };
    }
    
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var targetIndex = -1;
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(book.id)) {
        targetIndex = i + 2; // 行番号 (2から開始)
        break;
      }
    }
    
    if (targetIndex === -1) {
      return { success: false, message: "指定されたIDの本が見つかりません" };
    }
    
    // 現在の行データを取得して部分更新（登録日時などを壊さないため）
    var currentRowValues = sheet.getRange(targetIndex, 1, 1, 13).getValues()[0];
    
    var updatedRow = [
      book.id,
      book.date ? (book.date.replace(/-/g, "/") + " 00:00:00") : currentRowValues[1],
      book.isbn !== undefined ? book.isbn : currentRowValues[2],
      book.title !== undefined ? book.title : currentRowValues[3],
      book.author !== undefined ? book.author : currentRowValues[4],
      book.coverUrl !== undefined ? book.coverUrl : currentRowValues[5],
      book.ownerType !== undefined ? book.ownerType : currentRowValues[6],
      book.genre !== undefined ? book.genre : currentRowValues[7],
      book.comment !== undefined ? book.comment : currentRowValues[8],
      book.rating !== undefined ? Number(book.rating) : currentRowValues[9],
      book.readCount !== undefined ? Number(book.readCount) : currentRowValues[10],
      book.description !== undefined ? book.description : currentRowValues[11],
      book.publishedDate !== undefined ? book.publishedDate : currentRowValues[12]
    ];
    
    sheet.getRange(targetIndex, 1, 1, 13).setValues([updatedRow]);
    return { success: true };
  } catch (e) {
    Logger.log("updateBookでエラーが発生しました: " + e.message);
    return { success: false, message: e.message };
  }
}

// 設定管理シートから設定を取得し、必要なら初期化
function getSettings() {
  var ss = getActiveSpreadsheet();
  var settings = { kids: [], trophies: [], themeRules: [] };
  
  // 1. 設定_子供 シート
  var sKids = ss.getSheetByName("設定_子供");
  if (!sKids) {
    sKids = ss.insertSheet("設定_子供");
    sKids.getRange(1, 1, 1, 3).setValues([["名前", "表示カラー", "シート名"]]);
    sKids.getRange(2, 1, 2, 3).setValues([
      ["ゆうと", "#3b82f6", "読書管理_ゆうと"],
      ["あおい", "#ec4899", "読書管理_あおい"]
    ]);
    sKids.setFrozenRows(1);
  }
  var rawKids = sKids.getRange(2, 1, sKids.getLastRow() - 1, 3).getValues();
  settings.kids = rawKids.map(function(row) {
    return { name: String(row[0]), color: String(row[1]), sheetName: String(row[2]) };
  });
  
  // 各子供のシートがなければ作成
  settings.kids.forEach(function(kid) {
    getSheet(kid.sheetName);
  });
  
  // 2. 設定_トロフィー シート
  var sTrophies = ss.getSheetByName("設定_トロフィー");
  if (!sTrophies) {
    sTrophies = ss.insertSheet("設定_トロフィー");
    sTrophies.getRange(1, 1, 1, 7).setValues([["ID", "トロフィー名", "説明", "条件タイプ", "閾値", "条件値", "アイコン"]]);
    sTrophies.getRange(2, 1, 5, 7).setValues([
      ["trophy_1", "🐣 よむよむビギナー", "はじめての本をよんだ！", "total", 1, "", "🐣"],
      ["trophy_2", "🏆 読書マスター", "10冊の本をよみ終えた！", "total", 10, "", "🏆"],
      ["trophy_3", "🧚 おはなしだいすき", "物語の本を5冊よんだ！", "genre", 5, "📕 おはなし・めいろ", "🧚"],
      ["trophy_4", "❤️ 大お気に入り", "★5つの本が5冊になった！", "rating5", 5, "", "❤️"],
      ["trophy_5", "🔄 くりかえし読書", "3回以上よんだ本が1冊できた！", "repeat3", 1, "", "🔄"]
    ]);
    sTrophies.setFrozenRows(1);
  }
  var rawTrophies = sTrophies.getRange(2, 1, sTrophies.getLastRow() - 1, 7).getValues();
  settings.trophies = rawTrophies.map(function(row) {
    return {
      id: String(row[0]),
      name: String(row[1]),
      desc: String(row[2]),
      type: String(row[3]),
      threshold: Number(row[4]),
      conditionValue: String(row[5]),
      icon: String(row[6])
    };
  });
  
  // 3. 設定_テーマ判定 シート
  var sTheme = ss.getSheetByName("設定_テーマ判定");
  if (!sTheme) {
    sTheme = ss.insertSheet("設定_テーマ判定");
    sTheme.getRange(1, 1, 1, 2).setValues([["キーワード", "判定ジャンル"]]);
    sTheme.getRange(2, 1, 20, 2).setValues([
      ["めいろ", "📕 おはなし・めいろ"],
      ["迷路", "📕 おはなし・めいろ"],
      ["恐竜", "🐱 どうぶつ・きょうりゅう"],
      ["動物", "🐱 どうぶつ・きょうりゅう"],
      ["ずかん", "🐱 どうぶつ・きょうりゅう"],
      ["のりもの", "🚡 のりもの"],
      ["電車", "🚡 のりもの"],
      ["新幹線", "🚡 のりもの"],
      ["宇宙", "🚀 うちゅう・かがく"],
      ["しゃぼん玉", "🚀 うちゅう・かがく"],
      ["世界", "🗾 にほん・せかい"],
      ["日本", "🗾 にほん・せかい"],
      ["おしごと", "👗 おしゃれ・おしごと"],
      ["ドレス", "👗 おしゃれ・おしごと"],
      ["魔法", "🔮 ファンタジー・ようせい"],
      ["ようせい", "🔮 ファンタジー・ようせい"],
      ["学校", "🏫 くらし・べんきょう"],
      ["ひらがな", "🏫 くらし・べんきょう"],
      ["ヒーロー", "🦸 ヒーロー・アニメ"],
      ["アンパンマン", "🦸 ヒーロー・アニメ"]
    ]);
    sTheme.setFrozenRows(1);
  }
  var rawTheme = sTheme.getRange(2, 1, sTheme.getLastRow() - 1, 2).getValues();
  settings.themeRules = rawTheme.map(function(row) {
    return { keyword: String(row[0]), genre: String(row[1]) };
  });
  
  return settings;
}

// スプレッドシート編集時の自動トリガー（複数子供用シート対応）
function onEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  var sheetName = sheet.getName();
  
  if (sheetName.indexOf("読書管理") !== 0) return;
  
  var row = range.getRow();
  var col = range.getColumn();
  
  if (col === 3 && row > 1) {
    var isbn = range.getValue().toString().trim().replace(/[-\s]/g, '');
    if (!isbn || !/^\d{10}$|^\d{13}$/.test(isbn)) return;
    
    var titleCell = sheet.getRange(row, 4);
    if (titleCell.getValue().toString().trim() !== "") return;
    
    var info = fetchBookInfoBackend(isbn);
    if (!info.title) {
      info.title = "バーコードの本 (" + isbn + ")";
      info.author = "（著者不明）";
    }
    
    sheet.getRange(row, 4).setValue(info.title);
    sheet.getRange(row, 5).setValue(info.author);
    sheet.getRange(row, 6).setValue(info.coverUrl);
    sheet.getRange(row, 8).setValue(info.genre || "その他");
    sheet.getRange(row, 12).setValue(info.description || "");
    sheet.getRange(row, 13).setValue(info.publishedDate || "");
    
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
    if (sheet.getRange(row, 10).getValue() === "") {
      sheet.getRange(row, 10).setValue(5);
    }
    if (sheet.getRange(row, 11).getValue() === "") {
      sheet.getRange(row, 11).setValue(1);
    }
  }
}

// バックエンド用の書籍情報フェッチ関数 (openBD + Google Books API 二段構え)
function fetchBookInfoBackend(isbn) {
  var result = { title: "", author: "", coverUrl: "", genre: "📦 その他", description: "", publishedDate: "" };
  
  try {
    var openBdUrl = 'https://api.openbd.jp/v1/get?isbn=' + isbn;
    var response = UrlFetchApp.fetch(openBdUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      var data = JSON.parse(response.getContentText());
      if (data && data[0]) {
        if (data[0].summary) {
          var summary = data[0].summary;
          result.title = summary.title || "";
          result.author = summary.author || "（著者不明）";
          result.coverUrl = summary.cover || "";
          result.publishedDate = summary.pubdate ? (summary.pubdate.substring(0, 4) + "-" + summary.pubdate.substring(4, 6) + "-" + summary.pubdate.substring(6, 8)) : "";
        }
        if (data[0].onix && data[0].onix.CollateralDetail && data[0].onix.CollateralDetail.TextContent) {
          var textContents = data[0].onix.CollateralDetail.TextContent;
          for (var i = 0; i < textContents.length; i++) {
            if (textContents[i].Text) {
              result.description = textContents[i].Text;
              break;
            }
          }
        }
      }
    }
  } catch (e) {
    Logger.log("openBD fetch error: " + e.message);
  }

  if (!result.title || !result.coverUrl || !result.description) {
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
          
          if (!result.title) result.title = volumeInfo.title || "";
          if (!result.author || result.author === "（著者不明）" || result.author === "著者不明") {
            result.author = volumeInfo.authors ? volumeInfo.authors.join(", ") : "（著者不明）";
          }
          if (googleCoverUrl) result.coverUrl = googleCoverUrl;
          if (!result.description) result.description = volumeInfo.description || "";
          if (!result.publishedDate) result.publishedDate = volumeInfo.publishedDate || "";
        }
      }
    } catch (e) {
      Logger.log("Google Books API error: " + e.message);
    }
  }

  try {
    var ss = getActiveSpreadsheet();
    var sTheme = ss.getSheetByName("設定_テーマ判定");
    if (sTheme) {
      var lastRow = sTheme.getLastRow();
      if (lastRow > 1) {
        var rules = sTheme.getRange(2, 1, lastRow - 1, 2).getValues();
        var matched = false;
        var searchTarget = (result.title + " " + result.description).toLowerCase();
        
        for (var i = 0; i < rules.length; i++) {
          var keyword = String(rules[i][0]).trim().toLowerCase();
          var genre = String(rules[i][1]).trim();
          
          if (keyword && searchTarget.indexOf(keyword) !== -1) {
            result.genre = genre;
            matched = true;
            break;
          }
        }
        if (!matched) result.genre = "📦 その他";
      }
    }
  } catch (e) {
    Logger.log("Theme prediction error: " + e.message);
  }

  return result;
}

function fetchBookInfoFromBackend(isbn) {
  return fetchBookInfoBackend(isbn);
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