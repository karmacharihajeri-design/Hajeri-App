// ==========================================================
// settings-sync.js — प्रत्येक पान उघडताच डेव्हलपरचे सेव्ह केलेले
// सेटिंग्ज (अॅपचे नाव, पत्ता) आपोआप Google Sheet मधून आणून दाखवते.
// कुठल्याही मोबाईल/डिव्हाईसवर वेगळे मॅन्युअल सेटअप लागत नाही —
// फक्त इंटरनेट व नोंदणीकृत मोबाईल नंबर पुरेसा आहे.
// ==========================================================

async function syncAppSettings() {
  try {
    const res = await Api.getSettings();
    if (!res.success) return;
    const s = res.settings;

    // पेजचे शीर्षक व टॉपबार मधील नाव अपडेट करा (id="appNameLbl" असलेल्या ठिकाणी)
    if (s.AppName) {
      document.title = s.AppName;
      document.querySelectorAll('[data-app-name]').forEach(el => (el.textContent = s.AppName));
    }
    if (s.OrgAddress) {
      document.querySelectorAll('[data-org-address]').forEach(el => (el.textContent = s.OrgAddress));
    }

    // लोगो असल्यास डिफॉल्ट "GP" सील ऐवजी तो दाखवा
    if (s.AppLogo) {
      document.querySelectorAll('.logo-img').forEach(img => {
        img.src = s.AppLogo;
        img.style.display = 'block';
      });
      document.querySelectorAll('.seal').forEach(el => (el.style.display = 'none'));
    }
    // इतर पेजना लागणारे सेटिंग्ज (उदा. MinGapHours) हवे असल्यास इथून वापरता येईल
    window.__appSettings = s;
  } catch (e) {
    // सेटिंग्ज न मिळाल्यास पानावरचे डिफॉल्ट मजकूर तसेच राहतील — अॅप वापरण्यास अडथळा येत नाही
    console.warn("सेटिंग्ज सिंक करता आले नाही:", e.message);
  }
}

document.addEventListener("DOMContentLoaded", syncAppSettings);
