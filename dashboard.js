const BASE_API = "https://jprbceq0dk.execute-api.us-east-1.amazonaws.com";
const historyUrl = `${BASE_API}/getAttendanceHistory`;

const token = localStorage.getItem("access_token");

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "index.html";
});

document.getElementById("loadHistoryBtn").addEventListener("click", async () => {
  const container = document.getElementById("historyContainer");
  container.innerHTML = "Loading...";

  try {
    const response = await fetch(historyUrl, {
      method: "GET",
      headers: {
        Authorization: token
      }
    });

    const data = await response.json();

    if (response.ok) {
      const history = data.history;
      if (history.length === 0) {
        container.innerHTML = "<p>No attendance history found.</p>";
        return;
      }

      let html = `<p><strong>Employee ID:</strong> ${data.employeeId}<br><strong>Name:</strong> ${data.name}</p>`;
      html += "<ul>";
      for (const record of history) {
        html += `<li><strong>${record.Time}</strong> - Attendance marked</li>`;
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
