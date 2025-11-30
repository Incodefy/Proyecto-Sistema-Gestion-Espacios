// Script para generar clases CSS estáticas para todos los colores
// Esto permite cumplir con CSP sin usar style inline

const fs = require('fs');
const path = require('path');

const COLOR_PALETTES = {
  popular: [
    { hex: '#1a3c7c' },
    { hex: '#d53232' },
    { hex: '#059669' },
    { hex: '#7c3aed' },
    { hex: '#ea580c' }
  ],
  vibrant: [
    { hex: '#dc2626' },
    { hex: '#ea580c' },
    { hex: '#f59e0b' },
    { hex: '#84cc16' },
    { hex: '#10b981' },
    { hex: '#06b6d4' },
    { hex: '#3b82f6' },
    { hex: '#8b5cf6' },
    { hex: '#ec4899' },
    { hex: '#f43f5e' }
  ],
  pastel: [
    { hex: '#fca5a5' },
    { hex: '#fdba74' },
    { hex: '#fde047' },
    { hex: '#bef264' },
    { hex: '#86efac' },
    { hex: '#67e8f9' },
    { hex: '#93c5fd' },
    { hex: '#c4b5fd' },
    { hex: '#f9a8d4' },
    { hex: '#fda4af' }
  ],
  dark: [
    { hex: '#1e293b' },
    { hex: '#1e3a8a' },
    { hex: '#831843' },
    { hex: '#6b21a8' },
    { hex: '#7c2d12' },
    { hex: '#14532d' },
    { hex: '#164e63' },
    { hex: '#1e40af' },
    { hex: '#4c1d95' },
    { hex: '#9f1239' }
  ]
};

// Recolectar todos los colores únicos
const allColors = new Set();
Object.values(COLOR_PALETTES).forEach(palette => {
  palette.forEach(color => allColors.add(color.hex.toLowerCase()));
});

// Generar CSS
let css = '/* ===== CLASES DE COLORES GENERADAS AUTOMÁTICAMENTE ===== */\n';
css += '/* Este archivo contiene clases CSS para todos los colores del picker */\n';
css += '/* Se genera mediante scripts/generate-color-classes.js */\n\n';

allColors.forEach(hex => {
  const escapedHex = hex.replace('#', '');
  css += `/* Color: ${hex} */\n`;
  css += `.color-item[data-item-color="${hex}"] {\n`;
  css += `  background-color: ${hex} !important;\n`;
  css += `}\n`;
  css += `.preview-box[data-preview-color="${hex}"],\n`;
  css += `#previewBox[data-preview-color="${hex}"] {\n`;
  css += `  background-color: ${hex} !important;\n`;
  css += `}\n`;
  css += `.preview-large-box[data-preview-color="${hex}"],\n`;
  css += `#previewLargeBox[data-preview-color="${hex}"] {\n`;
  css += `  background-color: ${hex} !important;\n`;
  css += `}\n\n`;
});

// Guardar el archivo
const outputPath = path.join(__dirname, '..', 'public', 'css', 'color-classes.css');
fs.writeFileSync(outputPath, css, 'utf8');

console.log(`✅ Generadas ${allColors.size} clases de colores en: ${outputPath}`);
console.log(`   Total de líneas CSS: ${css.split('\n').length}`);
