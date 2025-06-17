# MapLedger Monorepo

MapLedger is organized as a Node.js monorepo containing a React frontend and an Azure Functions backend.

## Folder structure

```
/frontend - React application built with Vite
/backend  - Azure Functions project
```

Both projects use TypeScript and share their own `package.json` files. The root `package.json` defines workspace commands for linting and testing across the monorepo.

## Prerequisites

- **Node.js** 18 or later
- **npm** (comes with Node)
- **Azure Functions Core Tools** v4+ for running the backend locally

## Running the projects locally

### Frontend

```bash
cd frontend
npm install
npm run dev
```

This starts the development server on `localhost` using Vite.

### Backend

```bash
cd backend
npm install
func start
```

`func start` requires Azure Functions Core Tools and serves the functions on your machine.

## Linting and testing

Each package exposes `npm run lint` and `npm test`. From the repository root you can run:

```bash
npm run lint
npm test
```

The GitHub Actions workflows `.github/workflows/frontend.yml` and `.github/workflows/backend.yml` execute these commands on every push.
