const API_URL = "http://localhost:5000/api/events";
const ADMIN_LOGIN_URL = "http://localhost:5000/api/admin/login";

const form = document.getElementById("event-form");
const adminForm = document.getElementById("admin-form");
const adminCodeInput = document.getElementById("admin-code");
const adminStatus = document.getElementById("admin-status");
const logoutBtn = document.getElementById("logout-btn");
const createSection = document.getElementById("create-section");

let startWindow = getStartOfHour(new Date());
let isAdmin = localStorage.getItem("isAdmin") === "true";

function updateAdminUI() {
  if (isAdmin) {
    adminStatus.textContent = "Admin mode enabled";
    createSection.style.display = "block";
    adminCodeInput.value = "";
  } else {
    adminStatus.textContent = "Read-only mode";
    createSection.style.display = "none";
  }
}

function getStartOfHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

function formatHour(date) {
  return date.getHours().toString().padStart(2, "0") + ":00";
}

function renderHours() {
  const hoursDiv = document.getElementById("hours");
  hoursDiv.innerHTML = "";

  for (let i = 0; i < 24; i++) {
    const hourDate = new Date(startWindow);
    hourDate.setHours(startWindow.getHours() + i);

    const div = document.createElement("div");
    div.className = "hour";
    div.innerText = formatHour(hourDate);

    hoursDiv.appendChild(div);
  }
}

function updateRangeLabel() {
  const end = new Date(startWindow);
  end.setHours(startWindow.getHours() + 24);

  document.getElementById("range-label").innerText =
    startWindow.toLocaleString() + " → " + end.toLocaleString();
}

function renderEvents(events) {
  const rows = document.getElementById("rows");
  rows.innerHTML = "";

  const windowEnd = new Date(startWindow);
  windowEnd.setHours(startWindow.getHours() + 24);

  events.forEach((event) => {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);

    if (end <= startWindow || start >= windowEnd) return;

    const row = document.createElement("div");
    row.className = "row";

    const eventDiv = document.createElement("div");
    eventDiv.className = "event " + event.type;
    eventDiv.innerText = event.name;

    const startDiff = (start - startWindow) / (1000 * 60 * 60);
    const endDiff = (end - startWindow) / (1000 * 60 * 60);

    const left = Math.max(0, startDiff * 100);
    const width = Math.max(10, (endDiff - startDiff) * 100);

    eventDiv.style.left = left + "px";
    eventDiv.style.width = width + "px";
    eventDiv.style.top = "5px";

    if (isAdmin) {
      const btn = document.createElement("button");
      btn.innerText = "x";
      btn.onclick = () => deleteEvent(event._id);

      eventDiv.appendChild(btn);
    }

    row.appendChild(eventDiv);
    rows.appendChild(row);
  });
}

async function loadTimeline() {
  const res = await fetch(API_URL);
  const events = await res.json();

  renderHours();
  renderEvents(events);
  updateRangeLabel();
}

adminForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const code = adminCodeInput.value;

  try {
    const res = await fetch(ADMIN_LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      alert("Invalid admin code");
      return;
    }

    isAdmin = true;
    localStorage.setItem("isAdmin", "true");
    localStorage.setItem("adminCode", code);
    updateAdminUI();
    loadTimeline();
  } catch (error) {
    alert("Admin login failed");
  }
});

logoutBtn.addEventListener("click", () => {
  isAdmin = false;
  localStorage.removeItem("isAdmin");
  localStorage.removeItem("adminCode");
  updateAdminUI();
  loadTimeline();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!isAdmin) {
    alert("Admin access required");
    return;
  }

  const name = document.getElementById("name").value;
  const type = document.getElementById("type").value;
  const startAt = document.getElementById("startAt").value;
  const endAt = document.getElementById("endAt").value;
  const adminCode = localStorage.getItem("adminCode");

  if (new Date(endAt) <= new Date(startAt)) {
    alert("End date must be after start date.");
    return;
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-code": adminCode,
    },
    body: JSON.stringify({
      name,
      type,
      startAt,
      endAt,
    }),
  });

  if (!res.ok) {
    alert("Unauthorized or invalid event data.");
    return;
  }

  form.reset();
  loadTimeline();
});

async function deleteEvent(id) {
  if (!isAdmin) {
    alert("Admin access required");
    return;
  }

  const confirmed = confirm("Delete this event?");
  if (!confirmed) return;

  const adminCode = localStorage.getItem("adminCode");

  const res = await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
    headers: {
      "x-admin-code": adminCode,
    },
  });

  if (!res.ok) {
    alert("Unauthorized delete.");
    return;
  }

  loadTimeline();
}

document.getElementById("prev").onclick = () => {
  startWindow.setHours(startWindow.getHours() - 24);
  loadTimeline();
};

document.getElementById("next").onclick = () => {
  startWindow.setHours(startWindow.getHours() + 24);
  loadTimeline();
};

updateAdminUI();
loadTimeline();
