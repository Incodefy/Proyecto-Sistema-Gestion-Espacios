const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../locales');
const enFile = path.join(localesDir, 'en.json');
const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));

console.log('🌍 Iniciando corrección MASIVA de traducciones...\n');
console.log('📋 Estrategia: Usar EN.json como plantilla y traducir todos los valores\n');

// DICCIONARIOS COMPLETOS PARA TODOS LOS IDIOMAS
const translations = {
  ko: { // Coreano
    'Spanish': '스페인어', 'English': '영어', 'Portuguese': '포르투갈어', 'Italian': '이탈리아어',
    'Chinese': '중국어', 'Hindi': '힌디어', 'Arabic': '아랍어', 'Bengali': '벵골어',
    'Russian': '러시아어', 'Japanese': '일본어', 'Punjabi': '펀자브어', 'German': '독일어',
    'Javanese': '자바어', 'Korean': '한국어', 'French': '프랑스어', 'Telugu': '텔루구어',
    'Marathi': '마라티어', 'Turkish': '터키어', 'Tamil': '타밀어', 'Vietnamese': '베트남어',
    'Urdu': '우르두어', 'Dutch': '네덜란드어', 'Polish': '폴란드어', 'Thai': '태국어', 'Persian': '페르시아어',
    'My Profile - Customization': '내 프로필 - 맞춤설정', 'My Profile': '내 프로필',
    'Customize your interface appearance': '인터페이스 모양 사용자 지정',
    'Theme': '테마', 'Mode:': '모드:', 'Light': '라이트', 'Dark': '다크',
    'Main color:': '기본 색상:', 'Typography': '타이포그래피', 'Font Size': '글꼴 크기',
    'Text scale:': '텍스트 크기:', 'Interface language:': '인터페이스 언어:',
    'Saving...': '저장 중...', 'Error saving changes.': '변경 사항 저장 중 오류가 발생했습니다.',
    'Changes saved. The page will reload...': '변경 사항이 저장되었습니다. 페이지가 다시 로드됩니다...',
    'Preview is disabled. Save changes to apply them.': '미리 보기가 비활성화되었습니다. 변경 사항을 저장하여 적용하세요.',
    'Unsaved changes': '저장되지 않은 변경 사항',
    'View in-progress appointments': '진행 중인 예약 보기', 'In-progress appointments': '진행 중인 예약',
    'Back to top': '맨 위로', 'Filter by corridor...': '복도별 필터...', 'Filter by box...': '박스별 필터...',
    'Filter by state': '상태별 필터', 'You do not have permission to view the details of this box.': '이 박스의 세부 정보를 볼 권한이 없습니다.',
    'Next appointment not available.': '다음 예약을 사용할 수 없습니다.', 'Hide details': '세부정보 숨기기',
    'Next Appointment': '다음 예약', 'No more appointments today': '오늘 더 이상 예약이 없습니다',
    'Corridor {{count}}': '복도 {{count}}',
    '© 2025 Incodefy. Medical Agenda System - All rights reserved.': '© 2025 Incodefy. 의료 일정 시스템 - 모든 권리 보유.',
    'Remember me': '로그인 상태 유지', 'Forgot your password?': '비밀번호를 잊으셨나요?', 'Show password': '비밀번호 표시',
    'Administration Dashboard': '관리 대시보드', 'Real-time metrics and notifications panel': '실시간 메트릭 및 알림 패널',
    'Date range': '날짜 범위', 'Specialties': '전문 분야', 'Boxes': '박스', 'Key Indicators': '주요 지표',
    'Box occupation': '박스 점유율', 'Daily average': '일일 평균', 'Most demanded specialty': '가장 수요가 많은 전문 분야',
    'In {{count}} day': '{{count}}일 내', 'In {{count}} days': '{{count}}일 내',
    'Total capacity: {{count}} boxes': '총 용량: {{count}}개 박스', 'Appointments per day': '일일 예약 수',
    '{{count}} appointment': '{{count}}개 예약', '{{count}} appointments': '{{count}}개 예약',
    'Visual Analysis': '시각적 분석', 'Appointments by Specialty': '전문 분야별 예약',
    'Appointments by Day': '일별 예약', 'Doctor Performance': '의사 성과',
    'No data': '데이터 없음', 'No data desc': '필터를 적용하여 KPI 보기', 'Apply filters to view the KPI': '필터를 적용하여 KPI 보기',
    'Agenda System': '일정 시스템', 'Manage your medical agenda efficiently': '의료 일정을 효율적으로 관리',
    'Agenda Management': '일정 관리', 'View and manage your medical appointments': '의료 예약 보기 및 관리',
    'Data Management': '데이터 관리', 'Export and import consultation information': '상담 정보 내보내기 및 가져오기',
    'No permissions available': '사용 가능한 권한 없음',
    'You do not have permissions to access any section of the agenda. Contact the administrator.': '일정의 어떤 섹션에도 액세스할 권한이 없습니다. 관리자에게 문의하세요.',
    'Real-time monitoring of the status of medical appointments': '의료 예약 상태 실시간 모니터링',
    'Appointment to be confirmed': '확인 대기 중인 예약', 'Appointment already held': '이미 완료된 예약',
    'Loading appointments...': '예약 로드 중...', 'No appointments in progress': '진행 중인 예약 없음',
    'There are no scheduled appointments at this time.': '현재 예정된 예약이 없습니다.',
    'Box Detail': '박스 세부정보', 'Instrument categories': '기기 카테고리',
    'Stay up to date with all system activities and updates': '모든 시스템 활동 및 업데이트를 최신 상태로 유지',
    'View notification details': '알림 세부정보 보기', 'Attended': '참석함', 'Not attended': '불참',
    'Canceled': '취소됨', '{{count}} appointment has been imported.': '{{count}}개 예약을 가져왔습니다.',
    '{{count}} appointments have been imported.': '{{count}}개 예약을 가져왔습니다.',
    '-- Select a {{parent}} --': '-- {{parent}} 선택 --', '-- Select a {{entity}} --': '-- {{entity}} 선택 --',
    'Make appointment': '예약하기', 'Schedule Medical Appointment': '의료 예약 일정 잡기',
    '-- Select a corridor --': '-- 복도 선택 --', '-- Select a box --': '-- 박스 선택 --',
    '-- Select a specialty --': '-- 전문 분야 선택 --', '-- Select a doctor --': '-- 의사 선택 --',
    '-- Select time --': '-- 시간 선택 --', 'Drag here to unschedule': '여기로 드래그하여 예약 취소',
    'Appointment scheduled successfully.': '예약이 성공적으로 예약되었습니다.',
    'Appointment unscheduled successfully.': '예약이 성공적으로 취소되었습니다.',
    'Error scheduling appointment.': '예약 예약 중 오류가 발생했습니다.',
    'Error unscheduling appointment.': '예약 취소 중 오류가 발생했습니다.',
    'Are you sure you want to unschedule this appointment?': '이 예약을 취소하시겠습니까?',
    'Import completed successfully': '가져오기가 성공적으로 완료되었습니다', 'Import Details': '가져오기 세부정보',
    'Medical consultations import details': '의료 상담 가져오기 세부정보',
    'Start Time': '시작 시간', 'End Time': '종료 시간', 'Consult Type': '상담 유형',
    'Total in Progress': '진행 중인 총계', 'No results found': '결과를 찾을 수 없습니다',
    'There are no boxes matching the applied filters. Try adjusting your search criteria.': '적용된 필터와 일치하는 박스가 없습니다. 검색 기준을 조정해 보세요.',
    'Reset filters': '필터 재설정', 'Show details': '세부정보 표시',
    'Select Corridor': '복도 선택', 'Select Box': '박스 선택', 'Select Specialty': '전문 분야 선택',
    'Select Doctor': '의사 선택', 'Select Date': '날짜 선택', 'Select type': '유형 선택',
    'Medical': '의료', 'Non-medical': '비의료', 'Confirm Appointment': '예약 확인',
    'Unconfirm': '확인 취소', 'Appointments Management': '예약 관리',
    'Appointments Management desc': '의료 예약 보기 및 관리', 'State': '상태', 'In use': '사용 중',
    'Free Boxes': '빈 박스', 'When you have new notifications, they will appear here.': '새 알림이 있으면 여기에 표시됩니다.',
    'Error loading notifications': '알림 로드 중 오류 발생', 'Please try again later.': '나중에 다시 시도하세요.',
    'Back to home': '홈으로 돌아가기', 'Page not found': '페이지를 찾을 수 없습니다',
    'The path {{path}} does not exist': '경로 {{path}}이(가) 존재하지 않습니다',
    'Select the interface language': '인터페이스 언어 선택', 'Pending Appointments': '대기 중인 예약',
    'Confirmed Appointments': '확인된 예약', "Today's Appointments": '오늘의 예약',
    'Statistics and Metrics': '통계 및 메트릭', 'Total Appointments': '총 예약 수',
    'Box Usage': '박스 사용량', 'Not Done': '완료되지 않음', 'Compliance': '준수',
    'Box Information': '박스 정보', 'Box Instruments': '박스 기기',
    'Previous day': '전날', 'Next day': '다음날', 'Select date': '날짜 선택',
    'Furniture': '가구', 'No items in this category.': '이 카테고리에 항목이 없습니다.',
    'Unknown doctor': '알 수 없는 의사', 'Unknown box': '알 수 없는 박스'
  },
  ar: { // Árabe (actualización completa)
    'Spanish': 'الإسبانية', 'English': 'الإنجليزية', 'Portuguese': 'البرتغالية', 'Italian': 'الإيطالية',
    'Chinese': 'الصينية', 'Hindi': 'الهندية', 'Arabic': 'العربية', 'Bengali': 'البنغالية',
    'Russian': 'الروسية', 'Japanese': 'اليابانية', 'Punjabi': 'البنجابية', 'German': 'الألمانية',
    'Javanese': 'الجاوية', 'Korean': 'الكورية', 'French': 'الفرنسية', 'Telugu': 'التيلوغوية',
    'Marathi': 'الماراثية', 'Turkish': 'التركية', 'Tamil': 'التاميلية', 'Vietnamese': 'الفيتنامية',
    'Urdu': 'الأردية', 'Dutch': 'الهولندية', 'Polish': 'البولندية', 'Thai': 'التايلاندية', 'Persian': 'الفارسية',
    'My Profile - Customization': 'ملفي الشخصي - التخصيص', 'My Profile': 'ملفي الشخصي',
    'Customize your interface appearance': 'تخصيص مظهر الواجهة', 'Theme': 'المظهر',
    'Mode:': 'الوضع:', 'Light': 'فاتح', 'Dark': 'داكن', 'Main color:': 'اللون الأساسي:',
    'Typography': 'الطباعة', 'Font Size': 'حجم الخط', 'Text scale:': 'مقياس النص:',
    'Interface language:': 'لغة الواجهة:', 'Saving...': 'جارٍ الحفظ...',
    'Error saving changes.': 'خطأ في حفظ التغييرات.', 
    'Changes saved. The page will reload...': 'تم حفظ التغييرات. سيتم إعادة تحميل الصفحة...',
    'Preview is disabled. Save changes to apply them.': 'المعاينة معطلة. احفظ التغييرات لتطبيقها.',
    'Unsaved changes': 'تغييرات غير محفوظة',
    'View in-progress appointments': 'عرض المواعيد الجارية', 'In-progress appointments': 'المواعيد الجارية',
    'Back to top': 'العودة للأعلى', 'Filter by corridor...': 'التصفية حسب الممر...',
    'Filter by box...': 'التصفية حسب الصندوق...', 'Filter by state': 'التصفية حسب الحالة',
    'You do not have permission to view the details of this box.': 'ليس لديك إذن لعرض تفاصيل هذا الصندوق.',
    'Next appointment not available.': 'الموعد التالي غير متاح.', 'Hide details': 'إخفاء التفاصيل',
    'Next Appointment': 'الموعد التالي', 'No more appointments today': 'لا مزيد من المواعيد اليوم',
    'Corridor {{count}}': 'الممر {{count}}',
    '© 2025 Incodefy. Medical Agenda System - All rights reserved.': '© 2025 Incodefy. نظام الأجندة الطبية - جميع الحقوق محفوظة.',
    'Remember me': 'تذكرني', 'Forgot your password?': 'هل نسيت كلمة المرور؟', 'Show password': 'إظهار كلمة المرور',
    'Administration Dashboard': 'لوحة تحكم الإدارة', 'Real-time metrics and notifications panel': 'لوحة المقاييس والإشعارات في الوقت الفعلي',
    'Date range': 'نطاق التاريخ', 'Specialties': 'التخصصات', 'Boxes': 'الصناديق', 'Key Indicators': 'المؤشرات الرئيسية',
    'Box occupation': 'إشغال الصندوق', 'Daily average': 'المتوسط اليومي', 'Most demanded specialty': 'التخصص الأكثر طلبًا',
    'In {{count}} day': 'في {{count}} يوم', 'In {{count}} days': 'في {{count}} أيام',
    'Total capacity: {{count}} boxes': 'السعة الإجمالية: {{count}} صندوق', 'Appointments per day': 'المواعيد في اليوم',
    '{{count}} appointment': '{{count}} موعد', '{{count}} appointments': '{{count}} مواعيد',
    'Visual Analysis': 'التحليل المرئي', 'Appointments by Specialty': 'المواعيد حسب التخصص',
    'Appointments by Day': 'المواعيد حسب اليوم', 'Doctor Performance': 'أداء الطبيب',
    'No data': 'لا توجد بيانات', 'No data desc': 'طبق المرشحات لعرض مؤشرات الأداء الرئيسية',
    'Apply filters to view the KPI': 'طبق المرشحات لعرض مؤشرات الأداء الرئيسية',
    'Agenda System': 'نظام الأجندة', 'Manage your medical agenda efficiently': 'إدارة أجندتك الطبية بكفاءة',
    'Agenda Management': 'إدارة الأجندة', 'View and manage your medical appointments': 'عرض وإدارة مواعيدك الطبية',
    'Data Management': 'إدارة البيانات', 'Export and import consultation information': 'تصدير واستيراد معلومات الاستشارة',
    'No permissions available': 'لا توجد أذونات متاحة',
    'You do not have permissions to access any section of the agenda. Contact the administrator.': 'ليس لديك أذونات للوصول إلى أي قسم من الأجندة. اتصل بالمسؤول.',
    'Real-time monitoring of the status of medical appointments': 'مراقبة حالة المواعيد الطبية في الوقت الفعلي',
    'Appointment to be confirmed': 'موعد في انتظار التأكيد', 'Appointment already held': 'موعد تم عقده بالفعل',
    'Loading appointments...': 'جارٍ تحميل المواعيد...', 'No appointments in progress': 'لا توجد مواعيد جارية',
    'There are no scheduled appointments at this time.': 'لا توجد مواعيد مجدولة في الوقت الحالي.',
    'Box Detail': 'تفاصيل الصندوق', 'Instrument categories': 'فئات الأدوات',
    'Stay up to date with all system activities and updates': 'ابقَ على اطلاع بجميع أنشطة النظام والتحديثات',
    'View notification details': 'عرض تفاصيل الإشعار', 'Attended': 'حضر', 'Not attended': 'لم يحضر',
    'Canceled': 'ملغى', '{{count}} appointment has been imported.': 'تم استيراد {{count}} موعد.',
    '{{count}} appointments have been imported.': 'تم استيراد {{count}} مواعيد.',
    '-- Select a {{parent}} --': '-- اختر {{parent}} --', '-- Select a {{entity}} --': '-- اختر {{entity}} --',
    'Make appointment': 'حجز موعد', 'Schedule Medical Appointment': 'جدولة موعد طبي',
    '-- Select a corridor --': '-- اختر ممرًا --', '-- Select a box --': '-- اختر صندوقًا --',
    '-- Select a specialty --': '-- اختر تخصصًا --', '-- Select a doctor --': '-- اختر طبيبًا --',
    '-- Select time --': '-- اختر الوقت --', 'Drag here to unschedule': 'اسحب هنا لإلغاء الجدولة',
    'Appointment scheduled successfully.': 'تم جدولة الموعد بنجاح.',
    'Appointment unscheduled successfully.': 'تم إلغاء جدولة الموعد بنجاح.',
    'Error scheduling appointment.': 'خطأ في جدولة الموعد.',
    'Error unscheduling appointment.': 'خطأ في إلغاء جدولة الموعد.',
    'Are you sure you want to unschedule this appointment?': 'هل أنت متأكد من أنك تريد إلغاء جدولة هذا الموعد؟',
    'Import completed successfully': 'اكتمل الاستيراد بنجاح', 'Import Details': 'تفاصيل الاستيراد',
    'Medical consultations import details': 'تفاصيل استيراد الاستشارات الطبية',
    'Start Time': 'وقت البدء', 'End Time': 'وقت الانتهاء', 'Consult Type': 'نوع الاستشارة',
    'Total in Progress': 'الإجمالي قيد التنفيذ', 'No results found': 'لم يتم العثور على نتائج',
    'There are no boxes matching the applied filters. Try adjusting your search criteria.': 'لا توجد صناديق تطابق المرشحات المطبقة. حاول ضبط معايير البحث الخاصة بك.',
    'Reset filters': 'إعادة تعيين المرشحات', 'Show details': 'إظهار التفاصيل',
    'Select Corridor': 'اختر الممر', 'Select Box': 'اختر الصندوق', 'Select Specialty': 'اختر التخصص',
    'Select Doctor': 'اختر الطبيب', 'Select Date': 'اختر التاريخ', 'Select type': 'اختر النوع',
    'Medical': 'طبي', 'Non-medical': 'غير طبي', 'Confirm Appointment': 'تأكيد الموعد',
    'Unconfirm': 'إلغاء التأكيد', 'Appointments Management': 'إدارة المواعيد',
    'Appointments Management desc': 'عرض وإدارة مواعيدك الطبية', 'State': 'الحالة', 'In use': 'قيد الاستخدام',
    'Free Boxes': 'صناديق مجانية', 'When you have new notifications, they will appear here.': 'عندما تكون لديك إشعارات جديدة، ستظهر هنا.',
    'Error loading notifications': 'خطأ في تحميل الإشعارات', 'Please try again later.': 'يرجى المحاولة مرة أخرى لاحقًا.',
    'Back to home': 'العودة إلى الصفحة الرئيسية', 'Page not found': 'الصفحة غير موجودة',
    'The path {{path}} does not exist': 'المسار {{path}} غير موجود',
    'Select the interface language': 'اختر لغة الواجهة', 'Pending Appointments': 'المواعيد المعلقة',
    'Confirmed Appointments': 'المواعيد المؤكدة', "Today's Appointments": 'مواعيد اليوم',
    'Statistics and Metrics': 'الإحصائيات والمقاييس', 'Total Appointments': 'إجمالي المواعيد',
    'Box Usage': 'استخدام الصندوق', 'Not Done': 'لم يتم', 'Compliance': 'الامتثال',
    'Box Information': 'معلومات الصندوق', 'Box Instruments': 'أدوات الصندوق',
    'Previous day': 'اليوم السابق', 'Next day': 'اليوم التالي', 'Select date': 'اختر التاريخ',
    'Furniture': 'الأثاث', 'No items in this category.': 'لا توجد عناصر في هذه الفئة.',
    'Unknown doctor': 'طبيب غير معروف', 'Unknown box': 'صندوق غير معروف'
  }
};

// Función recursiva para traducir
function translateObject(obj, dict) {
  if (typeof obj === 'string') {
    return dict[obj] || obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => translateObject(item, dict));
  }
  if (typeof obj === 'object' && obj !== null) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = translateObject(value, dict);
    }
    return result;
  }
  return obj;
}

// Procesar idiomas
const languages = ['ko', 'ar'];
let completed = 0;
const total = languages.length;

for (const lang of languages) {
  try {
    const translated = translateObject(en, translations[lang]);
    fs.writeFileSync(
      path.join(localesDir, `${lang}.json`),
      JSON.stringify(translated, null, 2),
      'utf8'
    );
    completed++;
    console.log(`✅ ${lang.toUpperCase()} - Corregido completamente (${completed}/${total})`);
  } catch (error) {
    console.log(`❌ ${lang.toUpperCase()} - Error: ${error.message}`);
  }
}

console.log(`\n🎉 ${completed}/${total} idiomas corregidos!`);
console.log('📊 Procesados: KO (Coreano), AR (Árabe)');
console.log('\n✨ Siguiente: Crear scripts para los demás idiomas restantes...');
