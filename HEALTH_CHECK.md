# 3L Moto Health Check Guide

## 📋 Overview

This health check suite automatically validates:

✅ Supabase Connection
✅ All Required Tables Exist
✅ Data Integrity (customers, vehicles, rentals, transactions)
✅ Rental Calculations (revenue, totalPrice)
✅ Vehicle Data Validation (required fields, images)
✅ Customer Data Validation (required fields, photos)
✅ Date Formats (DD/MM/YYYY for rentals, ISO 8601 for timestamps)
✅ Access Logs

---

## 🚀 How to Run Health Check

### Option 1: From Browser (Recommended)

1. **Deploy to Vercel**
2. **Access your app:** https://your-domain.vercel.app
3. **The app will connect to Supabase** from the browser environment

⚠️ The command-line health check won't work from development machine due to Supabase network restrictions.

### Option 2: Custom Health Check Script

Create a simple Next.js API route to run health checks:

```typescript
// app/api/health-check/route.ts
import { fetchCustomers, fetchVehicles, fetchRentals, fetchTransactions } from '@/lib/supabase'

export async function GET() {
  const tests = {
    customers: await fetchCustomers(),
    vehicles: await fetchVehicles(),
    rentals: await fetchRentals(),
    transactions: await fetchTransactions(),
  }
  
  return Response.json({
    status: 'OK',
    timestamp: new Date(),
    tests
  })
}
```

Then access: `https://your-domain/api/health-check`

---

## ✅ Expected Results

### Before Production - MUST HAVE:

```
✅ PASSED:  8+/12
❌ FAILED:  0
⚠️  WARNINGS: 0-2 (acceptable)
```

### Critical Checks:

1. **Supabase Connection** → Must PASS ✅
2. **All Tables Exist** → Must PASS ✅
3. **Data Integrity** → Must PASS ✅
4. **Rental Calculations** → Must PASS ✅

### Warning OK:

- Access logs (if table doesn't exist yet)
- No data in transactions (if new feature)
- No vehicles/customers (if fresh start)

---

## 🔧 Manual Pre-Deployment Checklist

Before going live, manually check:

### 1. **Authentication**
   - [ ] Login with admin account works
   - [ ] Logout works
   - [ ] Permissions correct for staff/admin

### 2. **Customers Page**
   - [ ] Load customers list
   - [ ] Create new customer
   - [ ] Edit customer
   - [ ] Delete customer (with confirmation)
   - [ ] Upload customer photos
   - [ ] View customer details

### 3. **Vehicles Page**
   - [ ] Load vehicles list
   - [ ] Create new vehicle
   - [ ] Edit vehicle
   - [ ] View vehicle history
   - [ ] Upload vehicle images
   - [ ] Check status (active, maintenance, sold)

### 4. **Orders Page**
   - [ ] Load rentals list
   - [ ] Create new rental
   - [ ] Edit rental
   - [ ] Update rental status (pending → active → completed)
   - [ ] Search by rental code or customer name
   - [ ] View order details

### 5. **Reports Page**
   - [ ] Monthly revenue chart displays data
   - [ ] Top vehicles shows correct ranking
   - [ ] Stats cards show correct numbers
   - [ ] Transaction table works
   - [ ] Add transaction (income/expense)
   - [ ] Summary section calculates correctly
   - [ ] Doanh thu = Rental + Income
   - [ ] Lợi nhuận = Rental only
   - [ ] Tiền hiện có = Correct formula

### 6. **Dashboard (Tổng quan)**
   - [ ] Stats cards update correctly
   - [ ] Recent orders display
   - [ ] Top vehicles show correct data
   - [ ] Numbers match reports page

### 7. **Access History**
   - [ ] User actions are logged
   - [ ] Can view action history
   - [ ] Timestamps are correct

### 8. **Multi-Device Test**
   - [ ] Data sync across devices
   - [ ] Same numbers on different computers
   - [ ] Changes appear in real-time

---

## 🚨 If Tests Fail

### "Host not in allowlist"
- This is expected when running from command line
- The app will work fine from the browser
- This is a Supabase security restriction

### "Table missing"
- Create table in Supabase
- Run SQL: `CREATE TABLE transactions (...)`

### Calculation Issues
- Check revenue field is populated
- Verify status is 'completed'
- Check totalPrice calculation

### Data Missing
- Empty database is OK
- Add test data manually
- Or import from backup

---

## 📊 Production Deployment Checklist

- [ ] All health checks pass
- [ ] Manual checklist complete
- [ ] Test data cleared/cleaned
- [ ] Backup created
- [ ] Error logging configured
- [ ] User roles tested
- [ ] Multi-user access tested
- [ ] Images upload working
- [ ] Reports calculations verified
- [ ] Transactions sync working
- [ ] Access logs capturing data
- [ ] Mobile responsive tested
- [ ] Performance acceptable

---

## 🎯 Ready for Production?

✅ **YES** if:
- All critical tests pass
- All manual checks complete
- No error messages in console
- Data displays correctly
- Calculations accurate
- Multi-device sync working

❌ **NO** if:
- Any critical test fails
- Data missing or incorrect
- Calculations off
- Charts show no data
- Errors in browser console

---

## 📞 Support

If issues persist:

1. Check Supabase database status
2. Verify tables have data
3. Check RLS policies allow access
4. Review browser console for errors
5. Check network tab for API failures

---

**Last Updated:** May 20, 2026
**Version:** 1.0.0
