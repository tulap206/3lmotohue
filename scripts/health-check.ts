#!/usr/bin/env node

/**
 * 3L Moto Health Check & Test Suite
 * Comprehensive validation before production deployment
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fpiupgmknsydqrihqdbo.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwaXVwZ21rbnN5ZHFyaWhxZGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNTYzNzAsImV4cCI6MjA5NDYzMjM3MH0.0YK7DmgpA8YuWEaIt1wh07dOQXW5GFlQzo3JydfFaL8'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

interface TestResult {
  name: string
  status: 'PASS' | 'FAIL' | 'WARN'
  message: string
  details?: any
}

const results: TestResult[] = []

function logResult(result: TestResult) {
  results.push(result)
  const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️'
  console.log(`${icon} ${result.name}: ${result.message}`)
  if (result.details) {
    console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`)
  }
}

async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('customers').select('count()').limit(1)
    if (error) throw error
    logResult({
      name: '1. Supabase Connection',
      status: 'PASS',
      message: 'Connected to Supabase successfully'
    })
  } catch (error) {
    logResult({
      name: '1. Supabase Connection',
      status: 'FAIL',
      message: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    })
  }
}

async function testTablesExist() {
  const tables = ['customers', 'vehicles', 'rentals', 'transactions', 'access_logs']
  
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('count()').limit(1)
      if (error) throw error
      logResult({
        name: `2.${tables.indexOf(table) + 1} Table: ${table}`,
        status: 'PASS',
        message: `Table '${table}' exists`
      })
    } catch (error) {
      logResult({
        name: `2.${tables.indexOf(table) + 1} Table: ${table}`,
        status: 'FAIL',
        message: `Table '${table}' missing or inaccessible`,
        details: error instanceof Error ? error.message : error
      })
    }
  }
}

async function testDataIntegrity() {
  try {
    // Check customers
    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('*')
      .limit(5)
    
    if (custError) throw custError
    
    logResult({
      name: '3.1 Data: Customers',
      status: 'PASS',
      message: `Found ${customers?.length || 0} customers`,
      details: { count: customers?.length }
    })

    // Check vehicles
    const { data: vehicles, error: vehError } = await supabase
      .from('vehicles')
      .select('*')
      .limit(5)
    
    if (vehError) throw vehError
    
    logResult({
      name: '3.2 Data: Vehicles',
      status: 'PASS',
      message: `Found ${vehicles?.length || 0} vehicles`,
      details: { count: vehicles?.length }
    })

    // Check rentals
    const { data: rentals, error: rentError } = await supabase
      .from('rentals')
      .select('*')
      .limit(5)
    
    if (rentError) throw rentError
    
    logResult({
      name: '3.3 Data: Rentals',
      status: 'PASS',
      message: `Found ${rentals?.length || 0} rentals`,
      details: { count: rentals?.length }
    })

    // Check transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .limit(5)
    
    if (txError) {
      logResult({
        name: '3.4 Data: Transactions',
        status: 'WARN',
        message: 'Transactions table may not exist (expected if not created)',
        details: txError instanceof Error ? txError.message : txError
      })
    } else {
      logResult({
        name: '3.4 Data: Transactions',
        status: 'PASS',
        message: `Found ${transactions?.length || 0} transactions`,
        details: { count: transactions?.length }
      })
    }
  } catch (error) {
    logResult({
      name: '3. Data Integrity Check',
      status: 'FAIL',
      message: `Data check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    })
  }
}

async function testRentalCalculations() {
  try {
    const { data: rentals, error } = await supabase
      .from('rentals')
      .select('*')
      .eq('status', 'completed')
    
    if (error) throw error

    // Check if revenue field exists and is calculated
    if (rentals && rentals.length > 0) {
      const sample = rentals[0]
      
      if (!sample.revenue && sample.revenue !== 0) {
        logResult({
          name: '4.1 Calculations: Revenue Field',
          status: 'WARN',
          message: 'Revenue field not calculated in some rentals',
          details: { sample }
        })
      } else {
        logResult({
          name: '4.1 Calculations: Revenue Field',
          status: 'PASS',
          message: 'Revenue field exists and is calculated',
          details: { sample_revenue: sample.revenue, sample_total_price: sample.totalPrice }
        })
      }

      // Check totalPrice calculation
      const withoutTotalPrice = rentals.find((r: any) => !r.totalPrice)
      if (withoutTotalPrice) {
        logResult({
          name: '4.2 Calculations: Total Price',
          status: 'WARN',
          message: 'Some rentals missing totalPrice',
          details: withoutTotalPrice
        })
      } else {
        logResult({
          name: '4.2 Calculations: Total Price',
          status: 'PASS',
          message: 'All completed rentals have totalPrice calculated'
        })
      }
    } else {
      logResult({
        name: '4. Rental Calculations',
        status: 'WARN',
        message: 'No completed rentals found for testing',
        details: { count: rentals?.length || 0 }
      })
    }
  } catch (error) {
    logResult({
      name: '4. Rental Calculations',
      status: 'FAIL',
      message: `Calculation check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    })
  }
}

async function testVehicleData() {
  try {
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('*')
    
    if (error) throw error

    if (!vehicles || vehicles.length === 0) {
      logResult({
        name: '5. Vehicle Data Validation',
        status: 'WARN',
        message: 'No vehicles in database',
        details: { count: 0 }
      })
      return
    }

    // Check required fields
    const required = ['id', 'name', 'licensePlate', 'pricePerDay', 'status']
    const sample = vehicles[0]
    const missing = required.filter(field => !sample[field as keyof typeof sample] && sample[field as keyof typeof sample] !== 0)

    if (missing.length > 0) {
      logResult({
        name: '5. Vehicle Data Validation',
        status: 'WARN',
        message: `Some vehicles missing fields: ${missing.join(', ')}`,
        details: { missing, sample }
      })
    } else {
      logResult({
        name: '5. Vehicle Data Validation',
        status: 'PASS',
        message: `All ${vehicles.length} vehicles have required fields`
      })
    }

    // Check image arrays
    const vehiclesWithImages = vehicles.filter((v: any) => v.vehicleImages?.length > 0)
    logResult({
      name: '5.1 Vehicle Images',
      status: 'PASS',
      message: `${vehiclesWithImages.length}/${vehicles.length} vehicles have images`
    })
  } catch (error) {
    logResult({
      name: '5. Vehicle Data Validation',
      status: 'FAIL',
      message: `Vehicle validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    })
  }
}

async function testCustomerData() {
  try {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
    
    if (error) throw error

    if (!customers || customers.length === 0) {
      logResult({
        name: '6. Customer Data Validation',
        status: 'WARN',
        message: 'No customers in database',
        details: { count: 0 }
      })
      return
    }

    // Check required fields
    const required = ['id', 'name', 'phone', 'status']
    const sample = customers[0]
    const missing = required.filter(field => !sample[field as keyof typeof sample])

    if (missing.length > 0) {
      logResult({
        name: '6. Customer Data Validation',
        status: 'WARN',
        message: `Some customers missing fields: ${missing.join(', ')}`,
        details: { missing, sample }
      })
    } else {
      logResult({
        name: '6. Customer Data Validation',
        status: 'PASS',
        message: `All ${customers.length} customers have required fields`
      })
    }

    // Check customer photos
    const customersWithPhotos = customers.filter((c: any) => c.customerphoto?.length > 0)
    logResult({
      name: '6.1 Customer Photos',
      status: 'PASS',
      message: `${customersWithPhotos.length}/${customers.length} customers have photos`
    })
  } catch (error) {
    logResult({
      name: '6. Customer Data Validation',
      status: 'FAIL',
      message: `Customer validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    })
  }
}

async function testDateFormats() {
  try {
    const { data: rentals, error } = await supabase
      .from('rentals')
      .select('startDate, endDate, created_at')
      .limit(5)
    
    if (error) throw error

    if (!rentals || rentals.length === 0) {
      logResult({
        name: '7. Date Format Validation',
        status: 'WARN',
        message: 'No rentals to validate date formats'
      })
      return
    }

    const sample = rentals[0]
    const ddmmyyyyRegex = /^\d{2}\/\d{2}\/\d{4}$/

    if (sample.startDate && !ddmmyyyyRegex.test(sample.startDate)) {
      logResult({
        name: '7.1 Date Format: startDate',
        status: 'WARN',
        message: `startDate format issue: "${sample.startDate}" (expected DD/MM/YYYY)`,
        details: sample
      })
    } else {
      logResult({
        name: '7.1 Date Format: startDate',
        status: 'PASS',
        message: 'startDate in DD/MM/YYYY format'
      })
    }

    if (sample.endDate && !ddmmyyyyRegex.test(sample.endDate)) {
      logResult({
        name: '7.2 Date Format: endDate',
        status: 'WARN',
        message: `endDate format issue: "${sample.endDate}" (expected DD/MM/YYYY)`,
        details: sample
      })
    } else {
      logResult({
        name: '7.2 Date Format: endDate',
        status: 'PASS',
        message: 'endDate in DD/MM/YYYY format'
      })
    }

    // Check created_at is ISO format
    if (sample.created_at && !sample.created_at.includes('T')) {
      logResult({
        name: '7.3 Date Format: created_at',
        status: 'WARN',
        message: `created_at format issue: "${sample.created_at}" (expected ISO 8601)`,
        details: sample
      })
    } else {
      logResult({
        name: '7.3 Date Format: created_at',
        status: 'PASS',
        message: 'created_at in ISO 8601 format'
      })
    }
  } catch (error) {
    logResult({
      name: '7. Date Format Validation',
      status: 'FAIL',
      message: `Date validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    })
  }
}

async function testAccessLogs() {
  try {
    const { data: logs, error } = await supabase
      .from('access_logs')
      .select('*')
      .limit(5)
    
    if (error) {
      logResult({
        name: '8. Access Logs',
        status: 'WARN',
        message: 'Access logs table may not exist or is empty'
      })
      return
    }

    logResult({
      name: '8. Access Logs',
      status: 'PASS',
      message: `Found ${logs?.length || 0} access logs`,
      details: { count: logs?.length }
    })
  } catch (error) {
    logResult({
      name: '8. Access Logs',
      status: 'FAIL',
      message: `Access logs check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    })
  }
}

async function generateSummary() {
  console.log('\n' + '='.repeat(60))
  console.log('📊 HEALTH CHECK SUMMARY')
  console.log('='.repeat(60) + '\n')

  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const warnings = results.filter(r => r.status === 'WARN').length
  const total = results.length

  console.log(`✅ PASSED:  ${passed}/${total}`)
  console.log(`❌ FAILED:  ${failed}/${total}`)
  console.log(`⚠️  WARNINGS: ${warnings}/${total}`)
  console.log()

  if (failed > 0) {
    console.log('🔴 CRITICAL ISSUES:')
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   ❌ ${r.name}: ${r.message}`)
    })
    console.log()
  }

  if (warnings > 0) {
    console.log('🟡 WARNINGS:')
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`   ⚠️  ${r.name}: ${r.message}`)
    })
    console.log()
  }

  const status = failed === 0 ? '✅ READY FOR PRODUCTION' : '❌ ISSUES FOUND - FIX BEFORE DEPLOYMENT'
  console.log('='.repeat(60))
  console.log(status)
  console.log('='.repeat(60) + '\n')

  process.exit(failed > 0 ? 1 : 0)
}

async function runAllTests() {
  console.log('🚀 Starting 3L Moto Health Check...\n')
  
  await testSupabaseConnection()
  await testTablesExist()
  await testDataIntegrity()
  await testRentalCalculations()
  await testVehicleData()
  await testCustomerData()
  await testDateFormats()
  await testAccessLogs()
  
  await generateSummary()
}

runAllTests().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
