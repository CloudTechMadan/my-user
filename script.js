const domain = 'https://face-attendance-admin-auth.auth.us-east-1.amazoncognito.com';
const clientId = '8me27q0v6uiackv03hbqoa1p3';
const redirectUri = window.location.origin + window.location.pathname;
const scope = 'openid profile email employee-api/employee-access';
const responseType = 'token id_token';

const attendanceApi = 'https://jprbceq0dk.execute-api.us-east-1.amazonaws.com/markAttendance';
const presignUrlApi = 'https://jprbceq0dk.execute-api.us-east-1.amazonaws.com/getAttendanceImageUrl';

// Token Expiry Check
function isTokenExpired(token) {
  try {
    const [, payloadBase64] = token.split(".");
    const payload = JSON.parse(atob(payloadBase64));
    const exp = payload.exp * 1000;
    return Date.now() > exp;
  } catch {
    return true;
  }
}

// Parse tokens from URL and save to localStorage
function parseTokensFromUrl() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const idToken = params.get("id_token");

  if (accessToken && idToken) {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("id_token", idToken);
    window.location.hash = ""; // Clean URL
  }
}

parseTokensFromUrl();

const accessToken = localStorage.getItem("access_token");
const idToken = localStorage.getItem("id_token");

if (!accessToken || isTokenExpired(accessToken)) {
  localStorage.clear();
  const loginUrl = `${domain}/login?client_id=${clientId}&response_type=${responseType}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  window.location.href = loginUrl;
}

// Show user info
function showUserInfo(token) {
  try {
    const [, payloadBase64] = token.split(".");
    const payload = JSON.parse(atob(payloadBase64));
    const email = payload.email || payload["cognito:username"] || "Unknown user";
    document.getElementById("userInfo").innerHTML = `👤 Logged in as <strong>${email}</strong>`;
  } catch {
    document.getElementById("userInfo").textContent = "Logged in";
  }
}
showUserInfo(idToken);

// Logout
function logout() {
  localStorage.clear();
  const logoutUrl = `${domain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(redirectUri)}`;
  window.location.href = logoutUrl;
}
document.getElementById("logoutBtn").addEventListener("click", logout);

// Camera Access
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    document.getElementById('video').srcObject = stream;
    document.getElementById('status').textContent = '🎥 Camera ready...';
  })
  .catch(err => {
    console.error('Camera error:', err);
    document.getElementById('status').textContent = '❌ Camera access denied!';
  });

// Capture & Upload
function capture() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');
  const captureBtn = document.getElementById('captureBtn');

  captureBtn.disabled = true;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(async (blob) => {
    const fileName = `attendance/${Date.now()}.jpg`;
    status.textContent = '⬆️ Uploading...';

    try {
      // Step 1: Get pre-signed URL
      const presignResp = await fetch(presignUrlApi, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ key: fileName })
      });

      if (!presignResp.ok) throw new Error('❌ Failed to get pre-signed URL');
      const { url } = await presignResp.json();

      // Step 2: Upload to S3
      const uploadResp = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg'
        },
        body: blob
      });

      if (!uploadResp.ok) throw new Error('❌ Upload failed');

      // Step 3: Mark Attendance
      const attendanceResp = await fetch(attendanceApi, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ s3Key: fileName })
      });

      const resultJson = await attendanceResp.json();
      if (resultJson && resultJson.message && resultJson["TimestampIST"]) {
        status.textContent = `✅ ${resultJson.message} at ${resultJson["TimestampIST"]}`;
      } else {
        status.textContent = '✅ Attendance marked, but no timestamp returned.';
      }

    } catch (err) {
      console.error(err);
      status.textContent = `❌ ${err.message || 'Something went wrong.'}`;
    } finally {
      captureBtn.disabled = false;
    }
  }, 'image/jpeg');
}
