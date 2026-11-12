const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);
const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_DATA_FILE = path.join(__dirname, "data", "portal.json");
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 64 * 1024;
const JOBS = [
  {
    id: "job-frontend-engineer",
    title: "Frontend Engineer",
    company: "Northstar Labs",
    location: "Bengaluru, India",
    type: "Full-time",
    workMode: "Hybrid",
    experience: "Mid-level",
    salary: "₹18L – ₹26L",
    category: "Engineering",
    postedAt: "2026-11-08",
    featured: true,
    description:
      "Build thoughtful, accessible product experiences for teams working with data. Partner closely with design and backend engineering to ship reliable features.",
    skills: ["React", "TypeScript", "CSS", "Accessibility"]
  },
  {
    id: "job-product-designer",
    title: "Product Designer",
    company: "Goodside",
    location: "Remote, India",
    type: "Full-time",
    workMode: "Remote",
    experience: "Mid-level",
    salary: "₹15L – ₹22L",
    category: "Design",
    postedAt: "2026-11-07",
    featured: true,
    description:
      "Shape simple, delightful workflows from discovery through delivery. You will work with product and engineering to turn customer problems into polished experiences.",
    skills: ["Figma", "Prototyping", "Design systems", "Research"]
  },
  {
    id: "job-backend-engineer",
    title: "Backend Engineer",
    company: "OrbitPay",
    location: "Mumbai, India",
    type: "Full-time",
    workMode: "Hybrid",
    experience: "Senior",
    salary: "₹28L – ₹40L",
    category: "Engineering",
    postedAt: "2026-11-06",
    featured: true,
    description:
      "Design and operate secure payment services at scale. Help improve system resilience, APIs, and observability in a collaborative engineering team.",
    skills: ["Node.js", "PostgreSQL", "AWS", "Distributed systems"]
  },
  {
    id: "job-people-ops",
    title: "People Operations Associate",
    company: "Common Ground",
    location: "Pune, India",
    type: "Full-time",
    workMode: "On-site",
    experience: "Entry-level",
    salary: "₹6L – ₹9L",
    category: "People",
    postedAt: "2026-11-05",
    featured: false,
    description:
      "Create a welcoming employee experience by supporting onboarding, people programs, and day-to-day operations as the team grows.",
    skills: ["Communication", "Operations", "HR"]
  },
  {
    id: "job-data-analyst",
    title: "Data Analyst",
    company: "Fieldnotes",
    location: "Remote, India",
    type: "Full-time",
    workMode: "Remote",
    experience: "Entry-level",
    salary: "₹8L – ₹12L",
    category: "Data",
    postedAt: "2026-11-04",
    featured: false,
    description:
      "Turn product and business data into clear recommendations. Build dashboards, investigate trends, and make insights accessible across the company.",
    skills: ["SQL", "Python", "Tableau", "Analytics"]
  },
  {
    id: "job-marketing-intern",
    title: "Marketing Intern",
    company: "Little Palm",
    location: "Delhi, India",
    type: "Internship",
    workMode: "Hybrid",
    experience: "Internship",
    salary: "₹25K – ₹35K / month",
    category: "Marketing",
    postedAt: "2026-11-03",
    featured: false,
    description:
      "Help a small, ambitious marketing team bring its brand to life through research, content, and campaign coordination.",
    skills: ["Writing", "Social media", "Research"]
  },
  {
    id: "job-qa-engineer",
    title: "QA Engineer",
    company: "Northstar Labs",
    location: "Hyderabad, India",
    type: "Contract",
    workMode: "Remote",
    experience: "Mid-level",
    salary: "₹12L – ₹18L",
    category: "Engineering",
    postedAt: "2026-11-02",
    featured: false,
    description:
      "Raise the quality bar for customer-facing software with risk-based testing, thoughtful automation, and close collaboration with product teams.",
    skills: ["Playwright", "API testing", "JavaScript"]
  },
  {
    id: "job-customer-success",
    title: "Customer Success Manager",
    company: "OrbitPay",
    location: "Bengaluru, India",
    type: "Full-time",
    workMode: "On-site",
    experience: "Senior",
    salary: "₹16L – ₹24L",
    category: "Customer Success",
    postedAt: "2026-11-01",
    featured: false,
    description:
      "Build trusted relationships with strategic customers, help them reach their goals, and share their feedback with teams across OrbitPay.",
    skills: ["Customer success", "Communication", "SaaS"]
  }
];

const publicUser = (user) => {
  const { passwordHash, passwordSalt, ...profile } = user;
  return profile;
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify(payload));
}

function error(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function cleanString(value, maxLength, field, { required = false } = {}) {
  if (typeof value !== "string") {
    if (required) throw error(400, `${field} is required.`);
    return "";
  }
  const result = value.trim();
  if (required && !result) throw error(400, `${field} is required.`);
  if (result.length > maxLength) throw error(400, `${field} must be ${maxLength} characters or fewer.`);
  return result;
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header.split(";").map((part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return ["", ""];
      return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
    }).filter(([key]) => key)
  );
}

async function readBody(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) throw error(413, "Request body is too large.");
    chunks.push(chunk);
  }
  if (length === 0) return {};
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Expected an object.");
    }
    return body;
  } catch {
    throw error(400, "Request body must be valid JSON.");
  }
}

async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = await scrypt(password, salt, 64);
  return { salt, hash: hash.toString("hex") };
}

async function createServer({ dataFile = process.env.DATA_FILE || DEFAULT_DATA_FILE, staticDir = path.join(__dirname, "public") } = {}) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  let store;
  try {
    store = JSON.parse(await fs.readFile(dataFile, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    store = { users: [], applications: [], jobs: JOBS };
  }
  store.users ||= [];
  store.applications ||= [];
  store.jobs ||= JOBS;

  if (!store.users.some((user) => user.email === "demo@jobterritory.com")) {
    const { salt, hash } = await hashPassword("Candidate123!");
    store.users.push({
      id: crypto.randomUUID(),
      name: "Alex Morgan",
      email: "demo@jobterritory.com",
      passwordSalt: salt,
      passwordHash: hash,
      phone: "",
      location: "Bengaluru, India",
      headline: "Product-minded professional exploring what's next",
      bio: "",
      skills: ["Communication", "Problem solving"],
      linkedin: "",
      resumeUrl: "",
      createdAt: new Date().toISOString()
    });
    await fs.writeFile(dataFile, JSON.stringify(store, null, 2));
  }

  let writeQueue = Promise.resolve();
  const persist = () => {
    const snapshot = JSON.stringify(store, null, 2);
    writeQueue = writeQueue.then(async () => {
      const temporaryFile = `${dataFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
      await fs.writeFile(temporaryFile, snapshot, "utf8");
      await fs.rename(temporaryFile, dataFile);
    });
    return writeQueue;
  };
  const sessions = new Map();
  const sessionCookie = (token, secure) =>
    `jt_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure ? "; Secure" : ""}`;
  const authenticate = (req) => {
    const token = parseCookies(req.headers.cookie).jt_session;
    const session = token && sessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      if (token) sessions.delete(token);
      throw error(401, "Please sign in to continue.");
    }
    const user = store.users.find((item) => item.id === session.userId);
    if (!user) throw error(401, "Please sign in to continue.");
    return user;
  };

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const secure = Boolean(req.socket.encrypted);

    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader("content-security-policy", "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");

    if (req.method !== "GET" && req.method !== "HEAD" && requestUrl.pathname.startsWith("/api/")) {
      const origin = req.headers.origin;
      if (origin) {
        let originUrl;
        try {
          originUrl = new URL(origin);
        } catch {
          sendJson(res, 403, { error: "Request origin is not allowed." });
          return;
        }
        if (originUrl.host !== req.headers.host) {
          sendJson(res, 403, { error: "Request origin is not allowed." });
          return;
        }
      }
    }

    try {
      if (pathname === "/api/health" && req.method === "GET") {
        sendJson(res, 200, { status: "ok" });
        return;
      }

      if (pathname === "/api/auth/register" && req.method === "POST") {
        const body = await readBody(req);
        const name = cleanString(body.name, 80, "Name", { required: true });
        const email = cleanString(body.email, 254, "Email", { required: true }).toLowerCase();
        const password = typeof body.password === "string" ? body.password : "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw error(400, "Enter a valid email address.");
        if (password.length < 8 || password.length > 128) throw error(400, "Password must be between 8 and 128 characters.");
        if (store.users.some((user) => user.email === email)) throw error(409, "An account with this email already exists.");
        const { salt, hash } = await hashPassword(password);
        const user = {
          id: crypto.randomUUID(),
          name,
          email,
          passwordSalt: salt,
          passwordHash: hash,
          phone: "",
          location: "",
          headline: "",
          bio: "",
          skills: [],
          linkedin: "",
          resumeUrl: "",
          createdAt: new Date().toISOString()
        };
        store.users.push(user);
        await persist();
        const token = crypto.randomBytes(32).toString("hex");
        sessions.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
        res.setHeader("set-cookie", sessionCookie(token, secure));
        sendJson(res, 201, { user: publicUser(user) });
        return;
      }

      if (pathname === "/api/auth/login" && req.method === "POST") {
        const body = await readBody(req);
        const email = cleanString(body.email, 254, "Email", { required: true }).toLowerCase();
        const password = typeof body.password === "string" ? body.password : "";
        const user = store.users.find((item) => item.email === email);
        if (!user || !password) throw error(401, "Email or password is incorrect.");
        const { hash } = await hashPassword(password, user.passwordSalt);
        const storedHash = Buffer.from(user.passwordHash, "hex");
        const suppliedHash = Buffer.from(hash, "hex");
        if (storedHash.length !== suppliedHash.length || !crypto.timingSafeEqual(storedHash, suppliedHash)) {
          throw error(401, "Email or password is incorrect.");
        }
        const token = crypto.randomBytes(32).toString("hex");
        sessions.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
        res.setHeader("set-cookie", sessionCookie(token, secure));
        sendJson(res, 200, { user: publicUser(user) });
        return;
      }

      if (pathname === "/api/auth/logout" && req.method === "POST") {
        const token = parseCookies(req.headers.cookie).jt_session;
        if (token) sessions.delete(token);
        res.setHeader("set-cookie", `jt_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? "; Secure" : ""}`);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (pathname === "/api/auth/me" && req.method === "GET") {
        sendJson(res, 200, { user: publicUser(authenticate(req)) });
        return;
      }

      if (pathname === "/api/profile" && req.method === "PATCH") {
        const user = authenticate(req);
        const body = await readBody(req);
        const fields = ["name", "phone", "location", "headline", "bio", "linkedin", "resumeUrl"];
        const limits = { name: 80, phone: 30, location: 100, headline: 120, bio: 1000, linkedin: 300, resumeUrl: 300 };
        for (const field of fields) {
          if (Object.hasOwn(body, field)) {
            user[field] = cleanString(body[field], limits[field], field, { required: field === "name" });
          }
        }
        if (Object.hasOwn(body, "skills")) {
          if (!Array.isArray(body.skills) || body.skills.length > 20) throw error(400, "Skills must be a list of up to 20 items.");
          user.skills = [...new Set(body.skills.map((skill) => cleanString(skill, 40, "Skill")).filter(Boolean))];
        }
        for (const field of ["linkedin", "resumeUrl"]) {
          if (user[field]) {
            let link;
            try {
              link = new URL(user[field]);
            } catch {
              throw error(400, `${field === "linkedin" ? "LinkedIn" : "Resume"} must be a valid URL.`);
            }
            if (link.protocol !== "https:" && link.protocol !== "http:") {
              throw error(400, `${field === "linkedin" ? "LinkedIn" : "Resume"} must be a valid URL.`);
            }
          }
        }
        await persist();
        sendJson(res, 200, { user: publicUser(user) });
        return;
      }

      if (pathname === "/api/jobs" && req.method === "GET") {
        const query = (requestUrl.searchParams.get("q") || "").trim().toLowerCase();
        const location = (requestUrl.searchParams.get("location") || "").trim().toLowerCase();
        const type = requestUrl.searchParams.get("type") || "";
        const workMode = requestUrl.searchParams.get("workMode") || "";
        const experience = requestUrl.searchParams.get("experience") || "";
        const jobs = store.jobs.filter((job) => {
          const searchable = [job.title, job.company, job.description, job.category, ...job.skills].join(" ").toLowerCase();
          return (!query || searchable.includes(query))
            && (!location || job.location.toLowerCase().includes(location))
            && (!type || job.type === type)
            && (!workMode || job.workMode === workMode)
            && (!experience || job.experience === experience);
        });
        sendJson(res, 200, { jobs });
        return;
      }

      const jobMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
      if (jobMatch && req.method === "GET") {
        const job = store.jobs.find((item) => item.id === jobMatch[1]);
        if (!job) throw error(404, "Job not found.");
        sendJson(res, 200, { job });
        return;
      }

      const applyMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/apply$/);
      if (applyMatch && req.method === "POST") {
        const user = authenticate(req);
        const job = store.jobs.find((item) => item.id === applyMatch[1]);
        if (!job) throw error(404, "Job not found.");
        if (store.applications.some((item) => item.userId === user.id && item.jobId === job.id)) {
          throw error(409, "You have already applied for this role.");
        }
        const body = await readBody(req);
        const coverLetter = cleanString(body.coverLetter || "", 2000, "Cover letter");
        const application = {
          id: crypto.randomUUID(),
          userId: user.id,
          jobId: job.id,
          status: "Submitted",
          coverLetter,
          appliedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        store.applications.push(application);
        await persist();
        sendJson(res, 201, { application: { ...application, job } });
        return;
      }

      if (pathname === "/api/applications" && req.method === "GET") {
        const user = authenticate(req);
        const applications = store.applications
          .filter((item) => item.userId === user.id)
          .map((item) => ({ ...item, job: store.jobs.find((job) => job.id === item.jobId) }))
          .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
        sendJson(res, 200, { applications });
        return;
      }

      if (requestUrl.pathname.startsWith("/api/")) {
        throw error(404, "API route not found.");
      }

      if (req.method !== "GET" && req.method !== "HEAD") {
        throw error(405, "Method not allowed.");
      }
      const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      const filePath = path.resolve(staticDir, relativePath);
      if (!filePath.startsWith(path.resolve(staticDir) + path.sep)) throw error(404, "Page not found.");
      const contentTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
      try {
        const content = await fs.readFile(filePath);
        res.writeHead(200, {
          "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream",
          "cache-control": "no-cache"
        });
        res.end(req.method === "HEAD" ? undefined : content);
      } catch (err) {
        if (err.code !== "ENOENT" && err.code !== "ENOTDIR") throw err;
        throw error(404, "Page not found.");
      }
    } catch (err) {
      if (res.headersSent) {
        res.destroy(err);
        return;
      }
      sendJson(res, err.status || 500, { error: err.status ? err.message : "Something went wrong. Please try again." });
      if (!err.status) console.error("Request failed:", err);
    }
  });

  return server;
}

if (require.main === module) {
  createServer()
    .then((server) => server.listen(PORT, () => {
      console.log(`Jobs Territory Candidate Portal is running at http://localhost:${PORT}`);
      console.log("Demo account: demo@jobterritory.com / Candidate123!");
    }))
    .catch((err) => {
      console.error("Unable to start the portal:", err);
      process.exitCode = 1;
    });
}

module.exports = { createServer };
