// ==========================================================
// geo.js — GPS लोकेशन व जिओफेन्स गणित (बॅकएंडशी सुसंगत Haversine)
// ==========================================================

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new Error("GPS फक्त सुरक्षित (https://) पत्त्यावरच काम करते. कृपया https:// ने सुरू होणारी लिंक वापरा."));
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error("या ब्राउझरमध्ये GPS सुविधा उपलब्ध नाही — कृपया Chrome/Safari चा नवीनतम आवृत्ती वापरा"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => {
        let msg;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg = "GPS परवानगी नाकारली गेली आहे. ब्राउझरच्या ॲड्रेस बारमधील 🔒/ⓘ चिन्हावर टॅप करून 'Location' परवानगी 'Allow' करा, मग पुन्हा प्रयत्न करा.";
            break;
          case err.POSITION_UNAVAILABLE:
            msg = "GPS सिग्नल मिळत नाही. मोकळ्या जागेत/खिडकीजवळ जाऊन पुन्हा प्रयत्न करा, आणि मोबाईलचे Location (GPS) सुरू आहे याची खात्री करा.";
            break;
          case err.TIMEOUT:
            msg = "GPS शोधण्यास जास्त वेळ लागला. पुन्हा प्रयत्न करा.";
            break;
          default:
            msg = "GPS मिळवता आले नाही: " + err.message;
        }
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

/** getCurrentPosition प्रमाणेच, पण एकदाच न थांबता सतत (डिव्हाइस हलेल तसं)
 *  GPS अपडेट्स देत राहते — हजेरीच्या वेळी कर्मचारी व नेमून दिलेलं ठिकाण
 *  यामधलं अंतर लाईव्ह दाखवण्यासाठी व तो त्या ठिकाणात आत/बाहेर गेला की
 *  लगेच कळावं यासाठी उपयुक्त. परत मिळणारा watchId stopWatchingPosition()
 *  ला द्यावा लागतो (पान बंद होताना/कॅमेरा थांबवताना GPS ट्रॅकिंगही थांबवणे
 *  चांगली सवय — बॅटरी वाचते). */
function watchPosition(onUpdate, onError) {
  if (!window.isSecureContext) {
    onError(new Error("GPS फक्त सुरक्षित (https://) पत्त्यावरच काम करते. कृपया https:// ने सुरू होणारी लिंक वापरा."));
    return null;
  }
  if (!navigator.geolocation) {
    onError(new Error("या ब्राउझरमध्ये GPS सुविधा उपलब्ध नाही — कृपया Chrome/Safari चा नवीनतम आवृत्ती वापरा"));
    return null;
  }
  return navigator.geolocation.watchPosition(
    (pos) => onUpdate(pos.coords),
    (err) => {
      let msg;
      switch (err.code) {
        case err.PERMISSION_DENIED:
          msg = "GPS परवानगी नाकारली गेली आहे. ब्राउझरच्या ॲड्रेस बारमधील 🔒/ⓘ चिन्हावर टॅप करून 'Location' परवानगी 'Allow' करा, मग पुन्हा प्रयत्न करा.";
          break;
        case err.POSITION_UNAVAILABLE:
          msg = "GPS सिग्नल मिळत नाही. मोकळ्या जागेत/खिडकीजवळ जाऊन पुन्हा प्रयत्न करा, आणि मोबाईलचे Location (GPS) सुरू आहे याची खात्री करा.";
          break;
        case err.TIMEOUT:
          msg = "GPS शोधण्यास जास्त वेळ लागला. पुन्हा प्रयत्न करा.";
          break;
        default:
          msg = "GPS मिळवता आले नाही: " + err.message;
      }
      onError(new Error(msg));
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  );
}

function stopWatchingPosition(watchId) {
  if (watchId !== null && watchId !== undefined && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
