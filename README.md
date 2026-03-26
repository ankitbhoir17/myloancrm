# MyLoanCRM

A modern Loan Customer Relationship Management (CRM) system built with React and Express.

## Features

- User authentication with role-based access
- Dashboard with loan activity snapshots
- Customer management
- Loan management
- User administration for superusers
- Responsive interface for desktop and mobile

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

```bash
npm install
```

### Frontend

```bash
npm start
```

Open `http://localhost:3000`.

### Backend

Production-style backend:

```bash
npm run server
```

Local backend with a temporary in-memory MongoDB:

```bash
npm run server:local
```

When using `npm run server:local`, the app starts with a temporary MongoDB in memory.
This is useful for local testing when MongoDB Atlas is unavailable.
Data created in this mode is reset when the server stops.

### Recover Superuser Access

If you forget the superuser login, you can reset or recreate it directly in MongoDB:

```bash
$env:MONGODB_URI="your-mongodb-uri"
npm run recover:superuser -- --username admin --email admin@example.com --password "NewStrongPassword123" --name "Admin User"
```

This command will:

- reset the password if the matching user already exists
- force the account role back to `superuser`
- reactivate the account if it was disabled
- create a new superuser if no matching user exists

## Deployment

Frontend:

- Build with `npm run build`
- Upload the `build/` contents to Hostinger `public_html`

Backend:

- Deploy the Node.js API to Render using `render.yaml`

See [DEPLOY_CHECKLIST.md](C:/Users/DELL/myloancrm/DEPLOY_CHECKLIST.md) for the full step-by-step deployment flow.
