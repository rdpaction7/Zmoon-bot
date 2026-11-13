# SkillSwap GitHub Releases streaming uploader (Render)

## Deploy on Render
1. Put this `render-uploader` folder in a GitHub repository (it can be a separate small repository).
2. In Render choose **New → Web Service** and connect that repository.
3. Set **Root Directory** to `render-uploader` if the folder is inside a larger repository.
4. Runtime: Node.
5. Build command: `npm install`
6. Start command: `npm start`
7. Choose a plan. Free is suitable for a smoke test; test large uploads before depending on it.
8. After deployment, open `https://YOUR-SERVICE.onrender.com/health`. It should return JSON with `ok: true`.

## Connect SkillSwap
In `src/App.tsx`, set:
`const RENDER_UPLOAD_URL = "https://YOUR-SERVICE.onrender.com";`

The GitHub PAT stays in the frontend constant in `src/App.tsx` as requested. The browser sends it as a Bearer token to this service; this service uses it for GitHub API calls. The server also verifies that the token's GitHub account is `rdpaction7`.

## GitHub repository
Defaults:
- Owner: `rdpaction7`
- Repository: `Skillswpa`

Optional Render environment variables:
- `GITHUB_OWNER=rdpaction7`
- `GITHUB_REPO=Skillswpa`

## Upload behavior
- Browser sends the raw file body to `POST /upload?filename=...`.
- Render streams the incoming request directly to GitHub's release upload endpoint; it does not save the file to disk or buffer the entire file in memory.
- It uses GitHub's `upload_url` from the selected release.
- It counts assets and creates the next numbered release when the current one reaches 1,000 assets.
- The app accepts files smaller than 2 GiB, matching the GitHub release-asset ceiling.

## Important platform caveat
Render documents a maximum request duration, but does not publish a guaranteed 2 GiB inbound request-body allowance for all plans. Streaming keeps memory use low, but Render's edge/platform limits can still reject a large request. Test with progressively larger files on the chosen plan before relying on 2 GiB uploads.
