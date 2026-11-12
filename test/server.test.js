const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("../server");

async function withServer(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "jt-portal-test-"));
  const server = await createServer({ dataFile: path.join(directory, "portal.json") });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run({ baseUrl });
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function request(baseUrl, route, { cookie, ...options } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...options.headers
    }
  });
  const payload = await response.json();
  return { response, payload };
}

test("candidate can register, update profile, apply once, and track application", async () => {
  await withServer(async ({ baseUrl }) => {
    const registration = await request(baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Jamie Candidate", email: "jamie@example.com", password: "mysecurepass1" })
    });
    assert.equal(registration.response.status, 201);
    assert.equal(registration.payload.user.email, "jamie@example.com");
    const cookie = registration.response.headers.get("set-cookie").split(";")[0];

    const profile = await request(baseUrl, "/api/profile", {
      method: "PATCH", cookie,
      body: JSON.stringify({ headline: "Frontend developer", skills: ["React", "TypeScript"] })
    });
    assert.equal(profile.response.status, 200);
    assert.deepEqual(profile.payload.user.skills, ["React", "TypeScript"]);

    const application = await request(baseUrl, "/api/jobs/job-frontend-engineer/apply", {
      method: "POST", cookie, body: JSON.stringify({ coverLetter: "I would love to join the team." })
    });
    assert.equal(application.response.status, 201);
    assert.equal(application.payload.application.status, "Submitted");

    const duplicate = await request(baseUrl, "/api/jobs/job-frontend-engineer/apply", {
      method: "POST", cookie, body: JSON.stringify({})
    });
    assert.equal(duplicate.response.status, 409);

    const applications = await request(baseUrl, "/api/applications", { cookie });
    assert.equal(applications.response.status, 200);
    assert.equal(applications.payload.applications.length, 1);
    assert.equal(applications.payload.applications[0].job.title, "Frontend Engineer");
  });
});

test("job filters narrow results and protected routes reject anonymous candidates", async () => {
  await withServer(async ({ baseUrl }) => {
    const filtered = await request(baseUrl, "/api/jobs?q=designer&workMode=Remote");
    assert.equal(filtered.response.status, 200);
    assert.equal(filtered.payload.jobs.length, 1);
    assert.equal(filtered.payload.jobs[0].title, "Product Designer");

    const anonymous = await request(baseUrl, "/api/applications");
    assert.equal(anonymous.response.status, 401);
  });
});

test("registration validates input and prevents duplicate email addresses", async () => {
  await withServer(async ({ baseUrl }) => {
    const invalid = await request(baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Jamie", email: "not-an-email", password: "short" })
    });
    assert.equal(invalid.response.status, 400);

    const body = JSON.stringify({ name: "Jamie", email: "jamie@example.com", password: "mysecurepass1" });
    assert.equal((await request(baseUrl, "/api/auth/register", { method: "POST", body })).response.status, 201);
    assert.equal((await request(baseUrl, "/api/auth/register", { method: "POST", body })).response.status, 409);
  });
});
