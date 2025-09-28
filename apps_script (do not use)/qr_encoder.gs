// QR encoder (DIY) — produces a boolean module matrix for a given text.
// Exposes: QrEncoder.encodeToMatrix(text, ecc)
//
// Notes:
// - This is a self-contained QR Code generator adapted for Apps Script.
// - Error correction level defaults to 'L'. Supported values: 'L','M','Q','H'.
// - Output: { size: number, modules: boolean[][] } where true = dark module.

var QrEncoder = (function() {
  // Polyfill for Math.clz32 for older JS environments
  if (!Math.clz32) {
    Math.clz32 = function(x) {
      x = x >>> 0;
      if (x === 0) return 32;
      var n = 0;
      if ((x & 0xFFFF0000) === 0) { n += 16; x <<= 16; }
      if ((x & 0xFF000000) === 0) { n += 8; x <<= 8; }
      if ((x & 0xF0000000) === 0) { n += 4; x <<= 4; }
      if ((x & 0xC0000000) === 0) { n += 2; x <<= 2; }
      if ((x & 0x80000000) === 0) { n += 1; }
      return n;
    };
  }

  // Implementation based on Project Nayuki's public-domain qrcodegen algorithm,
  // adapted and simplified for Apps Script server-side execution.

  // ----- Private -----
  
  function QrEncoder() {
    // QrEncoder constructor, can be used to pass in a logger prefix for tests
    this.logPrefix = '';
  }
  
  QrEncoder.prototype.encode = function(text, ecc, typeNumber) {
    // This method is now the main entry point for the encoder instance.
    // It mirrors the third-party library's constructor for easier comparison.
    var eccLevel = parseEcc(ecc || 'H');
    var segs = [makeBytes(toUtf8Bytes(String(text)))];
    var qr = this.encodeSegments(segs, eccLevel, typeNumber || 1, -1, 40, true);
    // In a real scenario, we'd return the QR code data. For now, this is for testing.
    return qr;
  };

  // Backwards-compatible static function used by renderer/tests
  QrEncoder.encodeToMatrix = function(text, ecc) {
    var instance = new QrEncoder();
    var qr = instance.encode(text, ecc, 1);
    return { size: qr.size, modules: qr.modules };
  };
  
  QrEncoder.prototype.encodeSegments = function(segs, ecl, minVer, mask, maxVer, boostEcl) {
    if (minVer < 1 || maxVer > 40 || minVer > maxVer) throw new Error('Bad version');
    var ver, dataUsedBits;
    for (ver = minVer; ; ver++) {
      var dataCapacityBits = getNumDataCodewords(ver, ecl) * 8;
      var dataBitLen = this.getTotalBits(segs, ver);
      if (dataBitLen <= dataCapacityBits) { dataUsedBits = dataBitLen; break; }
      if (ver >= maxVer) throw new Error('Data too long');
    }

    var data = new BitBuffer();
    for (var i = 0; i < segs.length; i++) this.appendSegmentBytes(segs[i], data, ver);
    Logger.log(this.logPrefix + '1. After segment bytes: ' + data.getBytes().join(','));

    var capacity = getNumDataCodewords(ver, ecl) * 8;
    data.appendBits(0, Math.min(4, capacity - data.length));
    Logger.log(this.logPrefix + '2. After terminator: ' + data.getBytes().join(','));

    // Pad to next byte boundary
    while (data.getLengthInBits() % 8 !== 0) data.appendBits(0, 1);
    Logger.log(this.logPrefix + '3. After padding to byte boundary: ' + data.getBytes().join(','));

    // Fill remaining capacity with PAD0/PAD1 bytes (0xEC,0x11) directly into the bit buffer
    while (data.getLengthInBits() < capacity) {
      data.appendBits(0xEC, 8);
      if (data.getLengthInBits() >= capacity) break;
      data.appendBits(0x11, 8);
    }

    var bytes = data.getBytes();
    var numDataBytes = Math.min(bytes.length, Math.floor(capacity / 8));
    var dataBytes = bytes.slice(0, numDataBytes);
    Logger.log(this.logPrefix + 'Capacity bits: ' + capacity + ', numDataBytes: ' + numDataBytes + ', Final data bytes before ECC: ' + dataBytes.join(','));

    var qr = new QrCode(ver, ecl, this.logPrefix);
    qr.drawCodewords(dataBytes);
    qr.applyBestMask(mask);
    return qr;
  };

  QrEncoder.prototype.getTotalBits = function(segs, ver) {
    var result = 0;
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      result += 4 + getCharCountBits(seg.mode, ver) + seg.data.length * 8;
    }
    return result;
  }

  QrEncoder.prototype.appendSegmentBytes = function(seg, bb, ver) {
    bb.appendBits(Mode.BYTE, 4);
    bb.appendBits(seg.numChars, getCharCountBits(seg.mode, ver));
    for (var i = 0; i < seg.data.length; i++) bb.appendBits(seg.data[i], 8);
  }

  // ----- Utilities -----
  function parseEcc(ecc) {
    switch ((ecc || 'L').toUpperCase()) {
      case 'L': return ECC_LOW;
      case 'M': return ECC_MEDIUM;
      case 'Q': return ECC_QUARTILE;
      case 'H': return ECC_HIGH;
      default: return ECC_LOW;
    }
  }

  function toUtf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) {
        out.push(code);
      } else if (code < 0x800) {
        out.push(0xC0 | (code >>> 6));
        out.push(0x80 | (code & 0x3F));
      } else if (code < 0xD800 || code >= 0xE000) {
        out.push(0xE0 | (code >>> 12));
        out.push(0x80 | ((code >>> 6) & 0x3F));
        out.push(0x80 | (code & 0x3F));
      } else {
        // surrogate pair
        i++;
        var code2 = str.charCodeAt(i);
        var u = 0x10000 + (((code & 0x3FF) << 10) | (code2 & 0x3FF));
        out.push(0xF0 | (u >>> 18));
        out.push(0x80 | ((u >>> 12) & 0x3F));
        out.push(0x80 | ((u >>> 6) & 0x3F));
        out.push(0x80 | (u & 0x3F));
      }
    }
    return out;
  }

  // ----- qrcodegen core (trimmed) -----
  var ECC_LOW     = { ordinal: 0, percent: 7, name: 'L' };
  var ECC_MEDIUM  = { ordinal: 1, percent: 15, name: 'M' };
  var ECC_QUARTILE= { ordinal: 2, percent: 25, name: 'Q' };
  var ECC_HIGH    = { ordinal: 3, percent: 30, name: 'H' };

  var Mode = { BYTE: 4 };

  function makeBytes(data) {
    return { mode: Mode.BYTE, numChars: data.length, data: data };
  }

  function getNumRawDataModules(ver) {
    var size = ver * 4 + 17;
    var result = size * size - (8 * 8 * 3 + 2 * 15 + 2 * 5 + (ver >= 7 ? 36 : 0));
    var numAlign = (ver === 1) ? 0 : Math.floor(ver / 7) + 2;
    if (numAlign > 0) {
      var step = (ver === 32) ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
      var alignCount = numAlign * numAlign - 3;
      result -= alignCount * 25;
      if (ver === 1) {}
    }
    return result;
  }

  function getNumDataCodewords(ver, ecl) {
    var total = Math.floor(getNumRawDataModules(ver) / 8);
    var ec = ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
    var numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
    return total - ec * numBlocks;
  }

  function getCharCountBits(mode, ver) {
    if (mode !== Mode.BYTE) throw new Error('Unsupported mode');
    if (ver <= 9) return 8;
    if (ver <= 26) return 16;
    return 16;
  }

  function BitBuffer() {
    this.bits = [];
    this.length = 0;
  }
  BitBuffer.prototype.appendBits = function(val, len) {
    for (var i = len - 1; i >= 0; i--) {
      this.bits.push(((val >>> i) & 1) !== 0);
      this.length++;
    }
  };
  BitBuffer.prototype.getBytes = function() {
    var out = [];
    var accum = 0, n = 0;
    for (var i = 0; i < this.bits.length; i++) {
      accum = (accum << 1) | (this.bits[i] ? 1 : 0);
      n++;
      if (n === 8) { out.push(accum); accum = 0; n = 0; }
    }
    if (n > 0) out.push(accum << (8 - n));
    return out;
  };
  BitBuffer.prototype.getLengthInBits = function() {
    return this.length;
  };

  function QrCode(ver, ecl, logPrefix) {
    this.version = ver;
    this.errorCorrectionLevel = ecl;
    this.size = ver * 4 + 17;
    this.modules = new Array(this.size);
    this.isFunction = new Array(this.size);
    this.logPrefix = logPrefix || '';
    for (var i = 0; i < this.size; i++) {
      this.modules[i] = new Array(this.size);
      this.isFunction[i] = new Array(this.size);
    }
    drawFunctionPatterns(this);
  }

  QrCode.prototype.drawCodewords = function(data) {
    var ver = this.version;
    var ecl = this.errorCorrectionLevel;
    var blocks = makeBlocks(data, ver, ecl, this.logPrefix);
    var codewords = interleaveBlocks(blocks);
    var i = 0;
    for (var right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right -= 1;
      for (var vert = 0; vert < this.size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? (this.size - 1 - vert) : vert;
          if (!this.isFunction[y][x] && i < codewords.length * 8) {
            this.modules[y][x] = (((codewords[Math.floor(i / 8)] >>> (7 - (i % 8))) & 1) !== 0);
            i++;
          }
        }
      }
    }
  };

  QrCode.prototype.applyBestMask = function(mask) {
    var minPenalty = 1e9;
    var bestMask = 0;
    for (var m = 0; m < 8; m++) {
      if (mask !== -1 && mask !== 0 && m !== (mask - 1)) continue;
      var qr = cloneQr(this);
      applyMask(qr, m);
      drawFormatBits(qr, m);
      var penalty = getPenaltyScore(qr);
      if (penalty < minPenalty) { minPenalty = penalty; bestMask = m; this.modules = qr.modules; }
    }
  };

  function cloneQr(qr) {
    var out = new QrCode(qr.version, qr.errorCorrectionLevel);
    for (var y = 0; y < qr.size; y++) {
      for (var x = 0; x < qr.size; x++) {
        out.modules[y][x] = qr.modules[y][x];
        out.isFunction[y][x] = qr.isFunction[y][x];
      }
    }
    return out;
  }

  function drawFunctionPatterns(qr) {
    var size = qr.size;
    for (var i = 0; i < size; i++) {
      setFunctionModule(qr, 6, i, i % 2 === 0);
      setFunctionModule(qr, i, 6, i % 2 === 0);
    }
    drawFinderPattern(qr, 3, 3);
    drawFinderPattern(qr, size - 4, 3);
    drawFinderPattern(qr, 3, size - 4);
    var alignPatPos = getAlignmentPatternPositions(qr.version);
    for (var i = 0; i < alignPatPos.length; i++) {
      for (var j = 0; j < alignPatPos.length; j++) {
        var x = alignPatPos[i], y = alignPatPos[j];
        if (!(x === 6 && y === 6) && !(x === 6 && y === size - 7) && !(x === size - 7 && y === 6))
          drawAlignmentPattern(qr, x, y);
      }
    }
    drawVersion(qr);
  }

  function setFunctionModule(qr, x, y, isDark) {
    qr.modules[y][x] = isDark;
    qr.isFunction[y][x] = true;
  }

  function drawFinderPattern(qr, x, y) {
    for (var dy = -4; dy <= 4; dy++) {
      for (var dx = -4; dx <= 4; dx++) {
        var dist = Math.max(Math.abs(dx), Math.abs(dy));
        var xx = x + dx, yy = y + dy;
        if (0 <= xx && xx < qr.size && 0 <= yy && yy < qr.size)
          setFunctionModule(qr, xx, yy, dist !== 2 && dist !== 4);
      }
    }
  }

  function drawAlignmentPattern(qr, x, y) {
    for (var dy = -2; dy <= 2; dy++) {
      for (var dx = -2; dx <= 2; dx++) {
        setFunctionModule(qr, x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  function drawVersion(qr) {
    var ver = qr.version;
    if (ver < 7) return;
    var rem = ver;
    var bits = 0;
    for (var i = 0; i < 12; i++) bits = (bits << 1) | (rem & 1), rem >>>= 1;
    bits = (bits << 12) | getBchCode(bits, 0x1F25);
    for (var i = 0; i < 18; i++) {
      var bit = ((bits >>> i) & 1) !== 0;
      var a = qr.size - 11 + (i % 3), b = Math.floor(i / 3);
      setFunctionModule(qr, a, b, bit);
      setFunctionModule(qr, b, a, bit);
    }
  }

  function drawFormatBits(qr, mask) {
    var data = (qr.errorCorrectionLevel.ordinal << 3) | mask;
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >>> 9) * 0x537) & 0x7FF);
    data = ((data << 10) | rem) ^ 0x5412;
    for (var i = 0; i < 15; i++) {
      var bit = ((data >>> i) & 1) !== 0;
      if (i < 6) setFunctionModule(qr, 8, i, bit);
      else if (i < 8) setFunctionModule(qr, 8, i + 1, bit);
      else setFunctionModule(qr, 8, qr.size - 15 + i, bit);
      if (i < 8) setFunctionModule(qr, qr.size - i - 1, 8, bit);
      else setFunctionModule(qr, 14 - i, 8, bit);
    }
    setFunctionModule(qr, 8, qr.size - 8, true);
  }

  function applyMask(qr, mask) {
    for (var y = 0; y < qr.size; y++) {
      for (var x = 0; x < qr.size; x++) {
        if (!qr.isFunction[y][x]) {
          var invert = false;
          switch (mask) {
            case 0: invert = ((x + y) % 2) === 0; break;
            case 1: invert = (y % 2) === 0; break;
            case 2: invert = (x % 3) === 0; break;
            case 3: invert = ((x + y) % 3) === 0; break;
            case 4: invert = (((Math.floor(y / 2) + Math.floor(x / 3)) % 2) === 0); break;
            case 5: invert = (((x * y) % 2) + ((x * y) % 3) === 0); break;
            case 6: invert = ((((x * y) % 2) + ((x * y) % 3)) % 2 === 0); break;
            case 7: invert = ((((x + y) % 2) + ((x * y) % 3)) % 2 === 0); break;
          }
          qr.modules[y][x] = qr.modules[y][x] ^ invert;
        }
      }
    }
  }

  function getPenaltyScore(qr) {
    var result = 0;
    // Adjacent modules in row having same color
    for (var y = 0; y < qr.size; y++) {
      var runColor = false;
      var runLen = 0;
      for (var x = 0; x < qr.size; x++) {
        var color = qr.modules[y][x];
        if (x === 0 || color !== runColor) { runColor = color; runLen = 1; }
        else { runLen++; if (runLen === 5) result += 3; else if (runLen > 5) result++; }
      }
    }
    // Columns
    for (var x = 0; x < qr.size; x++) {
      var runColor2 = false;
      var runLen2 = 0;
      for (var y = 0; y < qr.size; y++) {
        var color2 = qr.modules[y][x];
        if (y === 0 || color2 !== runColor2) { runColor2 = color2; runLen2 = 1; }
        else { runLen2++; if (runLen2 === 5) result += 3; else if (runLen2 > 5) result++; }
      }
    }
    // Finder-like patterns in rows
    for (var y = 0; y < qr.size; y++) result += countFinderLike(qr.modules[y]);
    // Finder-like patterns in columns
    for (var x = 0; x < qr.size; x++) {
      var col = [];
      for (var y = 0; y < qr.size; y++) col.push(qr.modules[y][x]);
      result += countFinderLike(col);
    }
    // Balance of dark modules
    var dark = 0;
    for (var y = 0; y < qr.size; y++) for (var x = 0; x < qr.size; x++) if (qr.modules[y][x]) dark++;
    var total = qr.size * qr.size;
    var k = Math.abs(Math.floor(dark * 20 / total) - 10);
    result += k * 10;
    return result;
  }

  function countFinderLike(arr) {
    var result = 0;
    for (var i = 0, run = 0, color = false; i < arr.length; i++) {
      if (i === 0 || arr[i] !== color) { color = arr[i]; run = 1; }
      else run++;
      if (i >= 6 && run >= 5 && !color && arr[i-4] && !arr[i-3] && arr[i-2] && !arr[i-1]) result += 40;
    }
    return result;
  }

  function interleaveBlocks(blocks) {
    var result = [];
    var maxLen = 0;
    for (var i = 0; i < blocks.length; i++) if (blocks[i].length > maxLen) maxLen = blocks[i].length;
    for (var i = 0; i < maxLen; i++) {
      for (var j = 0; j < blocks.length; j++) if (i < blocks[j].length) result.push(blocks[j][i]);
    }
    return result;
  }

  function makeBlocks(dataBytes, ver, ecl, logPrefix) {
    var numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
    var totalEc = ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
    var numData = getNumDataCodewords(ver, ecl);
    var shortBlockLen = Math.floor(numData / numBlocks);
    var longBlocks = numData % numBlocks;
    var blocks = [];
    var k = 0;
    Logger.log((logPrefix || '') + 'ECC blocks for v' + ver + ' ' + ecl.name + ': ' + numBlocks + ' blocks, ' + totalEc + ' EC codewords/block');
    for (var i = 0; i < numBlocks; i++) {
      var datCount = shortBlockLen + (i < longBlocks ? 1 : 0);
      var dat = dataBytes.slice(k, k + datCount);
      k += datCount;
      var ec = reedSolomonComputeRemainder(dat, totalEc);
      Logger.log((logPrefix || '') + '  Block ' + (i+1) + ': data=' + dat.join(',') + ' | ec=' + ec.join(','));
      blocks.push(dat.concat(ec));
    }
    return blocks;
  }

  function reedSolomonComputeRemainder(data, ecLen) {
    var gf = new GF256(0x11D);
    var poly = gf.makeGenerator(ecLen);
    var rem = new Array(ecLen).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ rem[0];
      rem.shift(); rem.push(0);
      if (factor !== 0) {
        for (var j = 0; j < ecLen; j++) rem[j] ^= gf.mul(poly[j], factor);
      }
    }
    return rem;
  }

  function GF256(prim) {
    this.prim = prim;
    this.exp = new Array(512);
    this.log = new Array(256);
    var x = 1;
    for (var i = 0; i < 255; i++) {
      this.exp[i] = x;
      this.log[x] = i;
      x = this.mulNoLUT(x, 2);
    }
    for (var i = 255; i < 512; i++) this.exp[i] = this.exp[i - 255];
  }
  GF256.prototype.mulNoLUT = function(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * this.prim);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  };
  GF256.prototype.mul = function(x, y) {
    if (x === 0 || y === 0) return 0;
    return this.exp[this.log[x] + this.log[y]];
  };
  GF256.prototype.makeGenerator = function(degree) {
    var result = [1];
    for (var i = 0; i < degree; i++) {
      var next = new Array(result.length + 1).fill(0);
      for (var j = 0; j < result.length; j++) {
        next[j] ^= this.mul(result[j], this.exp[i]);
        next[j+1] ^= result[j];
      }
      result = next;
    }
    return result;
  };

  function getAlignmentPatternPositions(ver) {
    if (ver === 1) return [];
    var num = Math.floor(ver / 7) + 2;
    var step = (ver === 32) ? 26 : Math.ceil((ver * 4 + 4) / (num * 2 - 2)) * 2;
    var result = [6];
    var pos = ver * 4 + 10;
    while (result.length < num) {
      result.push(pos);
      pos -= step;
    }
    return result.reverse();
  }

  function getBchCode(val, poly) {
    var msb = 31 - Math.clz32(poly);
    val <<= msb - 1;
    while (true) {
      var shift = 0;
      var temp = val;
      while (temp > 0) {
        temp >>>= 1;
        shift++;
      }
      shift -= 1;
      if (shift >= msb) {
        val ^= poly << (shift - msb);
      } else {
        break;
      }
    }
    return val;
  }

  // Tables from spec (index by [ECL][version])
  var ECC_CODEWORDS_PER_BLOCK = [
    [null, 7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [null,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
    [null,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [null,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]
  ];
  var NUM_ERROR_CORRECTION_BLOCKS = [
    [null, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [null, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [null, 1, 1, 2, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 19, 21, 23, 25, 27, 28, 30, 33, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
    [null, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 12, 16, 18, 19, 21, 24, 26, 28, 31, 33, 36, 39, 42, 45, 48, 52, 55, 59, 62, 66, 70, 74, 78, 82, 86, 91, 95, 100, 104]
  ];

  return QrEncoder;
})();


