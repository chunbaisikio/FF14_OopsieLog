const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('src', function(filePath) {
  if (filePath.endsWith('.tsx')) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      // Find strings with Chinese and English characters that look like UI strings
      // usually they contain words like Boss, Part, Mechanic, Team
      if (/[\u4e00-\u9fa5]/.test(line) && /(Boss|Part|Mechanic|Team|Log|Mistake|Settings|ID)/i.test(line)) {
        console.log(`${filePath}:${i+1}: ${line.trim()}`);
      }
    });
  }
});
