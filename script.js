document.addEventListener('DOMContentLoaded', () => {
  const domain = 'https://face-attendance-admin-auth.auth.us-east-1.amazoncognito.com';
  const clientId = '8me27q0v6uiackv03hbqoa1p3';
  const redirectUri = window.location.origin + window.location.pathname;
  const scope = 'openid profile email employee-api/employee-access';
  const responseType = 'token id_token';

  const attendanceApi = 'https://jprbceq0dk.execute-api.us-east-1.amazonaws.com/markAttendance';
  const presignUrlApi = 'https://jprbceq0dk.execute-api.us-east-1.amazonaws.com/getAttendanceImageUrl';

  // ✅ Toast Notification Function
  function showToast(message, duration = 3000) {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");
  const closeBtn = document.getElementById("closeToastBtn");

  toastMessage.textContent = message;
  toast.style.display = "flex";

  // Optional auto-hide after duration
  const timeoutId = setTimeout(() => {
    toast.style.display = "none";
  }, duration);

  // Close button logic
  closeBtn.onclick = () => {
    toast.style.display = "none";
    clearTimeout(timeoutId);
  };
}

  // ✅ Spinner Control Function
  function toggleSpinner(show) {
    const spinner = document.getElementById('spinner');
    spinner.style.display = show ? 'block' : 'none';
  }

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
      window.location.hash = ""; // Clean URL
    }
  }

  parseTokensFromUrl();

  const accessToken = localStorage.getItem("access_token");
  const idToken = localStorage.getItem("id_token");

  if (!accessToken || isTokenExpired(accessToken)) {
    localStorage.clear();
    const loginUrl = `${domain}/login?client_id=${clientId}&response_type=${responseType}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = "https://face-attendance-admin-auth.auth.us-east-1.amazoncognito.com/login?client_id=8me27q0v6uiackv03hbqoa1p3&response_type=token&scope=email+employee-api%2Femployee-access+openid+profile&redirect_uri=https%3A%2F%2Fcloudtechmadan.github.io%2Fmy-user%2Findex.html";
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

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      document.getElementById('video').srcObject = stream;
      document.getElementById('status').textContent = '🎥 Camera ready...';
    })
    .catch(err => {
      console.error('Camera error:', err);
      document.getElementById('status').textContent = '❌ Camera access denied!';
      showToast('❌ Camera access denied!');
    });

  document.getElementById("captureBtn").addEventListener("click", capture);

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
      status.textContent = '📍 Getting location...';
      toggleSpinner(true);

      navigator.geolocation.getCurrentPosition(async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        let address = 'Unknown';
        let pincode = 'Unknown';
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            {
              headers: {
                'Accept-Language': 'en'
              }
            }
          );
          const data = await response.json();
          if (data && data.address) {
            const addr = data.address;
            address = [
              addr.house_number,
              addr.road,
              addr.residential || addr.neighbourhood || addr.suburb,
              addr.city || addr.town || addr.village || addr.county,
              addr.state,
              addr.country
            ].filter(Boolean).join(', ');
            pincode = addr.postcode || 'Unknown';
            console.log("🗺️ Full Address:", address);
            console.log("📮 Pincode:", pincode);
          }
        } catch (err) {
          console.error('⚠️ Reverse geocoding failed:', err);
          showToast(err);
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

          if (!presignResp.ok) throw new Error('❌ Failed to get pre-signed URL');
          const { url } = await presignResp.json();

          const uploadResp = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/jpeg' },
            body: blob
          });

          if (!uploadResp.ok) throw new Error('❌ Upload failed');

          status.textContent = '📡 Marking attendance...';

          const attendanceResp = await fetch(attendanceApi, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              s3Key: fileName,
              latitude,
              longitude,
              address,
              pincode
            })
          });

          const resultJson = await attendanceResp.json();
          if (attendanceResp.ok) {
            const msg = resultJson.message || '✅ Attendance marked.';
            const timestamp = resultJson.TimestampIST ? ` at ${resultJson.TimestampIST}` : '';
            status.textContent = `${msg}${timestamp}`;
            showToast(`${msg}${timestamp}`);
          } else {
            const errorMsg = resultJson.message || '❌ Something went wrong.';
            const fullError = resultJson.error
              ? `${errorMsg}\n🪵 ${resultJson.error}`
              : errorMsg;
            status.textContent = fullError;
            showToast(fullError);
          }

        } catch (err) {
          console.error(err);
          const errorMessage = err.message || 'Something went wrong.';
          status.textContent = errorMessage;
          showToast(errorMessage);
        }
        finally {
          captureBtn.disabled = false;
          toggleSpinner(false);
        }

      }, (err) => {
        status.textContent = '❌ Location access denied. Please enable location to proceed.';
        showToast('❌ Location permission denied');
        captureBtn.disabled = false;
        toggleSpinner(false);
      });
    }, 'image/jpeg');
  }

  // 🟩 Show Past Attendance List
  const attendanceList = document.getElementById("attendance-list");
  const errorDiv = document.getElementById("errorMessage");

  async function fetchAttendanceHistory() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      errorDiv.textContent = "⚠️ No token found. Please log in again.";
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
      errorDiv.textContent = `⚠️ ${error.message || "An unexpected error occurred while fetching attendance."}`;
      showToast('⚠️ Failed to fetch history');
    }
  }

  fetchAttendanceHistory();

});
