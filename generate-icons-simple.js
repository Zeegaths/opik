import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple colored square placeholders
const createIcon = (size) => {
  const canvas = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${size/8}" fill="url(#grad)"/>
    <text x="50%" y="50%" text-anchor="middle" dy=".35em" fill="white" font-size="${size/2.3}" font-weight="bold" font-family="sans-serif">BU</text>
  </svg>`;
  
  return canvas;
};

// Create SVG files (browsers can load these directly)
['16', '48', '128'].forEach(size => {
  const svg = createIcon(Number(size));
  fs.writeFileSync(path.join(__dirname, 'public', `icon-${size}.svg`), svg);
  console.log(`✅ Created icon-${size}.svg`);
});

console.log('\n🎨 SVG icons created in public/');
console.log('Note: Convert to PNG for production using an online converter');
console.log('Recommended: https://cloudconvert.com/svg-to-png\n');