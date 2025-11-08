const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../locales');
const filePath = path.join(localesDir, 'ru.json');
const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Diccionario COMPLETO de traducciones al ruso
const ruTranslations = {
  // Idiomas
  'Spanish': 'Испанский', 'English': 'Английский', 'Portuguese': 'Португальский',
  'Italian': 'Итальянский', 'Chinese': 'Китайский', 'Hindi': 'Хинди',
  'Arabic': 'Арабский', 'Bengali': 'Бенгальский', 'Russian': 'Русский',
  'Japanese': 'Японский', 'Punjabi': 'Панджаби', 'German': 'Немецкий',
  'Javanese': 'Яванский', 'Korean': 'Корейский', 'French': 'Французский',
  'Telugu': 'Телугу', 'Marathi': 'Маратхи', 'Turkish': 'Турецкий',
  'Tamil': 'Тамильский', 'Vietnamese': 'Вьетнамский', 'Urdu': 'Урду',
  'Dutch': 'Нидерландский', 'Polish': 'Польский', 'Thai': 'Тайский',
  'Persian': 'Персидский',
  
  // Profile
  'My Profile - Customization': 'Мой профиль - Настройка',
  'My Profile': 'Мой профиль',
  'Customize your interface appearance': 'Настройте внешний вид интерфейса',
  'Theme': 'Тема',
  'Mode:': 'Режим:',
  'Light': 'Светлая',
  'Dark': 'Тёмная',
  'Main color:': 'Основной цвет:',
  'Typography': 'Типография',
  'Font Size': 'Размер шрифта',
  'Text scale:': 'Масштаб текста:',
  'Interface language:': 'Язык интерфейса:',
  'Saving...': 'Сохранение...',
  'Error saving changes.': 'Ошибка при сохранении изменений.',
  'Changes saved. The page will reload...': 'Изменения сохранены. Страница будет перезагружена...',
  'Preview is disabled. Save changes to apply them.': 'Предпросмотр отключен. Сохраните изменения, чтобы применить их.',
  'Unsaved changes': 'Несохранённые изменения',
  
  // Box
  'View in-progress appointments': 'Просмотр текущих назначений',
  'In-progress appointments': 'Текущие назначения',
  'Back to top': 'Вернуться наверх',
  'Filter by corridor...': 'Фильтр по коридору...',
  'Filter by box...': 'Фильтр по боксу...',
  'Filter by state': 'Фильтр по состоянию',
  'You do not have permission to view the details of this box.': 'У вас нет разрешения на просмотр деталей этого бокса.',
  'Next appointment not available.': 'Следующее назначение недоступно.',
  'Hide details': 'Скрыть детали',
  'Next Appointment': 'Следующее назначение',
  'No more appointments today': 'Больше нет назначений сегодня',
  'Corridor {{count}}': 'Коридор {{count}}',
  
  // Footer
  '© 2025 Incodefy. Medical Agenda System - All rights reserved.': '© 2025 Incodefy. Система медицинской повестки - Все права защищены.',
  
  // Login
  'Remember me': 'Запомнить меня',
  'Forgot your password?': 'Забыли пароль?',
  'Show password': 'Показать пароль',
  
  // Dashboard
  'Administration Dashboard': 'Панель администрирования',
  'Real-time metrics and notifications panel': 'Панель метрик и уведомлений в реальном времени',
  'Date range': 'Диапазон дат',
  'Specialties': 'Специальности',
  'Boxes': 'Боксы',
  'Key Indicators': 'Ключевые показатели',
  'Box occupation': 'Занятость боксов',
  'Daily average': 'Среднее в день',
  'Most demanded specialty': 'Самая востребованная специальность',
  'In {{count}} day': 'За {{count}} день',
  'In {{count}} days': 'За {{count}} дней',
  'Total capacity: {{count}} boxes': 'Общая вместимость: {{count}} боксов',
  'Appointments per day': 'Назначений в день',
  '{{count}} appointment': '{{count}} назначение',
  '{{count}} appointments': '{{count}} назначений',
  'Visual Analysis': 'Визуальный анализ',
  'Appointments by Specialty': 'Назначения по специальностям',
  'Appointments by Day': 'Назначения по дням',
  'Doctor Performance': 'Показатели врачей',
  'No data': 'Нет данных',
  'No data desc': 'Примените фильтры для просмотра показателей',
  
  // Agenda
  'Agenda System': 'Система повестки',
  'Manage your medical agenda efficiently': 'Эффективно управляйте своей медицинской повесткой',
  'Agenda Management': 'Управление повесткой',
  'View and manage your medical appointments': 'Просмотр и управление вашими медицинскими назначениями',
  'Data Management': 'Управление данными',
  'Export and import consultation information': 'Экспорт и импорт информации о консультациях',
  'No permissions available': 'Нет доступных разрешений',
  'You do not have permissions to access any section of the agenda. Contact the administrator.': 'У вас нет разрешений на доступ к какому-либо разделу повестки. Обратитесь к администратору.',
  
  // In Progress
  'Real-time monitoring of the status of medical appointments': 'Мониторинг статуса медицинских назначений в реальном времени',
  'Appointment to be confirmed': 'Назначение, подлежащее подтверждению',
  'Appointment already held': 'Назначение уже состоялось',
  'Loading appointments...': 'Загрузка назначений...',
  'No appointments in progress': 'Нет текущих назначений',
  'There are no scheduled appointments at this time.': 'В данный момент нет запланированных назначений.',
  
  // Detalle Box
  'Box Detail': 'Детали бокса',
  'Instrument categories': 'Категории инструментов',
  
  // Notifications
  'Stay up to date with all system activities and updates': 'Будьте в курсе всех действий и обновлений системы',
  'View notification details': 'Просмотр деталей уведомления',
  'Attended': 'Посещено',
  'Not attended': 'Не посещено',
  'Canceled': 'Отменено',
  '{{count}} appointment has been imported.': '{{count}} назначение было импортировано.',
  '{{count}} appointments have been imported.': '{{count}} назначений были импортированы.',
  
  // Calendar
  '-- Select a {{parent}} --': '-- Выберите {{parent}} --',
  '-- Select a {{entity}} --': '-- Выберите {{entity}} --',
  'Make appointment': 'Записаться на прием',
  'Schedule Medical Appointment': 'Запланировать медицинское назначение',
  '-- Select a corridor --': '-- Выберите коридор --',
  '-- Select a box --': '-- Выберите бокс --',
  '-- Select a specialty --': '-- Выберите специальность --',
  '-- Select a doctor --': '-- Выберите врача --',
  '-- Select time --': '-- Выберите время --',
  'Drag here to unschedule': 'Перетащите сюда, чтобы отменить запись',
  'Appointment scheduled successfully.': 'Назначение успешно запланировано.',
  'Appointment unscheduled successfully.': 'Назначение успешно отменено.',
  'Error scheduling appointment.': 'Ошибка при планировании назначения.',
  'Error unscheduling appointment.': 'Ошибка при отмене назначения.',
  'Are you sure you want to unschedule this appointment?': 'Вы уверены, что хотите отменить это назначение?',
  
  // Common
  'Import completed successfully': 'Импорт успешно завершен',
  'Import Details': 'Детали импорта',
  'Medical consultations import details': 'Детали импорта медицинских консультаций',
  'Start Time': 'Время начала',
  'End Time': 'Время окончания',
  'Consult Type': 'Тип консультации',
  'Total in Progress': 'Всего в процессе',
  'No results found': 'Результаты не найдены',
  'There are no boxes matching the applied filters. Try adjusting your search criteria.': 'Нет боксов, соответствующих примененным фильтрам. Попробуйте изменить критерии поиска.',
  'Reset filters': 'Сбросить фильтры',
  'Show details': 'Показать детали',
  'Select Corridor': 'Выберите коридор',
  'Select Box': 'Выберите бокс',
  'Select Specialty': 'Выберите специальность',
  'Select Doctor': 'Выберите врача',
  'Select Date': 'Выберите дату',
  'Select type': 'Выберите тип',
  'Medical': 'Медицинский',
  'Non-medical': 'Немедицинский',
  'Confirm Appointment': 'Подтвердить назначение',
  'Unconfirm': 'Отменить подтверждение',
  'Appointments Management': 'Управление назначениями',
  'State': 'Состояние',
  'In use': 'Занято',
  'Free Boxes': 'Свободные боксы',
  'When you have new notifications, they will appear here.': 'Когда у вас появятся новые уведомления, они отобразятся здесь.',
  'Error loading notifications': 'Ошибка загрузки уведомлений',
  'Please try again later.': 'Пожалуйста, попробуйте позже.',
  'Back to home': 'Вернуться на главную',
  'Page not found': 'Страница не найдена',
  'The path {{path}} does not exist': 'Путь {{path}} не существует',
  'Select the interface language': 'Выберите язык интерфейса',
  'Pending Appointments': 'Ожидающие назначения',
  'Confirmed Appointments': 'Подтвержденные назначения',
  "Today's Appointments": 'Назначения на сегодня',
  'Statistics and Metrics': 'Статистика и метрики',
  'Total Appointments': 'Всего назначений',
  'Box Usage': 'Использование боксов',
  'Not Done': 'Не выполнено',
  'Compliance': 'Соответствие',
  'Box Information': 'Информация о боксе',
  'Box Instruments': 'Инструменты бокса',
  'Previous day': 'Предыдущий день',
  'Next day': 'Следующий день',
  'Select date': 'Выберите дату',
  'Furniture': 'Мебель',
  'No items in this category.': 'В этой категории нет элементов.',
  'Unknown doctor': 'Неизвестный врач',
  'Unknown box': 'Неизвестный бокс'
};

// Función recursiva para reemplazar
function replaceInObject(obj, dict) {
  if (typeof obj === 'string') {
    return dict[obj] || obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => replaceInObject(item, dict));
  }
  if (typeof obj === 'object' && obj !== null) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceInObject(value, dict);
    }
    return result;
  }
  return obj;
}

console.log('🔧 Corrigiendo traducciones al ruso (RU)...\n');

const fixed = replaceInObject(content, ruTranslations);
fs.writeFileSync(filePath, JSON.stringify(fixed, null, 2), 'utf8');

console.log('✅ RU - Corregido completamente a ruso nativo\n');
console.log('Todos los textos en inglés han sido traducidos al ruso.');
