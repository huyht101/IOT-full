const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function collectJavaScriptFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectJavaScriptFiles(fullPath));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

const srcDir = path.join(__dirname, '..', 'src');
const files = collectJavaScriptFiles(srcDir);

if (!files.length) {
  console.log('No JavaScript files found under src/.');
  process.exit(0);
}

let hasFailure = false;

for (const filePath of files) {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    hasFailure = true;
  }
}

if (hasFailure) {
  process.exit(1);
}

console.log(`Syntax OK for ${files.length} file(s).`);
