# Secure Notes API

A REST API for a note-taking platform with JWT authentication and role-based access control (user and admin).

**Stack:** Node.js, Express, MongoDB with Mongoose, JWT (`jsonwebtoken`), bcrypt password hashing.

## Links

- Live API: https://assesment-gamma-taupe.vercel.app (health check: `/health`)
- Live frontend: `https://assesment-frontend-opal.vercel.app/`
- Frontend repository: `https://github.com/Ronnie-Ahmed/assesment-frontend`

The frontend is a separate static page that calls this API over CORS with a Bearer token.
Login details for a test admin account are in the submission message.

## Run locally

1. Start MongoDB: `docker compose up -d` (exposes MongoDB on host port 27018).
   Without Docker, use a free MongoDB Atlas cluster and put its connection string in `MONGO_URI` instead.
2. Copy `.env.example` to `.env` and set `JWT_SECRET`.
3. `npm install`
4. `npm run dev` (the API listens on `http://localhost:5000`).

### Environment variables

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string. Include the database name, for example `.../secure-notes?retryWrites=true&w=majority`. |
| `JWT_SECRET` | Secret used to sign tokens. Use a long random value. |
| `JWT_EXPIRES_IN` | Token lifetime, for example `1d`. |
| `PORT` | Local port only (default 5000). Not needed on Vercel. |
| `FRONTEND_ORIGIN` | Allowed browser origin(s) for CORS, comma separated, exact URL without a trailing slash. If unset, cross-origin browser requests are refused. |

## Creating the first admin

Public registration always creates the role `user`, so nobody can promote themselves.
Register an account normally, then change its `role` field to `admin` (lowercase) directly in the database:

- Atlas: Browse Collections, open `users`, edit the document.
- Local Docker:
  `docker exec -it notes-mongo mongosh secure-notes --eval 'db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })'`

Role changes take effect immediately, because the role is read from the database on every request.

## API

All routes except register, login and `/health` require `Authorization: Bearer <token>`.

| Method and path | Access | Description |
|---|---|---|
| POST `/api/auth/register` | public | Create a user (role is always `user`). Returns a token. |
| POST `/api/auth/login` | public | Returns a token. |
| GET `/api/auth/me` | any user | Own profile. |
| POST `/api/notes` | any user | Create a note. |
| GET `/api/notes` | any user | List own notes (paginated). |
| GET `/api/notes/:id` | owner, or admin | Read one note. |
| PATCH `/api/notes/:id` | owner | Update a note. |
| DELETE `/api/notes/:id` | owner | Delete a note. |
| GET `/api/notes/all?owner=` | admin | List everyone's notes, optionally for one owner. |
| POST `/api/users` | admin | Add a user (admin may set the role). |
| GET `/api/users` | admin | List users (paginated). |
| GET `/api/users/:id` | admin | Read one user. |
| PATCH `/api/users/:id` | admin | Update a user. |
| DELETE `/api/users/:id` | admin | Remove a user and their notes and posts. |
| GET `/api/users/by-interests?interest=` | admin | Users grouped by interest (aggregation, scenario 1). |
| POST `/api/posts` | any user | Create a post. |
| GET `/api/posts` | any user | List all posts (paginated). |
| GET `/api/posts/:id` | any user | Read one post. |
| GET `/api/posts/user/:userId` | any user | All posts of one user (aggregation with `$lookup`, scenario 2). |

Posts are visible to every logged-in user. They are not exposed to anonymous visitors.

### Pagination

Every list endpoint uses cursor pagination: `?limit=` (default 10, maximum 50) and `?cursor=`.
Responses look like `{ data: [...], nextCursor: "<id or null>", limit: 10 }`.
Pass `nextCursor` back as `cursor` to get the next page.
Lists are sorted newest first by `_id`. ObjectIds are time-ordered, so sorting on `_id` needs no extra index.
For the interests view, the cursor is the last interest name returned.

## Indexes

Exactly four custom indexes, all declared with `schema.index` in the models:

| Collection | Index | Why it exists |
|---|---|---|
| users | `{ email: 1 }` unique | Login and any lookup by email; enforces unique emails. |
| users | `{ interests: 1 }` (multikey) | Supports the interests aggregation when it is filtered to one interest. |
| notes | `{ owner: 1, _id: -1 }` | "My notes, newest first", the admin filter by owner, and the cascade delete when a user is removed. |
| posts | `{ author: 1, _id: -1 }` | The `$lookup` for a user's posts (match plus sort plus limit), and the cascade delete. |

Deliberately **not** indexed:

- Admin user list, admin all-notes list, public posts list: filtered by nothing and sorted by `_id`, so the default `_id` index serves them.
- Get by id, update and delete: default `_id` index.
- `role`, `createdAt`, `title`: no query filters on them.
- No separate `{ owner: 1 }` or `{ author: 1 }` index: the compound indexes already cover queries on the first field alone.

I checked the plans with `explain()`: the notes list shows an index scan on `owner_1__id_-1` with no sort stage, and the posts `$lookup` uses `author_1__id_-1`.

## Aggregations

1. **Users grouped by interests** uses a single `User.aggregate()` call:
   `$match` (optional `?interest=`, uses the multikey index), `$unwind`, a second `$match` to keep only the requested group, `$group` (with a count and the first 20 users per group), then `$sort`, cursor `$match` and `$limit`.
   Interests are lowercased and de-duplicated when saved, so `Chess` and `chess` form one group.
   Without the filter, grouping all users has to read every user. No index can avoid that, because every document contributes to some group.
2. **Posts of one user** uses a single `User.aggregate()` call: `$match` on the user's `_id`, then `$lookup` in its `let` and `pipeline` form, with `$sort` and `$limit` inside the lookup so the joined posts are paginated and use the `{ author, _id }` index. An unknown user returns 404.

## Security notes

- Passwords are hashed with bcrypt (cost 12). The hash is `select: false` and is never returned.
- Login returns the same error for an unknown email and a wrong password.
- The role and the user's existence are checked in the database on each request, so deleted users and role changes take effect immediately.
- Requests for a note you do not own return 404 rather than 403, so ids cannot be probed. Note updates and deletes check the owner inside the query itself.
- Registration ignores any `role` in the request body. Update endpoints accept a fixed list of fields only.
- CORS uses an explicit allow-list, not `*`.

## Deployment notes and limits

- Backend: Vercel (Express, one serverless function). The database connection is cached across requests and waits for index builds on connect.
- MongoDB Atlas network access is open to `0.0.0.0/0` for this assessment only, because Vercel's outgoing IP addresses are not fixed. A production setup would restrict this.
- Deleting a user also deletes their notes and posts. It is not wrapped in a transaction, because that needs a replica set.
- There are no automated tests yet.
- The frontend keeps its token in `localStorage` for simplicity. A production app would use an httpOnly cookie.