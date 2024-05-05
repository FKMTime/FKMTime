---
sidebar_position: 1
---

# Setup environment

You can run FKMTime in development mode in 2 ways:
- Using Docker
- Running backend and frontend separately

Clone this repo and navigate into it
```bash
git clone https://github.com/maxidragon/FKMTime
cd FKMTime
```

## Docker
Run the following command in the root directory of the project

```bash
docker compose -f docker-compose-dev.yml up
```

Frontend will be accessible at localhost:5173, backend at localhost:5000, database at localhost:5432 and api-tester at localhost:5001

You can read how to setup local WCA server [here](https://docs.worldcubeassociation.org/contributing/quickstart.html) and how to setup local WCA Live server [here](https://github.com/thewca/wca-live?tab=readme-ov-file#developing-in-docker)

If you want other WCA server than local you have to change `WCA_ORIGIN` and `WCA_LIVE_API_ORIGIN` in `docker-compose-dev.yml` file.


## Running backend and frontend separately

#### Requirements
- NodeJS (version 19.0.0 or later)
- PostgreSQL

#### Setup database

- Install PostgreSQL
- Create a database
```sql
CREATE DATABASE fkm_time;
```

#### Backend

- Navigate into backend directory
```bash
cd backend
```

- Install dependencies
```bash
npm install
```

- Create .env file and enter database URL, JWT secret and WCA and WCA Live URL
```
PORT=5000
DATABASE_URL=postgres://postgres@localhost:5432/fkm_time
SECRET=jwt_secret
WCA_LIVE_API_ORIGIN=http://localhost:4000/api
WCA_ORIGIN=http://localhost:3000
WCA_CLIENT_ID=example-application-id
WCA_CLIENT_SECRET=example-secret
```

If you don't have WCA server running you can seed the DB with sample data by running

```bash
npm run prisma:seed-test
```

This will also create a user with username `admin` and password `admin`, you can use these credentials to login to the admin panel instead of WCA account.

- Run backend in development mode
```
npm run start:dev
```

The server will be accessible at localhost:5000

#### Frontend

- Navigate into frontend directory
```bash
cd frontend
```

- Install dependencies
```
npm install
```

- Run development server
```
npm run dev
```

Admin panel will be accessible at localhost:5173



