# Clean Architecture — refactor giữ hành vi

## Phân tích

| Lớp | Hiện tại | Sau wave này |
|-----|----------|--------------|
| UI | God pages | Vẫn page lớn, gọi use-case |
| Application | Công thức trong page | `lib/domain/finance/report-kpis.ts` |
| Domain helpers | `transaction-finance`, `cash-on-hand` | Không đổi |
| Infra | `lib/supabase.ts` | Chưa tách repository |

## Cấu trúc thư mục mới (đã có)

```
lib/
  finance/           # primitives quỹ
  domain/
    finance/
      report-kpis.ts # use-case kỳ lọc + KPI
    README.md
  debounce.ts
docs/architecture/
```

## Cải tiến chính

1. Tách `getPeriodDateRange` + filter + KPI ra domain — test/reuse được.
2. Reports page dùng `calcReportFinanceKpis` thay vì copy công thức.
3. Quỹ vẫn all-time trong use-case (không tái diễn bug kỳ lọc).

## Nguyên tắc

- Không đổi UI copy/UX.
- Một use-case / PR.
- Không migration DB trong bước này.
