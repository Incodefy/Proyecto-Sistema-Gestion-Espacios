// Script para generar variantes de color (claro/oscuro) automáticamente
// Genera las configuraciones necesarias para AWS Lambda

const fs = require('fs');
const path = require('path');

// Paletas de colores del selector (mismo que color-picker.js)
const COLOR_PALETTES = {
  popular: [
    { hex: '#1a3c7c', name: 'Azul' },
    { hex: '#d53232', name: 'Rojo' },
    { hex: '#059669', name: 'Verde' },
    { hex: '#7c3aed', name: 'Púrpura' },
    { hex: '#ea580c', name: 'Naranja' }
  ],
  vibrant: [
    { hex: '#dc2626', name: 'Rojo Vibrante' },
    { hex: '#ea580c', name: 'Naranja Intenso' },
    { hex: '#f59e0b', name: 'Ámbar' },
    { hex: '#84cc16', name: 'Lima' },
    { hex: '#10b981', name: 'Esmeralda' },
    { hex: '#06b6d4', name: 'Cian' },
    { hex: '#3b82f6', name: 'Azul Rey' },
    { hex: '#8b5cf6', name: 'Violeta' },
    { hex: '#ec4899', name: 'Rosa Fucsia' },
    { hex: '#f43f5e', name: 'Rosa Intenso' }
  ],
  pastel: [
    { hex: '#fca5a5', name: 'Rosa Pastel' },
    { hex: '#fdba74', name: 'Melocotón' },
    { hex: '#fde047', name: 'Amarillo Suave' },
    { hex: '#bef264', name: 'Lima Pastel' },
    { hex: '#86efac', name: 'Verde Menta' },
    { hex: '#67e8f9', name: 'Celeste' },
    { hex: '#93c5fd', name: 'Azul Cielo' },
    { hex: '#c4b5fd', name: 'Lavanda' },
    { hex: '#f9a8d4', name: 'Rosa Claro' },
    { hex: '#fda4af', name: 'Coral Suave' }
  ],
  dark: [
    { hex: '#1e293b', name: 'Pizarra' },
    { hex: '#1e3a8a', name: 'Azul Marino' },
    { hex: '#831843', name: 'Rosa Oscuro' },
    { hex: '#6b21a8', name: 'Púrpura Oscuro' },
    { hex: '#7c2d12', name: 'Marrón' },
    { hex: '#14532d', name: 'Verde Oscuro' },
    { hex: '#164e63', name: 'Verde Azulado' },
    { hex: '#1e40af', name: 'Azul Profundo' },
    { hex: '#4c1d95', name: 'Índigo Oscuro' },
    { hex: '#9f1239', name: 'Carmesí' }
  ]
};

// Función para convertir HEX a RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Función para convertir RGB a HEX
function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Función para generar variante más clara (aumentar luminosidad)
function lightenColor(hex, percent = 20) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const increase = Math.round(255 * (percent / 100));
  const r = Math.min(255, rgb.r + increase);
  const g = Math.min(255, rgb.g + increase);
  const b = Math.min(255, rgb.b + increase);
  
  return rgbToHex(r, g, b);
}

// Función para generar variante más oscura (reducir luminosidad)
function darkenColor(hex, percent = 20) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const decrease = Math.round(255 * (percent / 100));
  const r = Math.max(0, rgb.r - decrease);
  const g = Math.max(0, rgb.g - decrease);
  const b = Math.max(0, rgb.b - decrease);
  
  return rgbToHex(r, g, b);
}

// Recolectar todos los colores únicos
const allColors = new Map();
Object.entries(COLOR_PALETTES).forEach(([palette, colors]) => {
  colors.forEach(color => {
    if (!allColors.has(color.hex.toLowerCase())) {
      allColors.set(color.hex.toLowerCase(), color.name);
    }
  });
});

console.log(`📊 Total de colores únicos: ${allColors.size}`);

// Generar variantes para cada color
const colorVariants = {};
const themeColors = [];

allColors.forEach((name, hex) => {
  const light = lightenColor(hex, 25);
  const dark = darkenColor(hex, 20);
  
  colorVariants[hex] = { light, dark };
  themeColors.push(hex);
  
  console.log(`${name.padEnd(20)} ${hex} → light: ${light}, dark: ${dark}`);
});

// Generar archivo defaults.json actualizado
const defaultsPath = path.join(__dirname, '..', '..', 'aws', 'src', 'config', 'defaults.json');
const currentDefaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'));

const updatedDefaults = {
  ...currentDefaults,
  themeColors: themeColors
};

fs.writeFileSync(defaultsPath, JSON.stringify(updatedDefaults, null, 2), 'utf8');
console.log(`\n✅ Actualizado: ${defaultsPath}`);
console.log(`   ${themeColors.length} colores en themeColors`);

// Generar código JavaScript para config.js (colorVariants)
let jsCode = '    generateColorVariants: (primaryColor) => {\n';
jsCode += '      const colorVariants = {\n';

allColors.forEach((name, hex) => {
  const variant = colorVariants[hex];
  jsCode += `        '${hex}': { light: '${variant.light}', dark: '${variant.dark}' }, // ${name}\n`;
});

jsCode += '      };\n\n';
jsCode += '      // Devolver variantes del color o fallback\n';
jsCode += '      return colorVariants[primaryColor.toLowerCase()] || {\n';
jsCode += '        light: primaryColor,\n';
jsCode += '        dark: primaryColor\n';
jsCode += '      };\n';
jsCode += '    }';

// Guardar código JS en archivo temporal
const jsOutputPath = path.join(__dirname, '..', '..', 'aws', 'src', 'config', 'color-variants.js');
const jsOutput = `// Generado automáticamente por scripts/generate-color-variants.js
// NO EDITAR MANUALMENTE

module.exports = ${jsCode.substring(jsCode.indexOf('(primaryColor)'))};
`;

fs.writeFileSync(jsOutputPath, jsOutput, 'utf8');
console.log(`\n✅ Generado: ${jsOutputPath}`);

// Mostrar snippet para copiar a config.js
console.log('\n📋 Código para copiar en aws/src/config/config.js (reemplazar generateColorVariants):');
console.log('─'.repeat(80));
console.log(jsCode);
console.log('─'.repeat(80));

console.log('\n✨ Proceso completado!');
console.log(`\n📝 Próximos pasos:`);
console.log(`1. Copiar el código generado a aws/src/config/config.js`);
console.log(`2. O importar: const generateColorVariants = require('./color-variants.js');`);
console.log(`3. Reiniciar el servidor para aplicar cambios`);
