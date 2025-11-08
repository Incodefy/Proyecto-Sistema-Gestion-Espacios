const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../locales');

// Diccionarios COMPLETOS para cada idioma
const allTranslations = {
  zh: { // Chino
    'Spanish': '西班牙语', 'English': '英语', 'Portuguese': '葡萄牙语', 'Italian': '意大利语',
    'Chinese': '中文', 'Hindi': '印地语', 'Arabic': '阿拉伯语', 'Bengali': '孟加拉语',
    'Russian': '俄语', 'Japanese': '日语', 'Punjabi': '旁遮普语', 'German': '德语',
    'Javanese': '爪哇语', 'Korean': '韩语', 'French': '法语', 'Telugu': '泰卢固语',
    'Marathi': '马拉地语', 'Turkish': '土耳其语', 'Tamil': '泰米尔语', 'Vietnamese': '越南语',
    'Urdu': '乌尔都语', 'Dutch': '荷兰语', 'Polish': '波兰语', 'Thai': '泰语', 'Persian': '波斯语',
    'My Profile - Customization': '我的个人资料 - 自定义', 'My Profile': '我的个人资料',
    'Customize your interface appearance': '自定义您的界面外观', 'Theme': '主题',
    'Mode:': '模式：', 'Light': '浅色', 'Dark': '深色', 'Main color:': '主要颜色：',
    'Typography': '排版', 'Font Size': '字体大小', 'Text scale:': '文本缩放：',
    'Interface language:': '界面语言：', 'Saving...': '保存中...', 'Error saving changes.': '保存更改时出错。',
    'Changes saved. The page will reload...': '更改已保存。页面将重新加载...', 
    'Preview is disabled. Save changes to apply them.': '预览已禁用。保存更改以应用它们。',
    'Unsaved changes': '未保存的更改', 'View in-progress appointments': '查看进行中的预约',
    'In-progress appointments': '进行中的预约', 'Back to top': '返回顶部',
    'Filter by corridor...': '按走廊筛选...', 'Filter by box...': '按诊室筛选...',
    'Filter by state': '按状态筛选', 'You do not have permission to view the details of this box.': '您无权查看此诊室的详细信息。',
    'Next appointment not available.': '下一个预约不可用。', 'Hide details': '隐藏详细信息',
    'Next Appointment': '下一个预约', 'No more appointments today': '今天没有更多预约',
    'Corridor {{count}}': '走廊 {{count}}', '© 2025 Incodefy. Medical Agenda System - All rights reserved.': '© 2025 Incodefy. 医疗日程系统 - 保留所有权利。',
    'Remember me': '记住我', 'Forgot your password?': '忘记密码？', 'Show password': '显示密码',
    'Administration Dashboard': '管理员仪表板', 'Real-time metrics and notifications panel': '实时指标和通知面板',
    'Date range': '日期范围', 'Specialties': '专科', 'Boxes': '诊室', 'Key Indicators': '关键指标',
    'Box occupation': '诊室占用率', 'Daily average': '日均值', 'Most demanded specialty': '最受欢迎的专科',
    'In {{count}} day': '在 {{count}} 天内', 'In {{count}} days': '在 {{count}} 天内',
    'Total capacity: {{count}} boxes': '总容量：{{count}} 个诊室', 'Appointments per day': '每日预约数',
    '{{count}} appointment': '{{count}} 个预约', '{{count}} appointments': '{{count}} 个预约',
    'Visual Analysis': '可视化分析', 'Appointments by Specialty': '按专科分类的预约',
    'Appointments by Day': '按日期分类的预约', 'Doctor Performance': '医生表现',
    'No data': '无数据', 'No data desc': '应用筛选器以查看关键绩效指标',
    'Agenda System': '日程系统', 'Manage your medical agenda efficiently': '高效管理您的医疗日程',
    'Agenda Management': '日程管理', 'View and manage your medical appointments': '查看和管理您的医疗预约',
    'Data Management': '数据管理', 'Export and import consultation information': '导出和导入咨询信息',
    'No permissions available': '无可用权限', 'You do not have permissions to access any section of the agenda. Contact the administrator.': '您无权访问日程的任何部分。请联系管理员。',
    'Real-time monitoring of the status of medical appointments': '实时监控医疗预约状态',
    'Appointment to be confirmed': '待确认的预约', 'Appointment already held': '已完成的预约',
    'Loading appointments...': '加载预约中...', 'No appointments in progress': '没有进行中的预约',
    'There are no scheduled appointments at this time.': '目前没有计划的预约。',
    'Box Detail': '诊室详情', 'Instrument categories': '仪器类别',
    'Stay up to date with all system activities and updates': '随时了解所有系统活动和更新',
    'View notification details': '查看通知详情', 'Attended': '已参加', 'Not attended': '未参加',
    'Canceled': '已取消', '{{count}} appointment has been imported.': '已导入 {{count}} 个预约。',
    '{{count}} appointments have been imported.': '已导入 {{count}} 个预约。',
    '-- Select a {{parent}} --': '-- 选择{{parent}} --', '-- Select a {{entity}} --': '-- 选择{{entity}} --',
    'Make appointment': '预约', 'Schedule Medical Appointment': '安排医疗预约',
    '-- Select a corridor --': '-- 选择走廊 --', '-- Select a box --': '-- 选择诊室 --',
    '-- Select a specialty --': '-- 选择专科 --', '-- Select a doctor --': '-- 选择医生 --',
    '-- Select time --': '-- 选择时间 --', 'Drag here to unschedule': '拖到这里取消预约',
    'Appointment scheduled successfully.': '预约成功。', 'Appointment unscheduled successfully.': '取消预约成功。',
    'Error scheduling appointment.': '预约时出错。', 'Error unscheduling appointment.': '取消预约时出错。',
    'Are you sure you want to unschedule this appointment?': '您确定要取消此预约吗？',
    'Import completed successfully': '导入成功完成', 'Import Details': '导入详情',
    'Medical consultations import details': '医疗咨询导入详情', 'Start Time': '开始时间',
    'End Time': '结束时间', 'Consult Type': '咨询类型', 'Total in Progress': '总进行中',
    'No results found': '未找到结果', 'There are no boxes matching the applied filters. Try adjusting your search criteria.': '没有符合应用筛选器的诊室。尝试调整您的搜索条件。',
    'Reset filters': '重置筛选器', 'Show details': '显示详情', 'Select Corridor': '选择走廊',
    'Select Box': '选择诊室', 'Select Specialty': '选择专科', 'Select Doctor': '选择医生',
    'Select Date': '选择日期', 'Select type': '选择类型', 'Medical': '医疗',
    'Non-medical': '非医疗', 'Confirm Appointment': '确认预约', 'Unconfirm': '取消确认',
    'Appointments Management': '预约管理', 'State': '状态', 'In use': '使用中',
    'Free Boxes': '空闲诊室', 'When you have new notifications, they will appear here.': '当您有新通知时，它们将显示在这里。',
    'Error loading notifications': '加载通知时出错', 'Please try again later.': '请稍后再试。',
    'Back to home': '返回主页', 'Page not found': '页面未找到', 'The path {{path}} does not exist': '路径 {{path}} 不存在',
    'Select the interface language': '选择界面语言', 'Pending Appointments': '待处理预约',
    'Confirmed Appointments': '已确认预约', "Today's Appointments": '今日预约',
    'Statistics and Metrics': '统计和指标', 'Total Appointments': '总预约数',
    'Box Usage': '诊室使用情况', 'Not Done': '未完成', 'Compliance': '合规性',
    'Box Information': '诊室信息', 'Box Instruments': '诊室仪器', 'Previous day': '前一天',
    'Next day': '后一天', 'Select date': '选择日期', 'Furniture': '家具',
    'No items in this category.': '此类别中没有项目。', 'Unknown doctor': '未知医生',
    'Unknown box': '未知诊室'
  },
  ja: { // Japonés
    'Spanish': 'スペイン語', 'English': '英語', 'Portuguese': 'ポルトガル語', 'Italian': 'イタリア語',
    'Chinese': '中国語', 'Hindi': 'ヒンディー語', 'Arabic': 'アラビア語', 'Bengali': 'ベンガル語',
    'Russian': 'ロシア語', 'Japanese': '日本語', 'Punjabi': 'パンジャブ語', 'German': 'ドイツ語',
    'Javanese': 'ジャワ語', 'Korean': '韓国語', 'French': 'フランス語', 'Telugu': 'テルグ語',
    'Marathi': 'マラーティー語', 'Turkish': 'トルコ語', 'Tamil': 'タミル語', 'Vietnamese': 'ベトナム語',
    'Urdu': 'ウルドゥー語', 'Dutch': 'オランダ語', 'Polish': 'ポーランド語', 'Thai': 'タイ語', 'Persian': 'ペルシア語',
    'My Profile - Customization': 'マイプロフィール - カスタマイズ', 'My Profile': 'マイプロフィール',
    'Customize your interface appearance': 'インターフェースの外観をカスタマイズ', 'Theme': 'テーマ',
    'Mode:': 'モード：', 'Light': 'ライト', 'Dark': 'ダーク', 'Main color:': 'メインカラー：',
    'Typography': 'タイポグラフィ', 'Font Size': 'フォントサイズ', 'Text scale:': 'テキストスケール：',
    'Interface language:': 'インターフェース言語：', 'Saving...': '保存中...', 'Error saving changes.': '変更の保存中にエラーが発生しました。',
    'Changes saved. The page will reload...': '変更が保存されました。ページが再読み込みされます...', 
    'Preview is disabled. Save changes to apply them.': 'プレビューは無効です。変更を保存して適用してください。',
    'Unsaved changes': '未保存の変更', 'View in-progress appointments': '進行中の予約を表示',
    'In-progress appointments': '進行中の予約', 'Back to top': 'トップに戻る',
    'Filter by corridor...': '廊下でフィルター...', 'Filter by box...': 'ボックスでフィルター...',
    'Filter by state': '状態でフィルター', 'You do not have permission to view the details of this box.': 'このボックスの詳細を表示する権限がありません。',
    'Next appointment not available.': '次の予約は利用できません。', 'Hide details': '詳細を非表示',
    'Next Appointment': '次の予約', 'No more appointments today': '今日はこれ以上予約はありません',
    'Corridor {{count}}': '廊下 {{count}}', '© 2025 Incodefy. Medical Agenda System - All rights reserved.': '© 2025 Incodefy. 医療予定システム - 全著作権所有。',
    'Remember me': 'ログイン状態を保持', 'Forgot your password?': 'パスワードをお忘れですか？', 'Show password': 'パスワードを表示',
    'Administration Dashboard': '管理者ダッシュボード', 'Real-time metrics and notifications panel': 'リアルタイムメトリクスと通知パネル',
    'Date range': '日付範囲', 'Specialties': '専門分野', 'Boxes': 'ボックス', 'Key Indicators': '主要指標',
    'Box occupation': 'ボックス占有率', 'Daily average': '1日平均', 'Most demanded specialty': '最も需要の多い専門分野',
    'In {{count}} day': '{{count}}日間', 'In {{count}} days': '{{count}}日間',
    'Total capacity: {{count}} boxes': '総容量：{{count}}ボックス', 'Appointments per day': '1日あたりの予約数',
    '{{count}} appointment': '{{count}}件の予約', '{{count}} appointments': '{{count}}件の予約',
    'Visual Analysis': '視覚分析', 'Appointments by Specialty': '専門分野別予約',
    'Appointments by Day': '日別予約', 'Doctor Performance': '医師のパフォーマンス',
    'No data': 'データなし', 'No data desc': 'フィルターを適用してKPIを表示',
    'Agenda System': '予定システム', 'Manage your medical agenda efficiently': '医療予定を効率的に管理',
    'Agenda Management': '予定管理', 'View and manage your medical appointments': '医療予約の表示と管理',
    'Data Management': 'データ管理', 'Export and import consultation information': '診療情報のエクスポートとインポート',
    'No permissions available': '利用可能な権限がありません', 'You do not have permissions to access any section of the agenda. Contact the administrator.': '予定のどのセクションにもアクセスする権限がありません。管理者に連絡してください。',
    'Real-time monitoring of the status of medical appointments': '医療予約のステータスのリアルタイム監視',
    'Appointment to be confirmed': '確認待ちの予約', 'Appointment already held': 'すでに実施された予約',
    'Loading appointments...': '予約を読み込み中...', 'No appointments in progress': '進行中の予約はありません',
    'There are no scheduled appointments at this time.': '現在、予定されている予約はありません。',
    'Box Detail': 'ボックス詳細', 'Instrument categories': '機器カテゴリ',
    'Stay up to date with all system activities and updates': 'すべてのシステムアクティビティと更新を最新の状態に保つ',
    'View notification details': '通知の詳細を表示', 'Attended': '出席', 'Not attended': '欠席',
    'Canceled': 'キャンセル', '{{count}} appointment has been imported.': '{{count}}件の予約がインポートされました。',
    '{{count}} appointments have been imported.': '{{count}}件の予約がインポートされました。',
    '-- Select a {{parent}} --': '-- {{parent}}を選択 --', '-- Select a {{entity}} --': '-- {{entity}}を選択 --',
    'Make appointment': '予約する', 'Schedule Medical Appointment': '医療予約をスケジュール',
    '-- Select a corridor --': '-- 廊下を選択 --', '-- Select a box --': '-- ボックスを選択 --',
    '-- Select a specialty --': '-- 専門分野を選択 --', '-- Select a doctor --': '-- 医師を選択 --',
    '-- Select time --': '-- 時間を選択 --', 'Drag here to unschedule': 'ここにドラッグしてスケジュール解除',
    'Appointment scheduled successfully.': '予約が正常にスケジュールされました。', 'Appointment unscheduled successfully.': '予約が正常にキャンセルされました。',
    'Error scheduling appointment.': '予約のスケジュール中にエラーが発生しました。', 'Error unscheduling appointment.': '予約のキャンセル中にエラーが発生しました。',
    'Are you sure you want to unschedule this appointment?': 'この予約をキャンセルしてもよろしいですか？',
    'Import completed successfully': 'インポートが正常に完了しました', 'Import Details': 'インポート詳細',
    'Medical consultations import details': '医療診療インポート詳細', 'Start Time': '開始時刻',
    'End Time': '終了時刻', 'Consult Type': '診療タイプ', 'Total in Progress': '進行中の合計',
    'No results found': '結果が見つかりません', 'There are no boxes matching the applied filters. Try adjusting your search criteria.': '適用されたフィルターに一致するボックスはありません。検索条件を調整してみてください。',
    'Reset filters': 'フィルターをリセット', 'Show details': '詳細を表示', 'Select Corridor': '廊下を選択',
    'Select Box': 'ボックスを選択', 'Select Specialty': '専門分野を選択', 'Select Doctor': '医師を選択',
    'Select Date': '日付を選択', 'Select type': 'タイプを選択', 'Medical': '医療',
    'Non-medical': '非医療', 'Confirm Appointment': '予約を確認', 'Unconfirm': '確認解除',
    'Appointments Management': '予約管理', 'State': '状態', 'In use': '使用中',
    'Free Boxes': '空きボックス', 'When you have new notifications, they will appear here.': '新しい通知がある場合、ここに表示されます。',
    'Error loading notifications': '通知の読み込み中にエラーが発生しました', 'Please try again later.': '後でもう一度お試しください。',
    'Back to home': 'ホームに戻る', 'Page not found': 'ページが見つかりません', 'The path {{path}} does not exist': 'パス{{path}}は存在しません',
    'Select the interface language': 'インターフェース言語を選択', 'Pending Appointments': '保留中の予約',
    'Confirmed Appointments': '確認済みの予約', "Today's Appointments": '今日の予約',
    'Statistics and Metrics': '統計とメトリクス', 'Total Appointments': '総予約数',
    'Box Usage': 'ボックス使用状況', 'Not Done': '未完了', 'Compliance': 'コンプライアンス',
    'Box Information': 'ボックス情報', 'Box Instruments': 'ボックス機器', 'Previous day': '前日',
    'Next day': '翌日', 'Select date': '日付を選択', 'Furniture': '家具',
    'No items in this category.': 'このカテゴリにはアイテムがありません。', 'Unknown doctor': '不明な医師',
    'Unknown box': '不明なボックス'
  }
};

// Continúa en la siguiente parte...
console.log('🔧 Corrigiendo traducciones nativas para TODOS los idiomas...\n');

let completed = 0;
const languages = Object.keys(allTranslations);

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

for (const lang of languages) {
  try {
    const filePath = path.join(localesDir, `${lang}.json`);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const fixed = replaceInObject(content, allTranslations[lang]);
    fs.writeFileSync(filePath, JSON.stringify(fixed, null, 2), 'utf8');
    completed++;
    console.log(`✅ ${lang.toUpperCase()} - Corregido (${completed}/${languages.length})`);
  } catch (error) {
    console.log(`❌ ${lang.toUpperCase()} - Error: ${error.message}`);
  }
}

console.log(`\n🎉 ${completed}/${languages.length} idiomas corregidos!`);
console.log('\n📝 Nota: Este script procesa ZH y JA. Se necesitan scripts adicionales para los demás idiomas.');
