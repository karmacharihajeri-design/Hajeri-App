// ==========================================================
// api.js — Google Apps Script बॅकएंडशी संपर्क
// ==========================================================

async function callBackend(payload) {
  const response = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    // टीप: Apps Script Web App ला साधा टेक्स्ट/JSON बॉडी म्हणून पाठवणे
    // सर्वात कमी CORS त्रास देते.
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  return JSON.parse(text);
}

// सध्या लॉगिन असलेल्या यूजरचा मोबाईल नंबर — अधिकार तपासणीसाठी बॅकएंडला पाठवला जातो
function currentActorMobile() {
  return localStorage.getItem("mobileNumber") || "";
}

const Api = {
  login: (mobileNumber, deviceId) =>
    callBackend({ action: "login", mobileNumber, deviceId }),

  lookupName: (mobileNumber) => callBackend({ action: "lookupName", mobileNumber }),

  resetDevice: (mobileNumber) =>
    callBackend({ action: "resetDevice", mobileNumber, actorMobile: currentActorMobile() }),

  enrollFace: (mobileNumber, descriptors) =>
    callBackend({ action: "enrollFace", mobileNumber, descriptors, actorMobile: currentActorMobile() }),

  getFaceDescriptor: (mobileNumber) =>
    callBackend({ action: "getFaceDescriptor", mobileNumber }),

  resetFaceEnrollment: (mobileNumber) =>
    callBackend({ action: "resetFaceEnrollment", mobileNumber, actorMobile: currentActorMobile() }),

  getSettings: () => callBackend({ action: "getSettings" }),

  addWorkLocation: ({ name, lat, lon, radiusMeters, photoBase64 }) =>
    callBackend({
      action: "addWorkLocation", name, lat, lon, radiusMeters, photoBase64,
      actorMobile: currentActorMobile(),
    }),

  listLocations: () => callBackend({ action: "listLocations" }),

  uploadLogo: (photoBase64) =>
    callBackend({ action: "uploadLogo", photoBase64, actorMobile: currentActorMobile() }),

  markAttendance: ({ mobileNumber, lat, lon, photoBase64, session }) =>
    callBackend({ action: "markAttendance", mobileNumber, lat, lon, photoBase64, session }),

  getTodayStatus: (mobileNumber) => callBackend({ action: "getTodayStatus", mobileNumber }),

  applyLeave: ({ mobileNumber, fromDate, toDate, proofBase64, proofMime }) =>
    callBackend({
      action: "applyLeave", mobileNumber, fromDate, toDate, proofBase64, proofMime,
      actorMobile: currentActorMobile(),
    }),

  listMyLeaves: (mobileNumber) => callBackend({ action: "listMyLeaves", mobileNumber }),

  listAllLeaves: () => callBackend({ action: "listAllLeaves", actorMobile: currentActorMobile() }),

  updateLeaveDates: ({ rowIndex, fromDate, toDate }) =>
    callBackend({
      action: "updateLeaveDates", rowIndex, fromDate, toDate,
      actorMobile: currentActorMobile(),
    }),

  listHolidays: () => callBackend({ action: "listHolidays" }),

  addHoliday: ({ date, name }) =>
    callBackend({ action: "addHoliday", date, name, actorMobile: currentActorMobile() }),

  deleteHoliday: (rowIndex) =>
    callBackend({ action: "deleteHoliday", rowIndex, actorMobile: currentActorMobile() }),

  addStaff: ({ mobileNumber, name, role, locationId }) =>
    callBackend({
      action: "addStaff", mobileNumber, name, role, locationId,
      actorMobile: currentActorMobile(),
    }),

  removeStaff: (mobileNumber) =>
    callBackend({ action: "removeStaff", mobileNumber, actorMobile: currentActorMobile() }),

  updateSettings: (settings) =>
    callBackend({ action: "updateSettings", settings, actorMobile: currentActorMobile() }),

  generateReport: ({ mobileNumber, fromDate, toDate }) =>
    callBackend({
      action: "generateReport", mobileNumber, fromDate, toDate,
      actorMobile: currentActorMobile(),
    }),
};
