// QR renderer (DIY) — renders a QR matrix to an SVG data URI sized for print
// Exposes: QrRenderer.renderSvgDataUriForText(text, widthPx, options?)
// Options: { marginModules?: number, dark?: string, light?: string }

var QrRenderer = QrRenderer || {};

(function(ns) {
  ns.defaultOptions = {
    marginModules: 4,
    dark: '#000000',
    light: '#FFFFFF'
  };

  ns.renderSvgDataUriForText = function(text, widthPx, options) {
    var opts = Object.assign({}, ns.defaultOptions, options || {});
    var enc = QrEncoder.encodeToMatrix(String(text || ''), 'M');
    var size = enc.size;
    var margin = Math.max(0, opts.marginModules | 0);
    var full = size + margin * 2;
    var scale = 1; // viewBox-based; actual display size governed by container

    var svg = '';
    svg += '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ' + full + ' ' + full + '" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet">';
    // background
    svg += '<rect x="0" y="0" width="' + full + '" height="' + full + '" fill="' + escapeXml(opts.light) + '"/>';
    // modules
    for (var y = 0; y < size; y++) {
      var row = enc.modules[y];
      var runStart = -1;
      for (var x = 0; x < size; x++) {
        if (row[x]) {
          if (runStart === -1) runStart = x;
        } else if (runStart !== -1) {
          svg += '<rect x="' + (margin + runStart) + '" y="' + (margin + y) + '" width="' + (x - runStart) + '" height="1" fill="' + escapeXml(opts.dark) + '"/>';
          runStart = -1;
        }
      }
      if (runStart !== -1) {
        svg += '<rect x="' + (margin + runStart) + '" y="' + (margin + y) + '" width="' + (size - runStart) + '" height="1" fill="' + escapeXml(opts.dark) + '"/>';
      }
    }
    svg += '</svg>';
    // Data URI (utf8)
    var uri = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    return uri;
  };

  // Render a reliable raster data URI for embedding. This function uses the deterministic
  // BMP renderer to guarantee a single-layer raster image.
  ns.renderRasterDataUriForText = function(text, widthPx, options) {
    try {
      var bmpUri = ns.renderBmpDataUriForText(text, widthPx, options);
      if (!bmpUri || bmpUri.indexOf('data:image/bmp;base64,') !== 0) {
        throw new Error('BMP generation failed to return a valid data URI.');
      }
      return bmpUri;
    } catch (e) {
      Logger.log('FATAL: renderRasterDataUriForText failed: ' + String(e));
      throw new Error('Failed to generate raster QR code: ' + (e.message || String(e)));
    }
  };

  // The previous implementation involving Blob conversions (SVG->PNG, or HTML->PDF->PNG)
  // has been found to be unreliable in the Apps Script environment. This function
  // now delegates to the deterministic BMP renderer to ensure a crisp, single-layer output.
  ns.renderPngDataUriForText = function(text, widthPx, options) {
    // Native PNG encoder: rasterize QR matrix into RGB pixels and build a PNG with
    // uncompressed DEFLATE blocks wrapped in zlib. This avoids relying on
    // Apps Script blob conversions which can be unreliable.
    var opts = Object.assign({}, ns.defaultOptions, options || {});
    var enc = QrEncoder.encodeToMatrix(String(text || ''), 'M');
    var size = enc.size;
    var margin = Math.max(0, (opts.marginModules | 0));
    var scale = Math.max(1, Math.floor((widthPx || 600) / (size + margin * 2)));
    var imgW = (size + margin * 2) * scale;
    var imgH = imgW;

    // Build raw RGB pixel array (top-to-bottom scanlines)
    var rowStride = imgW * 3;
    var pixels = new Uint8Array(imgW * imgH * 3);
    for (var yImg = 0; yImg < imgH; yImg++) {
      var yModule = Math.floor(yImg / scale) - margin;
      for (var xImg = 0; xImg < imgW; xImg++) {
        var xModule = Math.floor(xImg / scale) - margin;
        var isDark = false;
        if (xModule >= 0 && xModule < size && yModule >= 0 && yModule < size) {
          isDark = !!enc.modules[yModule][xModule];
        }
        var idx = (yImg * imgW + xImg) * 3;
        if (isDark) { pixels[idx] = 0; pixels[idx+1] = 0; pixels[idx+2] = 0; }
        else { pixels[idx] = 255; pixels[idx+1] = 255; pixels[idx+2] = 255; }
      }
    }

    // Build the PNG raw image data (filter byte 0 per scanline + pixel bytes)
    var rawRowLen = 1 + rowStride;
    var raw = new Uint8Array(rawRowLen * imgH);
    for (var y = 0; y < imgH; y++) {
      var outOff = y * rawRowLen;
      raw[outOff] = 0; // filter type 0 (none)
      raw.set(pixels.subarray(y * rowStride, (y+1) * rowStride), outOff + 1);
    }

    // Helper: Adler32 checksum for zlib footer
    function adler32(buf) {
      var a = 1, b = 0, MOD = 65521;
      for (var i = 0; i < buf.length; i++) { a = (a + (buf[i] & 0xFF)) % MOD; b = (b + a) % MOD; }
      return ((b << 16) >>> 0) | (a & 0xFFFF);
    }

    // Build zlib wrapper with uncompressed DEFLATE blocks
    var parts = [];
    // zlib header for no compression (CMF/FLG) - 0x78 0x01 is commonly used
    parts.push(0x78); parts.push(0x01);

    var pos = 0;
    var rawLen = raw.length;
    while (pos < rawLen) {
      var blockSize = Math.min(65535, rawLen - pos);
      var isLast = (pos + blockSize) >= rawLen;
      // DEFLATE uncompressed block header: 1 byte (BFINAL+BTYPE)
      parts.push(isLast ? 0x01 : 0x00);
      // LEN (little-endian)
      parts.push(blockSize & 0xFF);
      parts.push((blockSize >>> 8) & 0xFF);
      // NLEN (one's complement)
      var nlen = (~blockSize) & 0xFFFF;
      parts.push(nlen & 0xFF);
      parts.push((nlen >>> 8) & 0xFF);
      // data
      for (var i = 0; i < blockSize; i++) parts.push(raw[pos + i]);
      pos += blockSize;
    }

    var rawAdler = adler32(raw);
    parts.push((rawAdler >>> 24) & 0xFF);
    parts.push((rawAdler >>> 16) & 0xFF);
    parts.push((rawAdler >>> 8) & 0xFF);
    parts.push(rawAdler & 0xFF);

    var zlibData = new Uint8Array(parts.length);
    for (var i = 0; i < parts.length; i++) zlibData[i] = parts[i] & 0xFF;

    // PNG chunk helpers (CRC32)
    var crcTable = null;
    function makeCrcTable() {
      var c; crcTable = new Array(256);
      for (var n = 0; n < 256; n++) {
        c = n;
        for (var k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        crcTable[n] = c >>> 0;
      }
    }
    function crc32(buf) {
      if (!crcTable) makeCrcTable();
      var c = 0xFFFFFFFF;
      for (var i = 0; i < buf.length; i++) c = (crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)) >>> 0;
      return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function packChunk(typeStr, dataBuf) {
      var typeBytes = [];
      for (var i = 0; i < 4; i++) typeBytes.push(typeStr.charCodeAt(i));
      var len = dataBuf ? dataBuf.length : 0;
      var out = new Uint8Array(8 + len + 4);
      // length (big-endian)
      out[0] = (len >>> 24) & 0xFF; out[1] = (len >>> 16) & 0xFF; out[2] = (len >>> 8) & 0xFF; out[3] = len & 0xFF;
      // type
      for (var i = 0; i < 4; i++) out[4 + i] = typeBytes[i];
      // data
      if (dataBuf && dataBuf.length) out.set(dataBuf, 8);
      // CRC over type+data
      var crcInput = new Uint8Array(4 + len);
      for (var i = 0; i < 4; i++) crcInput[i] = typeBytes[i];
      if (dataBuf && dataBuf.length) crcInput.set(dataBuf, 4);
      var crc = crc32(crcInput);
      var crcOff = 8 + len;
      out[crcOff] = (crc >>> 24) & 0xFF; out[crcOff+1] = (crc >>> 16) & 0xFF; out[crcOff+2] = (crc >>> 8) & 0xFF; out[crcOff+3] = crc & 0xFF;
      return out;
    }

    // Build PNG bytes
    var sig = new Uint8Array([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
    // IHDR data
    var ihdr = new Uint8Array(13);
    ihdr[0] = (imgW >>> 24) & 0xFF; ihdr[1] = (imgW >>> 16) & 0xFF; ihdr[2] = (imgW >>> 8) & 0xFF; ihdr[3] = imgW & 0xFF;
    ihdr[4] = (imgH >>> 24) & 0xFF; ihdr[5] = (imgH >>> 16) & 0xFF; ihdr[6] = (imgH >>> 8) & 0xFF; ihdr[7] = imgH & 0xFF;
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // color type = truecolor RGB
    ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

    var ihdrChunk = packChunk('IHDR', ihdr);
    var idatChunk = packChunk('IDAT', zlibData);
    var iendChunk = packChunk('IEND', new Uint8Array(0));

    var pngLen = sig.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
    var png = new Uint8Array(pngLen);
    var off = 0; png.set(sig, off); off += sig.length;
    png.set(ihdrChunk, off); off += ihdrChunk.length;
    png.set(idatChunk, off); off += idatChunk.length;
    png.set(iendChunk, off); off += iendChunk.length;

    var b64 = Utilities.base64Encode(png);
    return 'data:image/png;base64,' + b64;
  };

  // Render a BMP data URI by rasterizing the QR matrix directly (24-bit BGR)
  ns.renderBmpDataUriForText = function(text, widthPx, options) {
    var opts = Object.assign({}, ns.defaultOptions, options || {});
    var enc = QrEncoder.encodeToMatrix(String(text || ''), 'M');
    var size = enc.size;
    var margin = Math.max(0, (opts.marginModules | 0));
    var scale = Math.max(1, Math.floor((widthPx || 600) / (size + margin * 2)));
    var imgW = (size + margin * 2) * scale;
    var imgH = imgW;
    var rowStride = ((imgW * 3 + 3) & ~3); // pad to 4-byte boundary
    var pixelDataSize = rowStride * imgH;
    var dibHeaderSize = 40;
    var fileHeaderSize = 14;
    var fileSize = fileHeaderSize + dibHeaderSize + pixelDataSize;
    var buf = new Uint8Array(fileSize);

    function writeU16LE(off, val) { buf[off] = val & 0xFF; buf[off+1] = (val >>> 8) & 0xFF; }
    function writeU32LE(off, val) { buf[off] = val & 0xFF; buf[off+1] = (val >>> 8) & 0xFF; buf[off+2] = (val >>> 16) & 0xFF; buf[off+3] = (val >>> 24) & 0xFF; }

    // BMP file header
    buf[0] = 0x42; buf[1] = 0x4D; // 'BM'
    writeU32LE(2, fileSize);
    writeU16LE(6, 0);
    writeU16LE(8, 0);
    writeU32LE(10, fileHeaderSize + dibHeaderSize);
    // DIB header (BITMAPINFOHEADER)
    writeU32LE(14, dibHeaderSize);
    writeU32LE(18, imgW);
    writeU32LE(22, imgH);
    writeU16LE(26, 1); // planes
    writeU16LE(28, 24); // bpp
    writeU32LE(30, 0); // BI_RGB
    writeU32LE(34, pixelDataSize);
    writeU32LE(38, 2835); // 72 DPI
    writeU32LE(42, 2835);
    writeU32LE(46, 0);
    writeU32LE(50, 0);

    // Pixel data (bottom-up rows). Background white, modules black.
    for (var yImg = 0; yImg < imgH; yImg++) {
      var rowStart = fileHeaderSize + dibHeaderSize + (imgH - 1 - yImg) * rowStride;
      var yModule = Math.floor(yImg / scale) - margin;
      for (var xImg = 0; xImg < imgW; xImg++) {
        var xModule = Math.floor(xImg / scale) - margin;
        var isDark = false;
        if (xModule >= 0 && xModule < size && yModule >= 0 && yModule < size) {
          isDark = !!enc.modules[yModule][xModule];
        }
        var idx = rowStart + xImg * 3;
        if (isDark) { buf[idx] = 0; buf[idx+1] = 0; buf[idx+2] = 0; }
        else { buf[idx] = 255; buf[idx+1] = 255; buf[idx+2] = 255; }
      }
      // padding is already zero-initialized
    }

    var b64 = Utilities.base64Encode(buf);
    return 'data:image/bmp;base64,' + b64;
  };

  function escapeXml(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  }

})(QrRenderer);


