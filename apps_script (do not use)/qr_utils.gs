// QR utilities: key generation and lookup helpers
var QrUtils = QrUtils || {};

// Generate a base62 key of given length (defaults to 9)
QrUtils.generateKey = function(length) {
  length = length || 9;
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var out = '';
  for (var i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
};

// Create a unique key by checking existing sheets (delegates to global resolveQrKey if present)
QrUtils.generateUniqueKey = function(length) {
  var maxAttempts = 1000;
  for (var attempt = 0; attempt < maxAttempts; attempt++) {
    var candidate = QrUtils.generateKey(length);
    // if a global resolve function exists, use it; otherwise assume unique
    if (typeof resolveQrKey === 'function') {
      var existing = resolveQrKey(candidate);
      if (!existing) return candidate;
    } else {
      return candidate;
    }
  }
  return Utilities.getUuid().replace(/-/g,'').substr(0,12);
};

// Resolve a key -> { itemId, sheetName, row } using the main resolveQrKey if available
QrUtils.resolveKey = function(key) {
  if (!key) return null;
  if (typeof resolveQrKey === 'function') return resolveQrKey(key);
  return null;
};


