# Jobs Territory — Candidate Job Portal

A full-stack, responsive candidate job portal built for the Jobs Territory technical assignment. Candidates can create an account, maintain a profile, find roles with keyword and location search plus filters, apply with an optional note, and track application status.

## Run locally

**Requirements:** Node.js 18 or newer. No package installation or external database is needed.

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

For automatic server restarts during development:

```bash
npm run dev
```

The app creates `data/portal.json` on first run. Set `PORT` or `DATA_FILE` to change the server port or data location.

### Demo account

- **Email:** `demo@jobterritory.com`
- **Password:** `Candidate123!`

You can also create a new account from the application.

## Features

- **Candidate accounts:** Registration, login, logout, password hashing with Node.js `scrypt`, and an HTTP-only, same-site session cookie.
- **Candidate profile:** Edit name, phone, location, professional headline, bio, skills, LinkedIn, and resume link.
- **Job discovery:** Browse seeded openings; search by role, company, skill, or location; filter by job type, work arrangement, and experience; sort by company.
- **Applications:** Submit an application with an optional note, prevent duplicate applications, and view each application with its submission date and status.
- **Responsive interface:** Desktop and mobile layouts, accessible form labels, inline validation messages, empty states, and clear success feedback.
- **Local persistence:** Candidate and application records are stored in a JSON file for a simple, self-contained demo.

Application status is initialized as **Submitted**. The portal intentionally does not let candidates change their own status; subsequent status updates would come from the employer/ATS workflow.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create a candidate account and sign in |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | End the current session |
| `GET` | `/api/auth/me` | Get the signed-in candidate |
| `PATCH` | `/api/profile` | Update candidate profile |
| `GET` | `/api/jobs` | List jobs; supports `q`, `location`, `type`, `workMode`, `experience` |
| `GET` | `/api/jobs/:id` | Get a job |
| `POST` | `/api/jobs/:id/apply` | Apply to a job |
| `GET` | `/api/applications` | List the signed-in candidate's applications |
| `GET` | `/api/health` | Health check |

## Tests

```bash
npm test
```

The built-in Node test suite exercises registration and validation, profile updates, job filtering, authenticated application submission, duplicate prevention, and application tracking.

## AI-assisted development

**Tool used:** GitHub Copilot in VS Code, powered by Copilot SDK. It was used as a coding assistant for implementation, debugging, test creation, and documentation—not as a substitute for review or verification.

### How the work was done

1. **Start from user journeys:** Break the brief into candidate registration/sign-in, profile editing, job discovery, applying, and status tracking. Define what a successful result looks like for each journey before implementation.
2. **Give the assistant bounded tasks:** Include the existing stack, relevant files, constraints (dependency-free Node.js, safe authentication, accessible responsive UI), and acceptance criteria in each prompt. Ask for focused changes rather than an unreviewed rewrite.
3. **Implement and inspect:** Review generated changes for input validation, authorization, error handling, safe HTML rendering, mobile layout, and consistency between API and UI behavior. Refine the interface against real candidate feedback.
4. **Verify the behavior:** Run `npm test` and exercise search, account creation/login, application submission, and status tracking in a browser. When a browser session exposed connection failures because its server was stopped, verify server health, restart it, and repeat the user journey; improve the UI to show an actionable retry state instead of a raw fetch error.
5. **Document what is and is not included:** Keep demo credentials, local run instructions, limitations, and production hardening needs explicit. Do not claim a hosted deployment without an actual deployment URL.

### Example prompts

1. **Feature scope and acceptance criteria**

   > Build a responsive candidate job portal using the existing Node.js project. Support account registration and login, profile editing, searchable/filterable job listings, application submission, and application status tracking. Keep it dependency-free. Before finishing, list the candidate journeys and verify each one.

2. **Backend implementation**

   > Implement the API for this candidate portal. Hash passwords with Node.js built-ins, protect profile and application routes with an HTTP-only session cookie, validate request data, prevent duplicate applications, and return useful HTTP errors. Do not expose password fields. Add integration tests for registration, authorization, filtering, and applying.

3. **Debugging from user evidence**

   > Candidates report “Failed to fetch” while searching and applying. Reproduce the browser issue and distinguish a stopped/unreachable backend from an API validation error. Fix the root cause where possible and show a clear, actionable connection message with a retry option. Re-test search, sign-in, application submission, and application tracking.

4. **Usability review**

   > Review the candidate-facing UI from a first-time user's perspective. Make job details available before applying, preserve the selected role when authentication is required, provide clear loading/success/error feedback, and improve keyboard and mobile usability. Keep existing API behavior and add or update targeted tests.

### Review and test evidence

AI-generated changes were checked against the assignment requirements and reviewed before being kept. The automated test suite covers registration/input validation, profile updates, job filtering, authenticated application submission, duplicate prevention, and application tracking. Browser checks cover the actual search, registration/sign-in, apply, and status-view journeys. A manual browser check is useful for layout and interaction but does not replace automated tests.

## Demo / deployment

The project is ready to run locally using the steps above. To share a hosted demo, deploy the Node server to a Node-compatible host and configure persistent storage for `DATA_FILE`; a deployment URL is not included because no hosting account or target environment was provided.

## Production considerations

This assignment demo uses a JSON file and in-memory sessions to avoid external setup. A production rollout should use a managed database, a shared/expiring session store, HTTPS, rate limiting, email verification and password reset, and employer/ATS integration for application status updates.
