# Playwright Triage Dashboard

**ALWAYS follow these instructions first and only fallback to additional search and context gathering if the information here is incomplete or found to be in error.**

The Playwright Triage Dashboard is an Astro web application that displays GitHub issues and pull requests in a triage view. It shows issues and PRs sorted by priority (requiring attention, stale) to help maintainers efficiently triage GitHub repositories.

## Working Effectively

### Bootstrap and Build
- Install Node.js (tested with Node 22): The repository uses Node.js modules and npm.
- Clone the repository and navigate to it
- `npm ci` -- installs dependencies. Takes ~4 seconds. NEVER CANCEL.
- `npm audit fix` -- fixes security vulnerabilities. Takes ~10-15 seconds. NEVER CANCEL.
- `npm run build` -- builds the application for production. Takes ~4 seconds. NEVER CANCEL.

### GitHub Authentication Setup
**CRITICAL**: The application requires GitHub API access to function. Choose ONE method:

#### Method 1: Environment Variable (Recommended)
- Create a `.env` file in the project root
- Add `GITHUB_TOKEN=your_github_token_here` where the token has `repo` scope
- The token is needed to access GitHub's GraphQL API to fetch issues and pull requests

#### Method 2: GitHub CLI (Alternative)
- Install and authenticate with GitHub CLI: `gh auth login`
- The application will automatically use `gh auth token` if no GITHUB_TOKEN environment variable is found

### Run the Application
- **Development**: `npm run dev` -- starts development server at http://localhost:4321/. NEVER CANCEL. Server starts in ~0.2 seconds.
- **Production Preview**: `npm run preview` -- **DOES NOT WORK** with the Netlify adapter. Document this limitation.
- **Build Output**: The build creates files in `/dist/` directory for Netlify deployment.

### Important Timing and Cancellation Warnings
- **npm ci**: 4 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
- **npm run build**: 4 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
- **npm run dev**: Server ready in 0.2 seconds. NEVER CANCEL when testing. Set timeout to 30+ seconds for startup.
- **npm audit fix**: 10-15 seconds. NEVER CANCEL. Set timeout to 60+ seconds.

## Validation and Testing

### Manual Validation Requirements
After making any changes, ALWAYS run through this complete scenario:
1. Ensure GitHub authentication is properly configured (.env file with valid token OR gh CLI authenticated)
2. `npm ci && npm run build` -- verify no build errors
3. `npm run dev` -- start the development server
4. Navigate to http://localhost:4321/ in a browser
5. **Expected behavior with valid GitHub token**: Page displays "ISSUES" and "PULL REQUESTS" sections with GitHub data
6. **Expected behavior with invalid/missing token**: Page shows error message about authentication or rate limits
7. **Expected behavior in restricted environments**: May show "Blocked by DNS monitoring proxy" error due to network restrictions

### Error Handling Validation
- **500 Error Page**: Located at `src/pages/500.astro`, handles API errors and rate limits
- **Rate Limit Handling**: Shows friendly message with reset time when GitHub API rate limit is hit
- **Authentication Errors**: Properly displays when GitHub token is missing or invalid

### Application Functionality
- **Main Page**: `src/pages/index.astro` - displays issues and pull requests
- **Ticket Component**: `src/components/Ticket.astro` - renders individual issues/PRs
- **Data Logic**: `src/utils.ts` - contains GitHub API calls and business logic for determining attention/stale status
- **Sorting**: Issues and PRs are sorted by priority (attention required, stale status)
- **Visual Indicators**: Color coding for maintainer comments (green), attention required (red), stale (brown)

## Repository Structure and Key Files

### Core Application Files
```
src/
├── pages/
│   ├── index.astro          # Main dashboard page
│   └── 500.astro           # Error page (handles rate limits, auth errors)
├── components/
│   └── Ticket.astro        # Individual issue/PR component
└── utils.ts                # GitHub API calls and business logic
```

### Configuration Files
- `package.json` -- dependencies and scripts
- `astro.config.mjs` -- Astro configuration with Netlify adapter
- `tsconfig.json` -- TypeScript configuration
- `.env` -- GitHub token (create this file)

### GitHub Workflows
- `.github/workflows/claude.yml` -- Claude integration for PR comments
- `.github/workflows/visual-review.yml` -- Visual review automation

### Business Logic (src/utils.ts)
- `isMaintainer()` -- checks if user is a maintainer
- `requiresAttention()` -- determines if ticket needs maintainer attention  
- `isStale()` -- checks if ticket is stale (>3 business days since last comment)
- `getData()` -- fetches issues and PRs from GitHub GraphQL API

## Common Workflows

### Making Changes to the Dashboard
1. Always start with: `npm ci && npm run build` to ensure clean state
2. Make your changes to the relevant files:
   - UI changes: `src/pages/index.astro` or `src/components/Ticket.astro`
   - Business logic: `src/utils.ts`
   - Error handling: `src/pages/500.astro`
3. Test locally: `npm run dev` and verify at http://localhost:4321/
4. Always test with both valid and invalid GitHub tokens to verify error handling
5. Build again: `npm run build` to ensure no build errors

### Adding New GitHub Data Fields
- Modify the GraphQL query in `src/utils.ts` `getData()` function
- Update the `Ticket` interface to include new fields
- Update `src/components/Ticket.astro` to display new data
- Test with real GitHub data to ensure API changes work

### Debugging GitHub API Issues
- Check `.env` file has valid GITHUB_TOKEN
- Verify token has `repo` scope for private repositories  
- Use GitHub CLI: `gh auth status` to check authentication
- Check server logs in terminal running `npm run dev` for API errors
- Rate limit errors are handled gracefully in `src/pages/500.astro`

## CI/CD and Deployment

### GitHub Actions
- The repository uses Claude-powered automation for PR reviews
- Visual review workflow runs on PR changes
- Build process: Node.js 22, npm ci, npm run dev (for testing)
- **GitHub Secrets Required**: `ANTHROPIC_API_KEY`, `TOKEN_GITHUB`

### Netlify Deployment
- Application is configured for Netlify deployment via `@astrojs/netlify` adapter
- Build command: `npm run build`
- Publish directory: `dist/`
- **Environment Variables**: Requires `GITHUB_TOKEN` to be set in Netlify environment

## Troubleshooting

### Common Issues
- **"No oauth token found"**: Set up GitHub authentication (see Authentication Setup)
- **"Blocked by DNS monitoring proxy"**: Network restrictions prevent GitHub API access (expected in some environments)
- **"npm run preview" fails**: This is expected with Netlify adapter; use `npm run dev` instead
- **500 errors**: Check GitHub token validity and network connectivity
- **Build failures**: Run `npm audit fix` to resolve dependency vulnerabilities

### Performance Notes
- Application is very fast: builds in ~4 seconds, starts in ~0.2 seconds
- GitHub API rate limits: 5000 requests/hour for authenticated users
- No caching implemented - each page load hits GitHub API
- SSR application - requires server environment for GitHub API calls