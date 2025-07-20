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
        Authorization: `Bearer ${token}`
      }
    });

    
    const data = await response.json();

    if (response.ok) {
      const history = data.history;
      if (!history || history.length === 0) {
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
      container.innerHTML = `<p style="color: red;">Error: ${data.error || "Unable to fetch attendance history."}</p>`;
    }

  } catch (err) {
    console.error("Error:", err);
    container.innerHTML = `<p style="color: red;">Something went wrong while fetching data.</p>`;
  }
});
