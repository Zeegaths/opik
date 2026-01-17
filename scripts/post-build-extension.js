import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, '../dist-extension');
const publicPath = path.join(__dirname, '../public');

console.log('📦 Creating extension...');

// Create dist-extension
if (fs.existsSync(distPath)) {
  fs.rmSync(distPath, { recursive: true });
}
fs.mkdirSync(distPath, { recursive: true });

// Copy popup files
const filesToCopy = [
  'manifest.json',
  'background.js',
  'popup.html',
  'popup.js',
  'icon-16.png',
  'icon-48.png',
  'icon-128.png'
];

filesToCopy.forEach(file => {
  const srcPath = path.join(publicPath, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(distPath, file));
    console.log(`✅ Copied ${file}`);
  } else {
    console.warn(`⚠️  ${file} not found`);
  }
});

console.log('\n🎉 Extension ready in dist-extension/!\n');