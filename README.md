# Praxis

## GitHub Pages Deployment

This repository includes a GitHub Actions workflow at [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) that deploys the Vite build to GitHub Pages.

- Trigger: push to `main` (or manual run from Actions tab)
- Build command: `npm run build -- --base "/<repo-name>/"`
- Artifact: `dist/` (with `404.html` copied from `index.html` for SPA routing fallback)

### One-time repository setup

1. Open your repository on GitHub.
2. Go to `Settings` → `Pages`.
3. Set **Source** to **GitHub Actions**.

After that, every push to `main` publishes an updated site.
