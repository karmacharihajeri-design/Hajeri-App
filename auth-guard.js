// ==========================================================
// auth-guard.js — प्रत्येक संरक्षित पानावर (login सोडून) समाविष्ट करा.
// लॉगआउट/एक्झिट नंतर ब्राउझरच्या Back बटणाने परत आतल्या स्क्रीनवर
// जाता येऊ नये यासाठी सेशन-तपासणी करते.
// ==========================================================

function checkSessionOrRedirect() {
  if (!localStorage.getItem("mobileNumber")) {
    window.location.replace("index.html");
  }
}

// पान पहिल्यांदा लोड होताना तपासा
checkSessionOrRedirect();

// ब्राउझरच्या Back/Forward बटणाने पान बॅक-फॉरवर्ड कॅशेमधून (bfcache)
// परत दाखवलं गेलं तरी सेशन पुन्हा तपासा
window.addEventListener("pageshow", (event) => {
  checkSessionOrRedirect();
});

/** लॉगआउट — सेशन साफ करून लॉगिन स्क्रीनवर पाठवते, history मध्ये नोंद ठेवत नाही
 *  (त्यामुळे Back दाबल्यास परत आतल्या पानावर जाता येत नाही) */
function doLogout() {
  localStorage.removeItem("mobileNumber");
  localStorage.removeItem("role");
  localStorage.removeItem("name");
  localStorage.removeItem("locationId");
  localStorage.removeItem("faceEnrolled");
  window.location.replace("index.html");
}

/** एक्झिट — लॉगआउट सारखंच सेशन साफ करते, आणि शक्य असल्यास ब्राउझर
 *  टॅब/विंडो बंद करण्याचा प्रयत्न करते (स्क्रिप्टने उघडलेली विंडो
 *  नसेल तर ब्राउझर सुरक्षिततेमुळे बंद होणार नाही — तसं झाल्यास
 *  लॉगिन स्क्रीनवरच थांबेल, जे योग्य वर्तन आहे). */
function doExit() {
  localStorage.removeItem("mobileNumber");
  localStorage.removeItem("role");
  localStorage.removeItem("name");
  localStorage.removeItem("locationId");
  localStorage.removeItem("faceEnrolled");
  window.location.replace("index.html");
  setTimeout(() => { window.close(); }, 300);
}

/** ============================================================
 *  Standby (निष्क्रियता) टायमर — Developer ने Admin पॅनलमधून ठरवलेल्या
 *  मिनिटांपर्यंत काहीच स्पर्श/क्लिक/स्क्रोल न झाल्यास सुरक्षिततेसाठी
 *  आपोआप लॉगआउट करते (शेअर्ड/सार्वजनिक डिव्हाइसवर लॉगिन तसाच राहू नये
 *  म्हणून). Settings मध्ये StandbyMinutes = 0 असेल तर ही सुविधा बंद असते.
 * ============================================================ */
(function setupStandbyTimer_() {
  let idleTimer = null;
  let standbyMs = 0;

  function resetIdleTimer_() {
    if (!standbyMs) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      alert("बऱ्याच वेळ काहीच हालचाल न झाल्याने सुरक्षिततेसाठी आपोआप लॉगआउट करत आहोत.");
      doLogout();
    }, standbyMs);
  }

  async function initStandby_() {
    try {
      if (typeof Api === "undefined" || !localStorage.getItem("mobileNumber")) return;
      const res = await Api.getSettings();
      const minutes = Number(res.settings && res.settings.StandbyMinutes) || 0;
      if (!minutes) return; // 0 = बंद
      standbyMs = minutes * 60 * 1000;
      ["click", "touchstart", "keydown", "mousemove", "scroll"].forEach(evt =>
        document.addEventListener(evt, resetIdleTimer_, { passive: true })
      );
      resetIdleTimer_();
    } catch (e) {
      // सेटिंग्ज न मिळाल्यास standby बंदच राहील — अॅप वापरण्यास अडथळा येत नाही
    }
  }

  document.addEventListener("DOMContentLoaded", initStandby_);
})();
