# Backend

## Environment variables

Create a `backend/.env` file before starting (never commit it — it's
already in `.gitignore`):

```
MONGO_URI=mongodb://...
JWT_SECRET=your-secret-here
PORT=3000
```

`MONGO_URI` can point at a local MongoDB or an Atlas cluster.
`JWT_SECRET` signs the session tokens issued by `POST /auth/google` — use
a long random value, e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`.

The extension's `lib/auth.ts` and `background.ts` are both hardcoded to
`http://localhost:3000` — no extra config needed for local development.

## Running locally (fastest for iteration)

```bash
cd backend
npm install
npm run dev
```

`npm run dev` runs `node --watch index.js` — the server restarts
automatically on every save. The API is then available at
`http://localhost:3000`.

## Running via Docker

```bash
docker compose up --build
```

The API will be available at `http://localhost:3000`, same as above. Slower
to iterate with (full image rebuild per change) but closer to how it'd
actually run in production — useful for verifying the Dockerfile itself,
or if you don't have Node installed locally.

## Building for deployment

```bash
# Match your cloud provider's CPU architecture (e.g. amd64 on a Mac M-series):
docker build --platform=linux/amd64 -t chrome-highlighter-backend .

docker push myregistry.com/chrome-highlighter-backend
```

See Docker's [getting started](https://docs.docker.com/go/get-started-sharing/) docs for registry details.

## References

- [Docker's Node.js guide](https://docs.docker.com/language/nodejs/)
