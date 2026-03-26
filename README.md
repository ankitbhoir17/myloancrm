# MyLoanCRM

A modern Loan Customer Relationship Management (CRM) system built with React.

## Features

- **User Authentication**: Secure login/logout functionality
- **Dashboard**: Overview of loan statistics and recent activities
- **Loan Management**: Create, view, and manage loan applications
- **Customer Management**: Track customer profiles and their loan history
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Demo Login

You can log in with any username and password to explore the demo.

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── Layout.js     # Main layout with sidebar
│   └── Layout.css
├── context/          # React Context providers
│   └── AuthContext.js
├── pages/            # Page components
│   ├── Login.js
│   ├── Dashboard.js
│   ├── Loans.js
│   ├── LoanDetails.js
│   ├── Customers.js
│   └── CustomerDetails.js
├── App.js            # Main app with routing
├── App.css
├── index.js          # Entry point
└── index.css         # Global styles
```

## Available Scripts

- `npm start` - Run development server
- `npm build` - Build for production
- `npm test` - Run tests

### Backend

The project includes an Express backend in the `backend/` folder.

- Install dependencies (if not already installed):
```bash
npm install
```
- Run the backend server (production):
```bash
npm run server
```
- Run the backend in development with auto-reload (requires `nodemon`):
```bash
npm run dev
```

## API (basic)

Base path: `/api`

- `POST /api/auth/register` — register a new user
- `POST /api/auth/login` — authenticate and get JWT
- `GET /api/auth/me` — get current user (protected)

- `GET /api/customers` — list customers (protected)
- `POST /api/customers` — create customer (protected)
- `GET /api/customers/:id` — get customer (protected)
- `PUT /api/customers/:id` — update customer (protected)
- `DELETE /api/customers/:id` — delete customer (protected)

- `GET /api/loans` — list loans (protected)
- `POST /api/loans` — create loan (protected)
- `GET /api/loans/:id` — get loan (protected)
- `PUT /api/loans/:id` — update loan (protected)
- `DELETE /api/loans/:id` — delete loan (protected)

- `GET /api/activities` — list activities (protected)
- `POST /api/activities` — create activity (protected)
- `GET /api/activities/:id` — get activity (protected)
- `PUT /api/activities/:id` — update activity (protected)
- `DELETE /api/activities/:id` — delete activity (protected)

Notes:
- All protected endpoints require a Bearer token in the `Authorization` header.
- Configure `.env` with `MONGODB_URI`, `PORT`, and `JWT_SECRET` for production.
## Tech Stack

- React 18
- React Router v6
- CSS (no external UI library)

## License

MIT
