import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, '../dist-extension');
const publicPath = path.join(__dirname, '../public');

console.log('📦 Copying extension files...');

// Ensure dist-extension exists
if (!fs.existsSync(distPath)) {
  fs.mkdirSync(distPath, { recursive: true });
}

// Copy manifest.json
const manifestPath = path.join(publicPath, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  fs.copyFileSync(manifestPath, path.join(distPath, 'manifest.json'));
  console.log('✅ Copied manifest.json');
} else {
  console.error('❌ manifest.json not found in public/');
  process.exit(1);
}

// Copy background.js
const backgroundPath = path.join(publicPath, 'background.js');
if (fs.existsSync(backgroundPath)) {
  fs.copyFileSync(backgroundPath, path.join(distPath, 'background.js'));
  console.log('✅ Copied background.js');
}

// Copy icons (SVG or PNG)
const iconSizes = ['16', '48', '128'];
iconSizes.forEach(size => {
  // Try SVG first (since that's what you have)
  let iconPath = path.join(publicPath, `icon-${size}.svg`);
  let iconName = `icon-${size}.svg`;
  
  // If SVG doesn't exist, try PNG
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(publicPath, `icon-${size}.png`);
    iconName = `icon-${size}.png`;
  }
  
  if (fs.existsSync(iconPath)) {
    fs.copyFileSync(iconPath, path.join(distPath, iconName));
    console.log(`✅ Copied ${iconName}`);
  } else {
    console.warn(`⚠️  icon-${size} not found`);
  }
});

console.log('\n🎉 Extension build complete!');
console.log('📂 Load from: dist-extension/ folder');
console.log('\nTo install:');
console.log('1. Open chrome://extensions/');
console.log('2. Enable "Developer mode"');
console.log('3. Click "Load unpacked"');
console.log('4. Select the dist-extension folder\n');