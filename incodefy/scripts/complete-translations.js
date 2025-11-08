const fs = require('fs');
const path = require('path');

// Cargar archivos de referencia
const localesDir = path.join(__dirname, '../locales');
const esFile = path.join(localesDir, 'es.json');
const enFile = path.join(localesDir, 'en.json');

const es = JSON.parse(fs.readFileSync(esFile, 'utf8'));
const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));

// Mapeo de traducciones completas para cada idioma
const translations = {
  it: {
    // Italiano
    translations: {
      'Blue': 'Blu', 'Red': 'Rosso', 'Green': 'Verde', 'Purple': 'Viola', 'Orange': 'Arancione',
      'Small': 'Piccolo', 'Medium': 'Medio', 'Large': 'Grande',
      'Spanish': 'Spagnolo', 'English': 'Inglese', 'Portuguese': 'Portoghese', 'Italian': 'Italiano',
      'Chinese': 'Cinese', 'Hindi': 'Hindi', 'Arabic': 'Arabo', 'Bengali': 'Bengalese',
      'Russian': 'Russo', 'Japanese': 'Giapponese', 'Punjabi': 'Punjabi', 'German': 'Tedesco',
      'Javanese': 'Giavanese', 'Korean': 'Coreano', 'French': 'Francese', 'Telugu': 'Telugu',
      'Marathi': 'Marathi', 'Turkish': 'Turco', 'Tamil': 'Tamil', 'Vietnamese': 'Vietnamita',
      'Urdu': 'Urdu', 'Dutch': 'Olandese', 'Polish': 'Polacco', 'Thai': 'Tailandese', 'Persian': 'Persiano',
      'My Profile - Customization': 'Il Mio Profilo - Personalizzazione',
      'My Profile': 'Il Mio Profilo',
      'Customize your interface appearance': 'Personalizza l\'aspetto della tua interfaccia',
      'Theme': 'Tema', 'Mode:': 'Modalità:', 'Light': 'Chiaro', 'Dark': 'Scuro',
      'Main color:': 'Colore principale:', 'Font Size': 'Dimensione carattere',
      'Text scale:': 'Scala del testo:', 'Language': 'Lingua',
      'Interface language:': 'Lingua dell\'interfaccia:', 'Preview': 'Anteprima',
      'Save Changes': 'Salva modifiche', 'Reset changes': 'Ripristina modifiche',
      'Saving...': 'Salvando...', 'Error saving changes.': 'Errore durante il salvataggio delle modifiche.',
      'Changes saved. The page will reload...': 'Modifiche salvate. La pagina verrà ricaricata...',
      'Preview is disabled. Save changes to apply them.': 'L\'anteprima è disabilitata. Salva le modifiche per applicarle.',
      'Unsaved changes': 'Modifiche non salvate',
      'Dashboard': 'Dashboard', 'Schedule': 'Agenda', 'Box': 'Box', 'Notifications': 'Notifiche',
      'Profile': 'Profilo', 'Logout': 'Esci', 'Box Status': 'Stato dei Box',
      'View in-progress appointments': 'Visualizza consultazioni in corso',
      'In-progress appointments': 'Consultazioni in corso', 'Back to top': 'Torna su',
      'Filter by corridor...': 'Filtra per corridoio...', 'Filter by box...': 'Filtra per box...',
      'Filter by state': 'Filtra per stato', 'Show all': 'Mostra tutti',
      'You do not have permission to view the details of this box.': 'Non hai il permesso di visualizzare i dettagli di questo box.',
      'Next appointment not available.': 'Prossima consultazione non disponibile.',
      'Hide details': 'Nascondi dettagli', 'Next Appointment': 'Prossimo Appuntamento',
      'Free': 'Libero', 'In Use': 'In uso', 'Waiting': 'In attesa', 'Disabled': 'Disabilitato',
      'No more appointments today': 'Non ci sono più consultazioni per oggi',
      'Corridor {{count}}': 'Corridoio {{count}}',
      '© 2025 Incodefy. Medical Agenda System - All rights reserved.': '© 2025 Incodefy. Sistema di Agenda Medica - Tutti i diritti riservati.',
      'Login': 'Accedi', 'Email': 'Email', 'Password': 'Password',
      'Remember me': 'Ricordami', 'Forgot your password?': 'Password dimenticata?',
      'Show password': 'Mostra password',
      'Administration Dashboard': 'Dashboard di Amministrazione',
      'Real-time metrics and notifications panel': 'Pannello di metriche e notifiche in tempo reale',
      'Date range': 'Intervallo date', 'From': 'Da', 'To': 'A',
      'Specialties': 'Specialità', 'Select All': 'Seleziona Tutto', 'Boxes': 'Box', 'Reset': 'Ripristina',
      'Key Indicators': 'Indicatori Chiave', 'Box occupation': 'Occupazione dei box',
      'Total appointments': 'Totale consultazioni', 'Daily average': 'Media giornaliera',
      'Most demanded specialty': 'Specialità più richiesta',
      'In {{count}} day': 'In {{count}} giorno', 'In {{count}} days': 'In {{count}} giorni',
      'Total capacity: {{count}} boxes': 'Capacità totale: {{count}} box',
      'Appointments per day': 'Consultazioni al giorno',
      '{{count}} appointment': '{{count}} consultazione',
      '{{count}} appointments': '{{count}} consultazioni',
      'Visual Analysis': 'Analisi Visiva',
      'Appointments by Specialty': 'Consultazioni per Specialità',
      'Appointments by Day': 'Consultazioni per Giorno',
      'Doctor Performance': 'Prestazioni dei Medici',
      'No data': 'Nessun dato',
      'Apply filters to view the KPI': 'Applica filtri per visualizzare il KPI',
      'Loading data...': 'Caricamento dati...',
      'Cardiology': 'Cardiologia', 'Pediatrics': 'Pediatria', 'Gynecology': 'Ginecologia',
      'Traumatology': 'Traumatologia', 'Dermatology': 'Dermatologia', 'Neurology': 'Neurologia',
      'Monday': 'Lunedì', 'Tuesday': 'Martedì', 'Wednesday': 'Mercoledì',
      'Thursday': 'Giovedì', 'Friday': 'Venerdì', 'Saturday': 'Sabato', 'Sunday': 'Domenica',
      'Agenda': 'Agenda', 'Agenda System': 'Sistema di Agenda',
      'Manage your medical agenda efficiently': 'Gestisci la tua agenda medica in modo efficiente',
      'Agenda Management': 'Gestione Agenda',
      'View and manage your medical appointments': 'Visualizza e gestisci i tuoi appuntamenti medici',
      'Doctor': 'Medico', 'Data Management': 'Gestione Dati',
      'Export and import consultation information': 'Esporta e importa informazioni sulle consultazioni',
      'Import': 'Importa', 'Export': 'Esporta',
      'No permissions available': 'Nessun permesso disponibile',
      'You do not have permissions to access any section of the agenda. Contact the administrator.': 'Non hai i permessi per accedere ad alcuna sezione dell\'agenda. Contatta l\'amministratore.',
      'Appointments in Progress': 'Appuntamenti in Corso',
      'Real-time monitoring of the status of medical appointments': 'Monitoraggio in tempo reale dello stato degli appuntamenti medici',
      'Appointment to be confirmed': 'Appuntamento da confermare',
      'Appointment already held': 'Appuntamento già tenuto',
      'Loading appointments...': 'Caricamento appuntamenti...',
      'No appointments in progress': 'Nessun appuntamento in corso',
      'There are no scheduled appointments at this time.': 'Non ci sono appuntamenti programmati in questo momento.',
      'Box Detail': 'Dettaglio Box',
      'Instrument categories': 'Categorie di strumenti',
      'Notification History': 'Storico Notifiche',
      'Stay up to date with all system activities and updates': 'Rimani aggiornato su tutte le attività e gli aggiornamenti del sistema',
      'View notification details': 'Visualizza dettagli notifica',
      'Attended': 'Partecipato', 'Not attended': 'Non partecipato', 'Canceled': 'Annullato',
      '{{count}} appointment has been imported.': '{{count}} appuntamento è stato importato.',
      '{{count}} appointments have been imported.': '{{count}} appuntamenti sono stati importati.',
      'Medical Agenda': 'Agenda Medica',
      '-- Select a {{parent}} --': '-- Seleziona un {{parent}} --',
      '-- Select a {{entity}} --': '-- Seleziona un {{entity}} --',
      'Make appointment': 'Prendi appuntamento',
      'Schedule Medical Appointment': 'Programma Appuntamento Medico',
      'Location': 'Posizione', '-- Select a corridor --': '-- Seleziona un corridoio --',
      '-- Select a box --': '-- Seleziona un box --',
      'Medical Staff': 'Personale Medico',
      '-- Select a specialty --': '-- Seleziona una specialità --',
      '-- Select a doctor --': '-- Seleziona un medico --',
      'Date and Time': 'Data e Ora', '-- Select time --': '-- Seleziona orario --',
      'Time': 'Ora', 'Drag here to unschedule': 'Trascina qui per annullare',
      'Appointment scheduled successfully.': 'Appuntamento programmato con successo.',
      'Appointment unscheduled successfully.': 'Appuntamento annullato con successo.',
      'Error scheduling appointment.': 'Errore nella programmazione dell\'appuntamento.',
      'Error unscheduling appointment.': 'Errore nell\'annullamento dell\'appuntamento.',
      'Are you sure you want to unschedule this appointment?': 'Sei sicuro di voler annullare questo appuntamento?',
      'Specialty': 'Specialità', 'View details': 'Visualizza dettagli',
      'Import completed successfully': 'Importazione completata con successo',
      'Import Details': 'Dettagli Importazione', 'Close': 'Chiudi',
      'Medical consultations import details': 'Dettagli importazione consultazioni mediche',
      'Date': 'Data', 'Start Time': 'Ora Inizio', 'End Time': 'Ora Fine',
      'Consult Type': 'Tipo Consulta', 'Status': 'Stato',
      'Pending': 'In attesa', 'Confirmed': 'Confermato',
      'Total in Progress': 'Totale in Corso',
      'No results found': 'Nessun risultato trovato',
      'There are no boxes matching the applied filters. Try adjusting your search criteria.': 'Non ci sono box corrispondenti ai filtri applicati. Prova ad aggiustare i criteri di ricerca.',
      'Reset filters': 'Ripristina filtri', 'Show details': 'Mostra dettagli',
      'Filters': 'Filtri', 'Select Corridor': 'Seleziona Corridoio',
      'Select Box': 'Seleziona Box', 'Select Specialty': 'Seleziona Specialità',
      'Select Doctor': 'Seleziona Medico', 'Select Date': 'Seleziona Data',
      'Select type': 'Seleziona tipo', 'Medical': 'Medico', 'Non-medical': 'Non medico',
      'Confirm Appointment': 'Conferma Appuntamento', 'Unconfirm': 'Annulla conferma',
      'Appointments': 'Appuntamenti', 'Appointments Management': 'Gestione Appuntamenti',
      'Corridor': 'Corridoio', 'State': 'Stato', 'In use': 'In uso',
      'Free Boxes': 'Box Liberi', 'No notifications': 'Nessuna notifica',
      'When you have new notifications, they will appear here.': 'Quando avrai nuove notifiche, appariranno qui.',
      'Error loading notifications': 'Errore caricamento notifiche',
      'Please try again later.': 'Per favore riprova più tardi.',
      'Back to home': 'Torna alla home', 'Error': 'Errore',
      'Page not found': 'Pagina non trovata',
      'The path {{path}} does not exist': 'Il percorso {{path}} non esiste',
      'Select the interface language': 'Seleziona la lingua dell\'interfaccia',
      'Pending Appointments': 'Appuntamenti in Attesa',
      'Confirmed Appointments': 'Appuntamenti Confermati',
      'Today\'s Appointments': 'Appuntamenti di Oggi',
      'Statistics and Metrics': 'Statistiche e Metriche',
      'Total Appointments': 'Appuntamenti Totali',
      'Box Usage': 'Utilizzo Box', 'Not Done': 'Non Fatto',
      'Compliance': 'Conformità', 'Appointment Compliance': 'Conformità Appuntamenti',
      'Box Information': 'Informazioni Box', 'Name': 'Nome',
      'Box Instruments': 'Strumenti Box', 'Select Date': 'Seleziona Data',
      'Previous day': 'Giorno precedente', 'Next day': 'Giorno successivo',
      'Select date': 'Seleziona data', 'Furniture': 'Arredamento',
      'No items in this category.': 'Nessun elemento in questa categoria.',
      'Unknown doctor': 'Medico sconosciuto', 'Unknown box': 'Box sconosciuto'
    }
  }
};

// Función para traducir recursivamente un objeto JSON
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

// Generar archivo traducido para Italiano
const itTranslated = translateObject(en, translations.it.translations);
fs.writeFileSync(
  path.join(localesDir, 'it.json'),
  JSON.stringify(itTranslated, null, 2),
  'utf8'
);

console.log('✅ Italiano (it.json) - Completado 100%');
