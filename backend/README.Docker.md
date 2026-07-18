# Backend — Docker

## Running locally

Start the backend (Express + MongoDB) with:

```bash
docker compose up --build
```

The API will be available at `http://localhost:3000`.

The extension's `lib/auth.ts` and `background.ts` are both hardcoded to
`http://localhost:3000` — no config needed for local development.

## Environment variables

Create a `backend/.env` file before starting (never commit it):

```
MONGO_URI=mongodb://...
JWT_SECRET=your-secret-here
PORT=3000
```

## Building for deployment

```bash
# Match your cloud provider's CPU architecture (e.g. amd64 on a Mac M-series):
docker build --platform=linux/amd64 -t chrome-highlighter-backend .

docker push myregistry.com/chrome-highlighter-backend
```

See Docker's [getting started](https://docs.docker.com/go/get-started-sharing/) docs for registry details.

## References

- [Docker's Node.js guide](https://docs.docker.com/language/nodejs/)
