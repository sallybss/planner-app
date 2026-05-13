# Planix

[![Node.JS CI/CD](https://github.com/sallybss/planner-app/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/sallybss/planner-app/actions/workflows/main.yml)

Planix is a full-stack planning web app built as an improved version of a course compulsory assignment. It combines a yearly calendar, kanban board, notes workspace, and budget planner in one authenticated product with a Vue frontend, Express REST API, and MongoDB persistence.

## Live Links

- Frontend: https://planix-265e.onrender.com
- API: https://planix-api-rjvt.onrender.com/api
- Swagger Docs: https://planix-api-rjvt.onrender.com/swagger/

## Product Overview

Planix helps a user:

- register and log in
- manage calendar events in a timeline view
- move and resize events directly on the calendar
- organize tasks in a kanban board
- create, edit, search, and delete notes
- plan monthly or yearly budgets
- export budget overviews for printing or PDF saving

The frontend is a Vue single-page application. The backend exposes a documented Express API with MongoDB and Mongoose models for planner data.

## Main Features

### Authentication

- account registration and login
- JWT-protected create, update, and delete endpoints
- frontend session persistence for the current browser session

### Calendar

- yearly timeline calendar
- create events from the right-side form or by clicking calendar slots
- drag events to another slot to move them
- drag the resize handle to change event length and end time
- filter events by title, category, description, time, or color

### Board

- kanban columns for `To Do`, `In Progress`, and `Done`
- create tasks directly inside each column
- inline card editing
- drag tasks between columns

### Notes

- searchable notes workspace
- inline editing inside note cards
- dashed quick-add note tile inside the notes grid
- scrollable note cards for long content

### Budget

- income, fixed expenses, variable expenses, and savings sections
- editable row definitions stored in MongoDB
- monthly and yearly views
- DKK and EUR display support
- printable/downloadable budget overview

## Tech Stack

- Frontend: Vue 3, Vue Router, Vite, TypeScript
- Backend: Node.js, Express, TypeScript
- Database: MongoDB with Mongoose
- API Docs: Swagger UI + swagger-jsdoc
- Testing: Playwright API tests
- CI/CD: GitHub Actions + Render deployment

## Project Structure

```text
planner-app/
├── .github/
│   └── workflows/
├── backend/
│   ├── src/
│   ├── tests/
│   └── package.json
└── frontend/
    └── planner/
        ├── src/
        ├── public/
        └── package.json
```

## API Areas

Main API groups:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/users`
- `GET /api/events`
- `POST /api/events`
- `PUT /api/events/:id`
- `DELETE /api/events/:id`
- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `GET /api/notes`
- `POST /api/notes`
- `PUT /api/notes/:id`
- `DELETE /api/notes/:id`
- `GET /api/budget-entries`
- `POST /api/budget-entries`
- `PUT /api/budget-entries/:id`
- `DELETE /api/budget-entries/:id`
- `GET /api/budget-row-defs`
- `POST /api/budget-row-defs`
- `PUT /api/budget-row-defs/:id`
- `DELETE /api/budget-row-defs/:id`

For full request and response details, use the Swagger docs:

- https://planix-api-rjvt.onrender.com/swagger/

## Local Development

### Backend

```bash
cd backend
npm install
npm run start-dev
```

The backend runs locally at `http://localhost:4000`.

Swagger is available at:

```text
http://localhost:4000/swagger
```

### Frontend

```bash
cd frontend/planner
npm install
npm run dev
```

The frontend runs locally at:

```text
http://localhost:5173
```

## Testing

Backend API tests are run with Playwright:

```bash
cd backend
npm test
```

Current automated coverage includes:

- health check
- auth flows
- calendar events
- board tasks
- notes
- budget row definitions and budget entries

## Environment Variables

Backend development values:

- `PORT`
- `DBHOST`
- `TOKEN_SECRET`

Frontend values:

- `VITE_API_BASE_URL`

## Deployment Notes

The frontend is deployed on Render as a Static Site. Because it uses Vue Router history mode, Render needs an SPA fallback rewrite:

```text
/* -> /index.html
```

Recommended frontend Render settings:

- Root Directory: `frontend/planner`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

The backend is deployed separately on Render and is used by both the frontend and Swagger UI.

## Current Product Behavior

- planner records are stored in MongoDB
- auth session is kept for the current browser session
- budget currency preference is stored in browser `localStorage`
- direct frontend routes such as `/login`, `/register`, `/calendar`, `/board`, `/budget`, and `/notes` work in production with the Render rewrite rule

## Author

Built from the `sallybss/planner-app` repository.
