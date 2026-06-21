import { createRequire } from "node:module";

const requireFromBackend = createRequire(new URL("../backend/package.json", import.meta.url));
const mysql = requireFromBackend("mysql2/promise");

const apiBase = "http://localhost:5000/api";
const webBase = "http://localhost:3000";
const suffix = Date.now();
const created = {};
const results = [];

function check(name, condition, detail = "") {
  results.push({ name, pass: Boolean(condition), detail });
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
}

async function request(path, { cookie, method = "GET", body, form } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: form || (body === undefined ? undefined : JSON.stringify(body)),
    redirect: "manual",
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { response, payload };
}

async function login(username, password) {
  const { response, payload } = await request("/auth/login", { method: "POST", body: { username, password } });
  return {
    status: response.status,
    cookie: (response.headers.get("set-cookie") || "").split(";")[0],
    payload,
  };
}

const envText = await (await import("node:fs/promises")).readFile(new URL("../backend/.env", import.meta.url), "utf8");
const env = Object.fromEntries(envText.split(/\r?\n/).filter(Boolean).map((line) => {
  const separator = line.indexOf("=");
  return [line.slice(0, separator), line.slice(separator + 1)];
}));
const connection = await mysql.createConnection({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
});

try {
  const admin = await login("admin", "admin123");
  check("ADMIN login", admin.status === 200 && Boolean(admin.cookie), `status=${admin.status}`);
  const adminCookie = admin.cookie;

  let response = await request("/auth/me", { cookie: adminCookie });
  const adminId = response.payload?.data?.staff_id;
  check("ADMIN session", response.response.status === 200 && response.payload?.data?.role === "ADMIN");

  response = await request("/exam-types", { cookie: adminCookie });
  const examTypeId = response.payload?.data?.[0]?.exam_type_id;
  check("Load exam type", response.response.status === 200 && Boolean(examTypeId));

  const staffUsername = `e2e_staff_${suffix}`;
  const staffPassword = "E2ePass123!";
  response = await request("/staff", {
    cookie: adminCookie,
    method: "POST",
    body: {
      staff_name: "E2E Test Staff",
      username: staffUsername,
      password: staffPassword,
      role: "STAFF",
      position: "Tester",
      department: "Radiology",
    },
  });
  created.staffId = response.payload?.data?.staff_id;
  check("Create temporary STAFF", response.response.status === 201 && Boolean(created.staffId));

  response = await request("/patients", {
    cookie: adminCookie,
    method: "POST",
    body: {
      first_name: "E2E",
      last_name: `Patient ${suffix}`,
      age: 30,
      gender: "Other",
      phone: "02000000000",
      address: "E2E temporary record",
    },
  });
  created.patientId = response.payload?.data?.patient_id;
  check("Create patient", response.response.status === 201 && Boolean(created.patientId));

  response = await request("/orders", {
    cookie: adminCookie,
    method: "POST",
    body: {
      patient_id: created.patientId,
      exam_type_id: examTypeId,
      staff_id: adminId,
      note: "E2E workflow test",
      queue_date: "2099-12-31",
    },
  });
  created.orderId = response.payload?.data?.order_id;
  created.queueId = response.payload?.data?.queue?.queue_id;
  check("Create order and queue", response.response.status === 201 && Boolean(created.orderId) && Boolean(created.queueId));

  response = await request("/queues/call-next?date=2099-12-31", { cookie: adminCookie, method: "POST" });
  check("Call next queue", response.response.status === 200 && response.payload?.data?.queue_id === created.queueId);

  const resultForm = new FormData();
  resultForm.append("order_id", String(created.orderId));
  resultForm.append("result_detail", "E2E result completed successfully");
  response = await request("/results", { cookie: adminCookie, method: "POST", form: resultForm });
  created.resultId = response.payload?.data?.result_id;
  check("Save examination result", response.response.status === 201 && Boolean(created.resultId));

  response = await request("/payments", {
    cookie: adminCookie,
    method: "POST",
    body: { order_id: created.orderId, staff_id: adminId, payment_type: "ເງິນສົດ" },
  });
  created.paymentId = response.payload?.data?.payment_id;
  check("Create payment", response.response.status === 201 && Boolean(created.paymentId));

  response = await request(`/orders/${created.orderId}`, { cookie: adminCookie });
  check("Workflow reaches DONE", response.response.status === 200 && response.payload?.data?.workflow_status === "DONE");

  const staff = await login(staffUsername, staffPassword);
  check("STAFF login", staff.status === 200 && Boolean(staff.cookie));

  response = await request("/reports/results", { cookie: staff.cookie });
  check("STAFF can view result report API", response.response.status === 200);

  response = await request("/reports/payments", { cookie: staff.cookie });
  check("STAFF cannot view financial report API", response.response.status === 403, `status=${response.response.status}`);

  response = await request("/staff", { cookie: staff.cookie });
  check("STAFF cannot access staff management API", response.response.status === 403);

  let pageResponse = await fetch(`${webBase}/reports`, { headers: { Cookie: staff.cookie }, redirect: "manual" });
  check("STAFF can open reports page", pageResponse.status === 200, `status=${pageResponse.status}`);

  pageResponse = await fetch(`${webBase}/staff`, { headers: { Cookie: staff.cookie }, redirect: "manual" });
  check("STAFF staff-page redirect", pageResponse.status === 307 && pageResponse.headers.get("location") === "/dashboard");
} finally {
  await connection.beginTransaction();
  try {
    if (created.paymentId) await connection.execute("DELETE FROM payment WHERE payment_id = ?", [created.paymentId]);
    if (created.resultId) await connection.execute("DELETE FROM result WHERE result_id = ?", [created.resultId]);
    if (created.queueId) await connection.execute("DELETE FROM queue WHERE queue_id = ?", [created.queueId]);
    if (created.orderId) await connection.execute("DELETE FROM `order` WHERE order_id = ?", [created.orderId]);
    if (created.patientId) await connection.execute("DELETE FROM patients WHERE patient_id = ?", [created.patientId]);
    if (created.staffId) await connection.execute("DELETE FROM staff WHERE staff_id = ?", [created.staffId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

console.log(JSON.stringify({ passed: results.filter((item) => item.pass).length, total: results.length, results }, null, 2));
