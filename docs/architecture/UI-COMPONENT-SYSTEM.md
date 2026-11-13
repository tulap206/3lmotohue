# UI Component System (dashboard)

Design Read: *operational rental admin, Linear/Notion-clean, density medium, cobalt accent.*

## Kiến trúc

```
components/ui/*              → shadcn primitives (Dialog, Button, …)
components/dashboard/
  module-shell.tsx           → layout KPI / empty / async / table / pagination
  rental-ui.tsx              → RentalKpiCard, table head tokens
  *-dialog.tsx               → feature dialogs
```

## Props / API chính

| Component | Props thenói |
|-----------|-------------|
| `ModulePageShell` | `module`, `children` |
| `ModuleKpiGrid` | `columns`, children KPI |
| `ModuleEmptyState` | `title`, `description`, `action` |
| `ModuleLoadingState` | `label` (sr-only) |
| `ModuleAsyncBoundary` | `loading` \| `error` \| `empty` → children |
| `ModuleResponsiveTable` | desktop table + mobile cards |

## Best practices

1. Touch target ≥44px (`h-11`).  
2. Dùng `.text-display|title|body|label|meta` + `.money`.  
3. Loading / empty / error trước khi render bảng.  
4. Không card trong hero marketing; dashboard KPI là interaction containers — OK.  
5. Responsive: `ModuleResponsiveTable` + `ModuleMobileCard`.

## Ví dụ

```tsx
<ModuleAsyncBoundary
  loading={loading}
  empty={logs.length === 0}
  emptyTitle="Chưa có lịch sử"
  emptyDescription="Thao tác trên hệ thống sẽ hiện tại đây."
>
  <AccessHistoryModuleSection … />
</ModuleAsyncBoundary>
```
