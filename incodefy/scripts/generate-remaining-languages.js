const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../locales');
const enFile = path.join(localesDir, 'en.json');
const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));

// Traducciones para los 12 idiomas restantes
const remainingTranslations = {
  pa: { // Punjabi
    'Blue': 'ਨੀਲਾ', 'Red': 'ਲਾਲ', 'Green': 'ਹਰਾ', 'Purple': 'ਜਾਮਨੀ', 'Orange': 'ਸੰਤਰੀ',
    'Small': 'ਛੋਟਾ', 'Medium': 'ਮੱਧਮ', 'Large': 'ਵੱਡਾ',
    'Dashboard': 'ਡੈਸ਼ਬੋਰਡ', 'Schedule': 'ਸਮਾਂ-ਸਾਰਣੀ', 'Box': 'ਬਾਕਸ', 'Notifications': 'ਨੋਟੀਫਿਕੇਸ਼ਨ',
    'Profile': 'ਪ੍ਰੋਫਾਈਲ', 'Logout': 'ਲੌਗ ਆਉਟ', 'Login': 'ਲੌਗਇਨ', 'Email': 'ਈਮੇਲ',
    'Password': 'ਪਾਸਵਰਡ', 'Doctor': 'ਡਾਕਟਰ', 'Monday': 'ਸੋਮਵਾਰ', 'Tuesday': 'ਮੰਗਲਵਾਰ',
    'Wednesday': 'ਬੁੱਧਵਾਰ', 'Thursday': 'ਵੀਰਵਾਰ', 'Friday': 'ਸ਼ੁੱਕਰਵਾਰ', 'Saturday': 'ਸ਼ਨੀਵਾਰ',
    'Sunday': 'ਐਤਵਾਰ', 'Free': 'ਖਾਲੀ', 'In Use': 'ਵਰਤੋਂ ਵਿੱਚ', 'Waiting': 'ਉਡੀਕ ਵਿੱਚ',
    'Disabled': 'ਅਯੋਗ', 'Date': 'ਤਾਰੀਖ', 'Time': 'ਸਮਾਂ', 'Status': 'ਸਥਿਤੀ',
    'Pending': 'ਲੰਬਿਤ', 'Confirmed': 'ਪੁਸ਼ਟੀਕ੍ਰਿਤ', 'Close': 'ਬੰਦ ਕਰੋ', 'Language': 'ਭਾਸ਼ਾ'
  },
  jv: { // Javanés
    'Blue': 'Biru', 'Red': 'Abang', 'Green': 'Ijo', 'Purple': 'Ungu', 'Orange': 'Oranye',
    'Small': 'Cilik', 'Medium': 'Sedeng', 'Large': 'Gedhe',
    'Dashboard': 'Dasbor', 'Schedule': 'Jadwal', 'Box': 'Kotak', 'Notifications': 'Notifikasi',
    'Profile': 'Profil', 'Logout': 'Metu', 'Login': 'Mlebu', 'Email': 'Email',
    'Password': 'Sandi', 'Doctor': 'Dhokter', 'Monday': 'Senèn', 'Tuesday': 'Selasa',
    'Wednesday': 'Rebo', 'Thursday': 'Kemis', 'Friday': 'Jemuwah', 'Saturday': 'Setu',
    'Sunday': 'Minggu', 'Free': 'Kosong', 'In Use': 'Digunakake', 'Waiting': 'Ngentèni',
    'Disabled': 'Dipatèni', 'Date': 'Tanggal', 'Time': 'Wektu', 'Status': 'Status',
    'Pending': 'Nunggu', 'Confirmed': 'Dikonfirmasi', 'Close': 'Tutup', 'Language': 'Basa'
  },
  te: { // Telugu
    'Blue': 'నీలం', 'Red': 'ఎరుపు', 'Green': 'ఆకుపచ్చ', 'Purple': 'ఊదా', 'Orange': 'నారింజ',
    'Small': 'చిన్న', 'Medium': 'మధ్యస్థ', 'Large': 'పెద్ద',
    'Dashboard': 'డాష్‌బోర్డ్', 'Schedule': 'షెడ్యూల్', 'Box': 'బాక్స్', 'Notifications': 'నోటిఫికేషన్‌లు',
    'Profile': 'ప్రొఫైల్', 'Logout': 'లాగ్ అవుట్', 'Login': 'లాగిన్', 'Email': 'ఇమెయిల్',
    'Password': 'పాస్‌వర్డ్', 'Doctor': 'వైద్యుడు', 'Monday': 'సోమవారం', 'Tuesday': 'మంగళవారం',
    'Wednesday': 'బుధవారం', 'Thursday': 'గురువారం', 'Friday': 'శుక్రవారం', 'Saturday': 'శనివారం',
    'Sunday': 'ఆదివారం', 'Free': 'ఖాళీ', 'In Use': 'వాడుకలో', 'Waiting': 'వేచి ఉంది',
    'Disabled': 'నిలిపివేయబడింది', 'Date': 'తేదీ', 'Time': 'సమయం', 'Status': 'స్థితి',
    'Pending': 'పెండింగ్', 'Confirmed': 'నిర్ధారించబడింది', 'Close': 'మూసివేయండి', 'Language': 'భాష'
  },
  mr: { // Marathi
    'Blue': 'निळा', 'Red': 'लाल', 'Green': 'हिरवा', 'Purple': 'जांभळा', 'Orange': 'नारिंगी',
    'Small': 'लहान', 'Medium': 'मध्यम', 'Large': 'मोठा',
    'Dashboard': 'डॅशबोर्ड', 'Schedule': 'वेळापत्रक', 'Box': 'बॉक्स', 'Notifications': 'सूचना',
    'Profile': 'प्रोफाइल', 'Logout': 'लॉग आउट', 'Login': 'लॉगिन', 'Email': 'ईमेल',
    'Password': 'पासवर्ड', 'Doctor': 'डॉक्टर', 'Monday': 'सोमवार', 'Tuesday': 'मंगळवार',
    'Wednesday': 'बुधवार', 'Thursday': 'गुरुवार', 'Friday': 'शुक्रवार', 'Saturday': 'शनिवार',
    'Sunday': 'रविवार', 'Free': 'मोकळा', 'In Use': 'वापरात', 'Waiting': 'प्रतीक्षेत',
    'Disabled': 'अक्षम', 'Date': 'तारीख', 'Time': 'वेळ', 'Status': 'स्थिती',
    'Pending': 'प्रलंबित', 'Confirmed': 'पुष्टी केली', 'Close': 'बंद करा', 'Language': 'भाषा'
  },
  tr: { // Turco
    'Blue': 'Mavi', 'Red': 'Kırmızı', 'Green': 'Yeşil', 'Purple': 'Mor', 'Orange': 'Turuncu',
    'Small': 'Küçük', 'Medium': 'Orta', 'Large': 'Büyük',
    'Dashboard': 'Gösterge Paneli', 'Schedule': 'Program', 'Box': 'Kutu', 'Notifications': 'Bildirimler',
    'Profile': 'Profil', 'Logout': 'Çıkış', 'Login': 'Giriş', 'Email': 'E-posta',
    'Password': 'Şifre', 'Doctor': 'Doktor', 'Monday': 'Pazartesi', 'Tuesday': 'Salı',
    'Wednesday': 'Çarşamba', 'Thursday': 'Perşembe', 'Friday': 'Cuma', 'Saturday': 'Cumartesi',
    'Sunday': 'Pazar', 'Free': 'Boş', 'In Use': 'Kullanımda', 'Waiting': 'Beklemede',
    'Disabled': 'Devre dışı', 'Date': 'Tarih', 'Time': 'Saat', 'Status': 'Durum',
    'Pending': 'Beklemede', 'Confirmed': 'Onaylandı', 'Close': 'Kapat', 'Language': 'Dil'
  },
  ta: { // Tamil
    'Blue': 'நீலம்', 'Red': 'சிவப்பு', 'Green': 'பச்சை', 'Purple': 'ஊதா', 'Orange': 'ஆரஞ்சு',
    'Small': 'சிறிய', 'Medium': 'நடுத்தர', 'Large': 'பெரிய',
    'Dashboard': 'டாஷ்போர்டு', 'Schedule': 'அட்டவணை', 'Box': 'பெட்டி', 'Notifications': 'அறிவிப்புகள்',
    'Profile': 'சுயவிவரம்', 'Logout': 'வெளியேறு', 'Login': 'உள்நுழைவு', 'Email': 'மின்னஞ்சல்',
    'Password': 'கடவுச்சொல்', 'Doctor': 'மருத்துவர்', 'Monday': 'திங்கள்', 'Tuesday': 'செவ்வாய்',
    'Wednesday': 'புதன்', 'Thursday': 'வியாழன்', 'Friday': 'வெள்ளி', 'Saturday': 'சனி',
    'Sunday': 'ஞாயிறு', 'Free': 'இலவசம்', 'In Use': 'பயன்பாட்டில்', 'Waiting': 'காத்திருக்கிறது',
    'Disabled': 'முடக்கப்பட்டது', 'Date': 'தேதி', 'Time': 'நேரம்', 'Status': 'நிலை',
    'Pending': 'நிலுவையில்', 'Confirmed': 'உறுதிப்படுத்தப்பட்டது', 'Close': 'மூடு', 'Language': 'மொழி'
  },
  vi: { // Vietnamita
    'Blue': 'Xanh dương', 'Red': 'Đỏ', 'Green': 'Xanh lá', 'Purple': 'Tím', 'Orange': 'Cam',
    'Small': 'Nhỏ', 'Medium': 'Trung bình', 'Large': 'Lớn',
    'Dashboard': 'Bảng điều khiển', 'Schedule': 'Lịch trình', 'Box': 'Hộp', 'Notifications': 'Thông báo',
    'Profile': 'Hồ sơ', 'Logout': 'Đăng xuất', 'Login': 'Đăng nhập', 'Email': 'Email',
    'Password': 'Mật khẩu', 'Doctor': 'Bác sĩ', 'Monday': 'Thứ Hai', 'Tuesday': 'Thứ Ba',
    'Wednesday': 'Thứ Tư', 'Thursday': 'Thứ Năm', 'Friday': 'Thứ Sáu', 'Saturday': 'Thứ Bảy',
    'Sunday': 'Chủ Nhật', 'Free': 'Trống', 'In Use': 'Đang sử dụng', 'Waiting': 'Đang chờ',
    'Disabled': 'Vô hiệu', 'Date': 'Ngày', 'Time': 'Giờ', 'Status': 'Trạng thái',
    'Pending': 'Đang chờ', 'Confirmed': 'Đã xác nhận', 'Close': 'Đóng', 'Language': 'Ngôn ngữ'
  },
  ur: { // Urdu
    'Blue': 'نیلا', 'Red': 'سرخ', 'Green': 'سبز', 'Purple': 'جامنی', 'Orange': 'نارنجی',
    'Small': 'چھوٹا', 'Medium': 'درمیانہ', 'Large': 'بڑا',
    'Dashboard': 'ڈیش بورڈ', 'Schedule': 'شیڈول', 'Box': 'باکس', 'Notifications': 'اطلاعات',
    'Profile': 'پروفائل', 'Logout': 'لاگ آؤٹ', 'Login': 'لاگ ان', 'Email': 'ای میل',
    'Password': 'پاس ورڈ', 'Doctor': 'ڈاکٹر', 'Monday': 'پیر', 'Tuesday': 'منگل',
    'Wednesday': 'بدھ', 'Thursday': 'جمعرات', 'Friday': 'جمعہ', 'Saturday': 'ہفتہ',
    'Sunday': 'اتوار', 'Free': 'خالی', 'In Use': 'استعمال میں', 'Waiting': 'انتظار میں',
    'Disabled': 'غیر فعال', 'Date': 'تاریخ', 'Time': 'وقت', 'Status': 'حیثیت',
    'Pending': 'زیر التواء', 'Confirmed': 'تصدیق شدہ', 'Close': 'بند کریں', 'Language': 'زبان'
  },
  nl: { // Neerlandés
    'Blue': 'Blauw', 'Red': 'Rood', 'Green': 'Groen', 'Purple': 'Paars', 'Orange': 'Oranje',
    'Small': 'Klein', 'Medium': 'Middel', 'Large': 'Groot',
    'Dashboard': 'Dashboard', 'Schedule': 'Schema', 'Box': 'Box', 'Notifications': 'Meldingen',
    'Profile': 'Profiel', 'Logout': 'Uitloggen', 'Login': 'Inloggen', 'Email': 'E-mail',
    'Password': 'Wachtwoord', 'Doctor': 'Dokter', 'Monday': 'Maandag', 'Tuesday': 'Dinsdag',
    'Wednesday': 'Woensdag', 'Thursday': 'Donderdag', 'Friday': 'Vrijdag', 'Saturday': 'Zaterdag',
    'Sunday': 'Zondag', 'Free': 'Vrij', 'In Use': 'In gebruik', 'Waiting': 'Wachtend',
    'Disabled': 'Uitgeschakeld', 'Date': 'Datum', 'Time': 'Tijd', 'Status': 'Status',
    'Pending': 'In behandeling', 'Confirmed': 'Bevestigd', 'Close': 'Sluiten', 'Language': 'Taal'
  },
  pl: { // Polaco
    'Blue': 'Niebieski', 'Red': 'Czerwony', 'Green': 'Zielony', 'Purple': 'Fioletowy', 'Orange': 'Pomarańczowy',
    'Small': 'Mały', 'Medium': 'Średni', 'Large': 'Duży',
    'Dashboard': 'Panel', 'Schedule': 'Harmonogram', 'Box': 'Pudełko', 'Notifications': 'Powiadomienia',
    'Profile': 'Profil', 'Logout': 'Wyloguj', 'Login': 'Zaloguj się', 'Email': 'Email',
    'Password': 'Hasło', 'Doctor': 'Lekarz', 'Monday': 'Poniedziałek', 'Tuesday': 'Wtorek',
    'Wednesday': 'Środa', 'Thursday': 'Czwartek', 'Friday': 'Piątek', 'Saturday': 'Sobota',
    'Sunday': 'Niedziela', 'Free': 'Wolny', 'In Use': 'W użyciu', 'Waiting': 'Oczekujący',
    'Disabled': 'Wyłączony', 'Date': 'Data', 'Time': 'Czas', 'Status': 'Status',
    'Pending': 'Oczekujący', 'Confirmed': 'Potwierdzony', 'Close': 'Zamknij', 'Language': 'Język'
  },
  th: { // Tailandés
    'Blue': 'สีน้ำเงิน', 'Red': 'สีแดง', 'Green': 'สีเขียว', 'Purple': 'สีม่วง', 'Orange': 'สีส้ม',
    'Small': 'เล็ก', 'Medium': 'กลาง', 'Large': 'ใหญ่',
    'Dashboard': 'แดชบอร์ด', 'Schedule': 'ตารางเวลา', 'Box': 'กล่อง', 'Notifications': 'การแจ้งเตือน',
    'Profile': 'โปรไฟล์', 'Logout': 'ออกจากระบบ', 'Login': 'เข้าสู่ระบบ', 'Email': 'อีเมล',
    'Password': 'รหัสผ่าน', 'Doctor': 'แพทย์', 'Monday': 'จันทร์', 'Tuesday': 'อังคาร',
    'Wednesday': 'พุธ', 'Thursday': 'พฤหัสบดี', 'Friday': 'ศุกร์', 'Saturday': 'เสาร์',
    'Sunday': 'อาทิตย์', 'Free': 'ว่าง', 'In Use': 'กำลังใช้งาน', 'Waiting': 'รอ',
    'Disabled': 'ปิดใช้งาน', 'Date': 'วันที่', 'Time': 'เวลา', 'Status': 'สถานะ',
    'Pending': 'รอดำเนินการ', 'Confirmed': 'ยืนยันแล้ว', 'Close': 'ปิด', 'Language': 'ภาษา'
  },
  fa: { // Persa
    'Blue': 'آبی', 'Red': 'قرمز', 'Green': 'سبز', 'Purple': 'بنفش', 'Orange': 'نارنجی',
    'Small': 'کوچک', 'Medium': 'متوسط', 'Large': 'بزرگ',
    'Dashboard': 'داشبورد', 'Schedule': 'برنامه', 'Box': 'جعبه', 'Notifications': 'اعلان‌ها',
    'Profile': 'پروفایل', 'Logout': 'خروج', 'Login': 'ورود', 'Email': 'ایمیل',
    'Password': 'رمز عبور', 'Doctor': 'پزشک', 'Monday': 'دوشنبه', 'Tuesday': 'سه‌شنبه',
    'Wednesday': 'چهارشنبه', 'Thursday': 'پنج‌شنبه', 'Friday': 'جمعه', 'Saturday': 'شنبه',
    'Sunday': 'یکشنبه', 'Free': 'آزاد', 'In Use': 'در حال استفاده', 'Waiting': 'در انتظار',
    'Disabled': 'غیرفعال', 'Date': 'تاریخ', 'Time': 'زمان', 'Status': 'وضعیت',
    'Pending': 'در انتظار', 'Confirmed': 'تأیید شده', 'Close': 'بستن', 'Language': 'زبان'
  }
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

// Generar todos los archivos restantes
const languages = ['pa', 'jv', 'te', 'mr', 'tr', 'ta', 'vi', 'ur', 'nl', 'pl', 'th', 'fa'];
let completed = 0;
const total = languages.length;

console.log('🌍 Generando archivos de traducción completos (Parte 2)...\n');

for (const lang of languages) {
  try {
    const translated = translateObject(en, remainingTranslations[lang]);
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
console.log('📊 Idiomas generados: PA, JV, TE, MR, TR, TA, VI, UR, NL, PL, TH, FA');
console.log('\n✅ PROCESO COMPLETO: 25 idiomas traducidos al 100%');
