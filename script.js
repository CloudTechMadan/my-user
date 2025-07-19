const domain = 'https://face-attendance-admin-auth.auth.us-east-1.amazoncognito.com';
const clientId = '4vu39fr2kccnb6kdk67v8ejsak'; // your user pool client ID
const redirectUri = window.location.origin + window.location.pathname;
const scope = 'openid profile email employee-api/employee-access';
const responseType = 'token';

const attendanceApi = 'https://jprbceq0dk.execute-api.us-east-1.amazonaws.com/markAttendance';
const presignUrlApi = 'https://jprbceq0dk.execute-api.us-east-1.amazonaws.com/getAttendanceImageUrl';

let accessToken = null;

function parseTokenFromUrl() {
  const hash = window.location.hash;
  if (hash.includes('access_token')) {
    const params = new URLSearchParams(hash.substring(1));
    accessToken = params.get('access_token');
    localStorage.setItem('access_token', accessToken);
    window.history.replaceState({}, document.title, redirectUri); // Clean URL
  } else {
    accessToken = localStorage.getItem('access_token');
  }
}

function redirectToLogin() {
  const loginUrl = `${domain}/login?client_id=${clientId}&response_type=${responseType}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  window.location.href = loginUrl;
}

parseTokenFromUrl();
if (!accessToken) {
  redirectToLogin();
}

navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    document.getElementById('video').srcObject = stream;
    document.getElementById('status').textContent = 'Camera ready...';
  })
  .catch(err => {
    console.error('Camera error:', err);
    document.getElementById('status').textContent = 'Camera access denied!';
  });

function capture() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(async (blob) => {
    const fileName = `attendance/${Date.now()}.jpg`;
    status.textContent = 'Uploading...';

    try {
      // Get presigned URL from secured endpoint
      const presignResp = await fetch(presignUrlApi, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ key: fileName })
      });

      const { url } = await presignResp.json();

      // Upload to S3
      const uploadResp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob
      });

      if (!uploadResp.ok) throw new Error('Upload failed');

      // Call markAttendance
      const attendanceResp = await fetch(attendanceApi, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ s3Key: fileName })
      });

      const result = await attendanceResp.text();
      status.textContent = result;

    } catch (err) {
      console.error('Error:', err);
      status.textContent = '❌ Something went wrong.';
    }
  }, 'image/jpeg');
}
