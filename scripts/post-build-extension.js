import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, '../dist-extension');
const buildPath = path.join(__dirname, '../build/client');
const publicPath = path.join(__dirname, '../public');

console.log('📦 Creating extension...');

// Clean and create
if (fs.existsSync(distPath)) {
  fs.rmSync(distPath, { recursive: true });
}
fs.mkdirSync(distPath, { recursive: true });

// Copy all build files
fs.cpSync(buildPath, distPath, { recursive: true });
console.log('✅ Copied build files');

// Find the entry.client file
const assetsDir = path.join(distPath, 'assets');
const files = fs.readdirSync(assetsDir);
const entryFile = files.find(f => f.startsWith('entry.client-'));

if (!entryFile) {
  console.error('❌ Could not find entry.client file!');
  process.exit(1);
}

// Create index.html
const indexHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Builder Uptime</title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 400px;
      min-height: 600px;
      font-family: system-ui, -apple-system, sans-serif;
      background: #0f172a;
      color: white;
    }
    #root { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/${entryFile}"></script>
</body>
</html>`;

fs.writeFileSync(path.join(distPath, 'index.html'), indexHTML);
console.log('✅ Created index.html');

// Copy extension files
fs.copyFileSync(
  path.join(publicPath, 'manifest.json'),
  path.join(distPath, 'manifest.json')
);
fs.copyFileSync(
  path.join(publicPath, 'background.js'),
  path.join(distPath, 'background.js')
);

['16', '48', '128'].forEach(size => {
  const icon = path.join(publicPath, `icon-${size}.png`);
  if (fs.existsSync(icon)) {
    fs.copyFileSync(icon, path.join(distPath, `icon-${size}.png`));
  }
});

console.log('\n🎉 Extension ready in dist-extension/!\n');
