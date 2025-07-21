const domain = 'https://face-attendance-admin-auth.auth.us-east-1.amazoncognito.com';
const clientId = '8me27q0v6uiackv03hbqoa1p3';
const redirectUri = 'https://cloudtechmadan.github.io/my-user/';
const scope = 'openid profile email employee-api/employee-access';
const responseType = 'token id';

const attendanceApi = 'https://jprbceq0dk.execute-api.us-east-1.amazonaws.com/markAttendance';
const presignUrlApi = 'https://jprbceq0dk.execute-api.us-east-1.amazonaws.com/getAttendanceImageUrl';

let accessToken = null;

// Get access token from URL or localStorage
function parseTokenFromUrl() {
  const hash = window.location.hash;
  if (hash.includes('access_token')) {
    const params = new URLSearchParams(hash.substring(1));
    accessToken = params.get('access_token');
    localStorage.setItem('access_token', accessToken);
    // Remove token from URL
    window.history.replaceState({}, document.title, redirectUri);
  } else {
    accessToken = localStorage.getItem('access_token');
  }
}

// Redirect to Cognito login
function redirectToLogin() {
  const loginUrl = `${domain}/login?client_id=${clientId}&response_type=${responseType}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  window.location.href = loginUrl;
}

parseTokenFromUrl();
if (!accessToken) {
  redirectToLogin();
}

// Access webcam
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    document.getElementById('video').srcObject = stream;
    document.getElementById('status').textContent = '🎥 Camera ready...';
  })
  .catch(err => {
    console.error('Camera error:', err);
    document.getElementById('status').textContent = '❌ Camera access denied!';
  });

// Capture image and upload
function capture() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(async (blob) => {
    const fileName = `attendance/${Date.now()}.jpg`;
    status.textContent = '⬆️ Uploading...';

    try {
      // 1. Get presigned URL from backend
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

      // 2. Upload to S3
      const uploadResp = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg'
        },
        body: blob
      });

      if (!uploadResp.ok) throw new Error('❌ Upload failed');

      // 3. Trigger attendance marking
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
      status.textContent = '❌ Something went wrong.';
    }
  }, 'image/jpeg');
}
function logout() {
  localStorage.removeItem('access_token');
  const logoutUrl = `https://face-attendance-admin-auth.auth.us-east-1.amazoncognito.com/logout?client_id=8me27q0v6uiackv03hbqoa1p3&logout_uri=https://cloudtechmadan.github.io/my-user/index.html`;
  window.location.href = logoutUrl;
}




