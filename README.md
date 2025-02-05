# Sunmi ESC/POS Printer Utility Library

This repository contains a utility library for Sunmi cloud printers. It allows you to invoke printer functions over a local network using the available LAN API from Sunmi.
This library was created to address specific requirements for a project I worked on involving Sunmi ESC/POS printers. It may not be universally applicable to all projects.

## Features

- Connect to Sunmi cloud printers over a local network
- Send print commands using ESC/POS
- Query printer status
- Support for various printer functions (e.g., printing text, images, barcodes)

## Usage

Here is a basic example of how to use the library:

```javascript
// Print example
const SunmiPrinter = require('sunmi-esc-pos-printer');

const printer = new SunmiPrinter();

const ip = 'PRINTER_IP';
const sn = 'PRINTER_SN';
const copies = 1;

printer.clear();
printer.lineFeed(1);

printer.setLineSpacing(80);
printer.setPrintModes(true, true, false);
printer.setAlignment(Alignment.CENTER);

printer.appendText('*** Test / 打印测试 / ทดสอบ / ການທົດສອບ / ТЕСТ ***\n');

printer.restoreDefaultLineSpacing();
printer.setPrintModes(false, false, false);
printer.setAlignment(Alignment.LEFT);

if (printer.dotsPerLine === 576) {
  /* Setup 3 columns:
          1st: 288 dots with left alignment
          2nd: 144 dots with center alignment
          3rd: use the remaining dots with right alignment */
  printer.setColumnWidths(
    EscPosPrinter.columnWidthWithAlignment(288, Alignment.LEFT),
    EscPosPrinter.columnWidthWithAlignment(144, Alignment.CENTER),
    EscPosPrinter.columnWidthWithAlignment(0, Alignment.RIGHT),
  );
  printer.printInColumns(
    '|----------------------|',
    '|----------|',
    '|----------|',
  );
  printer.lineFeed(1);
} else {
  /* Setup 3 columns:
          1st: 96 dots with left alignment
          2nd: 144 dots with center alignment
          3rd: use the remaining dots with right alignment */
  printer.setColumnWidths(
    EscPosPrinter.columnWidthWithAlignment(96, Alignment.LEFT),
    EscPosPrinter.columnWidthWithAlignment(144, Alignment.CENTER),
    EscPosPrinter.columnWidthWithAlignment(0, Alignment.RIGHT),
  );
  printer.printInColumns('|------|', '|----------|', '|----------|');
  printer.lineFeed(1);
}

printer.printInColumns(
  '商品名称',
  '数量\n(单位：随意)',
  '小计\n(单位：元)',
);
printer.lineFeed(1);
printer.printInColumns(
  '橙子',
  '【备注：赠品购物满1000,000元送一只】',
  '￥0.00',
);
printer.lineFeed(1);
printer.printInColumns('test product', 'x100', '$102,020.99');
printer.lineFeed(1);
printer.printInColumns(
  'en - test product, randomlongenglishstringname',
  'x10',
  '₭100,000.00',
);
printer.lineFeed(1);
printer.printInColumns('lao - ຈຳນວນແຖວຕໍ່ໜ້າ', 'x100', '₭100,000.00');
printer.lineFeed(1);
printer.printInColumns('spanish - ¿Cómo estás?', 'x100', '€100,000.00');
printer.lineFeed(1);
printer.printInColumns('german - Glück', 'x100', '€100,000.00');
printer.lineFeed(1);
printer.printInColumns('thai - ขอโทษ', 'x100 ', '฿100,000.00');
printer.lineFeed(1);
printer.printInColumns('ru - ТЕСТ ПРОДУКТ', 'x100', '₽100,000.00');
printer.lineFeed(1);

printer.setAlignment(Alignment.CENTER);

/* Print CODE128 barcode */
printer.appendBarcode(HriPosition.BELOW, 160, 3, 73, 'Abc-000789');
printer.lineFeed(1);

/* Print QR code */
printer.appendQRcode(5, 1, 'https://www.sunmi.com/');
printer.lineFeed(1);

printer.setAlignment(Alignment.LEFT);

// /* Print image */
// const logo = this.form.get('logo')?.value;
// if (logo) {
//   const dither = 'diffuse'; // 'threshold' or 'diffuse';
//   const logo64 = await this.getImageDataFromUrl(logo);
//   printer.setAlignment(Alignment.CENTER);
//   printer.appendImage(logo64, dither);
//   printer.setAlignment(Alignment.LEFT);
//   printer.lineFeed(1);
// }

/* Print in page mode */
printer.setAlignment(Alignment.CENTER);
printer.appendText('---- 页模式多区域打印 ----\n');
printer.setAlignment(Alignment.LEFT);
printer.enterPageMode();
// Region 1
printer.setPrintAreaInPageMode(0, 0, 144, 500);
printer.setPrintDirectionInPageMode(0);
printer.appendText(
  '永和九年，岁在癸丑，暮春之初，会于会稽山阴之兰亭，修禊事也。群贤毕至，少长咸集。' +
    '此地有崇山峻岭，茂林修竹；又有清流激湍，映带左右，引以为流觞曲水，列坐其次。\n',
);
// Region 2
printer.setPrintAreaInPageMode(156, 0, 144, 500);
printer.setPrintDirectionInPageMode(2);
printer.appendText(
  '鎌倉アナウンサーはまず流暢な中国語でアナウンサーとしての豊富な経験を紹介されました。\n',
);
// Region 3
printer.setPrintAreaInPageMode(312, 0, 72, 500);
printer.setPrintDirectionInPageMode(3);
printer.appendText(
  'Scarlett is a woman who can deal with a nation at war, Atlanta burning.\n',
);

// Print and exit page mode
printer.printAndExitPageMode();

printer.lineFeed(4);
printer.cutPaper(false);

const result = await printer.print(ip, sn, copies);

/* --- --- --- --- --- --- */

// Query printer status
const status = await printer.getStatus();
```

## Contact

If you have any questions or need further assistance, please open an issue or contact me at w1df33r@gmail.com.
