// QR endpoints routing
// Diagnostic: do not assign to QrImage/QrRenderer/QrUtils here (avoid overwriting a real module)
var QrEndpoints = QrEndpoints || {};
try { Logger.log('diagnostic: typeof QrImage=' + (typeof QrImage) + ', typeof QrImage.generatePdfBlobForKey=' + (typeof (QrImage && QrImage.generatePdfBlobForKey))); } catch (e) {}

QrEndpoints.handleKeyRedirect = function(e) {
  var key = (e && e.parameter && (e.parameter.k || e.parameter.key)) ? (e.parameter.k || e.parameter.key) : null;
  if (!key) return ContentService.createTextOutput(JSON.stringify({ error: 'missing key' })).setMimeType(ContentService.MimeType.JSON);
  var resolved = QrUtils.resolveKey(key);
  if (!resolved) {
    return HtmlService.createHtmlOutput('<html><body><p>QR key not found.</p></body></html>');
  }
  Logger.log('handleKeyRedirect: key=' + key + ' resolved=' + JSON.stringify(resolved));
  var url = ScriptApp.getService().getUrl();
  var itemUrl = url + '?action=itemForm&itemUrlId=' + encodeURIComponent(resolved.itemId);
  var html = '<!doctype html><html><head><meta charset="utf-8"></head><body><script>window.location.replace("' + itemUrl + '");</script><noscript><a href="' + itemUrl + '">Open item</a></noscript></body></html>';
  return HtmlService.createHtmlOutput(html);
};

QrEndpoints.handleQrImage = function(e) {
  var key = (e && e.parameter && (e.parameter.k || e.parameter.key)) ? (e.parameter.k || e.parameter.key) : null;
  Logger.log('handleQrImage: entry params=' + JSON.stringify(e && e.parameter ? e.parameter : {}));
  if (!key) return ContentService.createTextOutput(JSON.stringify({ error: 'missing key' })).setMimeType(ContentService.MimeType.JSON);

  try {
    try {
      Logger.log('handleQrImage: typeof QrImage=' + (typeof QrImage) + ', generatePdfBlobForKey=' + (typeof (QrImage && QrImage.generatePdfBlobForKey)));
    } catch (typeErr) {
      Logger.log('handleQrImage: typeof check failed: ' + String(typeErr));
    }

    // Try to save a PNG to Drive by default (unless caller explicitly asked for PDF)
    var params = e && e.parameter ? e.parameter : {};
    try {
      if ((params.mode || '').toLowerCase() !== 'pdf' && (params.format || '').toLowerCase() !== 'pdf') {
        try {
          if (typeof QrImage.savePngForKey === 'function') {
            var pngSaved = QrImage.savePngForKey(key);
            if (pngSaved && pngSaved.fileUrl) {
              Logger.log('handleQrImage: saved png to Drive fileId=' + pngSaved.fileId + ' url=' + pngSaved.fileUrl);
              var redirectHtml = '<!doctype html><html><head><meta charset="utf-8"><title>QR Image</title></head><body><script>setTimeout(function(){window.location.replace("' + String(pngSaved.fileUrl).replace(/"/g,'&quot;') + '");},200);</script><noscript><a href="' + String(pngSaved.fileUrl).replace(/"/g,'&quot;') + '">Open PNG</a></noscript></body></html>';
              return HtmlService.createHtmlOutput(redirectHtml).setTitle('QR Image');
            }
          }
        } catch (imgErr) {
          Logger.log('handleQrImage: png save failed: ' + String(imgErr));
        }
      }
    } catch (e) {}

    var pdfBlob = QrImage.generatePdfBlobForKey(key, params);
    if (!pdfBlob) {
      Logger.log('handleQrImage: generatePdfBlobForKey returned null for key=' + key);
      return ContentService.createTextOutput(JSON.stringify({ error: 'failed to generate pdf' })).setMimeType(ContentService.MimeType.JSON);
    }

    // Name the file and persist to Drive (synchronous, required)
    try {
      var itemInfo = null;
      try { itemInfo = getItem((e && e.parameter && e.parameter.itemId) ? e.parameter.itemId : null, (e && e.parameter && e.parameter.sheetName) ? e.parameter.sheetName : null); } catch (ie) { itemInfo = null; }
      var projectName = (itemInfo && itemInfo.item && itemInfo.item.project_name) ? String(itemInfo.item.project_name) : (e && e.parameter && e.parameter.sheetName ? String(e.parameter.sheetName) : 'Project');
      var safeProject = String(projectName || 'Project').replace(/[\\/:*?\[\]]+/g, '-');
      var fileBaseName = safeProject + ' - ' + String(key) + '.pdf';
      pdfBlob.setName(fileBaseName);

      var rootFolders = DriveApp.getFoldersByName('QR Codes');
      var rootFolder = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder('QR Codes');
      var projectFolders = rootFolder.getFoldersByName(safeProject);
      var projectFolder = projectFolders.hasNext() ? projectFolders.next() : rootFolder.createFolder(safeProject);

      var file = projectFolder.createFile(pdfBlob);
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (shErr) { Logger.log('handleQrImage: setSharing failed: ' + String(shErr)); }
      var fileUrl = file.getUrl();
      Logger.log('handleQrImage: saved pdf to Drive fileId=' + file.getId() + ' url=' + fileUrl);

      // Return a tiny HTML shell that delays briefly then replaces location to Drive preview
      var redirectHtml = '<!doctype html><html><head><meta charset="utf-8"><title>QR Label</title></head><body><script>setTimeout(function(){window.location.replace("' + String(fileUrl).replace(/"/g,'&quot;') + '");},200);</script><noscript><a href="' + String(fileUrl).replace(/"/g,'&quot;') + '">Open PDF</a></noscript></body></html>';
      return HtmlService.createHtmlOutput(redirectHtml).setTitle('QR Label');
    } catch (driveErr) {
      Logger.log('handleQrImage: Drive save failed: ' + String(driveErr));
      return ContentService.createTextOutput(JSON.stringify({ error: 'failed to save pdf', details: String(driveErr) })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    Logger.log('handleQrImage: unexpected error: ' + String(err));
    return ContentService.createTextOutput(JSON.stringify({ error: 'server error', details: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
};

// Batch PDF generation endpoint: ?action=generateBatchPdf&sheetName=<sheet>&items[]=<id>&options=<json>
QrEndpoints.handleGenerateBatchPdf = function(e) {
  Logger.log('handleGenerateBatchPdf: entry params=' + JSON.stringify(e && e.parameter ? e.parameter : {}));
  var params = (e && e.parameter) ? e.parameter : {};
  var sheetName = params.sheetName || params.sheet || '';
  var itemsParam = params['items[]'] || params.items || [];
  var items = [];
  if (Array.isArray(itemsParam)) items = itemsParam;
  else if (typeof itemsParam === 'string' && itemsParam) items = [itemsParam];
  var options = {};
  if (params.options) {
    try { options = JSON.parse(params.options); } catch (err) { options = {}; }
  }
  if (!sheetName || !items.length) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'missing sheetName or items[]' })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    if (typeof QrImage === 'undefined' || typeof QrImage.generateBatchPdfBlob !== 'function') {
      Logger.log('handleGenerateBatchPdf: batch pdf generator not available');
      return ContentService.createTextOutput(JSON.stringify({ error: 'batch pdf generator unavailable' })).setMimeType(ContentService.MimeType.JSON);
    }

    var res = QrImage.generateBatchPdfBlob(sheetName, items, options);
    if (!res || !res.pdfBlob) {
      Logger.log('handleGenerateBatchPdf: generateBatchPdfBlob returned no pdfBlob for sheet=' + sheetName);
      return ContentService.createTextOutput(JSON.stringify({ error: 'failed to generate pdf' })).setMimeType(ContentService.MimeType.JSON);
    }

    // Persist PDF to Drive synchronously and redirect to it
    try {
      var pdfBlob = res.pdfBlob;
      var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
      var safeProject = String(sheetName || 'Project').replace(/[\\/:*?\[\]]+/g, '-');
      var fileName = safeProject + ' - batch - ' + timestamp + '.pdf';
      pdfBlob.setName(fileName);

      var rootFolders = DriveApp.getFoldersByName('QR Codes');
      var rootFolder = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder('QR Codes');
      var projectFolders = rootFolder.getFoldersByName(safeProject);
      var projectFolder = projectFolders.hasNext() ? projectFolders.next() : rootFolder.createFolder(safeProject);

      var file = projectFolder.createFile(pdfBlob);
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (shErr) { Logger.log('handleGenerateBatchPdf: setSharing failed: ' + String(shErr)); }
      var fileUrl = file.getUrl();
      Logger.log('handleGenerateBatchPdf: saved batch pdf to Drive fileId=' + file.getId() + ' url=' + fileUrl);

      var redirectHtml = '<!doctype html><html><head><meta charset="utf-8"><title>Batch QR Labels</title></head><body><script>setTimeout(function(){window.location.replace("' + String(fileUrl).replace(/"/g,'&quot;') + '");},200);</script><noscript><a href="' + String(fileUrl).replace(/"/g,'&quot;') + '">Open PDF</a></noscript></body></html>';
      return HtmlService.createHtmlOutput(redirectHtml).setTitle('Batch QR Labels');
    } catch (driveErr) {
      Logger.log('handleGenerateBatchPdf: Drive save failed: ' + String(driveErr));
      return ContentService.createTextOutput(JSON.stringify({ error: 'failed to save pdf', details: String(driveErr) })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    Logger.log('handleGenerateBatchPdf: unexpected error: ' + String(err));
    return ContentService.createTextOutput(JSON.stringify({ error: 'server error', details: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
};


