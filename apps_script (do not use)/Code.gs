// Apps Script backend for Project Control Center
// Replace INVENTORY_SPREADSHEET_ID and TRANSACTIONS_SPREADSHEET_ID
var INVENTORY_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('INVENTORY_SPREADSHEET_ID');
var TRANSACTIONS_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('TRANSACTIONS_SPREADSHEET_ID');
var PROJECTS_INDEX_SHEET_NAME = 'PROJECTS_INDEX';

// Transaction-specific canonical header names (used for creating and validating tabs)
var TRANSACTIONS_HEADERS = ['transaction_id','project_id','project_name','transaction_date','source','location','transaction_type','payment_method','amount','notes','receipt_image','receipt_emailed','created_at','created_by'];

// Enumerations used by the Transactions UI (fallback if no config sheet)
var TRANSACTION_ENUMS = {
  sources: ['Homegoods','Wayfair','Ross','Pottery Barn','West Elm','Home Depot','Movers','1584 Design','Amazon','Target','Arhaus','Crate & Barrel','Living Spaces','Lowes','Gas','Other'],
  types: ['Purchase','Return'],
  methods: ['Client Card','1584 Card','Split','Store Credit'],
  emailed: ['Yes','No'],
  dateChoices: ['Today','Different Date']
};

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'ui';
  // QR endpoints
  if (action === 'key') {
    return QrEndpoints.handleKeyRedirect(e);
  }
  if (action === 'qrImage') {
    return QrEndpoints.handleQrImage(e);
  }
  if (action === 'generateBatchPdf') {
    return QrEndpoints.handleGenerateBatchPdf(e);
  }
  if (action === 'ui') {
    var t = HtmlService.createTemplateFromFile('Dashboard');
    t.baseUrl = ScriptApp.getService().getUrl();
    // Provide a small helper flag to allow templates to render a server-side viewport hint when
    // the host/environment might otherwise report a desktop layout viewport. This is a best-effort
    // hint for embedded contexts.
    t.serverViewportMeta = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no">';
    // include helper for shared partials (kept for future use)
    t.include = function(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); };
    // Return the evaluated template optimizing for embedding: allowAllIframeEmbedding ensures
    // the HTML will be usable inside containers that might otherwise constrain the visual viewport.
    // Prefer the NATIVE sandbox mode where available; it avoids many iframe/layout issues on mobile
    // hosts. HtmlService has a setSandboxMode method, but it's deprecated; using the newer
    // setXFrameOptionsMode(ALLOWALL) and relying on default NATIVE rendering in modern Apps Script
    // environments is usually sufficient. We still set ALLOWALL to ensure embedding works.
    var out = t.evaluate().setTitle('Project Control').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    return out;
  }
  if (action === 'listSheets') {
    return jsonResponse(listSheets());
  }
  if (action === 'getSheet') {
    try {
      var sheet = e.parameter.sheet;
      return jsonResponse(getSheetValues(sheet));
    } catch (err) {
      return jsonResponse({ error: 'server error', details: String(err) });
    }
  }
  if (action === 'itemForm') {
    var id = e.parameter.itemUrlId;
    var t = HtmlService.createTemplateFromFile('ItemForm');
    t.itemUrlId = id;
    // Provide baseUrl so client-side templates can build QR/image URLs
    t.baseUrl = ScriptApp.getService().getUrl();
    // include helper kept for future use
    t.include = function(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); };
    var out = t.evaluate().setTitle('Item').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    return out;
  }
  if (action === 'getItem') {
    var itemId = e.parameter.itemId;
    var sheetName = e.parameter.sheetName;
    return jsonResponse(getItem(itemId, sheetName));
  }
  if (action === 'batchGenerateQr') {
    // expects parameter sheetName
    var sheetName = e.parameter.sheetName;
    return jsonResponse(batchGenerateQrForSheet(sheetName));
  }
  return jsonResponse({ error: 'unknown action' });
}

function doPost(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : null;
  var payload = {};
  if (e.postData && e.postData.contents) {
    try { payload = JSON.parse(e.postData.contents); } catch (err) { payload = e.postData.contents; }
  }
  if (action === 'appendInventory') {
    return jsonResponse(appendInventory(payload));
  }
  if (action === 'updateItem') {
    return jsonResponse(updateItem(payload));
  }
  if (action === 'createProject') {
    return jsonResponse(createProject(payload));
  }
  return jsonResponse({ error: 'unknown action' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Build a map from header (lowercased & trimmed) to column index for fast lookups
function headerIndexMap(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i] === null || headers[i] === undefined ? '' : String(headers[i]).trim();
    map[h.toLowerCase()] = i;
  }
  return map;
}

function getInventorySpreadsheet() {
  if (INVENTORY_SPREADSHEET_ID) return SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

// Transactions spreadsheet accessor (falls back to active if not configured)
function getTransactionsSpreadsheet() {
  if (TRANSACTIONS_SPREADSHEET_ID) return SpreadsheetApp.openById(TRANSACTIONS_SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

// Generate a stable project id. Keep simple and consistent with existing code.
function generateProjectId() {
  return Utilities.getUuid();
}

// Create a sheet if missing and set headers when the sheet is newly created.
function getOrCreateSheet(ss, tabName, headers) {
  var sheet = ss.getSheetByName(tabName);
  if (sheet) return sheet;
  sheet = ss.insertSheet(tabName);
  if (headers && Array.isArray(headers) && headers.length) {
    try { sheet.getRange(1,1,1,headers.length).setValues([headers]); } catch (e) { /* ignore header write failures */ }
  }
  return sheet;
}

// Ensure unique sheet name within a spreadsheet by appending numeric suffixes starting at 2.
function ensureUniqueSheetName(ss, baseName) {
  var name = baseName;
  var i = 2;
  while (ss.getSheetByName(name)) {
    name = baseName + ' ' + i;
    i++;
  }
  return name;
}

function listSheets() {
  var ss = getInventorySpreadsheet();
  // Prefer an index sheet if present
  var index = ss.getSheetByName(PROJECTS_INDEX_SHEET_NAME);
  if (index) {
    var values = index.getDataRange().getValues();
    if (!values || values.length <= 1) return { sheets: [] };
    var headers = values.shift();
    var list = values.map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      // normalize to stable keys the frontend expects
      return {
        sheet_name: obj.sheet_name || obj.sheetName || obj.sheet || obj['sheet name'] || obj.sheet_name || '',
        project_name: obj.project_name || obj.projectName || obj.name || obj.sheet_name || '',
        project_id: obj.project_id || obj.id || ''
      };
    });
    return { sheets: list };
  }
  // Fallback: return sheet names
  var sheets = ss.getSheets().map(function(s) { return { sheet_name: s.getName(), project_name: s.getName() }; });
  return { sheets: sheets };
}

// Transaction helpers
function generateTransactionId() {
  return 'T-' + Date.now() + '-' + Math.random().toString(36).substr(2,6);
}

// Resolve a project by id or sheet name using the PROJECTS_INDEX sheet when available
function resolveProject(projectIdOrName) {
  var ss = getInventorySpreadsheet();
  var index = ss.getSheetByName(PROJECTS_INDEX_SHEET_NAME);
  if (!index) return null;
  var values = index.getDataRange().getValues();
  if (!values || values.length <= 1) return null;
  var headers = values[0].map(function(h){ return String(h||'').trim(); });
  var rows = values.slice(1);
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) { obj[ headers[j] ] = row[j]; }
    if (String(obj.project_id) === String(projectIdOrName) || String(obj.project_name) === String(projectIdOrName) || String(obj.inventory_tab) === String(projectIdOrName) || String(obj.transactions_tab) === String(projectIdOrName)) {
      return { project_id: obj.project_id, project_name: obj.project_name, inventory_tab: obj.inventory_tab, transactions_tab: obj.transactions_tab };
    }
  }
  return null;
}

// Endpoint: listTransactionEnums - returns enumerations for building the UI
function listTransactionEnums() {
  // TODO: read from a config sheet in future; currently return in-code constants
  return TRANSACTION_ENUMS;
}

// Endpoint: createTransaction - create a transaction row in the transactions spreadsheet/tab
function createTransaction(payload) {
  // Validate payload minimally
  if (!payload) return { error: 'missing payload' };
  var projectId = payload.project_id || payload.project_name || '';
  var project = resolveProject(projectId) || { project_id: payload.project_id || '', project_name: payload.project_name || '', transactions_tab: payload.transactions_tab || (payload.project_name ? String(payload.project_name) + ' - transactions' : '') };
  var txSs = getTransactionsSpreadsheet();
  var txTabName = project.transactions_tab || (project.project_name ? (project.project_name + ' - transactions') : 'Transactions');
  var sheet = getOrCreateSheet(txSs, txTabName, TRANSACTIONS_HEADERS);
  // Build row in header order
  var headers = sheet.getDataRange().getValues()[0] || TRANSACTIONS_HEADERS;
  var txId = payload.transaction_id || generateTransactionId();
  var now = new Date();
  var rowObj = {
    transaction_id: txId,
    project_id: project.project_id || payload.project_id || '',
    project_name: project.project_name || payload.project_name || '',
    transaction_date: payload.transaction_date || (new Date()).toISOString(),
    source: payload.source || '',
    location: payload.location || '',
    transaction_type: payload.transaction_type || payload.type || '',
    payment_method: payload.payment_method || payload.method || '',
    amount: (typeof payload.amount === 'number') ? payload.amount : (payload.amount || ''),
    notes: payload.notes || '',
    receipt_image: payload.receipt_image || payload.receipt || '',
    receipt_emailed: payload.receipt_emailed || payload.emailed || '',
    created_at: now.toISOString(),
    created_by: (Session && Session.getActiveUser && Session.getActiveUser().getEmail) ? Session.getActiveUser().getEmail() : ''
  };
  var row = headers.map(function(h){ return rowObj[h] || ''; });
  sheet.appendRow(row);
  return { transaction_id: txId, sheetName: sheet.getName(), created_at: now.toISOString() };
}

// Endpoint: appendInventoryForTransaction - create inventory rows for each item and backlink to transaction_id
function appendInventoryForTransaction(payload) {
  // payload: { project_id, transaction_id, items: [ { description, price, source, location, ... } ] }
  if (!payload || !payload.project_id || !payload.transaction_id || !Array.isArray(payload.items)) return { error: 'invalid payload' };
  var project = resolveProject(payload.project_id) || { inventory_tab: payload.inventory_tab || payload.project_id || '' };
  var ss = getInventorySpreadsheet();
  var sheetName = project.inventory_tab || payload.inventory_tab || payload.project_id;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: 'inventory sheet not found', sheetName: sheetName };
  var headers = sheet.getDataRange().getValues()[0] || [];
  var map = headerIndexMap(headers);
  var results = [];
  for (var i = 0; i < payload.items.length; i++) {
    var it = payload.items[i] || {};
    try {
      var itemId = it.item_id || ('I-' + Date.now() + '-' + Math.random().toString(36).substr(2,4));
      var row = headers.map(function(h){
        if (!h) return '';
        if (h === 'item_id') return itemId;
        if (h === 'transaction_id') return payload.transaction_id;
        if (h === 'project_id') return project.project_id || payload.project_id || '';
        if (h === 'project_name') return project.project_name || '';
        if (h === 'date_created') return it.date_created || payload.transaction_date || new Date();
        return it[h] || it[String(h)] || '';
      });
      sheet.appendRow(row);
      results.push({ item_id: itemId, status: 'created' });
    } catch (err) {
      results.push({ item: it, error: String(err) });
    }
  }
  return { items: results, sheetName: sheet.getName() };
}

function getSheetValues(sheetName) {
  if (!sheetName) return { error: 'missing sheet name' };
  var ss = getInventorySpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: 'sheet not found' };
  var values = sheet.getDataRange().getValues();
  if (values.length === 0) return { headers: [], rows: [] };
  var headers = values[0];
  var rows = values.slice(1);
  // sanitize values to plain JSON-friendly types (convert Dates)
  var safeHeaders = headers.map(function(h){ return (h === null || h === undefined) ? '' : String(h); });
  var objectRows = rows.map(function(row){
    var obj = {};
    for (var i = 0; i < safeHeaders.length; i++) {
      var h = safeHeaders[i] || '';
      var cell = row[i];
      if (cell === null || cell === undefined) { obj[h] = ''; continue; }
      if (Object.prototype.toString.call(cell) === '[object Date]') {
        try { obj[h] = cell.toISOString(); } catch (e) { obj[h] = String(cell); }
        continue;
      }
      obj[h] = (typeof cell === 'object') ? String(cell) : cell;
    }
    return obj;
  });
  return { headers: safeHeaders, rows: objectRows };
}

function createProject(payload) {
  var projectName = payload && payload.project_name ? payload.project_name : 'New Project';
  var invSs = getInventorySpreadsheet();
  var txSs = getTransactionsSpreadsheet();
  // sanitize base tab name
  var safeName = String(projectName).replace(/[\\/:*?\[\]]+/g, '-').substr(0, 100);
  // ensure unique names in each spreadsheet
  var invTabName = ensureUniqueSheetName(invSs, safeName);
  var txTabName = ensureUniqueSheetName(txSs, safeName + '-transactions');

  var inventoryHeaders = ['item_id','transaction_id','project_id','store_name','sku','project_name','date_created','description','price','source','last_updated','notes','qr_key','bookmark','payment_method'];
  var transactionsHeaders = ['transaction_id','project_id','project_name','date','source','location','type','method','amount','notes','receipt','emailed','created_at','created_by'];

  // create sheets (if missing) and apply headers
  var invSheet = getOrCreateSheet(invSs, invTabName, inventoryHeaders);
  var txSheet = getOrCreateSheet(txSs, txTabName, transactionsHeaders);

  // Upsert PROJECTS_INDEX in inventory spreadsheet with expected headers
  var indexSheet = invSs.getSheetByName(PROJECTS_INDEX_SHEET_NAME);
  var indexHeaders = ['project_id','project_name','inventory_tab','transactions_tab','created_at','created_by'];
  if (!indexSheet) {
    indexSheet = invSs.insertSheet(PROJECTS_INDEX_SHEET_NAME);
    try { indexSheet.getRange(1,1,1,indexHeaders.length).setValues([indexHeaders]); } catch (e) { /* ignore */ }
  } else {
    // Ensure headers exist (weak attempt: only write if first row is empty or length mismatch)
    try {
      var existing = indexSheet.getDataRange().getValues()[0] || [];
      if (!existing || existing.length < indexHeaders.length || String(existing[0]||'').trim() === '') {
        indexSheet.getRange(1,1,1,indexHeaders.length).setValues([indexHeaders]);
      }
    } catch (e) { /* ignore */ }
  }

  var id = generateProjectId();
  var createdBy = Session && Session.getActiveUser ? (Session.getActiveUser().getEmail ? Session.getActiveUser().getEmail() : '') : '';
  try { indexSheet.appendRow([id, projectName, invTabName, txTabName, new Date(), createdBy]); } catch (e) { /* best-effort append */ }

  return { project_id: id, project_name: projectName, inventory_tab: invTabName, transactions_tab: txTabName };
}

function appendInventory(payload) {
  // payload must include sheet_name or project_id and a data object with fields matching headers
  var sheetName = payload.sheet_name || payload.project_sheet;
  var ss = getInventorySpreadsheet();
  if (!sheetName) return { error: 'missing sheet_name' };
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: 'sheet not found' };
  var headers = sheet.getDataRange().getValues()[0];
  var data = payload.data || {};
  // generate item id
  var itemId = data.item_id || ('I-' + Date.now());
  var row = headers.map(function(h) {
    if (h === 'item_id') return itemId;
    if (h === 'date_created') return data.date_created || new Date();
    if (h === 'project_name') return data.project_name || '';
    return data[h] || '';
  });
  sheet.appendRow(row);
  // generate qr_key and persist to the newly appended row if the sheet has a qr_key column
  try {
    var headersMap = headerIndexMap(headers);
    Logger.log('appendInventory: headers=' + JSON.stringify(headers));
    Logger.log('appendInventory: headersMap=' + JSON.stringify(headersMap));
    var qrCol = (typeof headersMap['qr_key'] !== 'undefined') ? headersMap['qr_key'] : -1;
    var itemCol = (typeof headersMap['item_id'] !== 'undefined') ? headersMap['item_id'] : -1;
    var newRowIndex = sheet.getLastRow();
    var qrKey = '';
    Logger.log('appendInventory: newRowIndex=' + newRowIndex + ' qrCol=' + qrCol + ' itemCol=' + itemCol);
    if (qrCol !== -1) {
      // generate a unique key
      qrKey = QrUtils.generateUniqueKey(9);
      sheet.getRange(newRowIndex, qrCol+1).setValue(qrKey);
      Logger.log('appendInventory: wrote qr_key=' + qrKey + ' at row=' + newRowIndex + ' col=' + (qrCol+1));
    } else {
      Logger.log('appendInventory: qr_key column not found; skipping write');
    }
    // build item URL for immediate return
    var url = ScriptApp.getService().getUrl();
    var itemUrl = url + '?action=itemForm&itemUrlId=' + encodeURIComponent(itemId);
    return { item_id: itemId, qr_key: qrKey, item_url: itemUrl };
  } catch (err) {
    // don't fail hard on QR generation — return minimal response
    var url = ScriptApp.getService().getUrl();
    var itemUrl = url + '?action=itemForm&itemUrlId=' + encodeURIComponent(itemId);
    return { item_id: itemId, qr_key: '', item_url: itemUrl, warning: String(err) };
  }
}

// (Deprecated) generateUniqueQrKey removed in favor of QrUtils.generateUniqueKey

// Resolve a qr_key to its itemId and row info. Returns null if not found.
function resolveQrKey(key) {
  if (!key) return null;
  // Cache lookup to speed up hot keys
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('qrKey:' + key);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
  } catch (err) {}
  var ss = getInventorySpreadsheet();
  var sheets = ss.getSheets();
  for (var si = 0; si < sheets.length; si++) {
    var sheet = sheets[si];
    var headers = sheet.getDataRange().getValues()[0] || [];
    var map = headerIndexMap(headers);
    if (typeof map['qr_key'] === 'undefined' || typeof map['item_id'] === 'undefined') continue;
    var qrIndex = map['qr_key'];
    var itemIndex = map['item_id'];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) continue;
    var startCol = Math.min(qrIndex, itemIndex) + 1;
    var numCols = Math.abs(qrIndex - itemIndex) + 1;
    var values = sheet.getRange(2, startCol, lastRow-1, numCols).getValues();
    for (var r = 0; r < values.length; r++) {
      var row = values[r];
      var qrVal = row[ qrIndex < itemIndex ? 0 + (qrIndex - Math.min(qrIndex,itemIndex)) : (qrIndex - Math.min(qrIndex,itemIndex)) ];
      // compute relative indexes
      var relQrIndex = qrIndex < itemIndex ? 0 : (qrIndex - Math.min(qrIndex,itemIndex));
      var relItemIndex = qrIndex < itemIndex ? (itemIndex - Math.min(qrIndex,itemIndex)) : 0;
      qrVal = row[relQrIndex];
      var itemVal = row[relItemIndex];
      if (String(qrVal) === String(key)) {
        var resolved = { itemId: String(itemVal), sheetName: sheet.getName(), row: r + 2 };
        try { CacheService.getScriptCache().put('qrKey:' + key, JSON.stringify(resolved), 21600); } catch (err) {}
        return resolved;
      }
    }
  }
  return null;
}

// Handle incoming short-key requests and redirect to the itemForm URL
// handleKeyRedirect centralized in QrEndpoints

function updateItem(payload) {
  // payload: { sheet_name?: string, item_id: 'I-...', data: { fieldName: value, ... } }
  if (!payload || !payload.item_id) return { error: 'missing item_id' };
  var ss = getInventorySpreadsheet();
  var targetSheets = [];
  if (payload.sheet_name) {
    var s = ss.getSheetByName(payload.sheet_name);
    if (s) targetSheets.push(s);
  } else {
    targetSheets = ss.getSheets();
  }

  var itemId = payload.item_id;
  var updated = false;
  var updatedRows = [];

  for (var si = 0; si < targetSheets.length; si++) {
    var sheet = targetSheets[si];
    var headers = sheet.getDataRange().getValues()[0] || [];
    var itemCol = headers.indexOf('item_id');
    if (itemCol === -1) continue;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) continue;
    var idRange = sheet.getRange(2, itemCol+1, lastRow-1, 1);
    var idValues = idRange.getValues();
    for (var i = 0; i < idValues.length; i++) {
      var cell = idValues[i][0];
      var rowItemId = (cell === null || cell === undefined) ? '' : String(cell);
      if (rowItemId === itemId) {
        var foundRowIndex = i + 2;
        console.log('updateItem: matched item_id at row ' + foundRowIndex + ' (itemId=' + itemId + ')');
        var fullRow = sheet.getRange(foundRowIndex, 1, 1, headers.length).getValues()[0];
        console.log('updateItem: fetched row data: ' + JSON.stringify(fullRow));
        // apply updates (case-insensitive header matching)
        var data = payload.data || {};
        var newRow = fullRow.slice();
        // Build a map of lowercased header -> index for tolerant matching
        var headerLowerMap = {};
        for (var hi = 0; hi < headers.length; hi++) {
          var hk = headers[hi] === null || headers[hi] === undefined ? '' : String(headers[hi]);
          headerLowerMap[hk.toLowerCase()] = hi;
        }
        // Apply each provided data key to the matching header (case-insensitive)
        for (var dataKey in data) {
          if (!Object.prototype.hasOwnProperty.call(data, dataKey)) continue;
          try {
            var lookup = (dataKey === null || dataKey === undefined) ? '' : String(dataKey).toLowerCase();
            if (typeof headerLowerMap[lookup] !== 'undefined') {
              newRow[ headerLowerMap[lookup] ] = data[dataKey];
            } else {
              // Fallback: if exact header name matches, use it
              for (var h = 0; h < headers.length; h++) {
                if (headers[h] === dataKey) { newRow[h] = data[dataKey]; break; }
              }
            }
          } catch (e) {
            // ignore individual key mapping errors
          }
        }
        // write back to sheet (row index is 1-based, add 1 for header)
        sheet.getRange(foundRowIndex, 1, 1, newRow.length).setValues([newRow]);
        updated = true;
        updatedRows.push({ sheet: sheet.getName(), row: foundRowIndex });
        break;
      }
    }
  }
  if (!updated) return { error: 'item not found' };
  return { updated: true, locations: updatedRows };
}

function getItem(itemId, sheetName) {
  if (!itemId) return { error: 'missing itemId' };
  var ss = getInventorySpreadsheet();
  var sheet = sheetName ? ss.getSheetByName(sheetName) : null;
  if (!sheet) return { error: 'sheet not found' };

  var headers = sheet.getDataRange().getValues()[0] || [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { error: 'no data' };

  var data = sheet.getRange(2, 1, lastRow-1, headers.length).getValues();
  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    var rowItemId = String(row[ headers.indexOf('item_id') ] || '');
    if (rowItemId === itemId) {
      var foundRowIndex = r + 2;
      var obj = {};
      for (var c = 0; c < headers.length; c++) {
        var key = headers[c] || '';
        var cell = row[c];
        if (cell === null || cell === undefined) obj[key] = '';
        else if (Object.prototype.toString.call(cell) === '[object Date]') {
          try { obj[key] = cell.toISOString(); } catch (e) { obj[key] = String(cell); }
        } else if (typeof cell === 'object') obj[key] = String(cell);
        else obj[key] = cell;
      }
      obj._sheet = sheet.getName();
      obj._row = foundRowIndex;
      return { item: obj, debug: { matchedRow: foundRowIndex } };
    }
  }
  return { error: 'item not found' };
}

// Batch-generate and save SVGs for all items in a sheet that are missing qr_key (or force all with force=true param)
function batchGenerateQrForSheet(sheetName, force) {
  if (!sheetName) return { error: 'missing sheetName' };
  Logger.log('batchGenerateQrForSheet: start sheetName=' + sheetName + ' force=' + !!force);
  var ss = getInventorySpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: 'sheet not found' };
  var values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) return { created: 0, skipped: 0, errors: [] };
  var headers = values[0];
  var rows = values.slice(1);
  var map = headerIndexMap(headers);
  Logger.log('batchGenerateQrForSheet: headers=' + JSON.stringify(headers) + ' map=' + JSON.stringify(map));
  if (typeof map['item_id'] === 'undefined') return { error: 'item_id column missing' };
  var qrIndex = (typeof map['qr_key'] !== 'undefined') ? map['qr_key'] : -1;
  var itemIndex = map['item_id'];
  var created = 0, skipped = 0;
  var results = [];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var itemId = String(row[itemIndex] || '');
    var qrVal = (qrIndex !== -1) ? String(row[qrIndex] || '') : '';
    // Always attempt to generate the SVG for the key. If no key exists, create one first.
    if (!qrVal) {
      // create a key if missing
      var createdKey = QrUtils.generateUniqueKey(9);
      if (qrIndex !== -1) sheet.getRange(r+2, qrIndex+1).setValue(createdKey);
      Logger.log('batchGenerateQrForSheet: created missing key for row=' + (r+2) + ' itemId=' + itemId + ' key=' + createdKey);
      qrVal = createdKey;
    } else {
      Logger.log('batchGenerateQrForSheet: will generate image for existing key at row=' + (r+2) + ' itemId=' + itemId + ' key=' + qrVal);
    }
    try {
      Logger.log('batchGenerateQrForSheet: processing row=' + (r+2) + ' itemId=' + itemId + ' existingQr=' + (qrVal ? 'yes' : 'no'));
      // ensure qr_key exists for this row
      var key = qrVal;
      if (!key) {
        key = QrUtils.generateUniqueKey(9);
        if (qrIndex !== -1) sheet.getRange(r+2, qrIndex+1).setValue(key);
      }
      var saved = QrImage.savePngForKey(key);
      if (saved && !saved.error) {
        created++;
        results.push({ row: r+2, itemId: itemId, key: key, fileId: saved.fileId, fileUrl: saved.fileUrl, existed: saved.existed });
        Logger.log('batchGenerateQrForSheet: saved key=' + key + ' fileId=' + saved.fileId + ' existed=' + !!saved.existed);
      } else {
        var saveErr = saved && saved.error ? saved.error : 'unknown';
        results.push({ row: r+2, itemId: itemId, key: key, error: saveErr });
        Logger.log('batchGenerateQrForSheet: failed to save key=' + key + ' error=' + saveErr);
      }
    } catch (err) {
      results.push({ row: r+2, itemId: itemId, error: String(err) });
      Logger.log('batchGenerateQrForSheet: exception processing row=' + (r+2) + ' itemId=' + itemId + ' error=' + String(err));
    }
  }
  Logger.log('batchGenerateQrForSheet: complete created=' + created + ' skipped=' + skipped + ' totalRows=' + rows.length);
  return { created: created, skipped: skipped, results: results };
}


