const BASE_API = "https://jprbceq0dk.execute-api.us-east-1.amazonaws.com";
const getHistoryUrl = `${BASE_API}/getAttendanceHistory`;

const token = localStorage.getItem("access_token");

// Logout function
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "https://face-attendance-user-auth.auth.us-east-1.amazoncognito.com/logout?client_id=8me27q0v6uiackv03hbqoa1p3&logout_uri=https://cloudtechmadan.github.io/my-user/";
});

// Redirect if no token
if (!token) {
  window.location.href = "https://face-attendance-user-auth.auth.us-east-1.amazoncognito.com/login?response_type=token&client_id=8me27q0v6uiackv03hbqoa1p3&redirect_uri=https://cloudtechmadan.github.io/my-user/";
}

async function fetchAttendanceHistory() {
  try {
    const response = await fetch(getHistoryUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Failed to fetch attendance history");
    }

    const data = await response.json();
    const tbody = document.getElementById("attendanceBody");
    tbody.innerHTML = "";

    if (!data || data.length === 0) {
      tbody.innerHTML = "<tr><td colspan='3'>No records found</td></tr>";
      return;
    }

    data.forEach((record) => {
      const dateTime = new Date(record.timestamp);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${dateTime.toLocaleDateString()}</td>
        <td>${dateTime.toLocaleTimeString()}</td>
        <td>${record.status || "Present"}</td>
      `;
      tbody.appendChild(row);
    });

  } catch (err) {
    console.error("Error:", err);
    alert("Error fetching attendance history");
  }
}

fetchAttendanceHistory();
