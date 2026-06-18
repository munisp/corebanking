# Contributing to 54Bank

## Development Setup

```bash
# Clone and install
git clone https://github.com/munisp/NGApp.git
cd NGApp
pnpm install

# Start database
docker-compose up -d postgres redis

# Run migrations
pnpm drizzle-kit push

# Start dev server
pnpm run dev
```

## Branch Naming

- `feature/` — new features
- `fix/` — bug fixes
- `docs/` — documentation
- `refactor/` — code improvements
- `test/` — test additions

## Commit Messages

Follow Conventional Commits:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `test:` test changes
- `refactor:` code refactoring
- `ci:` CI/CD changes

## Pull Request Process

1. Create a feature branch from `main`
2. Write tests for new functionality
3. Ensure all CI checks pass (7/7)
4. Request review from at least one team member
5. Squash and merge when approved

## Code Style

- TypeScript: Follow existing patterns in `server/lib/`
- Go: `gofmt` + stdlib-only where possible
- Rust: `cargo fmt` + `cargo clippy`
- Python: PEP 8 + type hints

## Testing

```bash
# Unit tests
pnpm test

# Lint + typecheck
pnpm run lint
pnpm run typecheck

# E2E tests
npx playwright test
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design.
