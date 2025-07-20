const BASE_API = "https://jprbceq0dk.execute-api.us-east-1.amazonaws.com";
const historyUrl = `${BASE_API}/getAttendanceHistory`;

const token = localStorage.getItem("access_token");

if (!token) {
  alert("Please login again.");
  window.location.href = "index.html";
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("access_token");
  sessionStorage.clear();
  const logoutUrl = `https://face-attendance-admin-auth.auth.us-east-1.amazoncognito.com/logout?client_id=8me27q0v6uiackv03hbqoa1p3&logout_uri=https://cloudtechmadan.github.io/my-user/`;
  window.location.href = logoutUrl;
});

document.getElementById("loadHistoryBtn").addEventListener("click", async () => {
  const container = document.getElementById("historyContainer");
  container.innerHTML = "Loading...";

  try {
    const response = await fetch(historyUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      const history = data.history;
      if (history.length === 0) {
        container.innerHTML = "<p>No attendance history found.</p>";
        return;
      }

      let html = "<ul>";
      for (const record of history) {
        html += `<li><strong>${record.Time}</strong> - ${record.Name} (${record.EmployeeID})</li>`;
      }
      html += "</ul>";
      container.innerHTML = html;
    } else {
      container.innerHTML = `<p style="color: red;">Error: ${data.error || "Unable to fetch"}</p>`;
    }

  } catch (err) {
    console.error("Error:", err);
    container.innerHTML = `<p style="color: red;">Something went wrong.</p>`;
  }
});
