# Workspace

A TypeScript monorepo managed with [pnpm](https://pnpm.io/) workspaces.

![License](https://img.shields.io/badge/license-MIT-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)
![pnpm](https://img.shields.io/badge/package%20manager-pnpm-orange.svg)

## Overview

This repository is a pnpm monorepo that holds multiple apps (`artifacts/`), shared TypeScript libraries, and helper scripts in a single workspace. All packages are type-checked together, so changes stay consistent across the whole codebase.

> Add a short description of what your project does here.

## Tech Stack

- **Language:** TypeScript
- **Package manager:** pnpm (workspaces)
- **Integrations:** [`@replit/connectors-sdk`](https://www.npmjs.com/package/@replit/connectors-sdk)
- **Formatting:** Prettier

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [pnpm](https://pnpm.io/installation)

> **Note:** This project only supports **pnpm**. Running `npm install` or `yarn install` will fail on purpose.

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>

# 2. Install dependencies
pnpm install

# 3. Build the project
pnpm run build
```

## Available Scripts

| Command | Description |
| --- | --- |
| `pnpm run build` | Type-checks everything, then runs `build` in every package that has one. |
| `pnpm run typecheck` | Type-checks shared libraries, then all packages in `artifacts/` and `scripts/`. |
| `pnpm run typecheck:libs` | Builds shared libraries using TypeScript project references. |

## Project Structure

```text
.
├── artifacts/      # Apps and deployable packages
├── scripts/        # Utility and automation scripts
├── package.json    # Root workspace configuration
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

## License

This project is licensed under the [MIT License](LICENSE).<img width="1254" height="1254" alt="ChatGPT Image Oct 6, 2026, 11_07_19 AM" src="https://github.com/user-attachments/assets/15ec9ac4-1857-40ec-a68f-d448e349ca3e" />
