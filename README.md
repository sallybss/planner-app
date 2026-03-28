# Planix

Planix is a full-stack planning app for managing personal schedules in a clean weekly calendar view. It includes account registration and login, protected event management, a dashboard-style calendar interface and a documented REST API.

## Live Links

- Frontend: https://planix-265e.onrender.com
- API: https://planix-api-rjvt.onrender.com/api
- Swagger Docs: https://planix-api-rjvt.onrender.com/swagger/

## What The Product Does

Planix helps a user:

- create an account and log in
- stay inside a protected calendar workspace
- create, edit and delete scheduled events
- organize events by date, time, category, color and description
- review events in a timeline-style yearly calendar board

The frontend is built as a Vue single-page application and the backend exposes an Express API with MongoDB persistence.

## Main Features

- Authentication with register and login flows
- Session-based frontend auth persistence per browser session
- Protected event CRUD endpoints
- Weekly calendar layout with scrollable timeline
- Event filters by title, category, description, time, or color
- Swagger UI for testing API endpoints
- Render deployment for both frontend and backend

## Tech Stack

- Frontend: Vue 3, Vue Router, Vite, TypeScript
- Backend: Node.js, Express, TypeScript
- Database: MongoDB with Mongoose
- API Docs: Swagger UI + swagger-jsdoc
- Deployment: Render

## Project Structure

```text
planner-app/
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

## Environment Notes

Backend environment values used in development include:

- `PORT`
- `DBHOST`
- `TOKEN_SECRET`

Frontend uses:

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

## API Overview

Main API areas:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/users`
- `GET /api/events`
- `POST /api/events`
- `PUT /api/events/:id`
- `DELETE /api/events/:id`

For full request and response details, use the live Swagger docs:

- https://planix-api-rjvt.onrender.com/swagger/

## Current Product Behavior

- users remain logged in during the active browser session
- refreshing the app keeps the session
- closing the browser/tab clears the session
- direct frontend routes such as `/login`, `/register`, and `/calendar` work in production with the Render rewrite rule

## Author

Built from the `sallybss/planner-app` repository.
