document.addEventListener('DOMContentLoaded', () => {
  const domain = 'https://face-attendance-admin-auth.auth.us-east-1.amazoncognito.com';
  const clientId = '8me27q0v6uiackv03hbqoa1p3';
  const redirectUri = window.location.origin + window.location.pathname;
  const scope = 'openid profile email employee-api/employee-access';
  const responseType = 'token id_token';

  const attendanceApi = 'https://jprbceq0dk.execute-api.us-east-1.amazonaws.com/markAttendance';
  const presignUrlApi = 'https://jprbceq0dk.execute-api.us-east-1.amazonaws.com/getAttendanceImageUrl';

  const toast = (msg, success = true) => {
    const div = document.createElement("div");
    div.className = `fixed bottom-5 right-5 px-4 py-2 rounded shadow-lg z-50 text-white transition-opacity duration-300 text-sm font-semibold ${success ? 'bg-green-600' : 'bg-red-600'}`;
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 4000);
  };

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

  function parseTokensFromUrl() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const idToken = params.get("id_token");

    if (accessToken && idToken) {
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("id_token", idToken);
      window.location.hash = "";
    }
  }

  parseTokensFromUrl();

  const accessToken = localStorage.getItem("access_token");
  const idToken = localStorage.getItem("id_token");

  if (!accessToken || isTokenExpired(accessToken)) {
    localStorage.clear();
    const loginUrl = `${domain}/login?client_id=${clientId}&response_type=${responseType}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = loginUrl;
    return;
  }

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

  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    const logoutUrl = `${domain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = logoutUrl;
  });

  const loader = document.getElementById("loader");

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      document.getElementById('video').srcObject = stream;
      document.getElementById('status').textContent = '🎥 Camera ready...';
    })
    .catch(err => {
      console.error('Camera error:', err);
      document.getElementById('status').textContent = '❌ Camera access denied!';
      toast('Camera access denied!', false);
    });

  document.getElementById("captureBtn").addEventListener("click", capture);

  async function capture() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const status = document.getElementById('status');
    const captureBtn = document.getElementById('captureBtn');

    captureBtn.disabled = true;
    loader.style.display = "block";
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      const fileName = `attendance/${Date.now()}.jpg`;
      status.textContent = '📍 Getting location...';

      navigator.geolocation.getCurrentPosition(async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        let address = 'Unknown';
        let pincode = 'Unknown';

        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`, {
            headers: { 'Accept-Language': 'en' }
          });
          const data = await response.json();
          if (data && data.address) {
            const addr = data.address;
            address = [addr.house_number, addr.road, addr.residential || addr.neighbourhood || addr.suburb, addr.city || addr.town || addr.village || addr.county, addr.state, addr.country].filter(Boolean).join(', ');
            pincode = addr.postcode || 'Unknown';
          }
        } catch (err) {
          console.error('Reverse geocoding failed:', err);
        }

        try {
          status.textContent = '⬆️ Uploading image...';
          const presignResp = await fetch(presignUrlApi, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ key: fileName })
          });

          if (!presignResp.ok) throw new Error('Failed to get pre-signed URL');
          const { url } = await presignResp.json();

          const uploadResp = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/jpeg' },
            body: blob
          });

          if (!uploadResp.ok) throw new Error('Upload failed');

          status.textContent = '📡 Marking attendance...';
          const attendanceResp = await fetch(attendanceApi, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ s3Key: fileName, latitude, longitude, address, pincode })
          });

          const resultJson = await attendanceResp.json();
          if (attendanceResp.ok) {
            const msg = resultJson.message || '✅ Attendance marked.';
            const timestamp = resultJson.TimestampIST ? ` at ${resultJson.TimestampIST}` : '';
            status.textContent = `${msg}${timestamp}`;
            toast(`${msg}${timestamp}`, true);
          } else {
            const errorMsg = resultJson.message || 'Something went wrong.';
            status.textContent = errorMsg;
            toast(errorMsg, false);
          }

        } catch (err) {
          console.error(err);
          const msg = err.message || 'Something went wrong.';
          status.textContent = `❌ ${msg}`;
          toast(msg, false);
        } finally {
          captureBtn.disabled = false;
          loader.style.display = "none";
        }

      }, (err) => {
        const msg = '❌ Location access denied. Please enable location to proceed.';
        status.textContent = msg;
        toast(msg, false);
        captureBtn.disabled = false;
        loader.style.display = "none";
      });
    }, 'image/jpeg');
  }

  const attendanceList = document.getElementById("attendance-list");
  const errorDiv = document.getElementById("errorMessage");

  async function fetchAttendanceHistory() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      errorDiv.textContent = "⚠️ No token found. Please log in again.";
      toast("No token found. Please log in again.", false);
      return;
    }

    try {
      const response = await fetch("https://jprbceq0dk.execute-api.us-east-1.amazonaws.com/getAttendanceHistory", {
        method: "GET",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        const errMsg = result.message || "Failed to fetch attendance records.";
        errorDiv.textContent = `⚠️ ${errMsg}`;
        toast(errMsg, false);
        return;
      }

      if (!result || result.length === 0) {
        attendanceList.innerHTML = `<li class="text-gray-600">No attendance records found.</li>`;
        errorDiv.textContent = "";
        return;
      }

      result.sort((a, b) => b.Timestamp.localeCompare(a.Timestamp));
      attendanceList.innerHTML = "";
      result.forEach(rec => {
        const li = document.createElement("li");
        li.className = "bg-gray-100 p-2 mb-2 rounded shadow";
        li.innerHTML = `
          <strong>🕒 Date (IST):</strong> ${rec.TimestampIST}<br>
          <strong>📍 Location:</strong> ${rec.Address || "N/A"}<br>
          <strong>📮 Pincode:</strong> ${rec.Pincode || "N/A"}<br>
        `;
        attendanceList.appendChild(li);
      });
      errorDiv.textContent = "";
    } catch (error) {
      console.error("Fetch error:", error);
      errorDiv.textContent = `⚠️ ${error.message || "Unexpected error."}`;
      toast(error.message || "Unexpected error while fetching attendance.", false);
    }
  }

  fetchAttendanceHistory();
});
