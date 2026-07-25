# Agent Guidelines for ui-dojo

## Commands

- Build: `pnpm run vite:build` (TypeScript compilation + Vite build)
- Lint: `pnpm run lint`
- Format: `pnpm run format`
- Dev: `pnpm run dev` (runs both Mastra and Vite in parallel)
- No test suite configured

## Code Style

- **Imports**: Use `@/*` path alias for src imports (e.g., `@/components/ui/button`)
- **Types**: Prefer `type` over `interface`; use TypeScript strict mode
- **Components**: Use functional components with typed props; extract prop types (e.g., `MessageProps`)
- **Formatting**: Prettier with default config; double quotes for strings
- **Class Names**: Use `cn()` utility from `@/lib/utils` to merge Tailwind classes with clsx
- **Variants**: Use `class-variance-authority` (cva) for component variants
- **Naming**: PascalCase for components, camelCase for functions/variables, kebab-case for files
- **React**: Extract reusable UI into `/components/ui`, AI components into `/components/ai-elements`
- **Mastra**: Agents in `/mastra/agents`, tools in `/mastra/tools`, workflows in `/mastra/workflows`
- **Error Handling**: No specific pattern observed; use standard try/catch
- **Exports**: Named exports for components and utilities
