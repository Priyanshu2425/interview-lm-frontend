# Code Practices

Comprehensive coding guidelines for the InterviewLM frontend, combining Vercel React performance best practices with our established architecture.

## Table of Contents

- [Project Structure](#project-structure)
- [Import Conventions](#import-conventions)
- [Component Patterns](#component-patterns)
- [State Management](#state-management)
- [Data Fetching](#data-fetching)
- [Performance Optimization](#performance-optimization)
- [Testing](#testing)
- [CSS and Styling](#css-and-styling)
- [Performance Rules Reference](#performance-rules-reference)

---

## Project Structure

```
src/
├── routes/                    # React Router - routing and layout only
│   ├── index.tsx              # Route table; heavy routes lazy
│   └── layouts/               # RootLayout: shell, rail, spend readout
│
├── features/                  # Vertical slices (feature modules)
│   ├── auth/                  # Authentication (login, register, password reset)
│   ├── session-setup/         # Scope, duration, provider selection
│   ├── examination/           # The exchange, composer, closed Visit
│   ├── mastery/               # Corpus map, readings, untested Topics
│   ├── evidence/              # Topic Visit rows, grounding
│   ├── notebook/              # Ingest, Adapter state, upload
│   ├── credits/               # Balance, ledger, BYOK
│   ├── settings/              # Defaults, behavior, appearance, identity
│   └── operator/              # Pool headroom, Provider spend, metering
│
├── shared/                    # Used by two or more features
│   ├── components/            # AppShell, PageHeader, Workbench, ThemeSwitcher
│   ├── hooks/                 # useMediaQuery, useCountdown, useDebounced, useOnEscape
│   ├── stores/                # theme, identity, preferences, session history, toasts
│   ├── types/                 # The /v1 contract, as types
│   └── utils/                 # cn, band mapping, formatters
│
├── ui/                        # Design system primitives
│   ├── styles/                # tokens, system, patterns, shell, auth
│   └── data/                  # Static data (beta.ts)
│
├── lib/                       # Infrastructure
│   ├── api-client.ts          # fetch, ApiError, idempotency key
│   ├── endpoints.ts           # Every path the surface knows
│   ├── query-keys.ts          # Type-safe cache keys
│   ├── services/              # One module per resource
│   └── auth/                  # Gatehouse integration
│
└── test/                      # Test setup
```

### Directory Rules

| Directory | Purpose | Import Rule |
|-----------|---------|-------------|
| `features/*` | Feature modules | Import through `index.ts` barrel only |
| `shared/*` | Cross-feature code | Direct imports allowed |
| `ui/*` | Design primitives | Import from `@/ui`, never from primitive file |
| `lib/*` | Infrastructure | Direct imports allowed |
| `routes/*` | Routing only | No business logic |

---

## Import Conventions

### Feature Barrels (Enforced by ESLint)

```typescript
// ✓ CORRECT: Import through feature barrel
import { LoginScreen } from "@/features/auth";
import { ExaminationScreen } from "@/features/examination";
import { Button, Dialog } from "@/ui";

// ✗ INCORRECT: Import feature internals directly
import { LoginScreen } from "@/features/auth/LoginScreen";
import { Button } from "@/ui/Button";
```

### Path Aliases

```typescript
// Use @/ alias for all src/ imports
import { api } from "@/lib/api-client";
import { useSessionUser } from "@/shared/stores/session";
import { cn } from "@/shared/utils/cn";
```

### Import Order

```typescript
// 1. External packages
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

// 2. Internal shared code
import { PageHeader, Workbench } from "@/shared/components";
import { useDebounced } from "@/shared/hooks";

// 3. UI primitives
import { Button, Skeleton, Tabs } from "@/ui";

// 4. Feature internals (only from within the feature)
import { useExamination } from "./hooks/useExamination";
import { Transcript } from "./components/Transcript";
```

---

## Component Patterns

### Named Function Declarations

```typescript
// ✓ PREFER: Named function declarations
export function MyComponent({ prop1, prop2 }: Props) {
  return <div>{prop1} {prop2}</div>;
}

// ✗ AVOID: Arrow functions assigned to variables
export const MyComponent = ({ prop1, prop2 }: Props) => {
  return <div>{prop1} {prop2}</div>;
};
```

### No Inline Component Definitions

```typescript
// ✗ INCORRECT: Defines component inside component (causes re-mount on every render)
function Parent() {
  const Child = () => <div>...</div>; // Re-created every render
  return <Child />;
}

// ✓ CORRECT: Extract to separate file or define outside
function Child() { return <div>...</div>; }

function Parent() {
  return <Child />;
}
```

### Props Interface Placement

```typescript
// Define Props interface above the component
interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: ReactNode;
}

export function Button({ variant = "secondary", size = "md", loading, children }: ButtonProps) {
  return <button className={`btn btn-${variant} btn-${size}`}>{children}</button>;
}
```

### Refs with forwardRef

```typescript
import type { Ref } from "react";

interface InputProps {
  label: string;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ label, ref }: InputProps) {
  return (
    <label>
      {label}
      <input ref={ref} />
    </label>
  );
}
```

---

## State Management

### Local State (useState)

```typescript
// Simple state
const [isOpen, setIsOpen] = useState(false);
const [count, setCount] = useState(0);

// Complex state object
const [form, setForm] = useState({
  email: "",
  password: "",
  rememberMe: false,
});

// Functional update for state depending on previous state
setCount(prev => prev + 1);
```

### Global State (Zustand)

```typescript
// Define store in shared/stores/
import { create } from "zustand";

interface ThemeStore {
  theme: "light" | "dark";
  toggle: () => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: "light",
  toggle: () => set((state) => ({
    theme: state.theme === "light" ? "dark" : "light",
  })),
}));

// Usage in component
function ThemeToggle() {
  const { theme, toggle } = useThemeStore();
  return <button onClick={toggle}>Current: {theme}</button>;
}
```

### Server State (TanStack Query)

```typescript
// Use query keys from lib/query-keys.ts
import { queryKeys } from "@/lib/query-keys";

// Simple query
const { data, isLoading, error } = useQuery({
  queryKey: queryKeys.session.one(sessionId),
  queryFn: () => sessionService.get(sessionId),
  enabled: Boolean(sessionId),
});

// Mutation
const mutation = useMutation({
  mutationFn: (newTodo: string) => api.request("/todos", { method: "POST", body: { text: newTodo } }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.session.all });
  },
});
```

---

## Data Fetching

### Parallel Queries (async-parallel)

```typescript
// ✗ INCORRECT: Sequential waterfall
const { data: user } = useQuery({ queryKey: ["user"], queryFn: fetchUser });
const { data: posts } = useQuery({
  queryKey: ["posts", user?.id],
  queryFn: () => fetchPosts(user.id),
  enabled: Boolean(user?.id),
});

// ✓ CORRECT: Independent queries run in parallel
const { data: user } = useQuery({ queryKey: ["user"], queryFn: fetchUser });
const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
// Both fetch simultaneously
```

### Dependent Queries

```typescript
// Chain dependent queries with proper enabled flag
const { data: user } = useQuery({
  queryKey: ["user"],
  queryFn: fetchUser,
});

const { data: posts } = useQuery({
  queryKey: ["posts", user?.id],
  queryFn: () => fetchPosts(user.id),
  enabled: Boolean(user?.id), // Only fetch when user is available
});
```

### Prefetching

```typescript
import { useQueryClient } from "@tanstack/react-query";

function UserList() {
  const queryClient = useQueryClient();

  const handleHover = (userId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.user.detail(userId),
      queryFn: () => fetchUser(userId),
      staleTime: 60_000, // 1 minute
    });
  };

  return <div onMouseEnter={() => handleHover("123")}>Hover me</div>;
}
```

---

## Performance Optimization

### Code Splitting (bundle-dynamic-imports)

```typescript
// Route-level code splitting with React.lazy
const SettingsScreen = lazy(() =>
  import("@/features/settings").then((m) => ({ default: m.SettingsScreen }))
);

// Usage with Suspense
<Suspense fallback={<Skeleton />}>
  <SettingsScreen />
</Suspense>
```

### Memoization

```typescript
// useMemo for expensive computations
const sortedData = useMemo(() =>
  data.sort((a, b) => a.value - b.value),
  [data]
);

// useCallback for stable references passed to children
const handleSubmit = useCallback((values: FormValues) => {
  onSubmit(values);
}, [onSubmit]);

// React.memo for pure components
const ExpensiveList = React.memo(function ExpensiveList({ items }: Props) {
  return items.map(item => <Item key={item.id} {...item} />);
});
```

### Lazy State Initialization

```typescript
// ✗ INCORRECT: Expensive computation on every render
function Component() {
  const [state, setState] = useState(expensiveComputation());
}

// ✓ CORRECT: Pass function to useState for lazy initialization
function Component() {
  const [state, setState] = useState(() => expensiveComputation());
}
```

### Avoid Inline Object/Array Literals

```typescript
// ✗ INCORRECT: New reference every render causes re-render
function Parent() {
  return <Child style={{ color: "red" }} />;
}

// ✓ CORRECT: Hoist constant values
const style = { color: "red" };

function Parent() {
  return <Child style={style} />;
}
```

### Use Functional setState

```typescript
// ✗ INCORRECT: Closure over stale state
const handleClick = () => {
  setCount(count + 1);
};

// ✓ CORRECT: Functional update uses latest state
const handleClick = () => {
  setCount(prev => prev + 1);
};
```

---

## Testing

### Test File Placement

```
features/
├── auth/
│   ├── LoginScreen.tsx
│   ├── __tests__/
│   │   └── LoginScreen.test.tsx
│   └── index.ts
```

### Test Patterns

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoginScreen } from "../LoginScreen";

// Helper to wrap components with providers
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe("LoginScreen", () => {
  it("renders login form", () => {
    renderWithProviders(<LoginScreen />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("submits form with valid data", async () => {
    renderWithProviders(<LoginScreen />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      // Assert success behavior
    });
  });
});
```

---

## CSS and Styling

### Using the cn() Utility

```typescript
import { cn } from "@/shared/utils/cn";

// Conditional classes
function Button({ variant, disabled, className }: Props) {
  return (
    <button className={cn(
      "btn",
      `btn-${variant}`,
      disabled && "btn-disabled",
      className
    )}>
      Click me
    </button>
  );
}
```

### CSS Custom Properties

```css
/* Use tokens from ui/styles/tokens.css */
.btn {
  background: var(--color-primary);
  padding: var(--s-2) var(--s-4);
  border-radius: var(--radius-md);
}
```

---

## Performance Rules Reference

### Critical Impact (async-*)

| Rule | Description |
|------|-------------|
| `async-parallel` | Use Promise.all() for independent async operations |
| `async-defer-await` | Move await into branches where actually used |
| `async-suspense-boundaries` | Use Suspense to stream content |

### Critical Impact (bundle-*)

| Rule | Description |
|------|-------------|
| `bundle-dynamic-imports` | Use next/dynamic or React.lazy for heavy components |
| `bundle-barrel-imports` | Import directly, avoid barrel files for tree-shaking |
| `bundle-defer-third-party` | Load analytics/logging after hydration |

### High Impact (server-*)

| Rule | Description |
|------|-------------|
| `server-parallel-fetching` | Restructure components to parallelize fetches |
| `server-hoist-static-io` | Hoist static I/O to module level |

### Medium Impact (rerender-*)

| Rule | Description |
|------|-------------|
| `rerender-no-inline-components` | Don't define components inside components |
| `rerender-memo` | Extract expensive work into memoized components |
| `rerender-functional-setstate` | Use functional setState for stable callbacks |
| `rerender-lazy-state-init` | Pass function to useState for expensive values |
| `rerender-dependencies` | Use primitive dependencies in effects |

### Medium Impact (rendering-*)

| Rule | Description |
|------|-------------|
| `rendering-conditional-render` | Use ternary, not && for conditionals |
| `rendering-hoist-jsx` | Extract static JSX outside components |

### Low-Medium Impact (js-*)

| Rule | Description |
|------|-------------|
| `js-set-map-lookups` | Use Set/Map for O(1) lookups |
| `js-early-exit` | Return early from functions |
| `js-combine-iterations` | Combine multiple filter/map into one loop |

---

## Enforcement

### ESLint Rules (Already Configured)

- `no-restricted-imports`: Enforces barrel imports for features and UI
- `react-hooks/rules-of-hooks`: Ensures proper hook usage
- `react-refresh/only-export-components`: Validates component exports

### PR Checklist

- [ ] No inline component definitions
- [ ] Expensive computations memoized
- [ ] Queries properly parallelized where applicable
- [ ] Tests colocated with feature
- [ ] Import order followed
- [ ] No direct imports from feature internals

---

## References

- [Vercel React Best Practices](https://github.com/vercel/react-best-practices)
- [TanStack Query Docs](https://tanstack.com/query)
- [Zustand Docs](https://docs.pmnd.rs/zustand)
