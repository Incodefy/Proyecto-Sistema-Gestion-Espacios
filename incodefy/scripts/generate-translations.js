// Script para generar traducciones completas
const fs = require('fs');
const path = require('path');

// Leer el archivo de referencia en español
const esPath = path.join(__dirname, '../locales/es.json');
const enPath = path.join(__dirname, '../locales/en.json');
const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Traducciones base para cada idioma (solo las claves principales que necesitan traducción manual)
const translations = {
  it: {
    name: 'Italiano',
    colors: { blue: 'Blu', red: 'Rosso', green: 'Verde', purple: 'Viola', orange: 'Arancione' },
    font_scales: { small: 'Piccolo', medium: 'Medio', large: 'Grande' },
    navbar: { dashboard: 'Dashboard', agenda: 'Agenda', box: 'Box', notifications: 'Notifiche', profile: 'Profilo', logout: 'Esci' },
    login: { title: 'Accedi', email: 'Email', password: 'Password', remember_me: 'Ricordami', forgot_password: 'Password dimenticata?', login_button: 'Accedi', show_password: 'Mostra password' },
    common: { doctor: 'Medico', box: 'Box', close: 'Chiudi', save: 'Salva', cancel: 'Annulla', confirm: 'Conferma', yes: 'Sì', no: 'No', loading: 'Caricamento...', error: 'Errore', success: 'Successo' },
    days: { monday: 'Lunedì', tuesday: 'Martedì', wednesday: 'Mercoledì', thursday: 'Giovedì', friday: 'Venerdì', saturday: 'Sabato', sunday: 'Domenica' }
  },
  zh: {
    name: '中文',
    colors: { blue: '蓝色', red: '红色', green: '绿色', purple: '紫色', orange: '橙色' },
    font_scales: { small: '小', medium: '中', large: '大' },
    navbar: { dashboard: '仪表板', agenda: '日程', box: '诊室', notifications: '通知', profile: '个人资料', logout: '登出' },
    login: { title: '登录', email: '邮箱', password: '密码', remember_me: '记住我', forgot_password: '忘记密码？', login_button: '登录', show_password: '显示密码' },
    common: { doctor: '医生', box: '诊室', close: '关闭', save: '保存', cancel: '取消', confirm: '确认', yes: '是', no: '否', loading: '加载中...', error: '错误', success: '成功' },
    days: { monday: '星期一', tuesday: '星期二', wednesday: '星期三', thursday: '星期四', friday: '星期五', saturday: '星期六', sunday: '星期日' }
  },
  de: {
    name: 'Deutsch',
    colors: { blue: 'Blau', red: 'Rot', green: 'Grün', purple: 'Lila', orange: 'Orange' },
    font_scales: { small: 'Klein', medium: 'Mittel', large: 'Groß' },
    navbar: { dashboard: 'Dashboard', agenda: 'Terminkalender', box: 'Box', notifications: 'Benachrichtigungen', profile: 'Profil', logout: 'Abmelden' },
    login: { title: 'Anmelden', email: 'E-Mail', password: 'Passwort', remember_me: 'Angemeldet bleiben', forgot_password: 'Passwort vergessen?', login_button: 'Anmelden', show_password: 'Passwort anzeigen' },
    common: { doctor: 'Arzt', box: 'Box', close: 'Schließen', save: 'Speichern', cancel: 'Abbrechen', confirm: 'Bestätigen', yes: 'Ja', no: 'Nein', loading: 'Laden...', error: 'Fehler', success: 'Erfolg' },
    days: { monday: 'Montag', tuesday: 'Dienstag', wednesday: 'Mittwoch', thursday: 'Donnerstag', friday: 'Freitag', saturday: 'Samstag', sunday: 'Sonntag' }
  },
  fr: {
    name: 'Français',
    colors: { blue: 'Bleu', red: 'Rouge', green: 'Vert', purple: 'Violet', orange: 'Orange' },
    font_scales: { small: 'Petit', medium: 'Moyen', large: 'Grand' },
    navbar: { dashboard: 'Tableau de bord', agenda: 'Agenda', box: 'Boîte', notifications: 'Notifications', profile: 'Profil', logout: 'Déconnexion' },
    login: { title: 'Connexion', email: 'Email', password: 'Mot de passe', remember_me: 'Se souvenir de moi', forgot_password: 'Mot de passe oublié?', login_button: 'Se connecter', show_password: 'Afficher le mot de passe' },
    common: { doctor: 'Médecin', box: 'Boîte', close: 'Fermer', save: 'Enregistrer', cancel: 'Annuler', confirm: 'Confirmer', yes: 'Oui', no: 'Non', loading: 'Chargement...', error: 'Erreur', success: 'Succès' },
    days: { monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' }
  },
  ru: {
    name: 'Русский',
    colors: { blue: 'Синий', red: 'Красный', green: 'Зелёный', purple: 'Фиолетовый', orange: 'Оранжевый' },
    font_scales: { small: 'Маленький', medium: 'Средний', large: 'Большой' },
    navbar: { dashboard: 'Панель', agenda: 'Повестка', box: 'Бокс', notifications: 'Уведомления', profile: 'Профиль', logout: 'Выход' },
    login: { title: 'Вход', email: 'Электронная почта', password: 'Пароль', remember_me: 'Запомнить меня', forgot_password: 'Забыли пароль?', login_button: 'Войти', show_password: 'Показать пароль' },
    common: { doctor: 'Врач', box: 'Бокс', close: 'Закрыть', save: 'Сохранить', cancel: 'Отмена', confirm: 'Подтвердить', yes: 'Да', no: 'Нет', loading: 'Загрузка...', error: 'Ошибка', success: 'Успех' },
    days: { monday: 'Понедельник', tuesday: 'Вторник', wednesday: 'Среда', thursday: 'Четверг', friday: 'Пятница', saturday: 'Суббота', sunday: 'Воскресенье' }
  },
  ja: {
    name: '日本語',
    colors: { blue: '青', red: '赤', green: '緑', purple: '紫', orange: 'オレンジ' },
    font_scales: { small: '小', medium: '中', large: '大' },
    navbar: { dashboard: 'ダッシュボード', agenda: '予定表', box: 'ボックス', notifications: '通知', profile: 'プロフィール', logout: 'ログアウト' },
    login: { title: 'ログイン', email: 'メール', password: 'パスワード', remember_me: 'ログイン状態を保持', forgot_password: 'パスワードをお忘れですか？', login_button: 'ログイン', show_password: 'パスワードを表示' },
    common: { doctor: '医師', box: 'ボックス', close: '閉じる', save: '保存', cancel: 'キャンセル', confirm: '確認', yes: 'はい', no: 'いいえ', loading: '読み込み中...', error: 'エラー', success: '成功' },
    days: { monday: '月曜日', tuesday: '火曜日', wednesday: '水曜日', thursday: '木曜日', friday: '金曜日', saturday: '土曜日', sunday: '日曜日' }
  },
  ko: {
    name: '한국어',
    colors: { blue: '파란색', red: '빨간색', green: '초록색', purple: '보라색', orange: '주황색' },
    font_scales: { small: '작게', medium: '중간', large: '크게' },
    navbar: { dashboard: '대시보드', agenda: '일정', box: '박스', notifications: '알림', profile: '프로필', logout: '로그아웃' },
    login: { title: '로그인', email: '이메일', password: '비밀번호', remember_me: '로그인 상태 유지', forgot_password: '비밀번호를 잊으셨나요?', login_button: '로그인', show_password: '비밀번호 표시' },
    common: { doctor: '의사', box: '박스', close: '닫기', save: '저장', cancel: '취소', confirm: '확인', yes: '예', no: '아니오', loading: '로딩 중...', error: '오류', success: '성공' },
    days: { monday: '월요일', tuesday: '화요일', wednesday: '수요일', thursday: '목요일', friday: '금요일', saturday: '토요일', sunday: '일요일' }
  },
  ar: {
    name: 'العربية',
    colors: { blue: 'أزرق', red: 'أحمر', green: 'أخضر', purple: 'بنفسجي', orange: 'برتقالي' },
    font_scales: { small: 'صغير', medium: 'متوسط', large: 'كبير' },
    navbar: { dashboard: 'لوحة التحكم', agenda: 'جدول الأعمال', box: 'صندوق', notifications: 'الإشعارات', profile: 'الملف الشخصي', logout: 'تسجيل الخروج' },
    login: { title: 'تسجيل الدخول', email: 'البريد الإلكتروني', password: 'كلمة المرور', remember_me: 'تذكرني', forgot_password: 'هل نسيت كلمة المرور؟', login_button: 'تسجيل الدخول', show_password: 'إظهار كلمة المرور' },
    common: { doctor: 'طبيب', box: 'صندوق', close: 'إغلاق', save: 'حفظ', cancel: 'إلغاء', confirm: 'تأكيد', yes: 'نعم', no: 'لا', loading: 'جاري التحميل...', error: 'خطأ', success: 'نجاح' },
    days: { monday: 'الإثنين', tuesday: 'الثلاثاء', wednesday: 'الأربعاء', thursday: 'الخميس', friday: 'الجمعة', saturday: 'السبت', sunday: 'الأحد' }
  },
  hi: {
    name: 'हिन्दी',
    colors: { blue: 'नीला', red: 'लाल', green: 'हरा', purple: 'बैंगनी', orange: 'नारंगी' },
    font_scales: { small: 'छोटा', medium: 'मध्यम', large: 'बड़ा' },
    navbar: { dashboard: 'डैशबोर्ड', agenda: 'एजेंडा', box: 'बॉक्स', notifications: 'सूचनाएं', profile: 'प्रोफाइल', logout: 'लॉग आउट' },
    login: { title: 'लॉगिन', email: 'ईमेल', password: 'पासवर्ड', remember_me: 'मुझे याद रखें', forgot_password: 'पासवर्ड भूल गए?', login_button: 'लॉगिन करें', show_password: 'पासवर्ड दिखाएं' },
    common: { doctor: 'डॉक्टर', box: 'बॉक्स', close: 'बंद करें', save: 'सहेजें', cancel: 'रद्द करें', confirm: 'पुष्टि करें', yes: 'हाँ', no: 'नहीं', loading: 'लोड हो रहा है...', error: 'त्रुटि', success: 'सफलता' },
    days: { monday: 'सोमवार', tuesday: 'मंगलवार', wednesday: 'बुधवार', thursday: 'गुरुवार', friday: 'शुक्रवार', saturday: 'शनिवार', sunday: 'रविवार' }
  }
};

console.log('✅ Script cargado correctamente');
console.log('📝 Para usar este script, necesitas implementar la lógica de traducción completa');
console.log('💡 Los archivos base ya están creados con las traducciones principales');
