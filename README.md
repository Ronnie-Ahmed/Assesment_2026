# Secure Notes API

Node.js, Express, MongoDB (Mongoose), JWT auth, bcrypt hashing, role-based access (user / admin).

## Run it
1. `docker compose up -d` (MongoDB on host port 27018)
2. `cp .env.example .env` and set `JWT_SECRET`
3. `npm install`
4. `npm run dev`, then open http://localhost:5000

## Creating the first admin
Public registration always creates role `user`, so nobody can self-promote.
Register normally, then promote the account once:

    docker exec -it notes-mongo mongosh secure-notes --eval 'db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })'

## API
| Method & path | Access | Notes |
|---|---|---|
| POST /api/auth/register, /api/auth/login | public | returns a JWT |
| GET /api/auth/me | any user | profile |
| POST/GET /api/notes | any user | create / list own notes |
| GET/PATCH/DELETE /api/notes/:id | owner (admin may GET any) | |
| GET /api/notes/all?owner= | admin | everyone's notes |
| POST/GET/PATCH/DELETE /api/users, GET /api/users/:id | admin | user management |
| GET /api/users/by-interests?interest= | admin | aggregation, scenario 1 |
| POST/GET /api/posts, GET /api/posts/:id | any user | public posts |
| GET /api/posts/user/:userId | any user | aggregation with $lookup, scenario 2 |

All list endpoints use cursor pagination: `?limit=` (max 50) and `?cursor=`,
and return `{ data, nextCursor, limit }`.

## Indexes (exactly four custom ones)
| Index | Why it exists |
|---|---|
| users `{ email: 1 }` unique | login and lookup by email, and email uniqueness |
| users `{ interests: 1 }` (multikey) | the interests aggregation when filtered by one interest |
| notes `{ owner: 1, _id: -1 }` | "my notes, newest first" and the admin owner filter; also the cascade delete |
| posts `{ author: 1, _id: -1 }` | the `$lookup` for a user's posts, and the cascade delete |

Deliberately NOT indexed:
- Admin user list, admin all-notes list, public posts list: sorted and paginated by `_id`
  (ObjectIds are time-ordered), so the default `_id` index serves them.
- Get by id, update, delete: default `_id` index.
- `role`, `createdAt`, `title`: no query filters on them.
- No separate `{ owner: 1 }` or `{ author: 1 }`: the compound indexes already cover them.

## Aggregations
1. **Group by interests**: one `User.aggregate()`: `$match` (optional filter, uses the index) ->
   `$unwind` -> `$group` -> `$sort` -> `$limit`. Unfiltered, the group necessarily reads every
   user, and no index can avoid that.
2. **User posts**: one `User.aggregate()` with `$lookup` (let + pipeline form, so the joined
   posts are sorted, limited and use the `{ author, _id }` index).

## Security notes
- bcrypt (cost 12); password hashes are `select: false` and never returned.
- The role is read from the database on each request, so role changes and deleted users take effect immediately.
- Non-owners get 404, not 403, so note ids can't be probed.
- Registration ignores any `role` in the body; update endpoints whitelist their fields.
- Frontend renders user text with `textContent` (no XSS). The token is in localStorage
  for simplicity; production would use httpOnly cookies.