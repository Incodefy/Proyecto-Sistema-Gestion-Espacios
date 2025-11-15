// src/config/config.js
const defaults = require('./defaults.json');

// Validar AWS_ROLE obligatorio en producción
if (process.env.NODE_ENV === 'production' && !process.env.AWS_ROLE) {
  throw new Error('AWS_ROLE environment variable is required in production');
}

module.exports = {
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    // AWS_ROLE es obligatorio en producción, fallback solo para desarrollo local
    role: process.env.AWS_ROLE || (process.env.NODE_ENV === 'development' ? 'arn:aws:iam::837538831487:role/LabRole' : null)
  },

  personalization: {
    // === Parámetros disponibles para personalización ===
    parameters: {
      'theme.mode': { 
        type: 'select', 
        options: process.env.THEME_MODES ? process.env.THEME_MODES.split(',') : defaults.themeModes,
        default: 'light',
        name: 'Modo de tema'
      },
      'theme.primary_color': { 
        type: 'color', 
        options: process.env.THEME_COLORS ? process.env.THEME_COLORS.split(',') : defaults.themeColors,
        default: '#1a3c7c',
        name: 'Color principal'
      },
      'locale.language': { 
        type: 'select',
        options: process.env.LANGUAGES ? process.env.LANGUAGES.split(',') : defaults.languages,
        default: 'es',
        name: 'Idioma'
      },
      'font.scale': {
        type: 'select',
        options: process.env.FONT_SIZES ? process.env.FONT_SIZES.split(',') : defaults.fontSizes,
        default: 'mediano',
        name: 'Escala de fuente'
      }
    },

    // === Función de variantes de color centralizada ===
    generateColorVariants: (primaryColor) => {
      const colorVariants = {
        '#1a3c7c': { light: '#375ca1', dark: '#142c59' },
        '#d53232ff': { light: '#e76464ff', dark: '#ad2424ff' },
        '#059669': { light: '#1ec78fff', dark: '#068d67ff' },
        '#7c3aed': { light: '#946cf2ff', dark: '#6028bbff' },
        '#ea580c': { light: '#3893dff', dark: '#c25125ff' }
      };

      return colorVariants[primaryColor] || {
        light: primaryColor + 'cc',
        dark: primaryColor + 'dd'
      };
    }
  },

  roles: {
    available_permissions_path: process.env.PERMISSIONS_FILE || 'src/config/permissions.json'
  }
};
