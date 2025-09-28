// QR image generation and caching
var QrImage = QrImage || {};
// Module initialization (no top-level try wrapper)

// Default options: PNG artwork at print DPI
QrImage.defaultOptions = {
  widthPx: 600,
  includeLabel: true,
  separator: ' — '
};

// Truncate helper
QrImage.truncate = function(s, maxLen) {
  if (!s) return '';
  s = String(s);
  if (s.length <= maxLen) return s;
  return s.substr(0, maxLen-1) + '…';
};

// Fetch a reliable raster QR image as a data URI for embedding
QrImage.buildRasterDataUri = function(qrKey, widthPx) {
  var size = widthPx || QrImage.defaultOptions.widthPx;
  var url = ScriptApp.getService().getUrl();
  var qrUrl = url + '?action=key&k=' + encodeURIComponent(qrKey);
  Logger.log('QrImage.buildRasterDataUri: start key=' + qrKey + ' size=' + size);
  // Log the exact URL encoded into the QR for debugging scan/tap issues
  Logger.log('QrImage.buildRasterDataUri: QR payload = ' + qrUrl);
  if (typeof QrRenderer === 'undefined') {
    Logger.log('QrImage.buildRasterDataUri: ERROR - QrRenderer is undefined');
    throw new Error('QrRenderer not defined. Ensure `qr_renderer.gs` is present and the web app has been redeployed to pick up code changes.');
  }
  // Always use the deterministic BMP renderer for reliability.
  var rasterUri = QrRenderer.renderRasterDataUriForText(qrUrl, size);
  var uriType = rasterUri ? rasterUri.split(';')[0] : 'null';
  if (uriType !== 'data:image/bmp') {
    Logger.log('QrImage.buildRasterDataUri: WARNING renderer returned non-BMP type: ' + uriType);
  }
  Logger.log('QrImage.buildRasterDataUri: done uriType=' + uriType);
  return rasterUri;
};

// Fetch a PNG QR image as a data URI for embedding
QrImage.buildPngDataUri = function(qrKey, widthPx) {
  // This function now uses the reliable raster renderer which produces a BMP.
  // The function name is kept for compatibility but the output is BMP.
  return QrImage.buildRasterDataUri(qrKey, widthPx);
};

// Build an SVG QR image data URI (preferred for print path)
QrImage.buildSvgDataUri = function(qrKey, widthPx) {
  var size = widthPx || QrImage.defaultOptions.widthPx;
  var url = ScriptApp.getService().getUrl();
  var qrUrl = url + '?action=key&k=' + encodeURIComponent(qrKey);
  Logger.log('QrImage.buildSvgDataUri: start key=' + qrKey + ' size=' + size);
  var svgUri = QrRenderer.renderSvgDataUriForText(qrUrl, size, { marginModules: 4 });
  Logger.log('QrImage.buildSvgDataUri: done uriType=' + (svgUri ? svgUri.split(';')[0] : 'null'));
  return svgUri;
};

// Basic XML escape
QrImage.escapeXml = function(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
};

// Generate or return a preview HTML for a key (PNG only). Not used for printing.
QrImage.generateForKey = function(key, options) {
  options = options || {};
  var opts = Object.assign({}, QrImage.defaultOptions, options);
  var resolved = QrUtils.resolveKey(key);
  if (!resolved) return HtmlService.createHtmlOutput('<html><body><p>QR key not found.</p></body></html>');
  // Build label from item description and source
  var item = null;
  try { item = getItem(resolved.itemId, resolved.sheetName).item || null; } catch (e) { item = null; }
  var description = item && item.description ? String(item.description) : '';
  var source = item && item.source ? String(item.source) : '';
  var maxDesc = 40;
  var maxSource = 20;
  var label = '';
  if (opts.includeLabel) {
    var d = QrImage.truncate(description, maxDesc);
    var s = QrImage.truncate(source, maxSource);
    label = d;
    if (d && s) label += (opts.separator || ' — ') + s;
  }
  var rasterUri = QrImage.buildRasterDataUri(key, opts.widthPx);
  var html = '<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif"><img src="' + QrImage.escapeXml(rasterUri) + '" alt="QR"/>';
  if (label) html += '<div>' + QrImage.escapeXml(label) + '</div>';
  html += '</body></html>';
  return HtmlService.createHtmlOutput(html);
};

// Build a simple single-label HTML (embedding SVG inline) and convert to PDF Blob
QrImage.buildSingleLabelPdf = function(imageDataUri, labelText, options) {
  var html = '';
  html += '<!doctype html><html><head><meta charset="utf-8">';
  html += '<style>@page{size: Letter portrait; margin:0.25in;} html,body{margin:0;padding:0} .label{width:2in;min-height:2.2in;display:block} .label .qr{width:2in;height:2in;display:block} .label .qr svg{width:100%;height:100%} .label .txt{font-family:Arial, Helvetica, sans-serif; font-size:14px; text-align:center; margin-top:4px}</style>';
  html += '</head><body>';
  // Treat input as data URI; prefer inline SVG for sharpness
  var src = String(imageDataUri || '');
  var body = '';
  if (src.indexOf('data:image/svg+xml') === 0) {
    // This path is now legacy and should ideally not be taken for PDFs.
    // It is kept for cases where SVG data is explicitly passed.
    Logger.log('buildSingleLabelPdf: received SVG input. Embedding raw SVG.');
    var comma = src.indexOf(',');
    var svgXml = '';
    try { svgXml = decodeURIComponent(src.substr(comma + 1)); } catch (e) { svgXml = src.substr(comma + 1); }
    body = '<div class="label"><div class="qr">' + svgXml + '</div>' + (labelText ? '<div class="txt">' + QrImage.escapeXml(labelText) + '</div>' : '') + '</div>';
  } else {
    // This is the standard path for reliable raster images (BMP).
    Logger.log('buildSingleLabelPdf: received raster input (' + src.substring(0, 30) + '...). Embedding as <img>.');
    body = '<div class="label"><img class="qr" src="' + QrImage.escapeXml(src) + '" alt="QR"/>' + (labelText ? '<div class="txt">' + QrImage.escapeXml(labelText) + '</div>' : '') + '</div>';
  }
  html += body;
  html += '</body></html>';
  var blob = Utilities.newBlob(html, 'text/html', 'label.html').getAs('application/pdf');
  blob.setName('qr_label.pdf');
  return blob;
};

// Return a printer-ready PDF for a single key. Does not return SVG or PNG.
QrImage.generatePdfForKey = function(key, options) {
  options = options || {};
  var resolved = QrUtils.resolveKey(key);
  if (!resolved) return HtmlService.createHtmlOutput('<html><body><p>QR key not found.</p></body></html>');
  var item = null;
  try { item = getItem(resolved.itemId, resolved.sheetName).item || null; } catch (e) { item = null; }
  var description = item && item.description ? String(item.description) : '';
  var source = item && item.source ? String(item.source) : '';
  var d = QrImage.truncate(description, 40);
  var s = QrImage.truncate(source, 20);
  var label = d;
  if (d && s) label += (QrImage.defaultOptions.separator || ' — ') + s;
  // Always cache to Drive and redirect to the file URL
  var saved = QrImage.saveSinglePdfForKey(key, { label: label });
  if (saved && saved.fileUrl) {
    var redirect = '<!doctype html><html><head><meta charset="utf-8"><title>QR Label</title></head><body><script>window.location.replace("' + QrImage.escapeXml(saved.fileUrl) + '");</script><noscript><a href="' + QrImage.escapeXml(saved.fileUrl) + '">Open PDF</a></noscript></body></html>';
    return HtmlService.createHtmlOutput(redirect).setTitle('QR Label');
  }
  // Fallback to embedded PDF if Drive write fails
  var rasterUri = QrImage.buildRasterDataUri(key, QrImage.defaultOptions.widthPx);
  var pdfBlob = QrImage.buildSingleLabelPdf(rasterUri, label, options);
  var base64 = Utilities.base64Encode(pdfBlob.getBytes());
  var html = '<!doctype html><html><head><meta charset="utf-8"><title>QR Label</title></head><body style="margin:0"><embed type="application/pdf" src="data:application/pdf;base64,' + base64 + '" width="100%" height="100%" /></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('QR Label');
};

// Return a PDF Blob for a single key (used when streaming application/pdf)
QrImage.generatePdfBlobForKey = function(key, options) {
  options = options || {};
  var resolved = QrUtils.resolveKey(key);
  if (!resolved) return null;
  var item = null;
  try { item = getItem(resolved.itemId, resolved.sheetName).item || null; } catch (e) { item = null; }
  var description = item && item.description ? String(item.description) : '';
  var source = item && item.source ? String(item.source) : '';
  var d = QrImage.truncate(description, 40);
  var s = QrImage.truncate(source, 20);
  var label = d; if (d && s) label += (QrImage.defaultOptions.separator || ' — ') + s;
  // Ensure we cache a PNG representation for this key as well (best-effort)
  try {
    if (typeof QrImage.savePngForKey === 'function') {
      try {
        var pngRes = QrImage.savePngForKey(key);
        Logger.log('generatePdfBlobForKey: savePngForKey result=' + JSON.stringify(pngRes));
      } catch (pngErr) {
        Logger.log('generatePdfBlobForKey: savePngForKey error: ' + String(pngErr));
      }
    }
  } catch (e) {}

  var rasterUri = QrImage.buildRasterDataUri(key, QrImage.defaultOptions.widthPx);
  var pdfBlob = QrImage.buildSingleLabelPdf(rasterUri, label, options);
  return pdfBlob;
};

// Generate a batch PDF for multiple items. Options may control page size/grid and caching.
QrImage.generateBatchPdf = function(sheetName, itemIds, options) {
  options = options || {};
  var pageSize = options.pageSize || 'Letter';
  var orientation = options.orientation === 'landscape' ? 'landscape' : 'portrait';
  // Keep caching enabled by default, but don't show any Drive link overlay
  var cacheToDrive = (typeof options.cache === 'undefined') ? true : !!options.cache;
  var dpi = options.dpi || 300;
  var cellPx = Math.round((2 * dpi)); // 2in label
  // Build HTML grid
  var styles = '' +
    '@page{size:' + pageSize + ' ' + orientation + '; margin:0.25in;}\n' +
    'html,body{margin:0;padding:0} .sheet{display:grid;grid-template-columns:repeat(auto-fill,2in);grid-auto-rows:2.2in;gap:0.125in;}\n' +
    '.cell{width:2in;height:2.2in;overflow:hidden} .cell img{width:2in;height:auto;display:block} .cell .txt{font-family:Arial, Helvetica, sans-serif; font-size:14px; text-align:center; margin-top:4px;}';

  var html = '';
  html += '<!doctype html><html><head><meta charset="utf-8"><style>' + styles + '</style></head><body>';
  html += '<div class="sheet">';
  var projectName = sheetName || 'Project';
  for (var i = 0; i < itemIds.length; i++) {
    var id = String(itemIds[i]);
    var itemResp = getItem(id, sheetName);
    if (!itemResp || !itemResp.item) continue;
    var it = itemResp.item;
    var key = it.qr_key;
    if (!key) {
      key = QrUtils.generateUniqueKey(9);
      // persist key if possible
      try {
        var ss = getInventorySpreadsheet();
        var sheet = ss.getSheetByName(sheetName);
        if (sheet) {
          var headers = sheet.getDataRange().getValues()[0] || [];
          var map = headerIndexMap(headers);
          if (typeof map['item_id'] !== 'undefined' && typeof map['qr_key'] !== 'undefined') {
            // find row from debug _row
            var rowIndex = itemResp.debug && itemResp.debug.matchedRow ? itemResp.debug.matchedRow : null;
            if (rowIndex) sheet.getRange(rowIndex, map['qr_key']+1).setValue(key);
          }
        }
      } catch (err) {}
    }
    if (it.project_name) projectName = String(it.project_name);
    var d = QrImage.truncate(it.description || '', 40);
    var s = QrImage.truncate(it.source || '', 20);
    var label = d; if (d && s) label += (QrImage.defaultOptions.separator || ' — ') + s;
    var rasterUri = QrImage.buildRasterDataUri(key, QrImage.defaultOptions.widthPx);
    html += '<div class="cell"><img class="qr" src="' + QrImage.escapeXml(rasterUri) + '" alt="QR"/>' + (label ? '<div class="txt">' + QrImage.escapeXml(label) + '</div>' : '') + '</div>';
  }
  html += '</div></body></html>';

  var pdfBlob = Utilities.newBlob(html, 'text/html', 'batch.html').getAs('application/pdf');
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
  pdfBlob.setName((projectName || 'Project') + ' - batch - ' + timestamp + '.pdf');

  var driveMeta = null;
  if (cacheToDrive) {
    try {
      var rootFolders = DriveApp.getFoldersByName('QR Codes');
      var rootFolder = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder('QR Codes');
      var safeProject = String(projectName || 'Project').replace(/[\\/:*?\[\]]+/g, '-');
      var projectFolders = rootFolder.getFoldersByName(safeProject);
      var projectFolder = projectFolders.hasNext() ? projectFolders.next() : rootFolder.createFolder(safeProject);
      var file = projectFolder.createFile(pdfBlob);
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
      driveMeta = { fileId: file.getId(), fileUrl: file.getUrl() };
    } catch (err) {
      console.log('generateBatchPdf: driveCacheFailure ' + String(err));
    }
  }

  // If we cached to Drive, redirect directly to the Drive file to avoid embedding data: PDFs
  if (driveMeta && driveMeta.fileUrl) {
    Logger.log('generateBatchPdf: redirecting to Drive file for sheet=' + projectName + ' url=' + driveMeta.fileUrl);
    var redirectHtml = '<!doctype html><html><head><meta charset="utf-8"><title>Batch QR Labels</title></head><body><script>window.location.replace("' + QrImage.escapeXml(driveMeta.fileUrl) + '");</script><noscript><a href="' + QrImage.escapeXml(driveMeta.fileUrl) + '">Open PDF</a></noscript></body></html>';
    return HtmlService.createHtmlOutput(redirectHtml).setTitle('Batch QR Labels');
  }

  // Return the PDF for immediate use by embedding as data URL (fallback when Drive caching unavailable)
  var base64 = Utilities.base64Encode(pdfBlob.getBytes());
  var outHtml = '<!doctype html><html><head><meta charset="utf-8"><title>Batch QR Labels</title></head><body style="margin:0">';
  outHtml += '<embed type="application/pdf" src="data:application/pdf;base64,' + base64 + '" width="100%" height="100%" />';
  outHtml += '</body></html>';
  return HtmlService.createHtmlOutput(outHtml).setTitle('Batch QR Labels');
};

// Produce only the PDF Blob (and Drive metadata if cached) for batch
QrImage.generateBatchPdfBlob = function(sheetName, itemIds, options) {
  options = options || {};
  var pageSize = options.pageSize || 'Letter';
  var orientation = options.orientation === 'landscape' ? 'landscape' : 'portrait';
  var cacheToDrive = (typeof options.cache === 'undefined') ? true : !!options.cache;
  var dpi = options.dpi || 300;
  var styles = '' +
    '@page{size:' + pageSize + ' ' + orientation + '; margin:0.25in;}\n' +
    'html,body{margin:0;padding:0} .sheet{display:grid;grid-template-columns:repeat(auto-fill,2in);grid-auto-rows:2.2in;gap:0.125in;}\n' +
    '.cell{width:2in;height:2.2in;overflow:hidden} .cell .qr{width:2in;height:2in;display:block} .cell .qr svg{width:100%;height:100%} .cell .txt{font-family:Arial, Helvetica, sans-serif; font-size:14px; text-align:center; margin-top:4px;}';

  var html = '';
  html += '<!doctype html><html><head><meta charset="utf-8"><style>' + styles + '</style></head><body>';
  html += '<div class="sheet">';
  var projectName = sheetName || 'Project';
  for (var i = 0; i < itemIds.length; i++) {
    var id = String(itemIds[i]);
    var itemResp = getItem(id, sheetName);
    if (!itemResp || !itemResp.item) continue;
    var it = itemResp.item;
    var key = it.qr_key;
    if (!key) {
      key = QrUtils.generateUniqueKey(9);
      try {
        var ss = getInventorySpreadsheet();
        var sheet = ss.getSheetByName(sheetName);
        if (sheet) {
          var headers = sheet.getDataRange().getValues()[0] || [];
          var map = headerIndexMap(headers);
          if (typeof map['item_id'] !== 'undefined' && typeof map['qr_key'] !== 'undefined') {
            var rowIndex = itemResp.debug && itemResp.debug.matchedRow ? itemResp.debug.matchedRow : null;
            if (rowIndex) sheet.getRange(rowIndex, map['qr_key']+1).setValue(key);
          }
        }
      } catch (err) {}
    }
    if (it.project_name) projectName = String(it.project_name);
    var d = QrImage.truncate(it.description || '', 40);
    var s = QrImage.truncate(it.source || '', 20);
    var label = d; if (d && s) label += (QrImage.defaultOptions.separator || ' — ') + s;
    var rasterUri = QrImage.buildRasterDataUri(key, QrImage.defaultOptions.widthPx);
    html += '<div class="cell"><img class="qr" src="' + QrImage.escapeXml(rasterUri) + '" alt="QR"/>' + (label ? '<div class="txt">' + QrImage.escapeXml(label) + '</div>' : '') + '</div>';
  }
  html += '</div></body></html>';

  var pdfBlob = Utilities.newBlob(html, 'text/html', 'batch.html').getAs('application/pdf');
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
  pdfBlob.setName((projectName || 'Project') + ' - batch - ' + timestamp + '.pdf');

  var driveMeta = null;
  if (cacheToDrive) {
    try {
      var rootFolders = DriveApp.getFoldersByName('QR Codes');
      var rootFolder = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder('QR Codes');
      var safeProject = String(projectName || 'Project').replace(/[\\/:*?\[\]]+/g, '-');
      var projectFolders = rootFolder.getFoldersByName(safeProject);
      var projectFolder = projectFolders.hasNext() ? projectFolders.next() : rootFolder.createFolder(safeProject);
      var file = projectFolder.createFile(pdfBlob);
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
      driveMeta = { fileId: file.getId(), fileUrl: file.getUrl() };
      Logger.log('generateBatchPdfBlob: saved sheet=' + sheetName + ' items=' + itemIds.length + ' fileId=' + file.getId() + ' fileUrl=' + file.getUrl());
    } catch (err) {
      Logger.log('generateBatchPdfBlob: driveCacheFailure ' + String(err));
    }
  }
  return { pdfBlob: pdfBlob, driveMeta: driveMeta };
};

// Generate a single-item PDF, save to Drive, and return metadata
QrImage.saveSinglePdfForKey = function(key, options) {
  options = options || {};
  if (!key) return { error: 'missing key' };
  var resolved = QrUtils.resolveKey(key);
  if (!resolved) return { error: 'key not found' };
  var item = null;
  try { item = getItem(resolved.itemId, resolved.sheetName).item || null; } catch (e) { item = null; }
  var description = item && item.description ? String(item.description) : '';
  var source = item && item.source ? String(item.source) : '';
  var d = QrImage.truncate(description, 40);
  var s = QrImage.truncate(source, 20);
  var label = options.label || (d ? (s ? d + (QrImage.defaultOptions.separator || ' — ') + s : d) : '');
  var rasterUri = QrImage.buildRasterDataUri(key, QrImage.defaultOptions.widthPx);
  var pdfBlob = QrImage.buildSingleLabelPdf(rasterUri, label, options);
  try {
    var projectName = (item && item.project_name) ? String(item.project_name) : (resolved.sheetName || 'Project');
    var safeProjectName = (projectName || 'Project').replace(/[\\/:*?\[\]]+/g, '-');
    var itemIdPart = resolved.itemId ? String(resolved.itemId) : 'item';
    var fileName = safeProjectName + ' - ' + itemIdPart + ' - ' + String(key) + '.pdf';
    pdfBlob.setName(fileName);
    var rootFolders = DriveApp.getFoldersByName('QR Codes');
    var rootFolder = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder('QR Codes');
    var projectFolders = rootFolder.getFoldersByName(safeProjectName);
    var projectFolder = projectFolders.hasNext() ? projectFolders.next() : rootFolder.createFolder(safeProjectName);
    var file = projectFolder.createFile(pdfBlob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    Logger.log('saveSinglePdfForKey: saved key=' + key + ' fileId=' + file.getId() + ' fileUrl=' + file.getUrl());
    return { fileUrl: file.getUrl(), fileId: file.getId() };
  } catch (err) {
    Logger.log('saveSinglePdfForKey: error key=' + key + ' err=' + String(err));
    return { error: String(err) };
  }
};

// Save PNG for a key to Drive and return metadata { fileUrl, fileId, existed }
QrImage.savePngForKey = function(key) {
  Logger.log('QrImage.savePngForKey: start key=' + key);
  if (!key) {
    Logger.log('QrImage.savePngForKey: missing key');
    return { error: 'missing key' };
  }
  var resolved = QrUtils.resolveKey(key);
  if (!resolved) {
    Logger.log('QrImage.savePngForKey: key not found in sheets key=' + key);
    return { error: 'key not found' };
  }
  var item = null;
  try { item = getItem(resolved.itemId, resolved.sheetName).item || null; } catch (e) { item = null; }
  Logger.log('QrImage.savePngForKey: resolved=' + JSON.stringify(resolved) + ' itemPresent=' + (item ? 'yes' : 'no'));
  var description = item && item.description ? String(item.description) : '';
  var source = item && item.source ? String(item.source) : '';
  var d = QrImage.truncate(description, 40);
  var s = QrImage.truncate(source, 20);
  var label = '';
  if (d) label = d;
  if (d && s) label += (QrImage.defaultOptions.separator || ' — ') + s;
  try {
    var projectName = (item && item.project_name) ? String(item.project_name) : (resolved.sheetName || 'Project');
    var safeProjectName = (projectName || 'Project').replace(/[\\/:*?\[\]]+/g, '-');
    var fileBaseName = safeProjectName;
    var itemIdPart = resolved.itemId ? String(resolved.itemId) : 'item';
    var fileName = fileBaseName + ' - ' + itemIdPart + ' - ' + String(key) + '.png';
    Logger.log('QrImage.savePngForKey: target project=' + safeProjectName + ' fileName=' + fileName);

    // Ensure folder structure: QR Codes/<Project Name>/PNGs/
    var rootFolders = DriveApp.getFoldersByName('QR Codes');
    var rootFolder = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder('QR Codes');
    var projectFolders = rootFolder.getFoldersByName(safeProjectName);
    var projectFolder = projectFolders.hasNext() ? projectFolders.next() : rootFolder.createFolder(safeProjectName);
    var pngFolders = projectFolder.getFoldersByName('PNGs');
    var pngFolder = pngFolders.hasNext() ? pngFolders.next() : projectFolder.createFolder('PNGs');

    var files = pngFolder.getFilesByName(fileName);
    var file = null;
    var existed = false;
    if (files.hasNext()) {
      file = files.next();
      existed = true;
      Logger.log('QrImage.savePngForKey: found existing file id=' + file.getId());
    } else {
      var rasterUri = QrImage.buildRasterDataUri(key, QrImage.defaultOptions.widthPx);
      var comma = rasterUri.indexOf(',');
      var header = (comma > 0) ? rasterUri.substring(5, comma) : 'image/png'; // e.g. "image/bmp;base64"
      var mimeType = header.split(';')[0] || 'image/png';
      Logger.log('QrImage.savePngForKey: rasterUri mimeType=' + mimeType + ' for key=' + key);
      var data = Utilities.base64Decode(rasterUri.substr(comma + 1));
      var blob = Utilities.newBlob(data, mimeType, fileName);

      // If the renderer returned BMP, attempt a server-side conversion to PNG for downstream compatibility
      if (mimeType === 'image/bmp') {
        try {
          var pngBlob = blob.getAs('image/png');
          if (pngBlob && pngBlob.getBytes && pngBlob.getBytes().length > 0) {
            blob = pngBlob;
            // Ensure filename ends with .png
            if (!/\.png$/i.test(fileName)) fileName = fileName.replace(/\.[^\.]+$/, '') + '.png';
            blob.setName(fileName);
            Logger.log('QrImage.savePngForKey: converted BMP->PNG for key=' + key + ' size=' + blob.getBytes().length);
          } else {
            Logger.log('QrImage.savePngForKey: BMP->PNG conversion returned empty blob; saving original BMP');
            // adjust filename extension to .bmp
            if (!/\.bmp$/i.test(fileName)) fileName = fileName.replace(/\.[^\.]+$/, '') + '.bmp';
            blob.setName(fileName);
          }
        } catch (convErr) {
          Logger.log('QrImage.savePngForKey: BMP->PNG conversion failed: ' + String(convErr) + ' — saving original BMP');
          if (!/\.bmp$/i.test(fileName)) fileName = fileName.replace(/\.[^\.]+$/, '') + '.bmp';
          blob.setName(fileName);
        }
      }

      file = pngFolder.createFile(blob);
      Logger.log('QrImage.savePngForKey: created file id=' + file.getId() + ' fileName=' + file.getName());
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); Logger.log('QrImage.savePngForKey: set file sharing for id=' + file.getId()); } catch (err) { Logger.log('QrImage.savePngForKey: setSharing failed: ' + String(err)); }
    }
    var result = { fileUrl: file.getUrl(), fileId: file.getId(), existed: existed };
    Logger.log('QrImage.savePngForKey: success result=' + JSON.stringify(result));
    return result;
  } catch (err) {
    Logger.log('QrImage.savePngForKey: exception ' + String(err));
    return { error: String(err) };
  }

  // Module initialization complete
  try { Logger.log('QrImage: module initialization complete; exports=' + JSON.stringify(Object.keys(QrImage || {}))); } catch (e) {}

  // End of qr_image module

};

