// ==========================================================
// face-utils.js — face-api.js द्वारे चेहरा एनरोलमेंट व मॅचिंग
// ==========================================================

let modelsLoaded = false;

async function loadFaceModels() {
  if (modelsLoaded) return;
  await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL);
  modelsLoaded = true;
}

// चेहरा शोधण्यासाठी: छोटा inputSize म्हणजे जलद गणित (जवळून घेतलेल्या सेल्फी-कॅमेरा
// फोटोंसाठी अचूकतेत फरक पडत नाही), आणि किंचित कमी scoreThreshold म्हणजे थोडा
// प्रकाश कमी/कोन वेगळा असला तरी चेहरा लवकर सापडतो.

/** व्हिडिओ एलिमेंटमधून सध्या चेहरा दिसतो आहे का व त्याचा descriptor मिळवते */
async function detectFaceDescriptor(videoEl) {
  // व्हिडिओला अजून प्रत्यक्ष फ्रेम्स मिळालेल्या नसतील (videoWidth/Height = 0)
  // तर face-api ला रिकामी फ्रेम मिळते आणि तो कायम "चेहरा सापडला नाही" असंच
  // सांगत राहतो — त्यामुळे आधी व्हिडिओ खरंच तयार आहे का ते तपासा.
  if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth || !videoEl.videoHeight) {
    return null;
  }
  try {
    const detection = await faceapi
      .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    return detection ? detection.descriptor : null; // Float32Array (128 अंकी)
  } catch (e) {
    // एखाद्या फ्रेमवर चुकून त्रुटी आली तरी संपूर्ण लूप थांबू नये
    console.warn("चेहरा ओळख त्रुटी:", e.message);
    return null;
  }
}

/** दोन descriptors ची तुलना — खरा चेहरा तोच व्यक्तीचा आहे का */
function isSameFace(descriptor1, descriptor2Array) {
  const descriptor2 = new Float32Array(descriptor2Array);
  const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
  return { match: distance <= FACE_MATCH_THRESHOLD, distance };
}

/**
 * एनरोलमेंटच्या वेळी वेगवेगळ्या कोनातून (समोर/डावे/उजवे/वर/खाली) साठवलेल्या
 * अनेक descriptors पैकी सध्याचा चेहरा कोणत्याही एकाशी जुळतो का हे तपासते.
 * यामुळे दाढी वाढणे, चष्मा घालणे, किंवा कॅमेऱ्यासमोरचा कोन थोडा वेगळा
 * असणे — यामुळे खरा कर्मचारीच नाकारला जाण्याची शक्यता कमी होते.
 */
function isSameFaceMulti(liveDescriptor, enrolledDescriptorsArray) {
  let bestDistance = Infinity;
  for (const enrolled of enrolledDescriptorsArray) {
    const d = faceapi.euclideanDistance(liveDescriptor, new Float32Array(enrolled));
    if (d < bestDistance) bestDistance = d;
  }
  return { match: bestDistance <= FACE_MATCH_THRESHOLD, distance: bestDistance };
}

/** कॅमेरा सुरू करणे — केवळ फ्रंट कॅमेरा, फाईल अपलोड/गॅलरी नाही */
async function startCamera(videoEl, facingMode) {
  if (!window.isSecureContext) {
    throw new Error("कॅमेरा फक्त सुरक्षित (https://) पत्त्यावरच काम करतो. कृपया https:// ने सुरू होणारी लिंक वापरा.");
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("या ब्राउझरमध्ये कॅमेरा सुविधा उपलब्ध नाही — कृपया Chrome/Safari चा नवीनतम आवृत्ती वापरा");
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode || "user" },
      audio: false,
    });
    videoEl.srcObject = stream;

    // व्हिडिओला खरोखर फ्रेम्स मिळेपर्यंत थांबा (काही ब्राउझर्स/मोबाईलवर
    // "autoplay" attribute असूनही आपोआप सुरू होत नाही — त्यामुळे स्पष्टपणे
    // play() कॉल करणे आवश्यक आहे). हे न केल्यास चेहरा-ओळख कायम रिकाम्या
    // (0x0) फ्रेमवर चालते व "हा कोन कॅप्चर करा" बटण कधीच सक्रिय होत नाही.
    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      videoEl.onloadedmetadata = () => {
        const playPromise = videoEl.play();
        if (playPromise && playPromise.then) playPromise.then(done).catch(done);
        else done();
      };
      // सुरक्षिततेसाठी — काही डिव्हाइसवर loadedmetadata उशिरा/कधी येत नाही,
      // तरीही अॅप अडकून राहू नये
      setTimeout(done, 3000);
    });

    return stream;
  } catch (err) {
    let msg;
    switch (err.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        msg = "कॅमेरा परवानगी नाकारली गेली आहे. ब्राउझरच्या ॲड्रेस बारमधील 🔒/ⓘ चिन्हावर टॅप करून 'Camera' परवानगी 'Allow' करा, मग पान रिफ्रेश करा.";
        break;
      case "NotFoundError":
      case "DevicesNotFoundError":
        msg = "या डिव्हाइसवर कॅमेरा सापडला नाही.";
        break;
      case "NotReadableError":
      case "TrackStartError":
        msg = "कॅमेरा दुसऱ्या अॅपमध्ये आधीच वापरात आहे. ते अॅप बंद करून पुन्हा प्रयत्न करा.";
        break;
      default:
        msg = "कॅमेरा सुरू करता आला नाही: " + err.message;
    }
    throw new Error(msg);
  }
}

function stopCamera(stream) {
  if (stream) stream.getTracks().forEach((t) => t.stop());
}

/** व्हिडिओ फ्रेमचा फोटो Base64 स्वरूपात कॅप्चर करणे */
function captureFrameAsBase64(videoEl) {
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  canvas.getContext("2d").drawImage(videoEl, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.8).split(",")[1]; // फक्त base64 भाग
}
