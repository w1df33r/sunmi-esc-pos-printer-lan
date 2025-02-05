export enum MaxColumns {
  MAX_COLUMNS = 6, // Maximum columns for printing in columns function
}

export enum Alignment {
  LEFT = 0, // Left alignment
  CENTER = 1, // Center alignment
  RIGHT = 2, // Right alignment
}

export enum HriPosition {
  ABOVE = 1, // HRI above the barcode
  BELOW = 2, // HRI below the barcode
}

export class EscPosPrinter {
  private widthOfColumns: number[] = new Array(MaxColumns.MAX_COLUMNS);
  private orderData: string = '';
  private charHSize: number = 1;
  public readonly dotsPerLine: number;

  /**
   * Creates an instance of EscPosPrinter.
   *
   * @param dotsPerLine - The print width in dots. Acceptable values are 384 for 58mm and 576 for 80mm.
   *                      If an invalid value is provided, it defaults to 384.
   */
  constructor(dotsPerLine: number = 576) {
    if (dotsPerLine !== 384 && dotsPerLine !== 576) {
      // Print width in dots. 384 for 58mm and 576 for 80mm
      this.dotsPerLine = 384;
    } else {
      this.dotsPerLine = dotsPerLine;
    }
  }

  private static numToHexStr(n: number, bytes: number): string {
    let str = '';
    let v;

    for (let i = 0; i < bytes; i++) {
      v = n & 0xff;
      if (v < 0x10) str += '0' + v.toString(16);
      else str += v.toString(16);
      n >>= 8;
    }
    return str;
  }

  private static unicodeToUtf8(unicode: number): string {
    let c1, c2, c3, c4;

    if (unicode < 0) return '';
    if (unicode <= 0x7f) {
      c1 = unicode & 0x7f;
      return EscPosPrinter.numToHexStr(c1, 1);
    }
    if (unicode <= 0x7ff) {
      c1 = ((unicode >> 6) & 0x1f) | 0xc0;
      c2 = (unicode & 0x3f) | 0x80;
      return (
        EscPosPrinter.numToHexStr(c1, 1) + EscPosPrinter.numToHexStr(c2, 1)
      );
    }
    if (unicode <= 0xffff) {
      c1 = ((unicode >> 12) & 0x0f) | 0xe0;
      c2 = ((unicode >> 6) & 0x3f) | 0x80;
      c3 = (unicode & 0x3f) | 0x80;
      return (
        EscPosPrinter.numToHexStr(c1, 1) +
        EscPosPrinter.numToHexStr(c2, 1) +
        EscPosPrinter.numToHexStr(c3, 1)
      );
    }
    if (unicode <= 0x10ffff) {
      c1 = ((unicode >> 18) & 0x07) | 0xf0;
      c2 = ((unicode >> 12) & 0x3f) | 0x80;
      c3 = ((unicode >> 6) & 0x3f) | 0x80;
      c4 = (unicode & 0x3f) | 0x80;
      return (
        EscPosPrinter.numToHexStr(c1, 1) +
        EscPosPrinter.numToHexStr(c2, 1) +
        EscPosPrinter.numToHexStr(c3, 1) +
        EscPosPrinter.numToHexStr(c4, 1)
      );
    }
    return '';
  }

  // Print the order data.
  public async print(
    host: string,
    sn: string,
    copies: number,
  ): Promise<{ status: number; response: string; taskId?: string }> {
    // const protocol = window.location.protocol == 'https:' ? 'https' : 'http';
    const protocol = 'http';

    const url = `${protocol}://${host}/cgi-bin/print.cgi?sn=${sn}&copies=${copies}`;
    const headers = new Headers({
      'Content-Type': 'text/plain; charset=utf-8',
    });

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: this.orderData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseText = await response.text();
    const re = /task_id: (\d+)/;
    const matches = re.exec(responseText);
    const taskId = matches ? matches[1] : undefined;

    return {
      status: response.status,
      response: responseText,
      taskId,
    };
  }

  // Query print status.
  public async queryStatus(
    host: string,
    sn: string,
    task_id: string,
  ): Promise<{ status: number; response: unknown }> {
    const url = `http://${host}/cgi-bin/status.cgi?sn=${sn}&task_id=${task_id}`;
    const headers = new Headers({
      'Content-Type': 'text/plain; charset=utf-8',
    });

    const response = await fetch(url, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseText = await response.text();

    let responseObj: unknown = {};
    if (response.status === 200 && responseText) {
      responseObj = responseText.split('\n').reduce(
        (acc, line) => {
          const [key, value] = line.split(':').map((str) => str.trim());
          if (key && value) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, string>,
      );
    }

    return {
      status: response.status,
      response: responseObj,
    };
  }

  // Clear the generated order data.
  public clear(): void {
    this.orderData = '';
  }

  //////////////////////////////////////////////////
  // Basic ESC/POS Commands
  //////////////////////////////////////////////////

  // Append text in the order.
  public appendText(str: string): void {
    for (let i = 0; i < str.length; i++)
      this.orderData += EscPosPrinter.unicodeToUtf8(str.charCodeAt(i));
  }

  // [LF] Print the contents in the buffer and feed n lines.
  public lineFeed(n: number): void {
    for (let i = 0; i < n; i++) this.orderData += '0a';
  }

  // [ESC @] Restore default settings (line spacing, print modes, etc).
  public restoreDefaultSettings(): void {
    this.charHSize = 1;
    this.orderData += '1b40';
  }

  // [ESC 2] Restore default line spacing.
  public restoreDefaultLineSpacing(): void {
    this.orderData += '1b32';
  }

  // [ESC 3] Set line spacing.
  public setLineSpacing(n: number): void {
    if (n >= 0 && n <= 255)
      this.orderData += '1b33' + EscPosPrinter.numToHexStr(n, 1);
  }

  // [ESC !] Select print modes (double width/height or not, bold or not).
  public setPrintModes(
    bold: boolean,
    double_h: boolean,
    double_w: boolean,
  ): void {
    let n = 0;

    if (bold) n |= 8;
    if (double_h) n |= 16;
    if (double_w) n |= 32;
    this.charHSize = double_w ? 2 : 1;
    this.orderData += '1b21' + EscPosPrinter.numToHexStr(n, 1);
  }

  // [GS !] Set character size (1~8 times of normal width or height).
  public setCharacterSize(h: number, w: number): void {
    let n = 0;

    if (h >= 1 && h <= 8) n |= h - 1;
    if (w >= 1 && w <= 8) {
      n |= (w - 1) << 4;
      this.charHSize = w;
    }
    this.orderData += '1d21' + EscPosPrinter.numToHexStr(n, 1);
  }

  // [HT] Jump to the next n TAB positions.
  public horizontalTab(n: number): void {
    for (let i = 0; i < n; i++) this.orderData += '09';
  }

  // [ESC $] Move to horizontal absolute position.
  public setAbsolutePrintPosition(n: number): void {
    if (n >= 0 && n <= 65535)
      this.orderData += '1b24' + EscPosPrinter.numToHexStr(n, 2);
  }

  // [ESC \] Move to horizontal relative position.
  public setRelativePrintPosition(n: number): void {
    if (n >= -32768 && n <= 32767)
      this.orderData += '1b5c' + EscPosPrinter.numToHexStr(n, 2);
  }

  // [ESC a] Set alignment.
  public setAlignment(n: number): void {
    if (n >= 0 && n <= 2)
      this.orderData += '1b61' + EscPosPrinter.numToHexStr(n, 1);
  }

  // [GS V m] Cut paper.
  public cutPaper(fullCut: boolean): void {
    this.orderData += '1d56' + (fullCut ? '30' : '31');
  }

  // [GS V m n] Postponed cut paper.
  public postponedCutPaper(fullCut: boolean, n: number): void {
    if (n >= 0 && n <= 255)
      this.orderData +=
        '1d56' + (fullCut ? '61' : '62') + EscPosPrinter.numToHexStr(n, 1);
  }

  //////////////////////////////////////////////////
  // Print in Columns
  //////////////////////////////////////////////////

  // Return the width of a character.
  // private static widthOfChar(c: number): number {
  //   // Adjust the width calculation for Thai, Lao, Russian, and other characters
  //   if (
  //     (c >= 0x0020 && c <= 0x007e) || // Basic Latin
  //     (c >= 0x00a0 && c <= 0x00ff) || // Latin-1 Supplement
  //     (c >= 0x0100 && c <= 0x017f) || // Latin Extended-A
  //     (c >= 0x0180 && c <= 0x024f) || // Latin Extended-B
  //     (c >= 0x0400 && c <= 0x04ff) || // Cyrillic (Russian)
  //     (c >= 0x0e00 && c <= 0x0e7f) || // Thai
  //     (c >= 0x0e80 && c <= 0x0eff) // Lao
  //   ) {
  //     return 12;
  //   }
  //   if (
  //     c == 0x2010 ||
  //     (c >= 0x2013 && c <= 0x2016) ||
  //     (c >= 0x2018 && c <= 0x2019) ||
  //     (c >= 0x201c && c <= 0x201d) ||
  //     (c >= 0x2025 && c <= 0x2026) ||
  //     (c >= 0x2030 && c <= 0x2033) ||
  //     c == 0x2035 ||
  //     c == 0x203b
  //   ) {
  //     return 24;
  //   }
  //   if (
  //     (c >= 0x1100 && c <= 0x11ff) || // Hangul Jamo
  //     (c >= 0x2460 && c <= 0x24ff) || // Enclosed Alphanumerics
  //     (c >= 0x25a0 && c <= 0x27bf) || // Geometric Shapes
  //     (c >= 0x2e80 && c <= 0x2fdf) || // CJK Radicals Supplement
  //     (c >= 0x3000 && c <= 0x318f) || // CJK Symbols and Punctuation
  //     (c >= 0x31a0 && c <= 0x31ef) || // Bopomofo Extended
  //     (c >= 0x3200 && c <= 0x9fff) || // CJK Unified Ideographs
  //     (c >= 0xac00 && c <= 0xd7ff) || // Hangul Syllables
  //     (c >= 0xf900 && c <= 0xfaff) || // CJK Compatibility Ideographs
  //     (c >= 0xfe30 && c <= 0xfe4f) || // CJK Compatibility Forms
  //     (c >= 0x1f000 && c <= 0x1f9ff) // Enclosed Alphanumeric Supplement
  //   ) {
  //     return 24;
  //   }
  //   if ((c >= 0xff01 && c <= 0xff5e) || (c >= 0xffe0 && c <= 0xffe5)) {
  //     return 24;
  //   }
  //   return 12; // Default to a standard width for unknown characters
  // }
  private static widthOfChar(c: number): number {
    // Basic Latin and Latin-1 Supplement (Single-byte characters)
    if (c >= 0x0020 && c <= 0x00ff) return 12;

    // CJK
    if (
      c === 0x02010 ||
      (c >= 0x02013 && c <= 0x02016) ||
      (c >= 0x02018 && c <= 0x02019) ||
      (c >= 0x0201c && c <= 0x0201d) ||
      (c >= 0x02025 && c <= 0x02026) ||
      (c >= 0x02030 && c <= 0x02033) ||
      c === 0x02035 ||
      c === 0x0203b
    )
      return 24;
    if (
      (c >= 0x01100 && c <= 0x011ff) ||
      (c >= 0x02460 && c <= 0x024ff) ||
      (c >= 0x025a0 && c <= 0x027bf) ||
      (c >= 0x02e80 && c <= 0x02fdf) ||
      (c >= 0x03000 && c <= 0x0318f) ||
      (c >= 0x031a0 && c <= 0x031ef) ||
      (c >= 0x03200 && c <= 0x09fff) ||
      (c >= 0x0ac00 && c <= 0x0d7ff) ||
      (c >= 0x0f900 && c <= 0x0faff) ||
      (c >= 0x0fe30 && c <= 0x0fe4f) ||
      (c >= 0x1f000 && c <= 0x1f9ff)
    )
      return 24;

    if ((c >= 0x0ff01 && c <= 0x0ff5e) || (c >= 0x0ffe0 && c <= 0x0ffe5))
      return 24;

    // Other characters (including Thai, Lao, Russian, etc.)
    if (
      (c >= 0x0100 && c <= 0x017f) || // Latin Extended-A
      (c >= 0x0180 && c <= 0x024f) || // Latin Extended-B
      (c >= 0x0400 && c <= 0x04ff) || // Cyrillic
      (c >= 0x0e00 && c <= 0x0e7f) || // Thai
      (c >= 0x0e80 && c <= 0x0eff) // Lao
    )
      return 20; // A middle ground width

    // Default width for any undefined characters
    return 20; // A middle ground width
  }

  static columnWidthWithAlignment(width: number, alignment: number): number {
    return (width & 0xffff) | ((alignment & 3) << 16);
  }

  private static columnWidth(v: number): number {
    return v & 0xffff;
  }

  private static columnAlignment(v: number): number {
    return (v >> 16) & 3;
  }

  // Set the width and alignment mode for each column.
  public setColumnWidths(...args: number[]): void {
    let alignment, i, remain, width;

    if (arguments.length === 0) return;
    for (i = 0; i < MaxColumns.MAX_COLUMNS; i++) this.widthOfColumns[i] = 0;

    remain = this.dotsPerLine; // Dots not used
    for (i = 0; i < arguments.length; i++) {
      if (i === MaxColumns.MAX_COLUMNS)
        // Maximum columns exceeded
        return;
      width = EscPosPrinter.columnWidth(args[i]);
      alignment = EscPosPrinter.columnAlignment(args[i]);
      if (width === 0 || width > remain) {
        // Use all free dots for the last column
        this.widthOfColumns[i] = EscPosPrinter.columnWidthWithAlignment(
          remain,
          alignment,
        );
        return;
      }
      this.widthOfColumns[i] = args[i];
      remain -= width;
    }
  }

  // Print in columns with the current column settings.
  public printInColumns(...args: string[]): void {
    const strcurr = new Array(MaxColumns.MAX_COLUMNS);
    const strrem = new Array(MaxColumns.MAX_COLUMNS);
    const strwidth = new Array(MaxColumns.MAX_COLUMNS);
    let i, j, c, w, columns, width, alignment, pos;
    let done;

    if (args.length === 0) return;

    columns = 0;
    for (i = 0; i < args.length; i++) {
      if (i === MaxColumns.MAX_COLUMNS || this.widthOfColumns[i] === 0) break;
      strcurr[i] = '';
      strrem[i] = args[i];
      columns++;
    }

    do {
      done = true;
      pos = 0;
      for (i = 0; i < columns; i++) {
        width = EscPosPrinter.columnWidth(this.widthOfColumns[i]);
        if (strrem[i].length === 0) {
          pos += width;
          continue;
        }
        done = false;
        strcurr[i] = '';
        strwidth[i] = 0;
        for (j = 0; j < strrem[i].length; j++) {
          c = strrem[i].charCodeAt(j);
          if (c === 0x0a) {
            // Line feed
            j++; // Drop the '\n'
            break;
          } else {
            w = EscPosPrinter.widthOfChar(c);
            if (w === 0) {
              c = '?'.charCodeAt(0);
              w = 20; // Adjust to a middle ground width
            }
            w *= this.charHSize;
            if (strwidth[i] + w > width) {
              break;
            } else {
              strcurr[i] += String.fromCharCode(c);
              strwidth[i] += w;
            }
          }
        }
        if (j < strrem[i].length) strrem[i] = strrem[i].substring(j);
        else strrem[i] = '';

        alignment = EscPosPrinter.columnAlignment(this.widthOfColumns[i]);
        switch (alignment) {
          case Alignment.CENTER:
            this.setAbsolutePrintPosition(
              pos + Math.round((width - strwidth[i]) / 2),
            );
            break;
          case Alignment.RIGHT:
            this.setAbsolutePrintPosition(pos + (width - strwidth[i]));
            break;
          default:
            this.setAbsolutePrintPosition(pos);
            break;
        }
        this.appendText(strcurr[i]);
        pos += width;
      }
      if (!done) this.lineFeed(1);
    } while (!done);
  }

  //////////////////////////////////////////////////
  // Barcode / QR Code Printing
  //////////////////////////////////////////////////

  // Append barcode in the order.
  public appendBarcode(
    hri_pos: number,
    height: number,
    module_size: number,
    barcode_type: number,
    text: string,
  ): void {
    let text_length = text.length;

    if (text_length === 0) return;
    if (text_length > 255) text_length = 255;
    if (height < 1) height = 1;
    else if (height > 255) height = 255;
    if (module_size < 1) module_size = 1;
    else if (module_size > 6) module_size = 6;

    this.orderData += `1d48${EscPosPrinter.numToHexStr(hri_pos & 3, 1)}`;
    this.orderData += '1d6600';
    this.orderData += `1d68${EscPosPrinter.numToHexStr(height, 1)}`;
    this.orderData += `1d77${EscPosPrinter.numToHexStr(module_size, 1)}`;
    this.orderData += `1d6b${EscPosPrinter.numToHexStr(
      barcode_type,
      1,
    )}${EscPosPrinter.numToHexStr(text_length, 1)}`;
    for (let i = 0; i < text_length; i++) {
      this.orderData += EscPosPrinter.numToHexStr(text.charCodeAt(i), 1);
    }
  }

  // Append QR code in the order.
  public appendQRcode(
    module_size: number,
    ec_level: number,
    text: string,
  ): void {
    let text_length = text.length;

    if (text_length === 0) return;
    if (text_length > 65535) text_length = 65535;
    if (module_size < 1) module_size = 1;
    else if (module_size > 16) module_size = 16;
    if (ec_level < 0) ec_level = 0;
    else if (ec_level > 3) ec_level = 3;

    this.orderData += '1d286b040031410000';
    this.orderData += `1d286b03003143${EscPosPrinter.numToHexStr(
      module_size,
      1,
    )}`;
    this.orderData += `1d286b03003145${EscPosPrinter.numToHexStr(
      ec_level + 48,
      1,
    )}`;
    this.orderData += `1d286b${EscPosPrinter.numToHexStr(
      text_length + 3,
      2,
    )}315030`;
    for (let i = 0; i < text_length; i++) {
      this.orderData += EscPosPrinter.numToHexStr(text.charCodeAt(i), 1);
    }
    this.orderData += '1d286b0300315130';
  }

  //////////////////////////////////////////////////
  // Image Printing
  //////////////////////////////////////////////////

  // Grayscale to mono - diffuse dithering.
  private static diffuseDither(
    srcData: number[],
    width: number,
    height: number,
  ): number[] | null {
    if (width <= 0 || height <= 0) return null;
    if (srcData.length < width * height) return null;

    const bmWidth = (width + 7) >> 3;
    const dstData = new Array(bmWidth * height).fill(0);
    const lineBuffer = new Array(2 * width).fill(0);
    let line1 = 0,
      line2 = 1,
      tmp: number;
    let e1: number, e3: number, e5: number, e7: number, err: number;
    let notLastLine: boolean;

    for (let i = 0; i < width; i++) {
      lineBuffer[i] = 0;
      lineBuffer[width + i] = srcData[i];
    }

    for (let y = 0; y < height; y++) {
      tmp = line1;
      line1 = line2;
      line2 = tmp;
      notLastLine = y < height - 1;

      if (notLastLine) {
        let p = (y + 1) * width;
        for (let i = 0; i < width; i++) {
          lineBuffer[line2 * width + i] = srcData[p++];
        }
      }

      let q = y * bmWidth;
      for (let i = 0; i < bmWidth; i++) {
        dstData[q++] = 0;
      }

      let b1 = 0,
        b2 = 0;
      q = y * bmWidth;
      let mask = 0x80;

      for (let x = 1; x <= width; x++) {
        const idx = line1 * width + b1;
        if (lineBuffer[idx] < 128) {
          err = lineBuffer[idx];
          dstData[q] |= mask;
        } else {
          err = lineBuffer[idx] - 255;
        }
        b1++;
        if (mask === 1) {
          q++;
          mask = 0x80;
        } else {
          mask >>= 1;
        }
        e7 = (err * 7 + 8) >> 4;
        e5 = (err * 5 + 8) >> 4;
        e3 = (err * 3 + 8) >> 4;
        e1 = err - (e7 + e5 + e3);
        if (x < width) lineBuffer[line1 * width + b1] += e7;
        if (notLastLine) {
          lineBuffer[line2 * width + b2] += e5;
          if (x > 1) lineBuffer[line2 * width + b2 - 1] += e3;
          if (x < width) lineBuffer[line2 * width + b2 + 1] += e1;
        }
        b2++;
      }
    }
    return dstData;
  }

  // Grayscale to mono - threshold dithering.
  private static thresholdDither(
    srcData: number[],
    width: number,
    height: number,
  ): number[] | null {
    if (width <= 0 || height <= 0) return null;
    if (srcData.length < width * height) return null;

    const bmWidth = (width + 7) >> 3;
    const dstData = new Array(bmWidth * height).fill(0);

    let p = 0,
      q = 0;
    for (let y = 0; y < height; y++) {
      let k = q;
      let mask = 0x80;
      for (let x = 0; x < width; x++) {
        if (srcData[p] < 128) {
          dstData[k] |= mask;
        }
        p++;
        if (mask === 1) {
          k++;
          mask = 0x80;
        } else {
          mask >>= 1;
        }
      }
      q += bmWidth;
    }
    return dstData;
  }

  // RGB to grayscale.
  private static convertToGray(
    imgData: ImageData,
    width: number,
    height: number,
  ): number[] {
    const grayData = new Array(width * height);
    let i = 0,
      j = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const r = imgData.data[j++] & 0xff;
        const g = imgData.data[j++] & 0xff;
        const b = imgData.data[j++] & 0xff;
        j++; // Skip the Alpha channel
        grayData[i++] = ((r * 11 + g * 16 + b * 5) >> 5) & 0xff;
      }
    }
    return grayData;
  }

  // Append image in the order.
  public appendImage(
    imgData: ImageData,
    dither: 'diffuse' | 'threshold',
  ): void {
    let grayData: number[], monoData: number[] | null;
    const w = imgData.width;
    const h = imgData.height;

    grayData = EscPosPrinter.convertToGray(imgData, w, h);
    if (dither === 'diffuse') {
      monoData = EscPosPrinter.diffuseDither(grayData, w, h);
    } else {
      monoData = EscPosPrinter.thresholdDither(grayData, w, h);
    }

    if (!monoData) return;

    const bmWidth = (w + 7) >> 3;
    this.orderData += '1d763000';
    this.orderData += EscPosPrinter.numToHexStr(bmWidth, 2);
    this.orderData += EscPosPrinter.numToHexStr(h, 2);
    for (let i = 0; i < monoData.length; i++) {
      this.orderData += EscPosPrinter.numToHexStr(monoData[i] & 0xff, 1);
    }
  }

  //////////////////////////////////////////////////
  // Page Mode Commands
  //////////////////////////////////////////////////

  // Enter page mode.
  public enterPageMode(): void {
    this.orderData += '1b4c';
  }

  // Set print area in page mode.
  // x, y: origin of the print area (the left-top corner of the print area)
  // w, h: width and height of the print area
  public setPrintAreaInPageMode(
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    this.orderData += '1b57';
    this.orderData += EscPosPrinter.numToHexStr(x, 2);
    this.orderData += EscPosPrinter.numToHexStr(y, 2);
    this.orderData += EscPosPrinter.numToHexStr(w, 2);
    this.orderData += EscPosPrinter.numToHexStr(h, 2);
  }

  // Set print direction in page mode.
  // dir: 0:not rotated; 1:90-degree clockwise rotated;
  //      2:180-degree clockwise rotated; 3:270-degree clockwise rotated
  public setPrintDirectionInPageMode(dir: number): void {
    if (dir >= 0 && dir <= 3)
      this.orderData += '1b54' + EscPosPrinter.numToHexStr(dir, 1);
  }

  // Set absolute print position in page mode.
  public setAbsolutePrintPositionInPageMode(n: number): void {
    if (n >= 0 && n <= 65535)
      this.orderData += '1d24' + EscPosPrinter.numToHexStr(n, 2);
  }

  // Set relative print position in page mode.
  public setRelativePrintPositionInPageMode(n: number): void {
    if (n >= -32768 && n <= 32767)
      this.orderData += '1d5c' + EscPosPrinter.numToHexStr(n, 2);
  }

  // Print contents in the buffer and exit page mode.
  public printAndExitPageMode(): void {
    this.orderData += '0c';
  }

  // Print contents in the buffer and keep in page mode.
  public printInPageMode(): void {
    this.orderData += '1b0c';
  }

  // Clear contents in the buffer and keep in page mode.
  public clearInPageMode(): void {
    this.orderData += '18';
  }

  // Discard contents in the buffer and exit page mode.
  public exitPageMode(): void {
    this.orderData += '1b53';
  }

  public setSingleByteEncoding(): void {
    this.orderData += '1c2e';
  }

  public setCodePage(codePage: number): void {
    this.orderData += '1b74' + EscPosPrinter.numToHexStr(codePage, 1);
  }

  public setCodePageCP437(): void {
    this.setSingleByteEncoding();
    this.setCodePage(0x00);
  }

  public setCodePageCP866(): void {
    this.setSingleByteEncoding();
    this.setCodePage(0x11);
  }
}
