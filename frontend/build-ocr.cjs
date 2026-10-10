const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const output = path.join(root, 'ocr');
fs.mkdirSync(path.join(output, 'core'), {recursive: true});
fs.mkdirSync(path.join(output, 'lang'), {recursive: true});
const copy = (source, destination) => fs.copyFileSync(path.join(root, 'node_modules', source), path.join(output, destination));
copy('tesseract.js/dist/tesseract.min.js', 'tesseract.min.js');
copy('tesseract.js/dist/worker.min.js', 'worker.min.js');
copy('tesseract.js/LICENSE.md', 'tesseract-license.txt');
copy('tesseract.js-core/LICENSE', 'core-license.txt');
for (const name of fs.readdirSync(path.join(root, 'node_modules/tesseract.js-core'))) {
  if (/^tesseract-core.*\.wasm(?:\.js)?$/.test(name)) copy('tesseract.js-core/' + name, 'core/' + name);
}
for (const language of ['eng', 'rus']) {
  copy('@tesseract.js-data/' + language + '/4.0.0_best_int/' + language + '.traineddata.gz', 'lang/' + language + '.traineddata.gz');
  copy('@tesseract.js-data/' + language + '/README.md', 'lang/' + language + '-source.txt');
}
console.log('Built same-origin English/Russian OCR assets from locked npm packages.');
