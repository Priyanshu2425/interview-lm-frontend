# Plan: CODE_PRACTICES.md and Codebase Alignment

## Current Codebase Analysis

### Structure Summary
The codebase already follows a **feature-based architecture** which is excellent:
- `src/features/` - 9 feature modules (auth, credits, examination, evidence, mastery, notebook, operator, session-setup, settings)
- `src/shared/` - Components, hooks, stores, types, utils shared across features
- `src/ui/` - Design system primitives with CSS tokens
- `src/lib/` - Infrastructure (API client, services, query keys, auth)
- `src/routes/` - React Router configuration

### Strengths Already in Place
1. **Feature barrel exports** - ESLint enforces imports through `index.ts` (line 28-38 in eslint.config.js)
2. **Lazy loading** - Credits, Settings, Operator use `React.lazy()` for code splitting
3. **Design system** - `src/ui/` with barrel export prevents direct primitive imports
4. **Type-safe query keys** - Centralized in `src/lib/query-keys.ts`
5. **Custom hooks** - Shared hooks in `src/shared/hooks/`
6. **Zustand stores** - Lightweight state management in `src/shared/stores/`
7. **API client with auth** - Automatic token refresh and retry in `src/lib/api-client.ts`

### Areas for Improvement (Based on Vercel React Best Practices)

| Category | Current State | Recommendation |
|----------|---------------|----------------|
| **Waterfalls** | Sequential queries in some features | Apply `async-parallel` with `Promise.all()` |
| **Bundle Size** | Good lazy loading, but barrel imports in `@/ui` | Consider direct imports for tree-shaking |
| **Server Components** | N/A (SPA) | Not applicable |
| **Client Data Fetching** | TanStack Query used | Already good, ensure deduplication |
| **Re-renders** | Some inline component definitions | Apply `rerender-no-inline-components` |
| **Memoization** | Limited use | Add `useMemo`/`useCallback` for expensive computations |

---

## CODE_PRACTICES.md Content Plan

### 1. Project Structure (Customize for This Codebase)

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

### 2. Import Conventions (Already Enforced)

```typescript
// CORRECT: Import through feature barrel
import { LoginScreen } from "@/features/auth";
import { Button, Dialog } from "@/ui";

// INCORRECT: Import feature internals directly
import { LoginScreen } from "@/features/auth/LoginScreen";
import { Button } from "@/ui/Button";
```

### 3. Component Patterns

#### 3.1 Component Definition
```typescript
// PREFER: Named function declarations
export function MyComponent({ prop1, prop2 }: Props) {
  return <div>...</div>;
}

// AVOID: Arrow functions assigned to variables
export const MyComponent = ({ prop1, prop2 }: Props) => {
  return <div>...</div>;
};
```

#### 3.2 Avoid Inline Component Definitions
```typescript
// INCORRECT: Defines component inside component (causes re-mount)
function Parent() {
  const Child = () => <div>...</div>; // BAD: re-created every render
  return <Child />;
}

// CORRECT: Extract to separate file or define outside
function Child() { return <div>...</div>; }
function Parent() { return <Child />; }
```

#### 3.3 Memoization Guidelines
```typescript
// Use useMemo for expensive computations
const sortedData = useMemo(() => 
  data.sort((a, b) => a.value - b.value), 
  [data]
);

// Use useCallback for stable references passed to children
const handleSubmit = useCallback((values: FormValues) => {
  // ...
}, [dependency]);

// Use React.memo for pure components that receive same props often
const ExpensiveList = React.memo(function ExpensiveList({ items }: Props) {
  return items.map(item => <Item key={item.id} {...item} />);
});
```

### 4. State Management

#### 4.1 Local State
```typescript
// Use useState for simple state
const [isOpen, setIsOpen] = useState(false);

// Use useReducer for complex state logic
const [state, dispatch] = useReducer(reducer, initialState);
```

#### 4.2 Global State (Zustand)
```typescript
// Define store in shared/stores/
import { create } from 'zustand';

interface ThemeStore {
  theme: 'light' | 'dark';
  toggle: () => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: 'light',
  toggle: () => set((state) => ({ 
    theme: state.theme === 'light' ? 'dark' : 'light' 
  })),
}));
```

#### 4.3 Server State (TanStack Query)
```typescript
// Use query keys from lib/query-keys.ts
import { queryKeys } from "@/lib/query-keys";

const { data, isLoading } = useQuery({
  queryKey: queryKeys.session.one(sessionId),
  queryFn: () => sessionService.get(sessionId),
  enabled: Boolean(sessionId),
});
```

### 5. Data Fetching Patterns

#### 5.1 Parallel Queries (async-parallel)
```typescript
// INCORRECT: Sequential waterfall
const { data: user } = useQuery({ queryKey: ['user'], queryFn: fetchUser });
const { data: posts } = useQuery({ 
  queryKey: ['posts', user?.id], 
  queryFn: () => fetchPosts(user.id),
  enabled: Boolean(user?.id)
});

// CORRECT: Parallel independent queries
const { data: user } = useQuery({ queryKey: ['user'], queryFn: fetchUser });
const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
// These two run in parallel
```

#### 5.2 Dependent Queries
```typescript
// CORRECT: Chain dependent queries properly
const { data: user } = useQuery({ queryKey: ['user'], queryFn: fetchUser });

const { data: posts } = useQuery({
  queryKey: ['posts', user?.id],
  queryFn: () => fetchPosts(user.id),
  enabled: Boolean(user?.id), // Only fetch when user is available
});
```

### 6. Performance Optimization

#### 6.1 Code Splitting
```typescript
// Use React.lazy for route-level code splitting
const SettingsScreen = lazy(() =>
  import("@/features/settings").then((m) => ({ default: m.SettingsScreen }))
);

// Wrap with Suspense
<Suspense fallback={<Skeleton />}>
  <SettingsScreen />
</Suspense>
```

#### 6.2 Dynamic Imports for Heavy Components
```typescript
// Load heavy chart libraries only when needed
const HeavyChart = lazy(() => import('./HeavyChart'));

function Dashboard() {
  const [showChart, setShowChart] = useState(false);
  
  return (
    <div>
      <button onClick={() => setShowChart(true)}>Show Chart</button>
      {showChart && (
        <Suspense fallback={<Skeleton />}>
          <HeavyChart />
        </Suspense>
      )}
    </div>
  );
}
```

#### 6.3 Preventing Unnecessary Re-renders
```typescript
// Use React.memo for pure components
const DataRow = React.memo(function DataRow({ item, onSelect }: Props) {
  return (
    <tr onClick={() => onSelect(item.id)}>
      <td>{item.name}</td>
    </tr>
  );
});

// Use useMemo for expensive calculations
const filteredItems = useMemo(() => 
  items.filter(item => item.matches(filter)),
  [items, filter]
);

// Use useCallback for event handlers passed to children
const handleSelect = useCallback((id: string) => {
  setSelected(id);
}, []);
```

### 7. Testing Patterns

```typescript
// Unit tests colocated with feature
// features/auth/__tests__/LoginScreen.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { LoginScreen } from '../LoginScreen';

describe('LoginScreen', () => {
  it('renders login form', () => {
    render(<LoginScreen />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
```

### 8. CSS and Styling

```typescript
// Use cn() utility for conditional classes
import { cn } from "@/shared/utils/cn";

function Button({ variant, disabled, className }: Props) {
  return (
    <button className={cn(
      'btn',
      `btn-${variant}`,
      disabled && 'btn-disabled',
      className
    )}>
      ...
    </button>
  );
}
```

---

## Migration Plan

### Phase 1: Documentation (Immediate)
1. Create `CODE_PRACTICES.md` with guidelines from this plan
2. Update `README.md` to reference the new practices document

### Phase 2: Code Quality (1-2 days)
1. **Audit re-render issues**
   - Search for inline component definitions
   - Add `React.memo` to frequently re-rendered components
   - Add `useMemo`/`useCallback` where beneficial

2. **Optimize data fetching**
   - Review all `useQuery` calls for parallelization opportunities
   - Ensure proper `enabled` flags on dependent queries

### Phase 3: Bundle Optimization (1 day)
1. **Review barrel imports**
   - Check if `@/ui` barrel is causing bundle bloat
   - Consider direct imports for tree-shaking if needed

2. **Add dynamic imports**
   - Identify heavy components not yet lazy loaded
   - Add `React.lazy()` for below-the-fold content

### Phase 4: Enforce Practices (Ongoing)
1. **Add ESLint rules** for:
   - `react/no-inline-styles` (if desired)
   - Custom rule for component definition style
   - `react-hooks/rules-of-hooks` (already enabled)

2. **PR checklist** to include:
   - [ ] No inline component definitions
   - [ ] Expensive computations memoized
   - [ ] Queries properly parallelized
   - [ ] Tests colocated with feature

---

## Specific Recommendations for This Codebase

### 1. Examination Screen (High Priority)
The `ExaminationScreen.tsx` is the most complex component. Recommendations:
- Extract `NoSessionYet` to a separate file (line 291-333)
- Memoize `PANES` constant (line 27-31) - already outside component, good
- Consider splitting the 333-line component into smaller pieces

### 2. Shared Hooks
Already well-structured. Consider adding:
- `useMediaQuery` for responsive behavior (already exists)
- `useIntersectionObserver` for lazy loading
- `useLocalStorage` for persistent preferences

### 3. Store Patterns
Zustand stores in `src/shared/stores/` are clean. Ensure:
- Selectors use shallow comparison when needed
- Actions are defined inside the store, not outside

### 4. Service Layer
`src/lib/services/` is well-organized. Consider:
- Adding request/response types for each service method
- Using TypeScript generics for type-safe API calls

---

## Success Metrics

After implementation, verify:
1. **Bundle size**: Should decrease or stay same (no increase)
2. **Lighthouse score**: Performance should improve
3. **Re-render count**: Should decrease in React DevTools Profiler
4. **Test coverage**: Should maintain or improve
5. **Developer experience**: Import patterns remain consistent
