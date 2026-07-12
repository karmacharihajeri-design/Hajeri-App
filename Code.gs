/**
 * ============================================================
 *  रोजची हजेरी अॅप — Google Apps Script बॅकएंड (वेब आवृत्ती)
 * ============================================================
 *
 * सेटअप:
 * 1. नवीन Google Sheet बनवा — मेनूतील "हजेरी अॅप सेटअप → Tabs आपोआप तयार करा"
 *    वापरून सर्व आवश्यक Tabs आपोआप तयार होतील.
 * 2. Extensions → Apps Script → हा कोड पेस्ट करा.
 * 3. Deploy → New deployment → Web app:
 *      Execute as: Me
 *      Who has access: Anyone
 * 4. मिळालेली URL js/config.js मधील BACKEND_URL मध्ये टाका.
 *
 * ============================================================
 *  सकाळ/दुपार दोन-सत्र हजेरी पद्धत (नवीन)
 * ============================================================
 * - डेव्हलपर Admin पॅनलमधून सकाळच्या व दुपारच्या हजेरीची वेळ (From-To) ठरवतो
 *   (Settings: MorningStartTime, MorningEndTime, AfternoonStartTime, AfternoonEndTime).
 * - त्या-त्या वेळेतच संबंधित हजेरीचा फोटो काढता येतो — इतर वेळी बटण लॉक असते.
 * - सकाळचा फोटो काढला व दुपारचा नाही → "सकाळची अर्धी हजेरी"
 * - दुपारचा फोटो काढला व सकाळचा नाही → "दुपारची अर्धी हजेरी"
 * - दोन्ही फोटो काढले → "पूर्ण हजेरी"
 * - दोन्हीपैकी एकही नाही (व सुट्टी/रजा नसेल तर) → "गैरहजर"
 * - एकदा एखाद्या सत्राचा फोटो नोंदवला की तोच सत्र पुन्हा नोंदवता येत नाही.
 * - **कामानिमित्त बाहेर (Outdoor Duty)**: कर्मचारी नेमून दिलेल्या ठिकाणाबाहेर
 *   असल्यास "कामानिमित्त बाहेर आहे" पर्याय निवडून कारण+ठिकाण लिहून फोटो पाठवू
 *   शकतो — अशा वेळी GPS जिओफेन्स तपासणी वगळली जाते, पण चेहरा-ओळख व फोटो अजूनही
 *   आवश्यक असतातच. ही नोंद Attendance शीटमध्ये व PDF अहवालातही दिसते.
 *
 * सुट्ट्या: शनिवार-रविवार (किंवा Settings मधील WeeklyOffDays) आपोआप साप्ताहिक
 * सुट्टी धरली जाते. याशिवाय Developer "Holidays" शीटमध्ये सण/शासकीय सुट्या
 * जोडू शकतो. सुट्टीच्या दिवशी फोटोची गरज नसते व PDF मध्ये आपोआप तशी नोंद येते.
 *
 * रजा: कामगार leave.html वरून रजेचा अर्ज (फोटो/PDF पुरावा + From-To तारीख)
 * सादर करतो — "LeaveRequests" शीटमध्ये नोंदवला जातो. त्या तारखांना हजेरीची
 * गरज राहत नाही. कामगार लवकर कामावर परतल्यास Admin/Developer इथून रजेची
 * शेवटची तारीख बदलू शकतात.
 *
 * Sheet कॉलम्स (पहिली रो हेडर):
 *
 * Users:          MobileNumber | Name | Role | AssignedLocationID | Status |
 *                 FaceDescriptor | FaceEnrolled | RegisteredDeviceID
 * WorkLocations:  LocationID | LocationName | Latitude | Longitude | RadiusMeters |
 *                 SpotPhotoURL | TaggedBy | TaggedOn
 * Attendance:     Date | MobileNumber | MorningTime | MorningPhotoURL | MorningGPS |
 *                 AfternoonTime | AfternoonPhotoURL | AfternoonGPS | Status |
 *                 MorningNote | AfternoonNote
 * Holidays:       Date | HolidayName | AddedBy | AddedOn
 * LeaveRequests:  MobileNumber | Name | FromDate | ToDate | ProofFileURL | AppliedOn |
 *                 Status | LastEditedBy | LastEditedOn
 * Settings:       Key | Value  (rows: AppName, AppLogo, OrgAddress, MorningStartTime,
 *                 MorningEndTime, AfternoonStartTime, AfternoonEndTime, WeeklyOffDays,
 *                 StandbyMinutes, GramPanchayatOfficerName, SarpanchName)
 * ============================================================
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();
const SHEET_USERS = SS.getSheetByName('Users');
const SHEET_LOCATIONS = SS.getSheetByName('WorkLocations');
const SHEET_ATTENDANCE = SS.getSheetByName('Attendance');
const SHEET_SETTINGS = SS.getSheetByName('Settings');
const SHEET_HOLIDAYS = SS.getSheetByName('Holidays');
const SHEET_LEAVES = SS.getSheetByName('LeaveRequests');

/**
 * ============================================================
 *  एका-क्लिकवर सर्व आवश्यक Tabs आपोआप तयार करणे
 * ============================================================
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('हजेरी अॅप सेटअप')
    .addItem('Tabs आपोआप तयार करा / दुरुस्त करा', 'setupProjectSheets')
    .addItem('नमुना डेटा भरा (टेस्टिंगसाठी)', 'insertSampleData')
    .addSeparator()
    .addItem('जुनी हजेरी शीट आर्काइव्ह करून नवीन (सकाळ/दुपार) सुरू करा', 'archiveOldAttendanceAndStartFresh')
    .addToUi();
}

function getOrCreateSheet_(name, headers) {
  let sheet = SS.getSheetByName(name);
  if (!sheet) {
    sheet = SS.insertSheet(name);
  }
  // पहिली रो रिकामी असेल किंवा हेडर जुळत नसतील तरच हेडर टाका (जुना डेटा उडणार नाही)
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const isEmpty = firstRow.every(v => v === '' || v === null);
  if (isEmpty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e3ede7');
  }
  return sheet;
}

/** मुख्य सेटअप फंक्शन — मेनूतून किंवा Apps Script एडिटरमधून थेट चालवता येते */
function setupProjectSheets() {
  getOrCreateSheet_('Users',
    ['MobileNumber', 'Name', 'Role', 'AssignedLocationID', 'Status', 'FaceDescriptor', 'FaceEnrolled', 'RegisteredDeviceID']);
  getOrCreateSheet_('WorkLocations',
    ['LocationID', 'LocationName', 'Latitude', 'Longitude', 'RadiusMeters', 'SpotPhotoURL', 'TaggedBy', 'TaggedOn']);
  const attSheet = getOrCreateSheet_('Attendance',
    ['Date', 'MobileNumber', 'MorningTime', 'MorningPhotoURL', 'MorningGPS',
     'AfternoonTime', 'AfternoonPhotoURL', 'AfternoonGPS', 'Status', 'MorningNote', 'AfternoonNote']);
  // मागच्या अपडेटमधील ९-कॉलम शीट असेल (Note कॉलम्सशिवाय) तर तेवढेच जोडा — जुना डेटा सुरक्षित राहतो
  const attHeaderRow = attSheet.getRange(1, 1, 1, Math.max(attSheet.getLastColumn(), 9)).getValues()[0];
  if (!attHeaderRow[9]) {
    attSheet.getRange(1, 10, 1, 2).setValues([['MorningNote', 'AfternoonNote']]);
    attSheet.getRange(1, 10, 1, 2).setFontWeight('bold').setBackground('#e3ede7');
  }
  getOrCreateSheet_('Holidays', ['Date', 'HolidayName', 'AddedBy', 'AddedOn']);
  getOrCreateSheet_('LeaveRequests',
    ['MobileNumber', 'Name', 'FromDate', 'ToDate', 'ProofFileURL', 'AppliedOn', 'Status', 'LastEditedBy', 'LastEditedOn']);
  const settingsSheet = getOrCreateSheet_('Settings', ['Key', 'Value']);

  // Settings मध्ये आवश्यक डिफॉल्ट key-values नसतील तरच घाला (असल्यास बदलणार नाही)
  const defaults = {
    AppName: 'ग्रामपंचायत हजेरी अॅप',
    OrgAddress: 'ता. ______, जि. ______',
    AppLogo: '',
    MorningStartTime: '09:00',
    MorningEndTime: '11:00',
    AfternoonStartTime: '15:30',
    AfternoonEndTime: '19:00',
    WeeklyOffDays: '0,6', // 0=रविवार, 6=शनिवार (JavaScript/Apps Script दिवस क्रमांक)
    StandbyMinutes: '0', // 0 = बंद (auto-logout नाही); Developer इथून मिनिटे सेट करू शकतो
    GramPanchayatOfficerName: '',
    SarpanchName: '',
  };
  const existing = settingsSheet.getDataRange().getValues();
  const existingKeys = existing.slice(1).map(r => r[0]);
  for (const key in defaults) {
    if (!existingKeys.includes(key)) settingsSheet.appendRow([key, defaults[key]]);
  }

  // सुरुवातीचा रिकामा "Sheet1" (Google Sheet नवीन बनवताना आपोआप येणारा) साफ करा
  const defaultSheet = SS.getSheetByName('Sheet1');
  if (defaultSheet && SS.getSheets().length > 1) {
    const isBlank = defaultSheet.getDataRange().getValues().flat().every(v => v === '' || v === null);
    if (isBlank) SS.deleteSheet(defaultSheet);
  }

  SpreadsheetApp.getUi().alert('✅ सर्व Tabs व डिफॉल्ट सेटिंग्ज तयार झाल्या. आता Deploy > Web app करा.');
}

/** जुन्या (Check-In/Check-Out पद्धतीच्या) Attendance शीटला सुरक्षित ठेवून
 *  नवीन सकाळ/दुपार-सत्र रचनेसह कोरी शीट तयार करणे. एकदाच वापरायचे. */
function archiveOldAttendanceAndStartFresh() {
  const ui = SpreadsheetApp.getUi();
  const old = SS.getSheetByName('Attendance');
  if (old) {
    const firstRow = old.getRange(1, 1, 1, Math.max(old.getLastColumn(), 1)).getValues()[0];
    const alreadyNew = firstRow[2] === 'MorningTime';
    if (alreadyNew) {
      ui.alert('"Attendance" शीट आधीच नवीन (सकाळ/दुपार) रचनेत आहे — काही करायची गरज नाही.');
      return;
    }
    const resp = ui.alert(
      'जुनी "Attendance" शीट "Attendance_Archive_<तारीख-वेळ>" या नावाने सुरक्षित ठेवली जाईल, ' +
      'आणि नवीन रचनेसह (सकाळ/दुपार सत्र) कोरी "Attendance" शीट तयार होईल. जुना डेटा उडणार नाही, ' +
      'पण नवीन हजेरी नव्या शीटमध्ये सुरुवातीपासून मोजली जाईल. पुढे जायचं आहे का?',
      ui.ButtonSet.YES_NO
    );
    if (resp !== ui.Button.YES) return;
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    old.setName('Attendance_Archive_' + stamp);
  }
  getOrCreateSheet_('Attendance',
    ['Date', 'MobileNumber', 'MorningTime', 'MorningPhotoURL', 'MorningGPS',
     'AfternoonTime', 'AfternoonPhotoURL', 'AfternoonGPS', 'Status', 'MorningNote', 'AfternoonNote']);
  ui.alert('✅ नवीन "Attendance" शीट तयार झाली — सकाळ/दुपार दोन सत्रांसह.');
}

/** टेस्टिंगसाठी एक नमुना ठिकाण व एक Developer नोंदवणे (ऐच्छिक) */
function insertSampleData() {
  setupProjectSheets(); // आधी शीट्स नसतील तर तयार करा

  const locSheet = SS.getSheetByName('WorkLocations');
  if (locSheet.getLastRow() < 2) {
    locSheet.appendRow(['LOC001', 'मीटर क्र. १२३ (नमुना)', 17.0432, 74.0018, 100, '', 'सिस्टम (नमुना)', new Date()]);
  }

  const usersSheet = SS.getSheetByName('Users');
  if (usersSheet.getLastRow() < 2) {
    const ui = SpreadsheetApp.getUi();
    const resp = ui.prompt('पहिला Developer मोबाईल नंबर टाका (उदा. 9800000000):');
    const mobile = resp.getResponseText().trim();
    if (mobile) {
      usersSheet.appendRow([mobile, 'मुख्य डेव्हलपर', 'developer', 'LOC001', 'Active', '', 'No', '']);
      ui.alert('Developer नोंदवला: ' + mobile + '. आता या नंबरने अॅपमध्ये लॉगिन करता येईल.');
    }
  }
}

function getPhotoFolder_() {
  const name = 'Hajeri_Photos';
  const f = DriveApp.getFoldersByName(name);
  return f.hasNext() ? f.next() : DriveApp.createFolder(name);
}
function getPdfFolder_() {
  const name = 'Hajeri_PDF_Reports';
  const f = DriveApp.getFoldersByName(name);
  return f.hasNext() ? f.next() : DriveApp.createFolder(name);
}
function getLeaveProofFolder_() {
  const name = 'Hajeri_LeaveProofs';
  const f = DriveApp.getFoldersByName(name);
  return f.hasNext() ? f.next() : DriveApp.createFolder(name);
}

/* वेब वरून येणारी request मध्ये Content-Type: text/plain असल्याने
   ती doPost मध्येच येते, वेगळा CORS preflight लागत नाही. */
function doPost(e) {
  let result;
  try {
    const req = JSON.parse(e.postData.contents);
    switch (req.action) {
      case 'login': result = loginUser(req.mobileNumber, req.deviceId); break;
      case 'lookupName': result = lookupUserName(req.mobileNumber); break;
      case 'resetDevice': result = resetDeviceRegistration(req); break;
      case 'enrollFace': result = enrollFace(req); break;
      case 'getFaceDescriptor': result = getFaceDescriptor(req.mobileNumber); break;
      case 'resetFaceEnrollment': result = resetFaceEnrollment(req); break;
      case 'markAttendance': result = markAttendance(req); break;
      case 'getTodayStatus': result = getTodayStatus(req.mobileNumber); break;
      case 'generateReport': result = generateAttendanceReport(req); break;
      case 'addStaff': result = addStaff(req); break;
      case 'removeStaff': result = removeStaff(req); break;
      case 'updateSettings': result = updateSettings(req); break;
      case 'getSettings': result = getAllSettings(); break;
      case 'addWorkLocation': result = addWorkLocation(req); break;
      case 'listLocations': result = listLocations(); break;
      case 'uploadLogo': result = uploadLogo(req); break;
      case 'addHoliday': result = addHoliday(req); break;
      case 'listHolidays': result = listHolidays(); break;
      case 'deleteHoliday': result = deleteHoliday(req); break;
      case 'applyLeave': result = applyLeave(req); break;
      case 'listMyLeaves': result = listMyLeaves(req.mobileNumber); break;
      case 'listAllLeaves': result = listAllLeaves(req); break;
      case 'updateLeaveDates': result = updateLeaveDates(req); break;
      default: result = { success: false, message: 'अनोळखी action' };
    }
  } catch (err) {
    result = { success: false, message: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------------------------------------------------
 * लॉगिन — मोबाईल नंबर + डिव्हाइस-लॉक तपासणी.
 * पहिल्यांदा ज्या डिव्हाइस/ब्राउझरवरून लॉगिन होते, तोच "अधिकृत डिव्हाइस"
 * म्हणून नोंदवला जातो (RegisteredDeviceID). पुढे त्याच नंबरने दुसऱ्या
 * डिव्हाइसवरून लॉगिनचा प्रयत्न झाल्यास तो नाकारला जातो.
 * --------------------------------------------------------- */
function loginUser(mobileNumber, deviceId) {
  const data = SHEET_USERS.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(mobileNumber) && data[i][4] === 'Active') {
      const faceDescRaw = data[i][5];
      const role = data[i][2];
      const registeredDevice = data[i][7];

      // डिव्हाइस-लॉक फक्त "user" (कामगार) रोलसाठीच लागू — Admin/Developer कुठूनही लॉगिन करू शकतात
      if (role === 'user') {
        if (!registeredDevice) {
          SHEET_USERS.getRange(i + 1, 8).setValue(deviceId || '');
        } else if (deviceId && String(registeredDevice) !== String(deviceId)) {
          return {
            success: false,
            message: 'हा मोबाईल नंबर आधीच दुसऱ्या डिव्हाइसवर नोंदणीकृत आहे. या डिव्हाइसवरून लॉगिन करता येणार नाही — Admin कडून डिव्हाइस-नोंदणी रीसेट करून घ्या.'
          };
        }
      }

      return {
        success: true,
        name: data[i][1],
        role: role,
        locationId: data[i][3],
        faceEnrolled: !!(faceDescRaw && String(faceDescRaw).length > 0)
      };
    }
  }
  return { success: false, message: 'हा मोबाईल नंबर नोंदणीकृत नाही किंवा निष्क्रिय आहे' };
}

/** मोबाईल नंबर टाकल्यावर लगेच नाव दाखवण्यासाठी — यात लॉगिन/डिव्हाइस तपासणी होत नाही */
function lookupUserName(mobileNumber) {
  const data = SHEET_USERS.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(mobileNumber) && data[i][4] === 'Active') {
      return { success: true, name: data[i][1] };
    }
  }
  return { success: false };
}

/** Admin/Developer वापरतो — कर्मचाऱ्याने नवीन मोबाईल/डिव्हाइस घेतल्यास जुनी डिव्हाइस-नोंदणी रद्द करणे */
function resetDeviceRegistration(req) {
  const auth = requireRole_(req.actorMobile, ['admin', 'developer']);
  if (!auth.ok) return { success: false, message: auth.message };

  const data = SHEET_USERS.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(req.mobileNumber)) {
      SHEET_USERS.getRange(i + 1, 8).setValue('');
      return { success: true, message: 'डिव्हाइस-नोंदणी रीसेट झाली — पुढच्या लॉगिनला जे डिव्हाइस वापरेल तेच नवीन अधिकृत डिव्हाइस म्हणून नोंदवले जाईल' };
    }
  }
  return { success: false, message: 'यूजर सापडला नाही' };
}

/** अधिकार तपासणी — फक्त ठराविक रोल्सनाच काही क्रिया करू देणे (उदा. स्पॉट असाइन फक्त Developer) */
function requireRole_(actorMobile, allowedRoles) {
  if (!actorMobile) return { ok: false, message: 'अधिकृतता तपासता आली नाही — पुन्हा लॉगिन करा' };
  const data = SHEET_USERS.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(actorMobile) && data[i][4] === 'Active') {
      if (allowedRoles.indexOf(data[i][2]) !== -1) return { ok: true };
      return { ok: false, message: 'या कृतीसाठी तुम्हाला परवानगी नाही' };
    }
  }
  return { ok: false, message: 'यूजर सापडला नाही' };
}

/* ---------------------------------------------------------
 * चेहरा एनरोलमेंट (एकदाच) — req.descriptors = अनेक कोनांतून घेतलेले
 * ५ descriptors ची यादी (प्रत्येकी १२८ अंकी अ‍ॅरे).
 * --------------------------------------------------------- */
function enrollFace(req) {
  if (String(req.mobileNumber) !== String(req.actorMobile)) {
    const auth = requireRole_(req.actorMobile, ['admin', 'developer']);
    if (!auth.ok) return { success: false, message: auth.message };
  }

  const data = SHEET_USERS.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(req.mobileNumber)) {
      SHEET_USERS.getRange(i + 1, 6).setValue(JSON.stringify(req.descriptors));
      SHEET_USERS.getRange(i + 1, 7).setValue('Yes');
      return { success: true, message: 'चेहरा यशस्वीरित्या नोंदवला (सर्व कोनांसह)' };
    }
  }
  return { success: false, message: 'यूजर सापडला नाही' };
}

function getFaceDescriptor(mobileNumber) {
  const data = SHEET_USERS.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(mobileNumber)) {
      const raw = data[i][5];
      if (!raw) return { success: false, message: 'चेहरा अद्याप नोंदवलेला नाही' };
      return { success: true, descriptors: JSON.parse(raw) };
    }
  }
  return { success: false, message: 'यूजर सापडला नाही' };
}

function resetFaceEnrollment(req) {
  const auth = requireRole_(req.actorMobile, ['admin', 'developer']);
  if (!auth.ok) return { success: false, message: auth.message };

  const data = SHEET_USERS.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(req.mobileNumber)) {
      SHEET_USERS.getRange(i + 1, 6).setValue('');
      SHEET_USERS.getRange(i + 1, 7).setValue('No');
      return { success: true, message: 'चेहरा-नोंदणी रीसेट झाली — पुढच्या लॉगिनला पुन्हा नोंदणी करावी लागेल' };
    }
  }
  return { success: false, message: 'यूजर सापडला नाही' };
}

/* ---------------------------------------------------------
 * स्पॉट असाइन — फक्त Developer करू शकतो (सर्व्हरवरही तपासले जाते).
 * --------------------------------------------------------- */
function addWorkLocation(req) {
  const auth = requireRole_(req.actorMobile, ['developer']);
  if (!auth.ok) return { success: false, message: auth.message };

  let photoUrl = '';
  if (req.photoBase64) {
    const folderName = 'Hajeri_LocationPhotos';
    const folders = DriveApp.getFoldersByName(folderName);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    const blob = Utilities.newBlob(Utilities.base64Decode(req.photoBase64), 'image/jpeg',
        'spot_' + new Date().getTime() + '.jpg');
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    photoUrl = file.getUrl();
  }

  const locationId = 'LOC' + new Date().getTime();
  SHEET_LOCATIONS.appendRow([locationId, req.name, req.lat, req.lon, req.radiusMeters, photoUrl, req.actorMobile || '', new Date()]);

  return { success: true, message: 'नवीन जागा नोंदवली: ' + req.name, locationId, photoUrl };
}

function listLocations() {
  const data = SHEET_LOCATIONS.getDataRange().getValues();
  const locations = [];
  for (let i = 1; i < data.length; i++) {
    locations.push({
      locationId: data[i][0],
      name: data[i][1],
      lat: data[i][2],
      lon: data[i][3],
      radiusMeters: data[i][4],
    });
  }
  return { success: true, locations };
}

function uploadLogo(req) {
  const auth = requireRole_(req.actorMobile, ['developer']);
  if (!auth.ok) return { success: false, message: auth.message };

  const folderName = 'Hajeri_Logo';
  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  const blob = Utilities.newBlob(Utilities.base64Decode(req.photoBase64), 'image/png', 'logo.png');
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const directUrl = 'https://lh3.googleusercontent.com/d/' + file.getId();

  updateSettings({ settings: { AppLogo: directUrl }, actorMobile: req.actorMobile });
  return { success: true, message: 'लोगो अपलोड झाला', logoUrl: directUrl };
}

function getAllSettings() {
  const data = SHEET_SETTINGS.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) settings[data[i][0]] = data[i][1];
  return { success: true, settings: settings };
}

function distanceMeters_(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ---------------------------------------------------------
 * सुट्टी / रजा ओळखण्यासाठी मदत-फंक्शन्स
 * --------------------------------------------------------- */
function normalizeDateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v);
}

/** दिलेली तारीख साप्ताहिक सुट्टीची (डीफॉल्ट: शनि-रवि) आहे का */
function isWeeklyOff_(dateObj) {
  const raw = getSetting_('WeeklyOffDays') || '0,6';
  const offDays = String(raw).split(',').map(s => Number(String(s).trim())).filter(n => !isNaN(n));
  return offDays.indexOf(dateObj.getDay()) !== -1;
}

/** दिलेली तारीख Holidays शीटमध्ये नोंदवलेली सुट्टी आहे का — असल्यास तिचं नाव मिळते */
function getHolidayName_(dateStr) {
  const data = SHEET_HOLIDAYS.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (normalizeDateStr_(data[i][0]) === dateStr) return data[i][1] || 'सार्वजनिक सुट्टी';
  }
  return null;
}

/** दिलेल्या मोबाईलची त्या तारखेला मंजूर (Active) रजा आहे का */
function getActiveLeaveForDate_(mobileNumber, dateStr) {
  const data = SHEET_LEAVES.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(mobileNumber) && data[i][6] === 'Active') {
      const from = normalizeDateStr_(data[i][2]);
      const to = normalizeDateStr_(data[i][3]);
      if (dateStr >= from && dateStr <= to) return true;
    }
  }
  return false;
}

/** दिलेल्या तारखेसाठी अंतिम हजेरी-स्थिती ठरवते — साप्ताहिक सुट्टी > सार्वजनिक
 *  सुट्टी > मंजूर रजा > प्रत्यक्ष हजेरी (Attendance row) > गैरहजर, या क्रमाने. */
function resolveDayStatus_(dateObj, dateStr, mobileNumber, attRow) {
  if (isWeeklyOff_(dateObj)) return { status: 'साप्ताहिक सुट्टी', category: 'holiday' };
  const holidayName = getHolidayName_(dateStr);
  if (holidayName) return { status: 'सुट्टी: ' + holidayName, category: 'holiday' };
  if (getActiveLeaveForDate_(mobileNumber, dateStr)) return { status: 'रजा', category: 'leave' };

  if (attRow) {
    const hasMorning = !!attRow[2];
    const hasAfternoon = !!attRow[5];
    if (hasMorning && hasAfternoon) return { status: 'पूर्ण हजेरी', category: 'present' };
    if (hasMorning) return { status: 'सकाळची अर्धी हजेरी', category: 'half' };
    if (hasAfternoon) return { status: 'दुपारची अर्धी हजेरी', category: 'half' };
  }
  return { status: 'गैरहजर', category: 'absent' };
}

/** दिलेली वेळ (Date ऑब्जेक्ट) "HH:mm" ते "HH:mm" या कक्षेत आहे का */
function isWithinWindow_(dateObj, startStr, endStr) {
  const toMinutes = s => { const p = String(s).split(':'); return Number(p[0]) * 60 + Number(p[1] || 0); };
  const nowMin = dateObj.getHours() * 60 + dateObj.getMinutes();
  return nowMin >= toMinutes(startStr) && nowMin <= toMinutes(endStr);
}

function getSetting_(key) {
  const data = SHEET_SETTINGS.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (data[i][0] === key) return data[i][1];
  return '';
}

/* ---------------------------------------------------------
 * आजच्या दिवसाची स्थिती (सुट्टी/रजा/काम) व दोन्ही सत्रांची स्थिती —
 * attendance.html पानावर बटणे कधी सक्रिय ठेवायची हे ठरवण्यासाठी.
 * --------------------------------------------------------- */
function getTodayStatus(mobileNumber) {
  const now = new Date();
  const todayStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  if (isWeeklyOff_(now)) {
    return { success: true, dayType: 'holiday', label: 'साप्ताहिक सुट्टी', morningDone: false, afternoonDone: false };
  }
  const holidayName = getHolidayName_(todayStr);
  if (holidayName) {
    return { success: true, dayType: 'holiday', label: holidayName, morningDone: false, afternoonDone: false };
  }
  if (getActiveLeaveForDate_(mobileNumber, todayStr)) {
    return { success: true, dayType: 'leave', label: 'आजची रजा मंजूर आहे', morningDone: false, afternoonDone: false };
  }

  const attData = SHEET_ATTENDANCE.getDataRange().getValues();
  let morningDone = false, afternoonDone = false;
  for (let i = 1; i < attData.length; i++) {
    if (normalizeDateStr_(attData[i][0]) === todayStr && String(attData[i][1]) === String(mobileNumber)) {
      morningDone = !!attData[i][2];
      afternoonDone = !!attData[i][5];
      break;
    }
  }

  return {
    success: true,
    dayType: 'working',
    morningDone, afternoonDone,
    morningWindow: [getSetting_('MorningStartTime') || '09:00', getSetting_('MorningEndTime') || '11:00'],
    afternoonWindow: [getSetting_('AfternoonStartTime') || '15:30', getSetting_('AfternoonEndTime') || '19:00'],
  };
}

/* ---------------------------------------------------------
 * हजेरी नोंदवणे (सकाळ/दुपार सत्रापैकी एक) — GPS जिओफेन्स तपासून, फोटो
 * Drive वर सेव्ह करून, त्या सत्राची ठरलेली वेळ आहे का हे तपासून.
 * (चेहरा-मॅचिंग client-side face-api.js ने आधीच केलेली असते.)
 * --------------------------------------------------------- */
function markAttendance(req) {
  const usersData = SHEET_USERS.getDataRange().getValues();
  let locationId = null;
  for (let i = 1; i < usersData.length; i++) {
    if (String(usersData[i][0]) === String(req.mobileNumber)) { locationId = usersData[i][3]; break; }
  }
  if (!locationId) return { success: false, message: 'यूजर सापडला नाही' };

  const now = new Date();
  const todayStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  if (isWeeklyOff_(now)) return { success: false, message: 'आज साप्ताहिक सुट्टी आहे — हजेरीची गरज नाही' };
  const holidayName = getHolidayName_(todayStr);
  if (holidayName) return { success: false, message: 'आज सुट्टी आहे (' + holidayName + ') — हजेरीची गरज नाही' };
  if (getActiveLeaveForDate_(req.mobileNumber, todayStr)) {
    return { success: false, message: 'आज तुमची मंजूर रजा आहे — हजेरीची गरज नाही (लवकर हजर झाला असल्यास Admin/Developer कडून रजेची तारीख बदलून घ्या)' };
  }

  const session = req.session === 'afternoon' ? 'afternoon' : 'morning';
  const isOutdoor = !!req.isOutdoor;
  if (isOutdoor && !String(req.outdoorReason || '').trim()) {
    return { success: false, message: 'कामानिमित्त बाहेर असल्यास कारण व सध्याचे ठिकाण लिहिणे आवश्यक आहे' };
  }

  const winStart = getSetting_(session === 'morning' ? 'MorningStartTime' : 'AfternoonStartTime')
    || (session === 'morning' ? '09:00' : '15:30');
  const winEnd = getSetting_(session === 'morning' ? 'MorningEndTime' : 'AfternoonEndTime')
    || (session === 'morning' ? '11:00' : '19:00');

  if (!isWithinWindow_(now, winStart, winEnd)) {
    return {
      success: false,
      message: (session === 'morning' ? 'सकाळच्या' : 'दुपारच्या') + ' हजेरीची वेळ ' + winStart + ' ते ' + winEnd +
        ' आहे — सध्या त्या वेळेत नाही'
    };
  }

  // GPS जिओफेन्स — कर्मचारी कामानिमित्त बाहेर असल्याचं सांगितलं असेल तरच ही तपासणी वगळली जाते
  if (!isOutdoor) {
    const locData = SHEET_LOCATIONS.getDataRange().getValues();
    let centerLat, centerLon, radius;
    for (let i = 1; i < locData.length; i++) {
      if (String(locData[i][0]) === String(locationId)) {
        centerLat = locData[i][2]; centerLon = locData[i][3]; radius = locData[i][4]; break;
      }
    }
    if (centerLat === undefined) return { success: false, message: 'नेमून दिलेले ठिकाण सापडले नाही' };
    const dist = distanceMeters_(req.lat, req.lon, centerLat, centerLon);
    if (dist > radius) {
      return {
        success: false,
        message: 'तुम्ही कामाच्या ठिकाणाच्या मर्यादेबाहेर आहात (अंतर: ' + Math.round(dist) + ' मी.) — ' +
          'कामानिमित्त बाहेर असल्यास "कामानिमित्त बाहेर आहे" पर्याय निवडून कारण नोंदवा'
      };
    }
  }

  const attData = SHEET_ATTENDANCE.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < attData.length; i++) {
    if (normalizeDateStr_(attData[i][0]) === todayStr && String(attData[i][1]) === String(req.mobileNumber)) { rowIndex = i + 1; break; }
  }

  const colTime = session === 'morning' ? 3 : 6;
  const colPhoto = session === 'morning' ? 4 : 7;
  const colGps = session === 'morning' ? 5 : 8;
  const colNote = session === 'morning' ? 10 : 11;
  const noteValue = isOutdoor ? ('कामानिमित्त बाहेर: ' + String(req.outdoorReason).trim()) : '';

  if (rowIndex > 0) {
    const existingVal = SHEET_ATTENDANCE.getRange(rowIndex, colTime).getValue();
    if (existingVal) {
      return { success: false, message: (session === 'morning' ? 'सकाळची' : 'दुपारची') + ' हजेरी आधीच नोंदवली आहे' };
    }
  }

  const folder = getPhotoFolder_();
  const fileName = req.mobileNumber + '_' + session + '_' + now.getTime() + '.jpg';
  const blob = Utilities.newBlob(Utilities.base64Decode(req.photoBase64), 'image/jpeg', fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const photoUrl = file.getUrl();

  const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');
  const gpsStr = req.lat + ',' + req.lon;

  if (rowIndex < 0) {
    const newRow = ['', '', '', '', '', '', '', '', '', '', ''];
    newRow[0] = todayStr;
    newRow[1] = req.mobileNumber;
    newRow[colTime - 1] = timeStr;
    newRow[colPhoto - 1] = photoUrl;
    newRow[colGps - 1] = gpsStr;
    newRow[colNote - 1] = noteValue;
    SHEET_ATTENDANCE.appendRow(newRow);
    rowIndex = SHEET_ATTENDANCE.getLastRow();
  } else {
    SHEET_ATTENDANCE.getRange(rowIndex, colTime).setValue(timeStr);
    SHEET_ATTENDANCE.getRange(rowIndex, colPhoto).setValue(photoUrl);
    SHEET_ATTENDANCE.getRange(rowIndex, colGps).setValue(gpsStr);
    SHEET_ATTENDANCE.getRange(rowIndex, colNote).setValue(noteValue);
  }

  const updatedRow = SHEET_ATTENDANCE.getRange(rowIndex, 1, 1, 9).getValues()[0];
  const hasMorning = !!updatedRow[2];
  const hasAfternoon = !!updatedRow[5];
  const finalStatus = hasMorning && hasAfternoon
    ? 'पूर्ण हजेरी'
    : (hasMorning ? 'सकाळची अर्धी हजेरी' : 'दुपारची अर्धी हजेरी');
  SHEET_ATTENDANCE.getRange(rowIndex, 9).setValue(finalStatus);

  return {
    success: true,
    message: (session === 'morning' ? 'सकाळची' : 'दुपारची') + ' हजेरी यशस्वी ✓ (सध्याची स्थिती: ' + finalStatus + ')' +
      (isOutdoor ? ' — कामानिमित्त बाह्य नोंद जतन झाली' : ''),
    status: finalStatus
  };
}

/* ---------------------------------------------------------
 * सुट्ट्यांची यादी (शासकीय/सार्वजनिक) — फक्त Developer जोडू/काढू शकतो,
 * यादी मात्र कोणालाही (सर्व पानांवरून) पाहता येते.
 * --------------------------------------------------------- */
function addHoliday(req) {
  const auth = requireRole_(req.actorMobile, ['developer']);
  if (!auth.ok) return { success: false, message: auth.message };
  if (!req.date || !req.name) return { success: false, message: 'तारीख व सुट्टीचे नाव दोन्ही आवश्यक' };
  SHEET_HOLIDAYS.appendRow([req.date, req.name, req.actorMobile, new Date()]);
  return { success: true, message: 'सुट्टी जोडली — ' + req.date + ' (' + req.name + ')' };
}

function listHolidays() {
  const data = SHEET_HOLIDAYS.getDataRange().getValues();
  const holidays = [];
  for (let i = 1; i < data.length; i++) {
    holidays.push({ rowIndex: i + 1, date: normalizeDateStr_(data[i][0]), name: data[i][1] });
  }
  holidays.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { success: true, holidays };
}

function deleteHoliday(req) {
  const auth = requireRole_(req.actorMobile, ['developer']);
  if (!auth.ok) return { success: false, message: auth.message };
  if (!req.rowIndex) return { success: false, message: 'सुट्टी सापडली नाही' };
  SHEET_HOLIDAYS.deleteRow(Number(req.rowIndex));
  return { success: true, message: 'सुट्टी काढली' };
}

/* ---------------------------------------------------------
 * रजा अर्ज — कामगार स्वतः कुठूनही (GPS/कामाच्या ठिकाणाची अट नाही) अर्ज
 * सादर करू शकतो. Admin/Developer यादी पाहू शकतात व तारखा बदलू शकतात
 * (कामगार लवकर हजर झाल्यास).
 * --------------------------------------------------------- */
function applyLeave(req) {
  if (!req.mobileNumber) return { success: false, message: 'मोबाईल नंबर आवश्यक' };
  if (!req.fromDate || !req.toDate) return { success: false, message: 'रजेच्या दोन्ही तारखा आवश्यक' };
  if (req.fromDate > req.toDate) return { success: false, message: 'From तारीख To तारखेनंतरची असू शकत नाही' };

  const usersData = SHEET_USERS.getDataRange().getValues();
  let name = '', found = false;
  for (let i = 1; i < usersData.length; i++) {
    if (String(usersData[i][0]) === String(req.mobileNumber)) { name = usersData[i][1]; found = true; break; }
  }
  if (!found) return { success: false, message: 'यूजर सापडला नाही — आधी लॉगिन करा' };

  let proofUrl = '';
  if (req.proofBase64) {
    const folder = getLeaveProofFolder_();
    const isPdf = req.proofMime === 'application/pdf';
    const blob = Utilities.newBlob(
      Utilities.base64Decode(req.proofBase64),
      req.proofMime || 'image/jpeg',
      'leave_' + req.mobileNumber + '_' + new Date().getTime() + (isPdf ? '.pdf' : '.jpg')
    );
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    proofUrl = file.getUrl();
  } else {
    return { success: false, message: 'रजेच्या अर्जाचा फोटो/PDF पुरावा आवश्यक आहे' };
  }

  SHEET_LEAVES.appendRow([req.mobileNumber, name, req.fromDate, req.toDate, proofUrl, new Date(), 'Active', '', '']);
  return { success: true, message: 'रजेचा अर्ज नोंदवला ✓ (' + req.fromDate + ' ते ' + req.toDate + ') — या काळात हजेरीची गरज राहणार नाही' };
}

function listMyLeaves(mobileNumber) {
  const data = SHEET_LEAVES.getDataRange().getValues();
  const leaves = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(mobileNumber)) {
      leaves.push({
        fromDate: normalizeDateStr_(data[i][2]),
        toDate: normalizeDateStr_(data[i][3]),
        status: data[i][6],
        proofUrl: data[i][4],
      });
    }
  }
  leaves.sort((a, b) => (a.fromDate < b.fromDate ? 1 : -1));
  return { success: true, leaves };
}

function listAllLeaves(req) {
  const auth = requireRole_(req.actorMobile, ['admin', 'developer']);
  if (!auth.ok) return { success: false, message: auth.message };
  const data = SHEET_LEAVES.getDataRange().getValues();
  const leaves = [];
  for (let i = 1; i < data.length; i++) {
    leaves.push({
      rowIndex: i + 1,
      mobile: data[i][0],
      name: data[i][1],
      fromDate: normalizeDateStr_(data[i][2]),
      toDate: normalizeDateStr_(data[i][3]),
      proofUrl: data[i][4],
      status: data[i][6],
    });
  }
  leaves.sort((a, b) => (a.fromDate < b.fromDate ? 1 : -1));
  return { success: true, leaves };
}

/** कामगार रजेच्या तारखेआधी कामावर हजर झाल्यास Admin/Developer इथून
 *  रजेच्या तारखा (उदा. शेवटची तारीख कमी करून) बदलू शकतात. */
function updateLeaveDates(req) {
  const auth = requireRole_(req.actorMobile, ['admin', 'developer']);
  if (!auth.ok) return { success: false, message: auth.message };
  if (!req.rowIndex) return { success: false, message: 'रजा सापडली नाही' };
  if (!req.fromDate || !req.toDate || req.fromDate > req.toDate) {
    return { success: false, message: 'कृपया योग्य From-To तारखा द्या' };
  }
  SHEET_LEAVES.getRange(Number(req.rowIndex), 3).setValue(req.fromDate);
  SHEET_LEAVES.getRange(Number(req.rowIndex), 4).setValue(req.toDate);
  SHEET_LEAVES.getRange(Number(req.rowIndex), 8).setValue(req.actorMobile);
  SHEET_LEAVES.getRange(Number(req.rowIndex), 9).setValue(new Date());
  return { success: true, message: 'रजेच्या तारखा अद्ययावत झाल्या' };
}

/* ---------------------------------------------------------
 * स्टाफ जोडणे / काढणे — फक्त Admin किंवा Developer करू शकतात
 * --------------------------------------------------------- */
function addStaff(req) {
  const auth = requireRole_(req.actorMobile, ['admin', 'developer']);
  if (!auth.ok) return { success: false, message: auth.message };

  const actorRole = getUserRole_(req.actorMobile);
  const requestedRole = req.role || 'user';
  if (actorRole === 'admin' && requestedRole !== 'user') {
    return { success: false, message: 'Admin फक्त "User (कामगार)" रोलचा स्टाफ जोडू शकतो' };
  }

  SHEET_USERS.appendRow([req.mobileNumber, req.name, requestedRole, req.locationId, 'Active', '', 'No', '']);
  return { success: true, message: 'स्टाफ यशस्वीरित्या जोडला — आता तो लॉगिन करून चेहरा नोंदवू शकतो' };
}
function getUserRole_(mobileNumber) {
  const data = SHEET_USERS.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(mobileNumber)) return data[i][2];
  }
  return null;
}
function removeStaff(req) {
  const auth = requireRole_(req.actorMobile, ['admin', 'developer']);
  if (!auth.ok) return { success: false, message: auth.message };

  const data = SHEET_USERS.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(req.mobileNumber)) {
      SHEET_USERS.getRange(i + 1, 5).setValue('Removed');
      return { success: true, message: 'स्टाफ काढला' };
    }
  }
  return { success: false, message: 'स्टाफ सापडला नाही' };
}

/* ---------------------------------------------------------
 * Developer सेटिंग्ज — फक्त Developer बदलू शकतो
 * --------------------------------------------------------- */
function updateSettings(req) {
  const auth = requireRole_(req.actorMobile, ['developer']);
  if (!auth.ok) return { success: false, message: auth.message };

  const data = SHEET_SETTINGS.getDataRange().getValues();
  for (let key in req.settings) {
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) { SHEET_SETTINGS.getRange(i + 1, 2).setValue(req.settings[key]); found = true; break; }
    }
    if (!found) SHEET_SETTINGS.appendRow([key, req.settings[key]]);
  }
  return { success: true, message: 'सेटिंग्स अपडेट झाल्या' };
}

/* ---------------------------------------------------------
 * हजेरी पत्रक PDF जनरेट करणे — सुट्टी/रजा/सकाळ-दुपार हजेरी सर्व दाखवते
 * --------------------------------------------------------- */
function generateAttendanceReport(req) {
  const auth = requireRole_(req.actorMobile, ['admin', 'developer']);
  if (!auth.ok) return { success: false, message: auth.message };

  const usersData = SHEET_USERS.getDataRange().getValues();
  const attData = SHEET_ATTENDANCE.getDataRange().getValues();

  const appName = getSetting_('AppName') || 'संस्थेचे नाव';
  const orgAddress = getSetting_('OrgAddress') || '';
  const officerName = getSetting_('GramPanchayatOfficerName') || '';
  const sarpanchName = getSetting_('SarpanchName') || '';

  let targetUsers = [];
  if (req.mobileNumber === 'all') {
    for (let i = 1; i < usersData.length; i++) if (usersData[i][2] === 'user') targetUsers.push({ mobile: usersData[i][0], name: usersData[i][1] });
  } else {
    for (let i = 1; i < usersData.length; i++) {
      if (String(usersData[i][0]) === String(req.mobileNumber)) { targetUsers.push({ mobile: usersData[i][0], name: usersData[i][1] }); break; }
    }
  }

  let fullHtml = '';
  targetUsers.forEach(u => {
    fullHtml += buildEmployeeReportHtml_(u, attData, req.fromDate, req.toDate, appName, orgAddress, officerName, sarpanchName);
    fullHtml += '<div style="page-break-after: always;"></div>';
  });

  const blob = Utilities.newBlob(fullHtml, 'text/html', 'report.html').getAs('application/pdf');
  const pdfName = 'Hajeri_Patrak_' + req.fromDate + '_to_' + req.toDate + '_' + (req.mobileNumber === 'all' ? 'सर्व' : req.mobileNumber) + '.pdf';
  blob.setName(pdfName);

  const pdfFolder = getPdfFolder_();
  const pdfFile = pdfFolder.createFile(blob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success: true,
    pdfUrl: pdfFile.getUrl(),
    pdfBase64: Utilities.base64Encode(blob.getBytes()),
    pdfFileName: pdfName,
    message: 'PDF तयार झाली'
  };
}

function buildEmployeeReportHtml_(user, attData, fromDate, toDate, appName, orgAddress, officerName, sarpanchName) {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM-yyyy');
  const from = new Date(fromDate);
  const to = new Date(toDate);

  let rows = '';
  let presentDays = 0, absentDays = 0, holidayDays = 0, leaveDays = 0;
  const weekDays = ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];

  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const dCopy = new Date(d);
    const dStr = Utilities.formatDate(dCopy, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const dDisplay = Utilities.formatDate(dCopy, Session.getScriptTimeZone(), 'dd-MM-yyyy');
    const dayName = weekDays[dCopy.getDay()];

    let attRow = null;
    for (let i = 1; i < attData.length; i++) {
      if (normalizeDateStr_(attData[i][0]) === dStr && String(attData[i][1]) === String(user.mobile)) { attRow = attData[i]; break; }
    }

    const resolved = resolveDayStatus_(dCopy, dStr, user.mobile, attRow);
    const status = resolved.status;

    let timeInfo = '-';
    if (attRow && (attRow[2] || attRow[5])) {
      const mNote = attRow[9] ? ' (' + attRow[9] + ')' : '';
      const aNote = attRow[10] ? ' (' + attRow[10] + ')' : '';
      timeInfo = 'सकाळ: ' + (attRow[2] || '-') + mNote + '  |  दुपार: ' + (attRow[5] || '-') + aNote;
    }

    if (resolved.category === 'present') presentDays += 1;
    else if (resolved.category === 'half') presentDays += 0.5;
    else if (resolved.category === 'absent') absentDays += 1;
    else if (resolved.category === 'holiday') holidayDays += 1;
    else if (resolved.category === 'leave') leaveDays += 1;

    const rowStyle = resolved.category === 'holiday' ? ' style="background:#f6e3e5;"'
      : (resolved.category === 'leave' ? ' style="background:#faecd2;"' : '');

    rows += '<tr' + rowStyle + '><td>' + dDisplay + '</td><td>' + dayName + '</td><td>' + timeInfo + '</td><td>' + status + '</td></tr>';
  }

  return `
  <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
    <div style="color: red; font-weight: bold; font-size: 18px;">${appName}</div>
    <div style="color: blue; font-weight: bold; font-size: 12px;">${orgAddress}</div>
    <div style="color: red; font-weight: bold; font-size: 14px;">हजेरी पत्रक</div>
    <div style="color: #111; font-weight: bold; font-size: 12px;">${user.name}</div>
    <div style="color: #111; font-weight: bold; font-size: 10px;">
      कालावधी: ${Utilities.formatDate(from, Session.getScriptTimeZone(), 'dd-MM-yyyy')}
      ते ${Utilities.formatDate(to, Session.getScriptTimeZone(), 'dd-MM-yyyy')}
    </div>
    <hr style="border: 2px solid darkred; margin: 10px 0;">
    <div style="font-size: 10px; margin-bottom: 10px;">प्रिंट तारीख: ${today}</div>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px;" border="1">
      <thead><tr style="background:#eee;"><th>तारीख</th><th>वार</th><th>वेळ (सकाळ/दुपार)</th><th>हजेरी स्थिती</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top: 15px; font-weight: bold; font-size: 11px;">
      एकूण हजर दिवस: ${presentDays} &nbsp;&nbsp; गैरहजर: ${absentDays} &nbsp;&nbsp;
      सुट्टीचे दिवस: ${holidayDays} &nbsp;&nbsp; रजेचे दिवस: ${leaveDays}
    </div>
    <div style="display: flex; justify-content: space-between; margin-top: 60px; font-size: 12px;">
      <div>________________________<br>ग्रामपंचायत अधिकारी<br>${officerName}</div>
      <div>________________________<br>सरपंच<br>${sarpanchName}</div>
    </div>
  </div>`;
}
