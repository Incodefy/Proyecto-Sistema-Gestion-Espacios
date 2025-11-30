// Generado automáticamente por scripts/generate-color-variants.js
// NO EDITAR MANUALMENTE

module.exports = (primaryColor) => {
      const colorVariants = {
        '#1a3c7c': { light: '#5a7cbc', dark: '#000949' }, // Azul
        '#d53232': { light: '#ff7272', dark: '#a20000' }, // Rojo
        '#059669': { light: '#45d6a9', dark: '#006336' }, // Verde
        '#7c3aed': { light: '#bc7aff', dark: '#4907ba' }, // Púrpura
        '#ea580c': { light: '#ff984c', dark: '#b72500' }, // Naranja
        '#dc2626': { light: '#ff6666', dark: '#a90000' }, // Rojo Vibrante
        '#f59e0b': { light: '#ffde4b', dark: '#c26b00' }, // Ámbar
        '#84cc16': { light: '#c4ff56', dark: '#519900' }, // Lima
        '#10b981': { light: '#50f9c1', dark: '#00864e' }, // Esmeralda
        '#06b6d4': { light: '#46f6ff', dark: '#0083a1' }, // Cian
        '#3b82f6': { light: '#7bc2ff', dark: '#084fc3' }, // Azul Rey
        '#8b5cf6': { light: '#cb9cff', dark: '#5829c3' }, // Violeta
        '#ec4899': { light: '#ff88d9', dark: '#b91566' }, // Rosa Fucsia
        '#f43f5e': { light: '#ff7f9e', dark: '#c10c2b' }, // Rosa Intenso
        '#fca5a5': { light: '#ffe5e5', dark: '#c97272' }, // Rosa Pastel
        '#fdba74': { light: '#fffab4', dark: '#ca8741' }, // Melocotón
        '#fde047': { light: '#ffff87', dark: '#caad14' }, // Amarillo Suave
        '#bef264': { light: '#feffa4', dark: '#8bbf31' }, // Lima Pastel
        '#86efac': { light: '#c6ffec', dark: '#53bc79' }, // Verde Menta
        '#67e8f9': { light: '#a7ffff', dark: '#34b5c6' }, // Celeste
        '#93c5fd': { light: '#d3ffff', dark: '#6092ca' }, // Azul Cielo
        '#c4b5fd': { light: '#fff5ff', dark: '#9182ca' }, // Lavanda
        '#f9a8d4': { light: '#ffe8ff', dark: '#c675a1' }, // Rosa Claro
        '#fda4af': { light: '#ffe4ef', dark: '#ca717c' }, // Coral Suave
        '#1e293b': { light: '#5e697b', dark: '#000008' }, // Pizarra
        '#1e3a8a': { light: '#5e7aca', dark: '#000757' }, // Azul Marino
        '#831843': { light: '#c35883', dark: '#500010' }, // Rosa Oscuro
        '#6b21a8': { light: '#ab61e8', dark: '#380075' }, // Púrpura Oscuro
        '#7c2d12': { light: '#bc6d52', dark: '#490000' }, // Marrón
        '#14532d': { light: '#54936d', dark: '#002000' }, // Verde Oscuro
        '#164e63': { light: '#568ea3', dark: '#001b30' }, // Verde Azulado
        '#1e40af': { light: '#5e80ef', dark: '#000d7c' }, // Azul Profundo
        '#4c1d95': { light: '#8c5dd5', dark: '#190062' }, // Índigo Oscuro
        '#9f1239': { light: '#df5279', dark: '#6c0006' }, // Carmesí
      };

      // Devolver variantes del color o fallback
      return colorVariants[primaryColor.toLowerCase()] || {
        light: primaryColor,
        dark: primaryColor
      };
    };
