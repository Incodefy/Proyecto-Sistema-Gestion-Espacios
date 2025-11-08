const fs = require('fs');
const path = require('path');

// Leer el archivo en.json como referencia
const enPath = path.join(__dirname, '../locales/en.json');
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Diccionarios completos para VI, UR, TH
const dictionaries = {
  vi: {
    // Nombres de idiomas
    "Spanish": "Tiếng Tây Ban Nha",
    "English": "Tiếng Anh",
    "Portuguese": "Tiếng Bồ Đào Nha",
    "Italian": "Tiếng Ý",
    "Chinese": "Tiếng Trung",
    "Hindi": "Tiếng Hindi",
    "Arabic": "Tiếng Ả Rập",
    "Bengali": "Tiếng Bengal",
    "Russian": "Tiếng Nga",
    "Japanese": "Tiếng Nhật",
    "Punjabi": "Tiếng Punjab",
    "German": "Tiếng Đức",
    "Javanese": "Tiếng Java",
    "Korean": "Tiếng Hàn",
    "French": "Tiếng Pháp",
    "Telugu": "Tiếng Telugu",
    "Marathi": "Tiếng Marathi",
    "Turkish": "Tiếng Thổ Nhĩ Kỳ",
    "Tamil": "Tiếng Tamil",
    "Vietnamese": "Tiếng Việt",
    "Urdu": "Tiếng Urdu",
    "Dutch": "Tiếng Hà Lan",
    "Polish": "Tiếng Ba Lan",
    "Thai": "Tiếng Thái",
    "Persian": "Tiếng Ba Tư",

    // UI Principal
    "Theme": "Chủ đề",
    "Mode": "Chế độ",
    "Light": "Sáng",
    "Dark": "Tối",
    "Language": "Ngôn ngữ",
    "Profile": "Hồ sơ",
    "Logout": "Đăng xuất",
    "Settings": "Cài đặt",
    "Preferences": "Tùy chọn",
    
    // Dashboard
    "Dashboard": "Bảng điều khiển",
    "Medical Dashboard": "Bảng điều khiển y tế",
    "Welcome": "Chào mừng",
    "Total Boxes": "Tổng số phòng",
    "Available Boxes": "Phòng có sẵn",
    "Occupied Boxes": "Phòng đang sử dụng",
    "Pending Consultations": "Tư vấn đang chờ",
    "Completed Consultations": "Tư vấn đã hoàn thành",
    "Active Consultations": "Tư vấn đang diễn ra",
    "Consultations": "Tư vấn",
    "Ongoing Consultations": "Tư vấn đang tiến hành",
    "View Details": "Xem chi tiết",
    "View All": "Xem tất cả",
    "Statistics": "Thống kê",
    "Overview": "Tổng quan",
    
    // Box/Habitaciones
    "Box": "Phòng",
    "Boxes": "Các phòng",
    "Box Status": "Trạng thái phòng",
    "Box Details": "Chi tiết phòng",
    "Select Box": "Chọn phòng",
    "Available": "Có sẵn",
    "Occupied": "Đang sử dụng",
    "Under Maintenance": "Đang bảo trì",
    "Reserved": "Đã đặt trước",
    "Status": "Trạng thái",
    "Hallway": "Hành lang",
    "Floor": "Tầng",
    "Wing": "Khu",
    "Room Number": "Số phòng",
    
    // Pacientes
    "Patient": "Bệnh nhân",
    "Patients": "Bệnh nhân",
    "Patient Name": "Tên bệnh nhân",
    "Patient ID": "Mã bệnh nhân",
    "Patient Information": "Thông tin bệnh nhân",
    "RUT": "Số định danh",
    "Age": "Tuổi",
    "Gender": "Giới tính",
    "Male": "Nam",
    "Female": "Nữ",
    "Other": "Khác",
    "Contact": "Liên hệ",
    "Phone": "Điện thoại",
    "Email": "Email",
    "Address": "Địa chỉ",
    
    // Consultas/Citas
    "Appointment": "Cuộc hẹn",
    "Appointments": "Các cuộc hẹn",
    "Schedule": "Lịch trình",
    "Calendar": "Lịch",
    "Agenda": "Lịch làm việc",
    "New Appointment": "Cuộc hẹn mới",
    "Edit Appointment": "Chỉnh sửa cuộc hẹn",
    "Cancel Appointment": "Hủy cuộc hẹn",
    "Confirm Appointment": "Xác nhận cuộc hẹn",
    "Reschedule": "Đặt lại lịch",
    "Date": "Ngày",
    "Time": "Giờ",
    "Duration": "Thời lượng",
    "Start Time": "Giờ bắt đầu",
    "End Time": "Giờ kết thúc",
    "Reason": "Lý do",
    "Notes": "Ghi chú",
    "Priority": "Ưu tiên",
    "High": "Cao",
    "Medium": "Trung bình",
    "Low": "Thấp",
    
    // Médicos
    "Doctor": "Bác sĩ",
    "Doctors": "Các bác sĩ",
    "Specialist": "Chuyên khoa",
    "Specialty": "Chuyên khoa",
    "Specialties": "Các chuyên khoa",
    "Assigned Doctor": "Bác sĩ phụ trách",
    "Available Doctors": "Bác sĩ có sẵn",
    
    // Especialidades médicas
    "Cardiology": "Tim mạch",
    "Dermatology": "Da liễu",
    "Neurology": "Thần kinh",
    "Pediatrics": "Nhi khoa",
    "Orthopedics": "Chỉnh hình",
    "Ophthalmology": "Nhãn khoa",
    "Psychiatry": "Tâm thần",
    "Radiology": "X-quang",
    "Surgery": "Phẫu thuật",
    "General Medicine": "Nội tổng quát",
    
    // Notificaciones
    "Notifications": "Thông báo",
    "New Notification": "Thông báo mới",
    "Mark as Read": "Đánh dấu đã đọc",
    "Mark as Unread": "Đánh dấu chưa đọc",
    "Delete Notification": "Xóa thông báo",
    "No notifications": "Không có thông báo",
    "Notification History": "Lịch sử thông báo",
    "Read": "Đã đọc",
    "Unread": "Chưa đọc",
    
    // Acciones comunes
    "Save": "Lưu",
    "Cancel": "Hủy",
    "Delete": "Xóa",
    "Edit": "Chỉnh sửa",
    "Update": "Cập nhật",
    "Create": "Tạo",
    "Add": "Thêm",
    "Remove": "Xóa bỏ",
    "Search": "Tìm kiếm",
    "Filter": "Lọc",
    "Sort": "Sắp xếp",
    "Export": "Xuất",
    "Import": "Nhập",
    "Print": "In",
    "Download": "Tải xuống",
    "Upload": "Tải lên",
    "Refresh": "Làm mới",
    "Close": "Đóng",
    "Back": "Quay lại",
    "Next": "Tiếp theo",
    "Previous": "Trước",
    "Submit": "Gửi",
    "Confirm": "Xác nhận",
    "Yes": "Có",
    "No": "Không",
    
    // Colores
    "Red": "Đỏ",
    "Blue": "Xanh dương",
    "Green": "Xanh lá",
    "Yellow": "Vàng",
    "Orange": "Cam",
    "Purple": "Tím",
    "Pink": "Hồng",
    "Brown": "Nâu",
    "Black": "Đen",
    "White": "Trắng",
    "Gray": "Xám",
    
    // Tamaños
    "Small": "Nhỏ",
    "Medium": "Trung bình",
    "Large": "Lớn",
    "Extra Large": "Rất lớn",
    
    // Días de la semana
    "Monday": "Thứ Hai",
    "Tuesday": "Thứ Ba",
    "Wednesday": "Thứ Tư",
    "Thursday": "Thứ Năm",
    "Friday": "Thứ Sáu",
    "Saturday": "Thứ Bảy",
    "Sunday": "Chủ Nhật",
    
    // Estados
    "Active": "Hoạt động",
    "Inactive": "Không hoạt động",
    "Pending": "Đang chờ",
    "Completed": "Đã hoàn thành",
    "Cancelled": "Đã hủy",
    "In Progress": "Đang tiến hành",
    "Scheduled": "Đã lên lịch",
    
    // Login/Auth
    "Login": "Đăng nhập",
    "Username": "Tên đăng nhập",
    "Password": "Mật khẩu",
    "Remember me": "Ghi nhớ đăng nhập",
    "Forgot password": "Quên mật khẩu",
    "Sign in": "Đăng nhập",
    "Sign out": "Đăng xuất"
  },
  
  ur: {
    // Nombres de idiomas
    "Spanish": "ہسپانوی",
    "English": "انگریزی",
    "Portuguese": "پرتگالی",
    "Italian": "اطالوی",
    "Chinese": "چینی",
    "Hindi": "ہندی",
    "Arabic": "عربی",
    "Bengali": "بنگالی",
    "Russian": "روسی",
    "Japanese": "جاپانی",
    "Punjabi": "پنجابی",
    "German": "جرمن",
    "Javanese": "جاوی",
    "Korean": "کوریائی",
    "French": "فرانسیسی",
    "Telugu": "تیلگو",
    "Marathi": "مراٹھی",
    "Turkish": "ترکی",
    "Tamil": "تمل",
    "Vietnamese": "ویتنامی",
    "Urdu": "اردو",
    "Dutch": "ڈچ",
    "Polish": "پولش",
    "Thai": "تھائی",
    "Persian": "فارسی",

    // UI Principal
    "Theme": "تھیم",
    "Mode": "موڈ",
    "Light": "روشن",
    "Dark": "تاریک",
    "Language": "زبان",
    "Profile": "پروفائل",
    "Logout": "لاگ آؤٹ",
    "Settings": "ترتیبات",
    "Preferences": "ترجیحات",
    
    // Dashboard
    "Dashboard": "ڈیش بورڈ",
    "Medical Dashboard": "طبی ڈیش بورڈ",
    "Welcome": "خوش آمدید",
    "Total Boxes": "کل کمرے",
    "Available Boxes": "دستیاب کمرے",
    "Occupied Boxes": "مصروف کمرے",
    "Pending Consultations": "زیر التواء مشاورت",
    "Completed Consultations": "مکمل مشاورت",
    "Active Consultations": "فعال مشاورت",
    "Consultations": "مشاورت",
    "Ongoing Consultations": "جاری مشاورت",
    "View Details": "تفصیلات دیکھیں",
    "View All": "سب دیکھیں",
    "Statistics": "اعدادوشمار",
    "Overview": "جائزہ",
    
    // Box/Habitaciones
    "Box": "کمرہ",
    "Boxes": "کمرے",
    "Box Status": "کمرے کی حالت",
    "Box Details": "کمرے کی تفصیلات",
    "Select Box": "کمرہ منتخب کریں",
    "Available": "دستیاب",
    "Occupied": "مصروف",
    "Under Maintenance": "مرمت میں",
    "Reserved": "محفوظ",
    "Status": "حالت",
    "Hallway": "راہداری",
    "Floor": "منزل",
    "Wing": "ونگ",
    "Room Number": "کمرہ نمبر",
    
    // Pacientes
    "Patient": "مریض",
    "Patients": "مریض",
    "Patient Name": "مریض کا نام",
    "Patient ID": "مریض کی شناخت",
    "Patient Information": "مریض کی معلومات",
    "RUT": "شناختی نمبر",
    "Age": "عمر",
    "Gender": "جنس",
    "Male": "مرد",
    "Female": "عورت",
    "Other": "دیگر",
    "Contact": "رابطہ",
    "Phone": "فون",
    "Email": "ای میل",
    "Address": "پتہ",
    
    // Consultas/Citas
    "Appointment": "ملاقات",
    "Appointments": "ملاقاتیں",
    "Schedule": "شیڈول",
    "Calendar": "کیلنڈر",
    "Agenda": "ایجنڈا",
    "New Appointment": "نئی ملاقات",
    "Edit Appointment": "ملاقات میں ترمیم",
    "Cancel Appointment": "ملاقات منسوخ کریں",
    "Confirm Appointment": "ملاقات کی تصدیق کریں",
    "Reschedule": "دوبارہ شیڈول کریں",
    "Date": "تاریخ",
    "Time": "وقت",
    "Duration": "مدت",
    "Start Time": "شروع کا وقت",
    "End Time": "ختم کا وقت",
    "Reason": "وجہ",
    "Notes": "نوٹس",
    "Priority": "ترجیح",
    "High": "زیادہ",
    "Medium": "درمیانی",
    "Low": "کم",
    
    // Médicos
    "Doctor": "ڈاکٹر",
    "Doctors": "ڈاکٹرز",
    "Specialist": "ماہر",
    "Specialty": "خصوصیت",
    "Specialties": "خصوصیات",
    "Assigned Doctor": "مقرر کردہ ڈاکٹر",
    "Available Doctors": "دستیاب ڈاکٹرز",
    
    // Especialidades médicas
    "Cardiology": "قلبیات",
    "Dermatology": "جلدیات",
    "Neurology": "اعصابیات",
    "Pediatrics": "اطفالیات",
    "Orthopedics": "ہڈیوں کی سرجری",
    "Ophthalmology": "چشم",
    "Psychiatry": "نفسیات",
    "Radiology": "ایکسرے",
    "Surgery": "سرجری",
    "General Medicine": "عمومی طب",
    
    // Notificaciones
    "Notifications": "اطلاعات",
    "New Notification": "نئی اطلاع",
    "Mark as Read": "پڑھا ہوا نشان زد کریں",
    "Mark as Unread": "نہ پڑھا ہوا نشان زد کریں",
    "Delete Notification": "اطلاع حذف کریں",
    "No notifications": "کوئی اطلاع نہیں",
    "Notification History": "اطلاعات کی تاریخ",
    "Read": "پڑھا ہوا",
    "Unread": "نہ پڑھا ہوا",
    
    // Acciones comunes
    "Save": "محفوظ کریں",
    "Cancel": "منسوخ کریں",
    "Delete": "حذف کریں",
    "Edit": "ترمیم کریں",
    "Update": "اپ ڈیٹ کریں",
    "Create": "بنائیں",
    "Add": "شامل کریں",
    "Remove": "ہٹائیں",
    "Search": "تلاش کریں",
    "Filter": "فلٹر کریں",
    "Sort": "ترتیب دیں",
    "Export": "برآمد کریں",
    "Import": "درآمد کریں",
    "Print": "پرنٹ کریں",
    "Download": "ڈاؤن لوڈ کریں",
    "Upload": "اپ لوڈ کریں",
    "Refresh": "تازہ کریں",
    "Close": "بند کریں",
    "Back": "واپس",
    "Next": "اگلا",
    "Previous": "پچھلا",
    "Submit": "جمع کرائیں",
    "Confirm": "تصدیق کریں",
    "Yes": "ہاں",
    "No": "نہیں",
    
    // Colores
    "Red": "سرخ",
    "Blue": "نیلا",
    "Green": "سبز",
    "Yellow": "پیلا",
    "Orange": "نارنجی",
    "Purple": "جامنی",
    "Pink": "گلابی",
    "Brown": "بھورا",
    "Black": "کالا",
    "White": "سفید",
    "Gray": "سرمئی",
    
    // Tamaños
    "Small": "چھوٹا",
    "Medium": "درمیانہ",
    "Large": "بڑا",
    "Extra Large": "بہت بڑا",
    
    // Días de la semana
    "Monday": "پیر",
    "Tuesday": "منگل",
    "Wednesday": "بدھ",
    "Thursday": "جمعرات",
    "Friday": "جمعہ",
    "Saturday": "ہفتہ",
    "Sunday": "اتوار",
    
    // Estados
    "Active": "فعال",
    "Inactive": "غیر فعال",
    "Pending": "زیر التواء",
    "Completed": "مکمل",
    "Cancelled": "منسوخ",
    "In Progress": "جاری",
    "Scheduled": "شیڈول شدہ",
    
    // Login/Auth
    "Login": "لاگ ان",
    "Username": "صارف کا نام",
    "Password": "پاس ورڈ",
    "Remember me": "مجھے یاد رکھیں",
    "Forgot password": "پاس ورڈ بھول گئے",
    "Sign in": "سائن ان",
    "Sign out": "سائن آؤٹ"
  },
  
  th: {
    // Nombres de idiomas
    "Spanish": "สเปน",
    "English": "อังกฤษ",
    "Portuguese": "โปรตุเกส",
    "Italian": "อิตาลี",
    "Chinese": "จีน",
    "Hindi": "ฮินดี",
    "Arabic": "อาหรับ",
    "Bengali": "เบงกาลี",
    "Russian": "รัสเซีย",
    "Japanese": "ญี่ปุ่น",
    "Punjabi": "ปัญจาบ",
    "German": "เยอรมัน",
    "Javanese": "ชวา",
    "Korean": "เกาหลี",
    "French": "ฝรั่งเศส",
    "Telugu": "เตลูกู",
    "Marathi": "มราฐี",
    "Turkish": "ตุรกี",
    "Tamil": "ทมิฬ",
    "Vietnamese": "เวียดนาม",
    "Urdu": "อูรดู",
    "Dutch": "ดัตช์",
    "Polish": "โปแลนด์",
    "Thai": "ไทย",
    "Persian": "เปอร์เซีย",

    // UI Principal
    "Theme": "ธีม",
    "Mode": "โหมด",
    "Light": "สว่าง",
    "Dark": "มืด",
    "Language": "ภาษา",
    "Profile": "โปรไฟล์",
    "Logout": "ออกจากระบบ",
    "Settings": "การตั้งค่า",
    "Preferences": "ความชอบ",
    
    // Dashboard
    "Dashboard": "แดชบอร์ด",
    "Medical Dashboard": "แดชบอร์ดทางการแพทย์",
    "Welcome": "ยินดีต้อนรับ",
    "Total Boxes": "ห้องทั้งหมด",
    "Available Boxes": "ห้องว่าง",
    "Occupied Boxes": "ห้องที่ใช้งาน",
    "Pending Consultations": "การปรึกษารอดำเนินการ",
    "Completed Consultations": "การปรึกษาที่เสร็จสิ้น",
    "Active Consultations": "การปรึกษาที่ใช้งานอยู่",
    "Consultations": "การปรึกษา",
    "Ongoing Consultations": "การปรึกษาที่กำลังดำเนินการ",
    "View Details": "ดูรายละเอียด",
    "View All": "ดูทั้งหมด",
    "Statistics": "สถิติ",
    "Overview": "ภาพรวม",
    
    // Box/Habitaciones
    "Box": "ห้อง",
    "Boxes": "ห้องต่างๆ",
    "Box Status": "สถานะห้อง",
    "Box Details": "รายละเอียดห้อง",
    "Select Box": "เลือกห้อง",
    "Available": "ว่าง",
    "Occupied": "ถูกใช้งาน",
    "Under Maintenance": "อยู่ระหว่างการบำรุงรักษา",
    "Reserved": "จอง",
    "Status": "สถานะ",
    "Hallway": "ทางเดิน",
    "Floor": "ชั้น",
    "Wing": "ปีก",
    "Room Number": "หมายเลขห้อง",
    
    // Pacientes
    "Patient": "ผู้ป่วย",
    "Patients": "ผู้ป่วย",
    "Patient Name": "ชื่อผู้ป่วย",
    "Patient ID": "รหัสผู้ป่วย",
    "Patient Information": "ข้อมูลผู้ป่วย",
    "RUT": "หมายเลขประจำตัว",
    "Age": "อายุ",
    "Gender": "เพศ",
    "Male": "ชาย",
    "Female": "หญิง",
    "Other": "อื่นๆ",
    "Contact": "ติดต่อ",
    "Phone": "โทรศัพท์",
    "Email": "อีเมล",
    "Address": "ที่อยู่",
    
    // Consultas/Citas
    "Appointment": "นัดหมาย",
    "Appointments": "การนัดหมาย",
    "Schedule": "ตารางเวลา",
    "Calendar": "ปฏิทิน",
    "Agenda": "วาระ",
    "New Appointment": "นัดหมายใหม่",
    "Edit Appointment": "แก้ไขนัดหมาย",
    "Cancel Appointment": "ยกเลิกนัดหมาย",
    "Confirm Appointment": "ยืนยันนัดหมาย",
    "Reschedule": "นัดใหม่",
    "Date": "วันที่",
    "Time": "เวลา",
    "Duration": "ระยะเวลา",
    "Start Time": "เวลาเริ่มต้น",
    "End Time": "เวลาสิ้นสุด",
    "Reason": "เหตุผล",
    "Notes": "หมายเหตุ",
    "Priority": "ลำดับความสำคัญ",
    "High": "สูง",
    "Medium": "ปานกลาง",
    "Low": "ต่ำ",
    
    // Médicos
    "Doctor": "แพทย์",
    "Doctors": "แพทย์",
    "Specialist": "ผู้เชี่ยวชาญ",
    "Specialty": "ความเชี่ยวชาญ",
    "Specialties": "ความเชี่ยวชาญ",
    "Assigned Doctor": "แพทย์ที่ได้รับมอบหมาย",
    "Available Doctors": "แพทย์ที่ว่าง",
    
    // Especialidades médicas
    "Cardiology": "โรคหัวใจ",
    "Dermatology": "โรคผิวหนัง",
    "Neurology": "โรคระบบประสาท",
    "Pediatrics": "กุมารเวชกรรม",
    "Orthopedics": "ศัลยกรรมกระดูก",
    "Ophthalmology": "จักษุวิทยา",
    "Psychiatry": "จิตเวช",
    "Radiology": "รังสีวิทยา",
    "Surgery": "ศัลยกรรม",
    "General Medicine": "อายุรกรรมทั่วไป",
    
    // Notificaciones
    "Notifications": "การแจ้งเตือน",
    "New Notification": "การแจ้งเตือนใหม่",
    "Mark as Read": "ทำเครื่องหมายว่าอ่านแล้ว",
    "Mark as Unread": "ทำเครื่องหมายว่ายังไม่อ่าน",
    "Delete Notification": "ลบการแจ้งเตือน",
    "No notifications": "ไม่มีการแจ้งเตือน",
    "Notification History": "ประวัติการแจ้งเตือน",
    "Read": "อ่านแล้ว",
    "Unread": "ยังไม่อ่าน",
    
    // Acciones comunes
    "Save": "บันทึก",
    "Cancel": "ยกเลิก",
    "Delete": "ลบ",
    "Edit": "แก้ไข",
    "Update": "อัปเดต",
    "Create": "สร้าง",
    "Add": "เพิ่ม",
    "Remove": "ลบออก",
    "Search": "ค้นหา",
    "Filter": "กรอง",
    "Sort": "เรียง",
    "Export": "ส่งออก",
    "Import": "นำเข้า",
    "Print": "พิมพ์",
    "Download": "ดาวน์โหลด",
    "Upload": "อัปโหลด",
    "Refresh": "รีเฟรช",
    "Close": "ปิด",
    "Back": "กลับ",
    "Next": "ถัดไป",
    "Previous": "ก่อนหน้า",
    "Submit": "ส่ง",
    "Confirm": "ยืนยัน",
    "Yes": "ใช่",
    "No": "ไม่",
    
    // Colores
    "Red": "แดง",
    "Blue": "น้ำเงิน",
    "Green": "เขียว",
    "Yellow": "เหลือง",
    "Orange": "ส้ม",
    "Purple": "ม่วง",
    "Pink": "ชมพู",
    "Brown": "น้ำตาล",
    "Black": "ดำ",
    "White": "ขาว",
    "Gray": "เทา",
    
    // Tamaños
    "Small": "เล็ก",
    "Medium": "กลาง",
    "Large": "ใหญ่",
    "Extra Large": "ใหญ่พิเศษ",
    
    // Días de la semana
    "Monday": "จันทร์",
    "Tuesday": "อังคาร",
    "Wednesday": "พุธ",
    "Thursday": "พฤหัสบดี",
    "Friday": "ศุกร์",
    "Saturday": "เสาร์",
    "Sunday": "อาทิตย์",
    
    // Estados
    "Active": "ใช้งานอยู่",
    "Inactive": "ไม่ใช้งาน",
    "Pending": "รอดำเนินการ",
    "Completed": "เสร็จสิ้น",
    "Cancelled": "ยกเลิก",
    "In Progress": "กำลังดำเนินการ",
    "Scheduled": "กำหนดการแล้ว",
    
    // Login/Auth
    "Login": "เข้าสู่ระบบ",
    "Username": "ชื่อผู้ใช้",
    "Password": "รหัสผ่าน",
    "Remember me": "จดจำฉัน",
    "Forgot password": "ลืมรหัสผ่าน",
    "Sign in": "ลงชื่อเข้าใช้",
    "Sign out": "ออกจากระบบ"
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
  { code: 'vi', name: 'VI' },
  { code: 'ur', name: 'UR' },
  { code: 'th', name: 'TH' }
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

console.log(`\n🎉 Batch 2 completado: ${successCount}/${languages.length}!`);
console.log(`✨ Ejecutar parte 3 para FA, PA, JV, TE, MR, TA...`);
