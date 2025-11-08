const i18next = require('i18next');
const i18nextHttpMiddleware = require('i18next-http-middleware');
const FsBackend = require('i18next-fs-backend');
const path = require('path');

i18next
  .use(FsBackend)
  .use(i18nextHttpMiddleware.LanguageDetector)
  .init({
    // Opciones del backend para cargar archivos
    backend: {
      loadPath: path.join(__dirname, 'locales/{{lng}}.json'),
    },
    // Idioma por defecto si no se detecta ninguno
    fallbackLng: 'es',
    // Lista de idiomas soportados (25 más populares del mundo)
    supportedLngs: [
      'es', // Español
      'en', // Inglés
      'pt', // Portugués
      'it', // Italiano
      'zh', // Chino (Mandarín)
      'hi', // Hindi
      'ar', // Árabe
      'bn', // Bengalí
      'ru', // Ruso
      'ja', // Japonés
      'pa', // Panyabí
      'de', // Alemán
      'jv', // Javanés
      'ko', // Coreano
      'fr', // Francés
      'te', // Telugu
      'mr', // Maratí
      'tr', // Turco
      'ta', // Tamil
      'vi', // Vietnamita
      'ur', // Urdu
      'nl', // Neerlandés (Holandés)
      'pl', // Polaco
      'th', // Tailandés
      'fa'  // Persa (Farsi)
    ],
    // Opciones para el detector de idioma (aunque lo sobreescribiremos)
    detection: {
      order: ['querystring', 'cookie', 'header'],
      caches: ['cookie'],
    },
    // Permite que las claves de traducción no existan en un idioma
    // y se resuelvan con el idioma de fallback (es)
    saveMissing: false, 
  });

module.exports = i18next;
