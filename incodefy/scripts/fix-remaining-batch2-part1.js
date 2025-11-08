const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../locales');
const enFile = path.join(localesDir, 'en.json');
const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));

console.log('🌍 BATCH 2: Corrigiendo 6 idiomas (PA, JV, TE, MR, TR, TA)\n');

const translations = {
  pa: { // Punjabi
    'Spanish': 'ਸਪੈਨਿਸ਼', 'English': 'ਅੰਗਰੇਜ਼ੀ', 'Portuguese': 'ਪੁਰਤਗਾਲੀ', 'Italian': 'ਇਤਾਲਵੀ',
    'Chinese': 'ਚੀਨੀ', 'Hindi': 'ਹਿੰਦੀ', 'Arabic': 'ਅਰਬੀ', 'Bengali': 'ਬੰਗਾਲੀ',
    'Russian': 'ਰੂਸੀ', 'Japanese': 'ਜਾਪਾਨੀ', 'Punjabi': 'ਪੰਜਾਬੀ', 'German': 'ਜਰਮਨ',
    'Javanese': 'ਜਾਵਾਨੀਜ਼', 'Korean': 'ਕੋਰੀਆਈ', 'French': 'ਫ੍ਰੈਂਚ', 'Telugu': 'ਤੇਲਗੂ',
    'Marathi': 'ਮਰਾਠੀ', 'Turkish': 'ਤੁਰਕੀ', 'Tamil': 'ਤਮਿਲ', 'Vietnamese': 'ਵੀਅਤਨਾਮੀ',
    'Urdu': 'ਉਰਦੂ', 'Dutch': 'ਡੱਚ', 'Polish': 'ਪੋਲਿਸ਼', 'Thai': 'ਥਾਈ', 'Persian': 'ਫ਼ਾਰਸੀ',
    'My Profile - Customization': 'ਮੇਰਾ ਪ੍ਰੋਫਾਈਲ - ਅਨੁਕੂਲਨ', 'My Profile': 'ਮੇਰਾ ਪ੍ਰੋਫਾਈਲ',
    'Customize your interface appearance': 'ਆਪਣੇ ਇੰਟਰਫੇਸ ਦੀ ਦਿੱਖ ਨੂੰ ਅਨੁਕੂਲ ਬਣਾਓ',
    'Theme': 'ਥੀਮ', 'Mode:': 'ਮੋਡ:', 'Light': 'ਹਲਕਾ', 'Dark': 'ਗੂੜ੍ਹਾ',
    'Main color:': 'ਮੁੱਖ ਰੰਗ:', 'Typography': 'ਟਾਈਪੋਗ੍ਰਾਫੀ', 'Font Size': 'ਫ਼ੌਂਟ ਆਕਾਰ',
    'Text scale:': 'ਟੈਕਸਟ ਸਕੇਲ:', 'Interface language:': 'ਇੰਟਰਫੇਸ ਭਾਸ਼ਾ:',
    'Saving...': 'ਸੁਰੱਖਿਅਤ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ...', 'Error saving changes.': 'ਤਬਦੀਲੀਆਂ ਨੂੰ ਸੁਰੱਖਿਅਤ ਕਰਨ ਵਿੱਚ ਗਲਤੀ।',
    'Changes saved. The page will reload...': 'ਤਬਦੀਲੀਆਂ ਸੁਰੱਖਿਅਤ ਹੋ ਗਈਆਂ। ਪੰਨਾ ਮੁੜ ਲੋਡ ਹੋਵੇਗਾ...',
    'Preview is disabled. Save changes to apply them.': 'ਪੂਰਵਦਰਸ਼ਨ ਅਸਮਰੱਥ ਹੈ। ਉਹਨਾਂ ਨੂੰ ਲਾਗੂ ਕਰਨ ਲਈ ਤਬਦੀਲੀਆਂ ਸੁਰੱਖਿਅਤ ਕਰੋ।',
    'Unsaved changes': 'ਅਸੁਰੱਖਿਅਤ ਤਬਦੀਲੀਆਂ', 'View in-progress appointments': 'ਜਾਰੀ ਮੁਲਾਕਾਤਾਂ ਦੇਖੋ',
    'In-progress appointments': 'ਜਾਰੀ ਮੁਲਾਕਾਤਾਂ', 'Back to top': 'ਸਿਖਰ ਤੇ ਵਾਪਸ',
    'Filter by corridor...': 'ਗਲਿਆਰੇ ਦੁਆਰਾ ਫਿਲਟਰ ਕਰੋ...', 'Filter by box...': 'ਬਾਕਸ ਦੁਆਰਾ ਫਿਲਟਰ ਕਰੋ...',
    'Filter by state': 'ਸਥਿਤੀ ਦੁਆਰਾ ਫਿਲਟਰ ਕਰੋ',
    'You do not have permission to view the details of this box.': 'ਤੁਹਾਡੇ ਕੋਲ ਇਸ ਬਾਕਸ ਦੇ ਵੇਰਵੇ ਦੇਖਣ ਦੀ ਇਜਾਜ਼ਤ ਨਹੀਂ ਹੈ।',
    'Next appointment not available.': 'ਅਗਲੀ ਮੁਲਾਕਾਤ ਉਪਲਬਧ ਨਹੀਂ ਹੈ।', 'Hide details': 'ਵੇਰਵੇ ਲੁਕਾਓ',
    'Next Appointment': 'ਅਗਲੀ ਮੁਲਾਕਾਤ', 'No more appointments today': 'ਅੱਜ ਹੋਰ ਮੁਲਾਕਾਤਾਂ ਨਹੀਂ',
    'Corridor {{count}}': 'ਗਲਿਆਰਾ {{count}}',
    '© 2025 Incodefy. Medical Agenda System - All rights reserved.': '© 2025 Incodefy. ਮੈਡੀਕਲ ਏਜੰਡਾ ਸਿਸਟਮ - ਸਾਰੇ ਅਧਿਕਾਰ ਰਾਖਵੇਂ।',
    'Remember me': 'ਮੈਨੂੰ ਯਾਦ ਰੱਖੋ', 'Forgot your password?': 'ਆਪਣਾ ਪਾਸਵਰਡ ਭੁੱਲ ਗਏ?',
    'Show password': 'ਪਾਸਵਰਡ ਦਿਖਾਓ', 'Administration Dashboard': 'ਪ੍ਰਸ਼ਾਸਨ ਡੈਸ਼ਬੋਰਡ',
    'Real-time metrics and notifications panel': 'ਰੀਅਲ-ਟਾਈਮ ਮੈਟ੍ਰਿਕਸ ਅਤੇ ਸੂਚਨਾ ਪੈਨਲ',
    'Date range': 'ਤਾਰੀਖ ਸੀਮਾ', 'Specialties': 'ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ', 'Boxes': 'ਬਾਕਸ',
    'Key Indicators': 'ਮੁੱਖ ਸੰਕੇਤਕ', 'Box occupation': 'ਬਾਕਸ ਕਬਜ਼ਾ',
    'Daily average': 'ਰੋਜ਼ਾਨਾ ਔਸਤ', 'Most demanded specialty': 'ਸਭ ਤੋਂ ਵੱਧ ਮੰਗ ਵਾਲੀ ਵਿਸ਼ੇਸ਼ਤਾ',
    'In {{count}} day': '{{count}} ਦਿਨ ਵਿੱਚ', 'In {{count}} days': '{{count}} ਦਿਨਾਂ ਵਿੱਚ',
    'Total capacity: {{count}} boxes': 'ਕੁੱਲ ਸਮਰੱਥਾ: {{count}} ਬਾਕਸ',
    'Appointments per day': 'ਪ੍ਰਤੀ ਦਿਨ ਮੁਲਾਕਾਤਾਂ', '{{count}} appointment': '{{count}} ਮੁਲਾਕਾਤ',
    '{{count}} appointments': '{{count}} ਮੁਲਾਕਾਤਾਂ', 'Visual Analysis': 'ਦ੍ਰਿਸ਼ਟੀਗਤ ਵਿਸ਼ਲੇਸ਼ਣ',
    'Appointments by Specialty': 'ਵਿਸ਼ੇਸ਼ਤਾ ਦੁਆਰਾ ਮੁਲਾਕਾਤਾਂ', 'Appointments by Day': 'ਦਿਨ ਦੁਆਰਾ ਮੁਲਾਕਾਤਾਂ',
    'Doctor Performance': 'ਡਾਕਟਰ ਪ੍ਰਦਰਸ਼ਨ', 'No data': 'ਕੋਈ ਡਾਟਾ ਨਹੀਂ',
    'No data desc': 'KPI ਦੇਖਣ ਲਈ ਫਿਲਟਰ ਲਾਗੂ ਕਰੋ',
    'Apply filters to view the KPI': 'KPI ਦੇਖਣ ਲਈ ਫਿਲਟਰ ਲਾਗੂ ਕਰੋ',
    'Agenda System': 'ਏਜੰਡਾ ਸਿਸਟਮ', 'Manage your medical agenda efficiently': 'ਆਪਣੇ ਮੈਡੀਕਲ ਏਜੰਡੇ ਨੂੰ ਕੁਸ਼ਲਤਾ ਨਾਲ ਪ੍ਰਬੰਧਿਤ ਕਰੋ',
    'Agenda Management': 'ਏਜੰਡਾ ਪ੍ਰਬੰਧਨ', 'View and manage your medical appointments': 'ਆਪਣੀਆਂ ਮੈਡੀਕਲ ਮੁਲਾਕਾਤਾਂ ਦੇਖੋ ਅਤੇ ਪ੍ਰਬੰਧਿਤ ਕਰੋ',
    'Data Management': 'ਡਾਟਾ ਪ੍ਰਬੰਧਨ', 'Export and import consultation information': 'ਸਲਾਹ-ਮਸ਼ਵਰੇ ਦੀ ਜਾਣਕਾਰੀ ਨਿਰਯਾਤ ਅਤੇ ਆਯਾਤ ਕਰੋ',
    'No permissions available': 'ਕੋਈ ਇਜਾਜ਼ਤ ਉਪਲਬਧ ਨਹੀਂ',
    'You do not have permissions to access any section of the agenda. Contact the administrator.': 'ਤੁਹਾਡੇ ਕੋਲ ਏਜੰਡੇ ਦੇ ਕਿਸੇ ਵੀ ਭਾਗ ਤੱਕ ਪਹੁੰਚ ਕਰਨ ਦੀ ਇਜਾਜ਼ਤ ਨਹੀਂ ਹੈ। ਪ੍ਰਸ਼ਾਸਕ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।',
    'Real-time monitoring of the status of medical appointments': 'ਮੈਡੀਕਲ ਮੁਲਾਕਾਤਾਂ ਦੀ ਸਥਿਤੀ ਦੀ ਰੀਅਲ-ਟਾਈਮ ਨਿਗਰਾਨੀ',
    'Appointment to be confirmed': 'ਪੁਸ਼ਟੀ ਕੀਤੀ ਜਾਣ ਵਾਲੀ ਮੁਲਾਕਾਤ', 'Appointment already held': 'ਮੁਲਾਕਾਤ ਪਹਿਲਾਂ ਹੀ ਹੋ ਚੁੱਕੀ ਹੈ',
    'Loading appointments...': 'ਮੁਲਾਕਾਤਾਂ ਲੋਡ ਹੋ ਰਹੀਆਂ ਹਨ...', 'No appointments in progress': 'ਕੋਈ ਮੁਲਾਕਾਤ ਜਾਰੀ ਨਹੀਂ',
    'There are no scheduled appointments at this time.': 'ਇਸ ਸਮੇਂ ਕੋਈ ਨਿਰਧਾਰਤ ਮੁਲਾਕਾਤ ਨਹੀਂ ਹੈ।',
    'Box Detail': 'ਬਾਕਸ ਵੇਰਵਾ', 'Instrument categories': 'ਯੰਤਰ ਸ਼੍ਰੇਣੀਆਂ',
    'Stay up to date with all system activities and updates': 'ਸਾਰੀਆਂ ਸਿਸਟਮ ਗਤੀਵਿਧੀਆਂ ਅਤੇ ਅੱਪਡੇਟਾਂ ਨਾਲ ਅਪਡੇਟ ਰਹੋ',
    'View notification details': 'ਸੂਚਨਾ ਵੇਰਵੇ ਦੇਖੋ', 'Attended': 'ਹਾਜ਼ਰ', 'Not attended': 'ਗੈਰਹਾਜ਼ਰ',
    'Canceled': 'ਰੱਦ', '{{count}} appointment has been imported.': '{{count}} ਮੁਲਾਕਾਤ ਆਯਾਤ ਕੀਤੀ ਗਈ ਹੈ।',
    '{{count}} appointments have been imported.': '{{count}} ਮੁਲਾਕਾਤਾਂ ਆਯਾਤ ਕੀਤੀਆਂ ਗਈਆਂ ਹਨ।',
    '-- Select a {{parent}} --': '-- {{parent}} ਚੁਣੋ --', '-- Select a {{entity}} --': '-- {{entity}} ਚੁਣੋ --',
    'Make appointment': 'ਮੁਲਾਕਾਤ ਕਰੋ', 'Schedule Medical Appointment': 'ਮੈਡੀਕਲ ਮੁਲਾਕਾਤ ਨਿਰਧਾਰਤ ਕਰੋ',
    '-- Select a corridor --': '-- ਗਲਿਆਰਾ ਚੁਣੋ --', '-- Select a box --': '-- ਬਾਕਸ ਚੁਣੋ --',
    '-- Select a specialty --': '-- ਵਿਸ਼ੇਸ਼ਤਾ ਚੁਣੋ --', '-- Select a doctor --': '-- ਡਾਕਟਰ ਚੁਣੋ --',
    '-- Select time --': '-- ਸਮਾਂ ਚੁਣੋ --', 'Drag here to unschedule': 'ਅਨਿਰਧਾਰਤ ਕਰਨ ਲਈ ਇੱਥੇ ਖਿੱਚੋ',
    'Appointment scheduled successfully.': 'ਮੁਲਾਕਾਤ ਸਫਲਤਾਪੂਰਵਕ ਨਿਰਧਾਰਤ ਕੀਤੀ ਗਈ।',
    'Appointment unscheduled successfully.': 'ਮੁਲਾਕਾਤ ਸਫਲਤਾਪੂਰਵਕ ਅਨਿਰਧਾਰਤ ਕੀਤੀ ਗਈ।',
    'Error scheduling appointment.': 'ਮੁਲਾਕਾਤ ਨਿਰਧਾਰਤ ਕਰਨ ਵਿੱਚ ਗਲਤੀ।',
    'Error unscheduling appointment.': 'ਮੁਲਾਕਾਤ ਅਨਿਰਧਾਰਤ ਕਰਨ ਵਿੱਚ ਗਲਤੀ।',
    'Are you sure you want to unschedule this appointment?': 'ਕੀ ਤੁਸੀਂ ਯਕੀਨੀ ਤੌਰ 'ਤੇ ਇਸ ਮੁਲਾਕਾਤ ਨੂੰ ਅਨਿਰਧਾਰਤ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ?',
    'Import completed successfully': 'ਆਯਾਤ ਸਫਲਤਾਪੂਰਵਕ ਪੂਰਾ ਹੋਇਆ', 'Import Details': 'ਆਯਾਤ ਵੇਰਵੇ',
    'Medical consultations import details': 'ਮੈਡੀਕਲ ਸਲਾਹ-ਮਸ਼ਵਰੇ ਆਯਾਤ ਵੇਰਵੇ',
    'Start Time': 'ਸ਼ੁਰੂਆਤ ਸਮਾਂ', 'End Time': 'ਸਮਾਪਤੀ ਸਮਾਂ', 'Consult Type': 'ਸਲਾਹ-ਮਸ਼ਵਰਾ ਕਿਸਮ',
    'Total in Progress': 'ਕੁੱਲ ਜਾਰੀ', 'No results found': 'ਕੋਈ ਨਤੀਜੇ ਨਹੀਂ ਮਿਲੇ',
    'There are no boxes matching the applied filters. Try adjusting your search criteria.': 'ਲਾਗੂ ਕੀਤੇ ਫਿਲਟਰਾਂ ਨਾਲ ਮੇਲ ਖਾਂਦੇ ਕੋਈ ਬਾਕਸ ਨਹੀਂ ਹਨ। ਆਪਣੇ ਖੋਜ ਮਾਪਦੰਡ ਨੂੰ ਐਡਜਸਟ ਕਰਨ ਦੀ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    'Reset filters': 'ਫਿਲਟਰ ਰੀਸੈੱਟ ਕਰੋ', 'Show details': 'ਵੇਰਵੇ ਦਿਖਾਓ',
    'Select Corridor': 'ਗਲਿਆਰਾ ਚੁਣੋ', 'Select Box': 'ਬਾਕਸ ਚੁਣੋ', 'Select Specialty': 'ਵਿਸ਼ੇਸ਼ਤਾ ਚੁਣੋ',
    'Select Doctor': 'ਡਾਕਟਰ ਚੁਣੋ', 'Select Date': 'ਤਾਰੀਖ ਚੁਣੋ', 'Select type': 'ਕਿਸਮ ਚੁਣੋ',
    'Medical': 'ਮੈਡੀਕਲ', 'Non-medical': 'ਗੈਰ-ਮੈਡੀਕਲ', 'Confirm Appointment': 'ਮੁਲਾਕਾਤ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ',
    'Unconfirm': 'ਪੁਸ਼ਟੀ ਰੱਦ ਕਰੋ', 'Appointments Management': 'ਮੁਲਾਕਾਤ ਪ੍ਰਬੰਧਨ',
    'Appointments Management desc': 'ਆਪਣੀਆਂ ਮੈਡੀਕਲ ਮੁਲਾਕਾਤਾਂ ਦੇਖੋ ਅਤੇ ਪ੍ਰਬੰਧਿਤ ਕਰੋ',
    'State': 'ਸਥਿਤੀ', 'In use': 'ਵਰਤੋਂ ਵਿੱਚ', 'Free Boxes': 'ਮੁਫਤ ਬਾਕਸ',
    'When you have new notifications, they will appear here.': 'ਜਦੋਂ ਤੁਹਾਡੇ ਕੋਲ ਨਵੀਆਂ ਸੂਚਨਾਵਾਂ ਹੋਣਗੀਆਂ, ਉਹ ਇੱਥੇ ਦਿਖਾਈ ਦੇਣਗੀਆਂ।',
    'Error loading notifications': 'ਸੂਚਨਾਵਾਂ ਲੋਡ ਕਰਨ ਵਿੱਚ ਗਲਤੀ', 'Please try again later.': 'ਕਿਰਪਾ ਕਰਕੇ ਬਾਅਦ ਵਿੱਚ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    'Back to home': 'ਘਰ ਵਾਪਸ ਜਾਓ', 'Page not found': 'ਪੰਨਾ ਨਹੀਂ ਮਿਲਿਆ',
    'The path {{path}} does not exist': 'ਰਸਤਾ {{path}} ਮੌਜੂਦ ਨਹੀਂ ਹੈ',
    'Select the interface language': 'ਇੰਟਰਫੇਸ ਭਾਸ਼ਾ ਚੁਣੋ', 'Pending Appointments': 'ਬਕਾਇਆ ਮੁਲਾਕਾਤਾਂ',
    'Confirmed Appointments': 'ਪੁਸ਼ਟੀ ਕੀਤੀਆਂ ਮੁਲਾਕਾਤਾਂ', "Today's Appointments": 'ਅੱਜ ਦੀਆਂ ਮੁਲਾਕਾਤਾਂ',
    'Statistics and Metrics': 'ਅੰਕੜੇ ਅਤੇ ਮੈਟ੍ਰਿਕਸ', 'Total Appointments': 'ਕੁੱਲ ਮੁਲਾਕਾਤਾਂ',
    'Box Usage': 'ਬਾਕਸ ਵਰਤੋਂ', 'Not Done': 'ਪੂਰਾ ਨਹੀਂ ਹੋਇਆ', 'Compliance': 'ਅਨੁਪਾਲਨ',
    'Box Information': 'ਬਾਕਸ ਜਾਣਕਾਰੀ', 'Box Instruments': 'ਬਾਕਸ ਯੰਤਰ',
    'Previous day': 'ਪਿਛਲਾ ਦਿਨ', 'Next day': 'ਅਗਲਾ ਦਿਨ', 'Select date': 'ਤਾਰੀਖ ਚੁਣੋ',
    'Furniture': 'ਫਰਨੀਚਰ', 'No items in this category.': 'ਇਸ ਸ਼੍ਰੇਣੀ ਵਿੱਚ ਕੋਈ ਆਈਟਮ ਨਹੀਂ ਹਨ।',
    'Unknown doctor': 'ਅਣਜਾਣ ਡਾਕਟਰ', 'Unknown box': 'ਅਣਜਾਣ ਬਾਕਸ'
  },
  jv: { // Javanés
    'Spanish': 'Spanyol', 'English': 'Inggris', 'Portuguese': 'Portugis', 'Italian': 'Italia',
    'Chinese': 'Tionghoa', 'Hindi': 'Hindi', 'Arabic': 'Arab', 'Bengali': 'Bengali',
    'Russian': 'Rusia', 'Japanese': 'Jepang', 'Punjabi': 'Punjabi', 'German': 'Jerman',
    'Javanese': 'Jawa', 'Korean': 'Korea', 'French': 'Prancis', 'Telugu': 'Telugu',
    'Marathi': 'Marathi', 'Turkish': 'Turki', 'Tamil': 'Tamil', 'Vietnamese': 'Vietnam',
    'Urdu': 'Urdu', 'Dutch': 'Walanda', 'Polish': 'Polandia', 'Thai': 'Thailand', 'Persian': 'Persia',
    'My Profile - Customization': 'Profilku - Kustomisasi', 'My Profile': 'Profilku',
    'Customize your interface appearance': 'Sesuaikan tampilan antarmuka sampeyan',
    'Theme': 'Tema', 'Mode:': 'Mode:', 'Light': 'Padhang', 'Dark': 'Peteng',
    'Main color:': 'Werna utama:', 'Typography': 'Tipografi', 'Font Size': 'Ukuran Font',
    'Text scale:': 'Skala teks:', 'Interface language:': 'Basa antarmuka:',
    'Saving...': 'Nyimpen...', 'Error saving changes.': 'Kesalahan nyimpen owah-owahan.',
    'Changes saved. The page will reload...': 'Owah-owahan wis disimpen. Kaca bakal dimuat maneh...',
    'Preview is disabled. Save changes to apply them.': 'Pratinjau dipateni. Simpen owah-owahan kanggo ngetrapake.',
    'Unsaved changes': 'Owah-owahan sing durung disimpen', 'View in-progress appointments': 'Deleng janjian sing lagi mlaku',
    'In-progress appointments': 'Janjian sing lagi mlaku', 'Back to top': 'Bali menyang dhuwur',
    'Filter by corridor...': 'Filter miturut koridor...', 'Filter by box...': 'Filter miturut kotak...',
    'Filter by state': 'Filter miturut status',
    'You do not have permission to view the details of this box.': 'Sampeyan ora duwe idin kanggo ndeleng rincian kotak iki.',
    'Next appointment not available.': 'Janjian sabanjure ora kasedhiya.', 'Hide details': 'Dhelikake rincian',
    'Next Appointment': 'Janjian sabanjure', 'No more appointments today': 'Ora ana janjian maneh dina iki',
    'Corridor {{count}}': 'Koridor {{count}}',
    '© 2025 Incodefy. Medical Agenda System - All rights reserved.': '© 2025 Incodefy. Sistem Agenda Medis - Kabeh hak dilindhungi.',
    'Remember me': 'Elinga aku', 'Forgot your password?': 'Lali sandhi sampeyan?',
    'Show password': 'Tampilake sandhi', 'Administration Dashboard': 'Dashboard Administrasi',
    'Real-time metrics and notifications panel': 'Panel metrik lan notifikasi real-time',
    'Date range': 'Rentang tanggal', 'Specialties': 'Spesialisasi', 'Boxes': 'Kotak',
    'Key Indicators': 'Indikator Kunci', 'Box occupation': 'Pendudukan kotak',
    'Daily average': 'Rata-rata saben dina', 'Most demanded specialty': 'Spesialisasi paling dibutuhake',
    'In {{count}} day': 'Ing {{count}} dina', 'In {{count}} days': 'Ing {{count}} dina',
    'Total capacity: {{count}} boxes': 'Kapasitas total: {{count}} kotak',
    'Appointments per day': 'Janjian saben dina', '{{count}} appointment': '{{count}} janjian',
    '{{count}} appointments': '{{count}} janjian', 'Visual Analysis': 'Analisis Visual',
    'Appointments by Specialty': 'Janjian miturut Spesialisasi', 'Appointments by Day': 'Janjian miturut Dina',
    'Doctor Performance': 'Kinerja Dokter', 'No data': 'Ora ana data',
    'No data desc': 'Terapake filter kanggo ndeleng KPI',
    'Apply filters to view the KPI': 'Terapake filter kanggo ndeleng KPI',
    'Agenda System': 'Sistem Agenda', 'Manage your medical agenda efficiently': 'Ngatur agenda medis sampeyan kanthi efisien',
    'Agenda Management': 'Manajemen Agenda', 'View and manage your medical appointments': 'Deleng lan ngatur janjian medis sampeyan',
    'Data Management': 'Manajemen Data', 'Export and import consultation information': 'Ekspor lan impor informasi konsultasi',
    'No permissions available': 'Ora ana ijin sing kasedhiya',
    'You do not have permissions to access any section of the agenda. Contact the administrator.': 'Sampeyan ora duwe ijin kanggo ngakses bagean apa wae saka agenda. Hubungi administrator.',
    'Real-time monitoring of the status of medical appointments': 'Pemantauan real-time status janjian medis',
    'Appointment to be confirmed': 'Janjian sing kudu dikonfirmasi', 'Appointment already held': 'Janjian wis ditindakake',
    'Loading appointments...': 'Muat janjian...', 'No appointments in progress': 'Ora ana janjian sing lagi mlaku',
    'There are no scheduled appointments at this time.': 'Ora ana janjian sing dijadwalake ing wektu iki.',
    'Box Detail': 'Rincian Kotak', 'Instrument categories': 'Kategori instrumen',
    'Stay up to date with all system activities and updates': 'Tetep nganyari karo kabeh aktivitas lan pembaruan sistem',
    'View notification details': 'Deleng rincian notifikasi', 'Attended': 'Rawuh', 'Not attended': 'Ora rawuh',
    'Canceled': 'Dibatalake', '{{count}} appointment has been imported.': '{{count}} janjian wis diimpor.',
    '{{count}} appointments have been imported.': '{{count}} janjian wis diimpor.',
    '-- Select a {{parent}} --': '-- Pilih {{parent}} --', '-- Select a {{entity}} --': '-- Pilih {{entity}} --',
    'Make appointment': 'Gawe janjian', 'Schedule Medical Appointment': 'Jadwalake Janjian Medis',
    '-- Select a corridor --': '-- Pilih koridor --', '-- Select a box --': '-- Pilih kotak --',
    '-- Select a specialty --': '-- Pilih spesialisasi --', '-- Select a doctor --': '-- Pilih dokter --',
    '-- Select time --': '-- Pilih wektu --', 'Drag here to unschedule': 'Seret ing kene kanggo mbatalake jadwal',
    'Appointment scheduled successfully.': 'Janjian dijadwalake kanthi sukses.',
    'Appointment unscheduled successfully.': 'Janjian dibatalake kanthi sukses.',
    'Error scheduling appointment.': 'Kesalahan njadwalake janjian.',
    'Error unscheduling appointment.': 'Kesalahan mbatalake jadwal janjian.',
    'Are you sure you want to unschedule this appointment?': 'Apa sampeyan yakin arep mbatalake jadwal janjian iki?',
    'Import completed successfully': 'Impor rampung kanthi sukses', 'Import Details': 'Rincian Impor',
    'Medical consultations import details': 'Rincian impor konsultasi medis',
    'Start Time': 'Wektu Mulai', 'End Time': 'Wektu Rampung', 'Consult Type': 'Jenis Konsultasi',
    'Total in Progress': 'Total sing lagi mlaku', 'No results found': 'Ora ana asil sing ditemokake',
    'There are no boxes matching the applied filters. Try adjusting your search criteria.': 'Ora ana kotak sing cocog karo filter sing diterapake. Coba sesuaikan kriteria panelusuran sampeyan.',
    'Reset filters': 'Reset filter', 'Show details': 'Tampilake rincian',
    'Select Corridor': 'Pilih Koridor', 'Select Box': 'Pilih Kotak', 'Select Specialty': 'Pilih Spesialisasi',
    'Select Doctor': 'Pilih Dokter', 'Select Date': 'Pilih Tanggal', 'Select type': 'Pilih jenis',
    'Medical': 'Medis', 'Non-medical': 'Non-medis', 'Confirm Appointment': 'Konfirmasi Janjian',
    'Unconfirm': 'Batal konfirmasi', 'Appointments Management': 'Manajemen Janjian',
    'Appointments Management desc': 'Deleng lan ngatur janjian medis sampeyan',
    'State': 'Status', 'In use': 'Digunakake', 'Free Boxes': 'Kotak Kosong',
    'When you have new notifications, they will appear here.': 'Nalika sampeyan duwe notifikasi anyar, bakal katon ing kene.',
    'Error loading notifications': 'Kesalahan muat notifikasi', 'Please try again later.': 'Mangga nyoba maneh mengko.',
    'Back to home': 'Bali menyang ngarep', 'Page not found': 'Kaca ora ditemokake',
    'The path {{path}} does not exist': 'Jalur {{path}} ora ana',
    'Select the interface language': 'Pilih basa antarmuka', 'Pending Appointments': 'Janjian sing nunggu',
    'Confirmed Appointments': 'Janjian sing dikonfirmasi', "Today's Appointments": 'Janjian Dina Iki',
    'Statistics and Metrics': 'Statistik lan Metrik', 'Total Appointments': 'Total Janjian',
    'Box Usage': 'Panggunaan Kotak', 'Not Done': 'Durung Rampung', 'Compliance': 'Kepatuhan',
    'Box Information': 'Informasi Kotak', 'Box Instruments': 'Instrumen Kotak',
    'Previous day': 'Dina sadurunge', 'Next day': 'Dina sabanjure', 'Select date': 'Pilih tanggal',
    'Furniture': 'Furnitur', 'No items in this category.': 'Ora ana item ing kategori iki.',
    'Unknown doctor': 'Dokter ora dikenal', 'Unknown box': 'Kotak ora dikenal'
  }
};

// Continúa con TE, MR, TR, TA en el mismo formato...
// Por límite de caracteres, los incluiré en la ejecución

function translateObject(obj, dict) {
  if (typeof obj === 'string') return dict[obj] || obj;
  if (Array.isArray(obj)) return obj.map(item => translateObject(item, dict));
  if (typeof obj === 'object' && obj !== null) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = translateObject(value, dict);
    }
    return result;
  }
  return obj;
}

let completed = 0;
const batch = ['pa', 'jv'];
const total = batch.length;

for (const lang of batch) {
  try {
    const translated = translateObject(en, translations[lang]);
    fs.writeFileSync(
      path.join(localesDir, `${lang}.json`),
      JSON.stringify(translated, null, 2),
      'utf8'
    );
    completed++;
    console.log(`✅ ${lang.toUpperCase()} - Corregido (${completed}/${total})`);
  } catch (error) {
    console.log(`❌ ${lang.toUpperCase()} - Error: ${error.message}`);
  }
}

console.log(`\n🎉 Batch 2 (Parte 1/3): ${completed}/${total} idiomas completados!`);
console.log('📊 Idiomas procesados: PA (Punjabi), JV (Javanese)');
console.log('\n✨ Continuando con TE, MR, TR, TA...');
