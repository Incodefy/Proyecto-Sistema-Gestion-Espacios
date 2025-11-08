const fs = require('fs');
const path = require('path');

// Leer el archivo en.json como referencia
const enPath = path.join(__dirname, '../locales/en.json');
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Diccionarios completos para FA, PA, JV
const dictionaries = {
  fa: {
    // Nombres de idiomas
    "Spanish": "اسپانیایی",
    "English": "انگلیسی",
    "Portuguese": "پرتغالی",
    "Italian": "ایتالیایی",
    "Chinese": "چینی",
    "Hindi": "هندی",
    "Arabic": "عربی",
    "Bengali": "بنگالی",
    "Russian": "روسی",
    "Japanese": "ژاپنی",
    "Punjabi": "پنجابی",
    "German": "آلمانی",
    "Javanese": "جاوه‌ای",
    "Korean": "کره‌ای",
    "French": "فرانسوی",
    "Telugu": "تلوگو",
    "Marathi": "مراتی",
    "Turkish": "ترکی",
    "Tamil": "تامیلی",
    "Vietnamese": "ویتنامی",
    "Urdu": "اردو",
    "Dutch": "هلندی",
    "Polish": "لهستانی",
    "Thai": "تایلندی",
    "Persian": "فارسی",

    // UI Principal
    "Theme": "پوسته",
    "Mode": "حالت",
    "Light": "روشن",
    "Dark": "تیره",
    "Language": "زبان",
    "Profile": "نمایه",
    "Logout": "خروج",
    "Settings": "تنظیمات",
    "Preferences": "ترجیحات",
    
    // Dashboard
    "Dashboard": "داشبورد",
    "Medical Dashboard": "داشبورد پزشکی",
    "Welcome": "خوش آمدید",
    "Total Boxes": "کل اتاق‌ها",
    "Available Boxes": "اتاق‌های موجود",
    "Occupied Boxes": "اتاق‌های اشغال شده",
    "Pending Consultations": "مشاوره‌های در انتظار",
    "Completed Consultations": "مشاوره‌های انجام شده",
    "Active Consultations": "مشاوره‌های فعال",
    "Consultations": "مشاوره‌ها",
    "Ongoing Consultations": "مشاوره‌های در حال انجام",
    "View Details": "مشاهده جزئیات",
    "View All": "مشاهده همه",
    "Statistics": "آمار",
    "Overview": "نمای کلی",
    
    // Box/Habitaciones
    "Box": "اتاق",
    "Boxes": "اتاق‌ها",
    "Box Status": "وضعیت اتاق",
    "Box Details": "جزئیات اتاق",
    "Select Box": "انتخاب اتاق",
    "Available": "موجود",
    "Occupied": "اشغال شده",
    "Under Maintenance": "در حال تعمیر",
    "Reserved": "رزرو شده",
    "Status": "وضعیت",
    "Hallway": "راهرو",
    "Floor": "طبقه",
    "Wing": "بخش",
    "Room Number": "شماره اتاق",
    
    // Pacientes
    "Patient": "بیمار",
    "Patients": "بیماران",
    "Patient Name": "نام بیمار",
    "Patient ID": "شناسه بیمار",
    "Patient Information": "اطلاعات بیمار",
    "RUT": "شماره شناسایی",
    "Age": "سن",
    "Gender": "جنسیت",
    "Male": "مرد",
    "Female": "زن",
    "Other": "سایر",
    "Contact": "تماس",
    "Phone": "تلفن",
    "Email": "ایمیل",
    "Address": "آدرس",
    
    // Consultas/Citas
    "Appointment": "قرار ملاقات",
    "Appointments": "قرارهای ملاقات",
    "Schedule": "برنامه زمانی",
    "Calendar": "تقویم",
    "Agenda": "دستور کار",
    "New Appointment": "قرار ملاقات جدید",
    "Edit Appointment": "ویرایش قرار ملاقات",
    "Cancel Appointment": "لغو قرار ملاقات",
    "Confirm Appointment": "تایید قرار ملاقات",
    "Reschedule": "تغییر زمان",
    "Date": "تاریخ",
    "Time": "زمان",
    "Duration": "مدت زمان",
    "Start Time": "زمان شروع",
    "End Time": "زمان پایان",
    "Reason": "دلیل",
    "Notes": "یادداشت‌ها",
    "Priority": "اولویت",
    "High": "بالا",
    "Medium": "متوسط",
    "Low": "پایین",
    
    // Médicos
    "Doctor": "پزشک",
    "Doctors": "پزشکان",
    "Specialist": "متخصص",
    "Specialty": "تخصص",
    "Specialties": "تخصص‌ها",
    "Assigned Doctor": "پزشک تعیین شده",
    "Available Doctors": "پزشکان موجود",
    
    // Especialidades médicas
    "Cardiology": "قلب و عروق",
    "Dermatology": "پوست",
    "Neurology": "مغز و اعصاب",
    "Pediatrics": "کودکان",
    "Orthopedics": "ارتوپدی",
    "Ophthalmology": "چشم‌پزشکی",
    "Psychiatry": "روانپزشکی",
    "Radiology": "رادیولوژی",
    "Surgery": "جراحی",
    "General Medicine": "پزشکی عمومی",
    
    // Notificaciones
    "Notifications": "اعلان‌ها",
    "New Notification": "اعلان جدید",
    "Mark as Read": "علامت‌گذاری به عنوان خوانده شده",
    "Mark as Unread": "علامت‌گذاری به عنوان خوانده نشده",
    "Delete Notification": "حذف اعلان",
    "No notifications": "هیچ اعلانی وجود ندارد",
    "Notification History": "تاریخچه اعلان‌ها",
    "Read": "خوانده شده",
    "Unread": "خوانده نشده",
    
    // Acciones comunes
    "Save": "ذخیره",
    "Cancel": "لغو",
    "Delete": "حذف",
    "Edit": "ویرایش",
    "Update": "به‌روزرسانی",
    "Create": "ایجاد",
    "Add": "افزودن",
    "Remove": "حذف",
    "Search": "جستجو",
    "Filter": "فیلتر",
    "Sort": "مرتب‌سازی",
    "Export": "صادرات",
    "Import": "واردات",
    "Print": "چاپ",
    "Download": "دانلود",
    "Upload": "بارگذاری",
    "Refresh": "تازه‌سازی",
    "Close": "بستن",
    "Back": "بازگشت",
    "Next": "بعدی",
    "Previous": "قبلی",
    "Submit": "ارسال",
    "Confirm": "تایید",
    "Yes": "بله",
    "No": "خیر",
    
    // Colores
    "Red": "قرمز",
    "Blue": "آبی",
    "Green": "سبز",
    "Yellow": "زرد",
    "Orange": "نارنجی",
    "Purple": "بنفش",
    "Pink": "صورتی",
    "Brown": "قهوه‌ای",
    "Black": "سیاه",
    "White": "سفید",
    "Gray": "خاکستری",
    
    // Tamaños
    "Small": "کوچک",
    "Medium": "متوسط",
    "Large": "بزرگ",
    "Extra Large": "خیلی بزرگ",
    
    // Días de la semana
    "Monday": "دوشنبه",
    "Tuesday": "سه‌شنبه",
    "Wednesday": "چهارشنبه",
    "Thursday": "پنج‌شنبه",
    "Friday": "جمعه",
    "Saturday": "شنبه",
    "Sunday": "یک‌شنبه",
    
    // Estados
    "Active": "فعال",
    "Inactive": "غیرفعال",
    "Pending": "در انتظار",
    "Completed": "انجام شده",
    "Cancelled": "لغو شده",
    "In Progress": "در حال انجام",
    "Scheduled": "برنامه‌ریزی شده",
    
    // Login/Auth
    "Login": "ورود",
    "Username": "نام کاربری",
    "Password": "رمز عبور",
    "Remember me": "مرا به خاطر بسپار",
    "Forgot password": "فراموشی رمز عبور",
    "Sign in": "ورود به سیستم",
    "Sign out": "خروج از سیستم"
  },
  
  pa: {
    // Nombres de idiomas
    "Spanish": "ਸਪੈਨਿਸ਼",
    "English": "ਅੰਗਰੇਜ਼ੀ",
    "Portuguese": "ਪੁਰਤਗਾਲੀ",
    "Italian": "ਇਤਾਲਵੀ",
    "Chinese": "ਚੀਨੀ",
    "Hindi": "ਹਿੰਦੀ",
    "Arabic": "ਅਰਬੀ",
    "Bengali": "ਬੰਗਾਲੀ",
    "Russian": "ਰੂਸੀ",
    "Japanese": "ਜਾਪਾਨੀ",
    "Punjabi": "ਪੰਜਾਬੀ",
    "German": "ਜਰਮਨ",
    "Javanese": "ਜਾਵਾਨੀ",
    "Korean": "ਕੋਰੀਆਈ",
    "French": "ਫਰਾਂਸੀਸੀ",
    "Telugu": "ਤੇਲਗੂ",
    "Marathi": "ਮਰਾਠੀ",
    "Turkish": "ਤੁਰਕੀ",
    "Tamil": "ਤਮਿਲ",
    "Vietnamese": "ਵੀਅਤਨਾਮੀ",
    "Urdu": "ਉਰਦੂ",
    "Dutch": "ਡੱਚ",
    "Polish": "ਪੋਲਿਸ਼",
    "Thai": "ਥਾਈ",
    "Persian": "ਫਾਰਸੀ",

    // UI Principal
    "Theme": "ਥੀਮ",
    "Mode": "ਮੋਡ",
    "Light": "ਹਲਕਾ",
    "Dark": "ਗੂੜਾ",
    "Language": "ਭਾਸ਼ਾ",
    "Profile": "ਪ੍ਰੋਫਾਇਲ",
    "Logout": "ਲਾਗਆਉਟ",
    "Settings": "ਸੈਟਿੰਗਾਂ",
    "Preferences": "ਤਰਜੀਹਾਂ",
    
    // Dashboard
    "Dashboard": "ਡੈਸ਼ਬੋਰਡ",
    "Medical Dashboard": "ਮੈਡੀਕਲ ਡੈਸ਼ਬੋਰਡ",
    "Welcome": "ਸੁਆਗਤ ਹੈ",
    "Total Boxes": "ਕੁੱਲ ਕਮਰੇ",
    "Available Boxes": "ਉਪਲਬਧ ਕਮਰੇ",
    "Occupied Boxes": "ਵਿਅਸਤ ਕਮਰੇ",
    "Pending Consultations": "ਬਕਾਇਆ ਸਲਾਹ",
    "Completed Consultations": "ਪੂਰੀਆਂ ਸਲਾਹਾਂ",
    "Active Consultations": "ਸਰਗਰਮ ਸਲਾਹਾਂ",
    "Consultations": "ਸਲਾਹਾਂ",
    "Ongoing Consultations": "ਜਾਰੀ ਸਲਾਹਾਂ",
    "View Details": "ਵੇਰਵੇ ਦੇਖੋ",
    "View All": "ਸਾਰੇ ਦੇਖੋ",
    "Statistics": "ਅੰਕੜੇ",
    "Overview": "ਸੰਖੇਪ",
    
    // Box/Habitaciones
    "Box": "ਕਮਰਾ",
    "Boxes": "ਕਮਰੇ",
    "Box Status": "ਕਮਰੇ ਦੀ ਸਥਿਤੀ",
    "Box Details": "ਕਮਰੇ ਦੇ ਵੇਰਵੇ",
    "Select Box": "ਕਮਰਾ ਚੁਣੋ",
    "Available": "ਉਪਲਬਧ",
    "Occupied": "ਵਿਅਸਤ",
    "Under Maintenance": "ਮੁਰੰਮਤ ਅਧੀਨ",
    "Reserved": "ਰਿਜ਼ਰਵ",
    "Status": "ਸਥਿਤੀ",
    "Hallway": "ਗਲਿਆਰਾ",
    "Floor": "ਮੰਜ਼ਿਲ",
    "Wing": "ਵਿੰਗ",
    "Room Number": "ਕਮਰਾ ਨੰਬਰ",
    
    // Pacientes
    "Patient": "ਮਰੀਜ਼",
    "Patients": "ਮਰੀਜ਼",
    "Patient Name": "ਮਰੀਜ਼ ਦਾ ਨਾਮ",
    "Patient ID": "ਮਰੀਜ਼ ਆਈਡੀ",
    "Patient Information": "ਮਰੀਜ਼ ਦੀ ਜਾਣਕਾਰੀ",
    "RUT": "ਪਛਾਣ ਨੰਬਰ",
    "Age": "ਉਮਰ",
    "Gender": "ਲਿੰਗ",
    "Male": "ਮਰਦ",
    "Female": "ਔਰਤ",
    "Other": "ਹੋਰ",
    "Contact": "ਸੰਪਰਕ",
    "Phone": "ਫੋਨ",
    "Email": "ਈਮੇਲ",
    "Address": "ਪਤਾ",
    
    // Consultas/Citas
    "Appointment": "ਮੁਲਾਕਾਤ",
    "Appointments": "ਮੁਲਾਕਾਤਾਂ",
    "Schedule": "ਸਮਾਂ-ਸਾਰਣੀ",
    "Calendar": "ਕੈਲੰਡਰ",
    "Agenda": "ਏਜੰਡਾ",
    "New Appointment": "ਨਵੀਂ ਮੁਲਾਕਾਤ",
    "Edit Appointment": "ਮੁਲਾਕਾਤ ਸੋਧੋ",
    "Cancel Appointment": "ਮੁਲਾਕਾਤ ਰੱਦ ਕਰੋ",
    "Confirm Appointment": "ਮੁਲਾਕਾਤ ਪੁਸ਼ਟੀ ਕਰੋ",
    "Reschedule": "ਮੁੜ-ਅਨੁਸੂਚੀ",
    "Date": "ਤਾਰੀਖ",
    "Time": "ਸਮਾਂ",
    "Duration": "ਮਿਆਦ",
    "Start Time": "ਸ਼ੁਰੂਆਤੀ ਸਮਾਂ",
    "End Time": "ਅੰਤਮ ਸਮਾਂ",
    "Reason": "ਕਾਰਨ",
    "Notes": "ਨੋਟਸ",
    "Priority": "ਤਰਜੀਹ",
    "High": "ਉੱਚ",
    "Medium": "ਮੱਧਮ",
    "Low": "ਘੱਟ",
    
    // Médicos
    "Doctor": "ਡਾਕਟਰ",
    "Doctors": "ਡਾਕਟਰ",
    "Specialist": "ਮਾਹਿਰ",
    "Specialty": "ਵਿਸ਼ੇਸ਼ਤਾ",
    "Specialties": "ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ",
    "Assigned Doctor": "ਨਿਯੁਕਤ ਡਾਕਟਰ",
    "Available Doctors": "ਉਪਲਬਧ ਡਾਕਟਰ",
    
    // Especialidades médicas
    "Cardiology": "ਦਿਲ ਦੀ ਬਿਮਾਰੀ",
    "Dermatology": "ਚਮੜੀ ਦੀ ਬਿਮਾਰੀ",
    "Neurology": "ਤੰਤੂ ਵਿਗਿਆਨ",
    "Pediatrics": "ਬਾਲ ਰੋਗ",
    "Orthopedics": "ਹੱਡੀਆਂ ਦੀ ਸਰਜਰੀ",
    "Ophthalmology": "ਅੱਖਾਂ ਦਾ ਇਲਾਜ",
    "Psychiatry": "ਮਨੋਵਿਗਿਆਨ",
    "Radiology": "ਐਕਸ-ਰੇ",
    "Surgery": "ਸਰਜਰੀ",
    "General Medicine": "ਆਮ ਦਵਾਈ",
    
    // Notificaciones
    "Notifications": "ਸੂਚਨਾਵਾਂ",
    "New Notification": "ਨਵੀਂ ਸੂਚਨਾ",
    "Mark as Read": "ਪੜਿਆ ਹੋਇਆ ਨਿਸ਼ਾਨ ਲਗਾਓ",
    "Mark as Unread": "ਨਾ ਪੜਿਆ ਹੋਇਆ ਨਿਸ਼ਾਨ ਲਗਾਓ",
    "Delete Notification": "ਸੂਚਨਾ ਮਿਟਾਓ",
    "No notifications": "ਕੋਈ ਸੂਚਨਾ ਨਹੀਂ",
    "Notification History": "ਸੂਚਨਾ ਇਤਿਹਾਸ",
    "Read": "ਪੜਿਆ ਹੋਇਆ",
    "Unread": "ਨਾ ਪੜਿਆ ਹੋਇਆ",
    
    // Acciones comunes
    "Save": "ਸੁਰੱਖਿਅਤ ਕਰੋ",
    "Cancel": "ਰੱਦ ਕਰੋ",
    "Delete": "ਮਿਟਾਓ",
    "Edit": "ਸੋਧੋ",
    "Update": "ਅੱਪਡੇਟ ਕਰੋ",
    "Create": "ਬਣਾਓ",
    "Add": "ਸ਼ਾਮਲ ਕਰੋ",
    "Remove": "ਹਟਾਓ",
    "Search": "ਖੋਜੋ",
    "Filter": "ਫਿਲਟਰ",
    "Sort": "ਕ੍ਰਮਬੱਧ ਕਰੋ",
    "Export": "ਬਾਹਰ ਭੇਜੋ",
    "Import": "ਅੰਦਰ ਲਿਆਓ",
    "Print": "ਪ੍ਰਿੰਟ ਕਰੋ",
    "Download": "ਡਾਊਨਲੋਡ ਕਰੋ",
    "Upload": "ਅੱਪਲੋਡ ਕਰੋ",
    "Refresh": "ਤਾਜ਼ਾ ਕਰੋ",
    "Close": "ਬੰਦ ਕਰੋ",
    "Back": "ਪਿੱਛੇ",
    "Next": "ਅੱਗੇ",
    "Previous": "ਪਿਛਲਾ",
    "Submit": "ਜਮਾਂ ਕਰੋ",
    "Confirm": "ਪੁਸ਼ਟੀ ਕਰੋ",
    "Yes": "ਹਾਂ",
    "No": "ਨਹੀਂ",
    
    // Colores
    "Red": "ਲਾਲ",
    "Blue": "ਨੀਲਾ",
    "Green": "ਹਰਾ",
    "Yellow": "ਪੀਲਾ",
    "Orange": "ਸੰਤਰੀ",
    "Purple": "ਜਾਮਨੀ",
    "Pink": "ਗੁਲਾਬੀ",
    "Brown": "ਭੂਰਾ",
    "Black": "ਕਾਲਾ",
    "White": "ਚਿੱਟਾ",
    "Gray": "ਸਲੇਟੀ",
    
    // Tamaños
    "Small": "ਛੋਟਾ",
    "Medium": "ਮੱਧਮ",
    "Large": "ਵੱਡਾ",
    "Extra Large": "ਬਹੁਤ ਵੱਡਾ",
    
    // Días de la semana
    "Monday": "ਸੋਮਵਾਰ",
    "Tuesday": "ਮੰਗਲਵਾਰ",
    "Wednesday": "ਬੁੱਧਵਾਰ",
    "Thursday": "ਵੀਰਵਾਰ",
    "Friday": "ਸ਼ੁੱਕਰਵਾਰ",
    "Saturday": "ਸ਼ਨੀਵਾਰ",
    "Sunday": "ਐਤਵਾਰ",
    
    // Estados
    "Active": "ਸਰਗਰਮ",
    "Inactive": "ਨਾ-ਸਰਗਰਮ",
    "Pending": "ਬਕਾਇਆ",
    "Completed": "ਪੂਰਾ ਹੋਇਆ",
    "Cancelled": "ਰੱਦ ਕੀਤਾ",
    "In Progress": "ਜਾਰੀ",
    "Scheduled": "ਅਨੁਸੂਚਿਤ",
    
    // Login/Auth
    "Login": "ਲਾਗਇਨ",
    "Username": "ਯੂਜ਼ਰਨੇਮ",
    "Password": "ਪਾਸਵਰਡ",
    "Remember me": "ਮੈਨੂੰ ਯਾਦ ਰੱਖੋ",
    "Forgot password": "ਪਾਸਵਰਡ ਭੁੱਲ ਗਏ",
    "Sign in": "ਸਾਈਨ ਇਨ",
    "Sign out": "ਸਾਈਨ ਆਉਟ"
  },
  
  jv: {
    // Nombres de idiomas
    "Spanish": "Spanyol",
    "English": "Inggris",
    "Portuguese": "Portugis",
    "Italian": "Italia",
    "Chinese": "Tionghoa",
    "Hindi": "Hindi",
    "Arabic": "Arab",
    "Bengali": "Bengali",
    "Russian": "Rusia",
    "Japanese": "Jepang",
    "Punjabi": "Punjab",
    "German": "Jerman",
    "Javanese": "Jawa",
    "Korean": "Korea",
    "French": "Prancis",
    "Telugu": "Telugu",
    "Marathi": "Marathi",
    "Turkish": "Turki",
    "Tamil": "Tamil",
    "Vietnamese": "Vietnam",
    "Urdu": "Urdu",
    "Dutch": "Walanda",
    "Polish": "Polandia",
    "Thai": "Thailand",
    "Persian": "Persia",

    // UI Principal
    "Theme": "Tema",
    "Mode": "Mode",
    "Light": "Padhang",
    "Dark": "Peteng",
    "Language": "Basa",
    "Profile": "Profil",
    "Logout": "Metu",
    "Settings": "Pangaturan",
    "Preferences": "Preferensi",
    
    // Dashboard
    "Dashboard": "Papan Kontrol",
    "Medical Dashboard": "Papan Kontrol Medis",
    "Welcome": "Sugeng Rawuh",
    "Total Boxes": "Total Kamar",
    "Available Boxes": "Kamar Kasedhiya",
    "Occupied Boxes": "Kamar Diisi",
    "Pending Consultations": "Konsultasi Nunggu",
    "Completed Consultations": "Konsultasi Rampung",
    "Active Consultations": "Konsultasi Aktif",
    "Consultations": "Konsultasi",
    "Ongoing Consultations": "Konsultasi Lumaku",
    "View Details": "Deleng Rincian",
    "View All": "Deleng Kabeh",
    "Statistics": "Statistik",
    "Overview": "Ringkesan",
    
    // Box/Habitaciones
    "Box": "Kamar",
    "Boxes": "Kamar-kamar",
    "Box Status": "Status Kamar",
    "Box Details": "Rincian Kamar",
    "Select Box": "Pilih Kamar",
    "Available": "Kasedhiya",
    "Occupied": "Diisi",
    "Under Maintenance": "Lagi Diopeni",
    "Reserved": "Dipesan",
    "Status": "Status",
    "Hallway": "Lorong",
    "Floor": "Lantai",
    "Wing": "Sayap",
    "Room Number": "Nomer Kamar",
    
    // Pacientes
    "Patient": "Pasien",
    "Patients": "Pasien-pasien",
    "Patient Name": "Jeneng Pasien",
    "Patient ID": "ID Pasien",
    "Patient Information": "Informasi Pasien",
    "RUT": "Nomer Identitas",
    "Age": "Umur",
    "Gender": "Jender",
    "Male": "Lanang",
    "Female": "Wadon",
    "Other": "Liyane",
    "Contact": "Kontak",
    "Phone": "Telpon",
    "Email": "Email",
    "Address": "Alamat",
    
    // Consultas/Citas
    "Appointment": "Janjian",
    "Appointments": "Janjian-janjian",
    "Schedule": "Jadwal",
    "Calendar": "Tanggalan",
    "Agenda": "Agenda",
    "New Appointment": "Janjian Anyar",
    "Edit Appointment": "Sunting Janjian",
    "Cancel Appointment": "Batal Janjian",
    "Confirm Appointment": "Konfirmasi Janjian",
    "Reschedule": "Jadwal Ulang",
    "Date": "Tanggal",
    "Time": "Wektu",
    "Duration": "Durasi",
    "Start Time": "Wektu Mulai",
    "End Time": "Wektu Rampung",
    "Reason": "Alesan",
    "Notes": "Cathetan",
    "Priority": "Prioritas",
    "High": "Dhuwur",
    "Medium": "Sedeng",
    "Low": "Endhek",
    
    // Médicos
    "Doctor": "Dhokter",
    "Doctors": "Dhokter-dhokter",
    "Specialist": "Spesialis",
    "Specialty": "Spesialisasi",
    "Specialties": "Spesialisasi-spesialisasi",
    "Assigned Doctor": "Dhokter Ditugasake",
    "Available Doctors": "Dhokter Kasedhiya",
    
    // Especialidades médicas
    "Cardiology": "Kardiologi",
    "Dermatology": "Dermatologi",
    "Neurology": "Neurologi",
    "Pediatrics": "Pediatri",
    "Orthopedics": "Ortopedi",
    "Ophthalmology": "Oftalmologi",
    "Psychiatry": "Psikiatri",
    "Radiology": "Radiologi",
    "Surgery": "Bedah",
    "General Medicine": "Kedokteran Umum",
    
    // Notificaciones
    "Notifications": "Notifikasi",
    "New Notification": "Notifikasi Anyar",
    "Mark as Read": "Tandhai Wis Diwaca",
    "Mark as Unread": "Tandhai Durung Diwaca",
    "Delete Notification": "Busek Notifikasi",
    "No notifications": "Ora ana notifikasi",
    "Notification History": "Riwayat Notifikasi",
    "Read": "Wis Diwaca",
    "Unread": "Durung Diwaca",
    
    // Acciones comunes
    "Save": "Simpen",
    "Cancel": "Batal",
    "Delete": "Busek",
    "Edit": "Sunting",
    "Update": "Perbarui",
    "Create": "Gawe",
    "Add": "Tambah",
    "Remove": "Copot",
    "Search": "Goleki",
    "Filter": "Filter",
    "Sort": "Urutake",
    "Export": "Ekspor",
    "Import": "Impor",
    "Print": "Cetak",
    "Download": "Undhuh",
    "Upload": "Unggah",
    "Refresh": "Segarake",
    "Close": "Tutup",
    "Back": "Bali",
    "Next": "Sabanjure",
    "Previous": "Sadurunge",
    "Submit": "Kirim",
    "Confirm": "Konfirmasi",
    "Yes": "Ya",
    "No": "Ora",
    
    // Colores
    "Red": "Abang",
    "Blue": "Biru",
    "Green": "Ijo",
    "Yellow": "Kuning",
    "Orange": "Oranye",
    "Purple": "Ungu",
    "Pink": "Jambon",
    "Brown": "Coklat",
    "Black": "Ireng",
    "White": "Putih",
    "Gray": "Abu-abu",
    
    // Tamaños
    "Small": "Cilik",
    "Medium": "Sedeng",
    "Large": "Gedhe",
    "Extra Large": "Gedhe Banget",
    
    // Días de la semana
    "Monday": "Senin",
    "Tuesday": "Selasa",
    "Wednesday": "Rebo",
    "Thursday": "Kemis",
    "Friday": "Jumat",
    "Saturday": "Setu",
    "Sunday": "Minggu",
    
    // Estados
    "Active": "Aktif",
    "Inactive": "Ora Aktif",
    "Pending": "Nunggu",
    "Completed": "Rampung",
    "Cancelled": "Dibatalake",
    "In Progress": "Lumaku",
    "Scheduled": "Dijadwalake",
    
    // Login/Auth
    "Login": "Mlebu",
    "Username": "Jeneng Pangguna",
    "Password": "Sandi",
    "Remember me": "Elinga Aku",
    "Forgot password": "Lali Sandi",
    "Sign in": "Mlebu",
    "Sign out": "Metu"
  }
};

// Función para traducir recursivamente
function translateObject(obj, dict) {
  if (typeof obj === 'string') {
    return dict[obj] || obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => translateObject(item, dict));
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const result = {};
    for (const key in obj) {
      result[key] = translateObject(obj[key], dict);
    }
    return result;
  }
  
  return obj;
}

// Procesar idiomas
const languages = [
  { code: 'fa', name: 'FA' },
  { code: 'pa', name: 'PA' },
  { code: 'jv', name: 'JV' }
];

let successCount = 0;

languages.forEach((lang, index) => {
  try {
    const translated = translateObject(enData, dictionaries[lang.code]);
    const outputPath = path.join(__dirname, `../locales/${lang.code}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(translated, null, 2), 'utf8');
    console.log(`✅ ${lang.name} - Corregido (${index + 1}/${languages.length})`);
    successCount++;
  } catch (error) {
    console.log(`❌ ${lang.name} - Error: ${error.message}`);
  }
});

console.log(`\n🎉 Batch 3 completado: ${successCount}/${languages.length}!`);
console.log(`✨ Ejecutar parte 4 para TE, MR, TA...`);
