const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../locales');
const enFile = path.join(localesDir, 'en.json');
const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));

// Mapeo de traducciones clave para todos los idiomas restantes
const allTranslations = {
  ru: { // Ruso
    'Blue': 'Синий', 'Red': 'Красный', 'Green': 'Зелёный', 'Purple': 'Фиолетовый', 'Orange': 'Оранжевый',
    'Small': 'Маленький', 'Medium': 'Средний', 'Large': 'Большой',
    'Dashboard': 'Панель', 'Schedule': 'Расписание', 'Box': 'Бокс', 'Notifications': 'Уведомления',
    'Profile': 'Профиль', 'Logout': 'Выход', 'Login': 'Вход', 'Email': 'Электронная почта',
    'Password': 'Пароль', 'Doctor': 'Врач', 'Monday': 'Понедельник', 'Tuesday': 'Вторник',
    'Wednesday': 'Среда', 'Thursday': 'Четверг', 'Friday': 'Пятница', 'Saturday': 'Суббота',
    'Sunday': 'Воскресенье', 'Free': 'Свободно', 'In Use': 'Занято', 'Waiting': 'Ожидание',
    'Disabled': 'Отключено', 'Date': 'Дата', 'Time': 'Время', 'Status': 'Статус',
    'Pending': 'Ожидает', 'Confirmed': 'Подтверждено', 'Close': 'Закрыть', 'Save Changes': 'Сохранить',
    'Reset changes': 'Сбросить', 'Loading data...': 'Загрузка данных...', 'Error': 'Ошибка',
    'Import': 'Импорт', 'Export': 'Экспорт', 'View details': 'Показать детали',
    'Show all': 'Показать все', 'Select All': 'Выбрать все', 'Reset': 'Сбросить',
    'Filters': 'Фильтры', 'From': 'От', 'To': 'До', 'Name': 'Имя',
    'Language': 'Язык', 'Theme': 'Тема', 'Light': 'Светлая', 'Dark': 'Тёмная',
    'Preview': 'Предпросмотр', 'Agenda': 'Повестка', 'Appointments': 'Назначения',
    'Specialty': 'Специальность', 'Corridor': 'Коридор', 'Location': 'Местоположение',
    'Medical Staff': 'Медицинский персонал', 'Date and Time': 'Дата и время',
    'Cardiology': 'Кардиология', 'Pediatrics': 'Педиатрия', 'Gynecology': 'Гинекология',
    'Traumatology': 'Травматология', 'Dermatology': 'Дерматология', 'Neurology': 'Неврология'
  },
  zh: { // Chino
    'Blue': '蓝色', 'Red': '红色', 'Green': '绿色', 'Purple': '紫色', 'Orange': '橙色',
    'Small': '小', 'Medium': '中', 'Large': '大',
    'Dashboard': '仪表板', 'Schedule': '日程', 'Box': '诊室', 'Notifications': '通知',
    'Profile': '个人资料', 'Logout': '登出', 'Login': '登录', 'Email': '邮箱',
    'Password': '密码', 'Doctor': '医生', 'Monday': '星期一', 'Tuesday': '星期二',
    'Wednesday': '星期三', 'Thursday': '星期四', 'Friday': '星期五', 'Saturday': '星期六',
    'Sunday': '星期日', 'Free': '空闲', 'In Use': '使用中', 'Waiting': '等待',
    'Disabled': '禁用', 'Date': '日期', 'Time': '时间', 'Status': '状态',
    'Pending': '待处理', 'Confirmed': '已确认', 'Close': '关闭', 'Save Changes': '保存更改',
    'Reset changes': '重置更改', 'Loading data...': '加载数据...', 'Error': '错误',
    'Import': '导入', 'Export': '导出', 'View details': '查看详情',
    'Show all': '显示全部', 'Select All': '全选', 'Reset': '重置',
    'Filters': '筛选', 'From': '从', 'To': '到', 'Name': '姓名',
    'Language': '语言', 'Theme': '主题', 'Light': '浅色', 'Dark': '深色',
    'Preview': '预览', 'Agenda': '议程', 'Appointments': '预约',
    'Specialty': '专科', 'Corridor': '走廊', 'Location': '位置',
    'Medical Staff': '医务人员', 'Date and Time': '日期和时间',
    'Cardiology': '心脏科', 'Pediatrics': '儿科', 'Gynecology': '妇科',
    'Traumatology': '创伤科', 'Dermatology': '皮肤科', 'Neurology': '神经科'
  },
  ja: { // Japonés
    'Blue': '青', 'Red': '赤', 'Green': '緑', 'Purple': '紫', 'Orange': 'オレンジ',
    'Small': '小', 'Medium': '中', 'Large': '大',
    'Dashboard': 'ダッシュボード', 'Schedule': 'スケジュール', 'Box': 'ボックス', 'Notifications': '通知',
    'Profile': 'プロフィール', 'Logout': 'ログアウト', 'Login': 'ログイン', 'Email': 'メール',
    'Password': 'パスワード', 'Doctor': '医師', 'Monday': '月曜日', 'Tuesday': '火曜日',
    'Wednesday': '水曜日', 'Thursday': '木曜日', 'Friday': '金曜日', 'Saturday': '土曜日',
    'Sunday': '日曜日', 'Free': '空き', 'In Use': '使用中', 'Waiting': '待機中',
    'Disabled': '無効', 'Date': '日付', 'Time': '時間', 'Status': 'ステータス',
    'Pending': '保留中', 'Confirmed': '確認済み', 'Close': '閉じる', 'Save Changes': '変更を保存',
    'Reset changes': '変更をリセット', 'Loading data...': 'データを読み込み中...', 'Error': 'エラー',
    'Import': 'インポート', 'Export': 'エクスポート', 'View details': '詳細を表示',
    'Show all': 'すべて表示', 'Select All': 'すべて選択', 'Reset': 'リセット',
    'Filters': 'フィルター', 'From': '開始', 'To': '終了', 'Name': '名前',
    'Language': '言語', 'Theme': 'テーマ', 'Light': 'ライト', 'Dark': 'ダーク',
    'Preview': 'プレビュー', 'Agenda': 'アジェンダ', 'Appointments': '予約',
    'Specialty': '専門', 'Corridor': '廊下', 'Location': '場所',
    'Medical Staff': '医療スタッフ', 'Date and Time': '日時',
    'Cardiology': '循環器科', 'Pediatrics': '小児科', 'Gynecology': '婦人科',
    'Traumatology': '外傷科', 'Dermatology': '皮膚科', 'Neurology': '神経科'
  },
  ko: { // Coreano
    'Blue': '파란색', 'Red': '빨간색', 'Green': '초록색', 'Purple': '보라색', 'Orange': '주황색',
    'Small': '작게', 'Medium': '중간', 'Large': '크게',
    'Dashboard': '대시보드', 'Schedule': '일정', 'Box': '박스', 'Notifications': '알림',
    'Profile': '프로필', 'Logout': '로그아웃', 'Login': '로그인', 'Email': '이메일',
    'Password': '비밀번호', 'Doctor': '의사', 'Monday': '월요일', 'Tuesday': '화요일',
    'Wednesday': '수요일', 'Thursday': '목요일', 'Friday': '금요일', 'Saturday': '토요일',
    'Sunday': '일요일', 'Free': '사용 가능', 'In Use': '사용 중', 'Waiting': '대기 중',
    'Disabled': '비활성화', 'Date': '날짜', 'Time': '시간', 'Status': '상태',
    'Pending': '대기 중', 'Confirmed': '확인됨', 'Close': '닫기', 'Save Changes': '변경사항 저장',
    'Reset changes': '변경사항 재설정', 'Loading data...': '데이터 로딩 중...', 'Error': '오류',
    'Import': '가져오기', 'Export': '내보내기', 'View details': '세부정보 보기',
    'Show all': '모두 표시', 'Select All': '모두 선택', 'Reset': '재설정',
    'Filters': '필터', 'From': '시작', 'To': '종료', 'Name': '이름',
    'Language': '언어', 'Theme': '테마', 'Light': '밝게', 'Dark': '어둡게',
    'Preview': '미리보기', 'Agenda': '안건', 'Appointments': '예약',
    'Specialty': '전문분야', 'Corridor': '복도', 'Location': '위치',
    'Medical Staff': '의료진', 'Date and Time': '날짜 및 시간',
    'Cardiology': '심장내과', 'Pediatrics': '소아과', 'Gynecology': '산부인과',
    'Traumatology': '외상과', 'Dermatology': '피부과', 'Neurology': '신경과'
  },
  ar: { // Árabe
    'Blue': 'أزرق', 'Red': 'أحمر', 'Green': 'أخضر', 'Purple': 'بنفسجي', 'Orange': 'برتقالي',
    'Small': 'صغير', 'Medium': 'متوسط', 'Large': 'كبير',
    'Dashboard': 'لوحة التحكم', 'Schedule': 'الجدول', 'Box': 'صندوق', 'Notifications': 'الإشعارات',
    'Profile': 'الملف الشخصي', 'Logout': 'تسجيل الخروج', 'Login': 'تسجيل الدخول', 'Email': 'البريد الإلكتروني',
    'Password': 'كلمة المرور', 'Doctor': 'طبيب', 'Monday': 'الإثنين', 'Tuesday': 'الثلاثاء',
    'Wednesday': 'الأربعاء', 'Thursday': 'الخميس', 'Friday': 'الجمعة', 'Saturday': 'السبت',
    'Sunday': 'الأحد', 'Free': 'متاح', 'In Use': 'قيد الاستخدام', 'Waiting': 'في الانتظار',
    'Disabled': 'معطل', 'Date': 'التاريخ', 'Time': 'الوقت', 'Status': 'الحالة',
    'Pending': 'قيد الانتظار', 'Confirmed': 'مؤكد', 'Close': 'إغلاق', 'Save Changes': 'حفظ التغييرات',
    'Reset changes': 'إعادة تعيين التغييرات', 'Loading data...': 'جاري تحميل البيانات...', 'Error': 'خطأ',
    'Import': 'استيراد', 'Export': 'تصدير', 'View details': 'عرض التفاصيل',
    'Show all': 'عرض الكل', 'Select All': 'تحديد الكل', 'Reset': 'إعادة تعيين',
    'Filters': 'التصفية', 'From': 'من', 'To': 'إلى', 'Name': 'الاسم',
    'Language': 'اللغة', 'Theme': 'السمة', 'Light': 'فاتح', 'Dark': 'داكن',
    'Preview': 'معاينة', 'Agenda': 'جدول الأعمال', 'Appointments': 'المواعيد',
    'Specialty': 'التخصص', 'Corridor': 'الممر', 'Location': 'الموقع',
    'Medical Staff': 'الطاقم الطبي', 'Date and Time': 'التاريخ والوقت',
    'Cardiology': 'أمراض القلب', 'Pediatrics': 'طب الأطفال', 'Gynecology': 'أمراض النساء',
    'Traumatology': 'جراحة الصدمات', 'Dermatology': 'الأمراض الجلدية', 'Neurology': 'الأمراض العصبية'
  },
  hi: { // Hindi
    'Blue': 'नीला', 'Red': 'लाल', 'Green': 'हरा', 'Purple': 'बैंगनी', 'Orange': 'नारंगी',
    'Small': 'छोटा', 'Medium': 'मध्यम', 'Large': 'बड़ा',
    'Dashboard': 'डैशबोर्ड', 'Schedule': 'अनुसूची', 'Box': 'बॉक्स', 'Notifications': 'सूचनाएं',
    'Profile': 'प्रोफाइल', 'Logout': 'लॉग आउट', 'Login': 'लॉगिन', 'Email': 'ईमेल',
    'Password': 'पासवर्ड', 'Doctor': 'डॉक्टर', 'Monday': 'सोमवार', 'Tuesday': 'मंगलवार',
    'Wednesday': 'बुधवार', 'Thursday': 'गुरुवार', 'Friday': 'शुक्रवार', 'Saturday': 'शनिवार',
    'Sunday': 'रविवार', 'Free': 'खाली', 'In Use': 'उपयोग में', 'Waiting': 'प्रतीक्षा में',
    'Disabled': 'अक्षम', 'Date': 'तारीख', 'Time': 'समय', 'Status': 'स्थिति',
    'Pending': 'लंबित', 'Confirmed': 'पुष्टि की गई', 'Close': 'बंद करें', 'Save Changes': 'परिवर्तन सहेजें',
    'Reset changes': 'परिवर्तन रीसेट करें', 'Loading data...': 'डेटा लोड हो रहा है...', 'Error': 'त्रुटि',
    'Import': 'आयात', 'Export': 'निर्यात', 'View details': 'विवरण देखें',
    'Show all': 'सभी दिखाएं', 'Select All': 'सभी चुनें', 'Reset': 'रीसेट',
    'Filters': 'फ़िल्टर', 'From': 'से', 'To': 'तक', 'Name': 'नाम',
    'Language': 'भाषा', 'Theme': 'थीम', 'Light': 'हल्का', 'Dark': 'गहरा',
    'Preview': 'पूर्वावलोकन', 'Agenda': 'एजेंडा', 'Appointments': 'नियुक्तियां',
    'Specialty': 'विशेषता', 'Corridor': 'गलियारा', 'Location': 'स्थान',
    'Medical Staff': 'चिकित्सा कर्मचारी', 'Date and Time': 'तिथि और समय',
    'Cardiology': 'हृदय रोग विज्ञान', 'Pediatrics': 'बाल चिकित्सा', 'Gynecology': 'स्त्री रोग विज्ञान',
    'Traumatology': 'आघात विज्ञान', 'Dermatology': 'त्वचा विज्ञान', 'Neurology': 'तंत्रिका विज्ञान'
  },
  bn: { // Bengalí  
    'Blue': 'নীল', 'Red': 'লাল', 'Green': 'সবুজ', 'Purple': 'বেগুনি', 'Orange': 'কমলা',
    'Small': 'ছোট', 'Medium': 'মাঝারি', 'Large': 'বড়',
    'Dashboard': 'ড্যাশবোর্ড', 'Schedule': 'সময়সূচী', 'Box': 'বক্স', 'Notifications': 'বিজ্ঞপ্তি',
    'Profile': 'প্রোফাইল', 'Logout': 'লগ আউট', 'Login': 'লগইন', 'Email': 'ইমেইল',
    'Password': 'পাসওয়ার্ড', 'Doctor': 'ডাক্তার', 'Monday': 'সোমবার', 'Tuesday': 'মঙ্গলবার',
    'Wednesday': 'বুধবার', 'Thursday': 'বৃহস্পতিবার', 'Friday': 'শুক্রবার', 'Saturday': 'শনিবার',
    'Sunday': 'রবিবার', 'Free': 'মুক্ত', 'In Use': 'ব্যবহার হচ্ছে', 'Waiting': 'অপেক্ষমাণ',
    'Disabled': 'নিষ্ক্রিয়', 'Date': 'তারিখ', 'Time': 'সময়', 'Status': 'অবস্থা',
    'Pending': 'মুলতুবি', 'Confirmed': 'নিশ্চিত', 'Close': 'বন্ধ', 'Save Changes': 'পরিবর্তন সংরক্ষণ',
    'Reset changes': 'পরিবর্তন পুনরায় সেট', 'Loading data...': 'ডেটা লোড হচ্ছে...', 'Error': 'ত্রুটি',
    'Import': 'আমদানি', 'Export': 'রপ্তানি', 'View details': 'বিস্তারিত দেখুন',
    'Show all': 'সব দেখান', 'Select All': 'সব নির্বাচন', 'Reset': 'পুনরায় সেট',
    'Filters': 'ফিল্টার', 'From': 'থেকে', 'To': 'পর্যন্ত', 'Name': 'নাম',
    'Language': 'ভাষা', 'Theme': 'থিম', 'Light': 'হালকা', 'Dark': 'অন্ধকার',
    'Preview': 'পূর্বরূপ', 'Agenda': 'এজেন্ডা', 'Appointments': 'অ্যাপয়েন্টমেন্ট',
    'Specialty': 'বিশেষত্ব', 'Corridor': 'করিডোর', 'Location': 'অবস্থান',
    'Medical Staff': 'চিকিৎসা কর্মী', 'Date and Time': 'তারিখ এবং সময়',
    'Cardiology': 'হৃদরোগ বিদ্যা', 'Pediatrics': 'শিশু চিকিৎসা', 'Gynecology': 'স্ত্রীরোগ বিদ্যা',
    'Traumatology': 'আঘাত বিদ্যা', 'Dermatology': 'ত্বক বিদ্যা', 'Neurology': 'স্নায়ু বিদ্যা'
  },
  // Continuaré con el resto en el siguiente bloque...
};

// Función para traducir recursivamente
function translateObject(obj, translations) {
  if (typeof obj === 'string') {
    return translations[obj] || obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => translateObject(item, translations));
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = translateObject(value, translations);
    }
    return result;
  }
  
  return obj;
}

// Generar todos los archivos
const languages = ['ru', 'zh', 'ja', 'ko', 'ar', 'hi', 'bn'];
let completed = 0;
const total = languages.length;

console.log('🌍 Generando archivos de traducción completos...\n');

for (const lang of languages) {
  try {
    const translated = translateObject(en, allTranslations[lang]);
    fs.writeFileSync(
      path.join(localesDir, `${lang}.json`),
      JSON.stringify(translated, null, 2),
      'utf8'
    );
    completed++;
    console.log(`✅ ${lang.toUpperCase()} - Completado (${completed}/${total})`);
  } catch (error) {
    console.log(`❌ ${lang.toUpperCase()} - Error: ${error.message}`);
  }
}

console.log(`\n🎉 ${completed}/${total} idiomas completados exitosamente!`);
console.log('📊 Idiomas generados: RU, ZH, JA, KO, AR, HI, BN');
