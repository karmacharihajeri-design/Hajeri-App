// ==========================================================
// config.js — सर्व महत्त्वाच्या सेटिंग्ज इथे एकाच ठिकाणी
// ==========================================================

// तुमच्या Google Apps Script Web App ची URL (Deploy > Web app केल्यावर मिळते)
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbyAKzbnp2y_meViMr51s09hMdCxsCZqBr4FPZoXhEfWIZwzJ2Cmfq5W7w-P3-Ty3OWkOw/exec";

// face-api.js साठी मॉडेल फाईल्सचा पत्ता.
// पर्याय १ (सोपे): खालील सार्वजनिक CDN वापरा (इंटरनेट कनेक्शन लागेल)
const FACE_MODEL_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";

// पर्याय २ (जास्त विश्वासार्ह): हे मॉडेल फोल्डर स्वतःच्या GitHub repo मध्ये
// "models/" फोल्डरमध्ये ठेवा आणि इथे "./models" असे बदला.
// मॉडेल फाईल्स इथून डाउनलोड करता येतील:
// https://github.com/justadudewhohacks/face-api.js/tree/master/weights

// चेहरा जुळण्यासाठी अनुज्ञेय कमाल अंतर (कमी = जास्त कडक तपासणी)
const FACE_MATCH_THRESHOLD = 0.55;

// हजेरी पूर्ण होण्यासाठी आवश्यक किमान तासांतर
const MIN_GAP_HOURS = 5;
