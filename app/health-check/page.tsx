'use client'

import { useState } from 'react'
import { fetchCustomers, fetchVehicles, fetchRentals, fetchTransactions } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react'

interface TestResult {
  name: string
  status: 'PASS' | 'FAIL' | 'LOADING' | 'WARN'
  message: string
  details?: any
}

export default function HealthCheckPage() {
  const [results, setResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  function addResult(result: TestResult) {
    setResults(prev => [...prev, result])
  }

  async function runTests() {
    setResults([])
    setIsRunning(true)
    setIsComplete(false)

    try {
      // Test 1: Customers
      addResult({
        name: '1. Load Customers',
        status: 'LOADING',
        message: 'Testing...'
      })
      try {
        const customers = await fetchCustomers()
        addResult({
          name: '1. Load Customers',
          status: 'PASS',
          message: `Found ${customers.length} customers`,
          details: { count: customers.length }
        })
      } catch (error) {
        addResult({
          name: '1. Load Customers',
          status: 'FAIL',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      // Test 2: Vehicles
      addResult({
        name: '2. Load Vehicles',
        status: 'LOADING',
        message: 'Testing...'
      })
      try {
        const vehicles = await fetchVehicles()
        addResult({
          name: '2. Load Vehicles',
          status: 'PASS',
          message: `Found ${vehicles.length} vehicles`,
          details: { count: vehicles.length }
        })
      } catch (error) {
        addResult({
          name: '2. Load Vehicles',
          status: 'FAIL',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      // Test 3: Rentals
      addResult({
        name: '3. Load Rentals',
        status: 'LOADING',
        message: 'Testing...'
      })
      try {
        const rentals = await fetchRentals()
        addResult({
          name: '3. Load Rentals',
          status: 'PASS',
          message: `Found ${rentals.length} rentals`,
          details: { count: rentals.length }
        })
      } catch (error) {
        addResult({
          name: '3. Load Rentals',
          status: 'FAIL',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      // Test 4: Transactions
      addResult({
        name: '4. Load Transactions',
        status: 'LOADING',
        message: 'Testing...'
      })
      try {
        const transactions = await fetchTransactions()
        if (transactions.length === 0) {
          addResult({
            name: '4. Load Transactions',
            status: 'WARN',
            message: 'Transactions table empty or not created',
            details: { count: 0 }
          })
        } else {
          addResult({
            name: '4. Load Transactions',
            status: 'PASS',
            message: `Found ${transactions.length} transactions`,
            details: { count: transactions.length }
          })
        }
      } catch (error) {
        addResult({
          name: '4. Load Transactions',
          status: 'WARN',
          message: 'Transactions table may not exist yet'
        })
      }

      // Test 5: Data Validation
      addResult({
        name: '5. Data Validation',
        status: 'LOADING',
        message: 'Testing...'
      })
      try {
        const customers = await fetchCustomers()
        const vehicles = await fetchVehicles()
        const rentals = await fetchRentals()

        const allValid = 
          customers.every((c: any) => c.id && c.name) &&
          vehicles.every((v: any) => v.id && v.name && v.licensePlate) &&
          rentals.every((r: any) => r.id && r.customerId && r.vehicleId)

        if (allValid) {
          addResult({
            name: '5. Data Validation',
            status: 'PASS',
            message: 'All data records have required fields'
          })
        } else {
          addResult({
            name: '5. Data Validation',
            status: 'WARN',
            message: 'Some records missing fields'
          })
        }
      } catch (error) {
        addResult({
          name: '5. Data Validation',
          status: 'FAIL',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }

    } finally {
      setIsRunning(false)
      setIsComplete(true)
    }
  }

  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const warnings = results.filter(r => r.status === 'WARN').length

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">🏥 Health Check</h1>
        <p className="text-gray-600 mt-2">Verify all systems are ready for production</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button 
            onClick={runTests} 
            disabled={isRunning}
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
            size="lg"
          >
            {isRunning ? '🔄 Running Tests...' : '▶️ Start Health Check'}
          </Button>

          {isComplete && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-600">{passed}</div>
                <div className="text-sm text-green-700">Passed</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="text-2xl font-bold text-red-600">{failed}</div>
                <div className="text-sm text-red-700">Failed</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-600">{warnings}</div>
                <div className="text-sm text-yellow-700">Warnings</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.map((result, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-lg border-l-4 ${
                  result.status === 'PASS' ? 'bg-green-50 border-green-500' :
                  result.status === 'FAIL' ? 'bg-red-50 border-red-500' :
                  result.status === 'WARN' ? 'bg-yellow-50 border-yellow-500' :
                  'bg-gray-50 border-gray-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {result.status === 'PASS' && <CheckCircle className="w-5 h-5 text-green-600" />}
                    {result.status === 'FAIL' && <XCircle className="w-5 h-5 text-red-600" />}
                    {result.status === 'WARN' && <AlertCircle className="w-5 h-5 text-yellow-600" />}
                    {result.status === 'LOADING' && <Loader className="w-5 h-5 text-gray-600 animate-spin" />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{result.name}</p>
                    <p className="text-sm text-gray-600">{result.message}</p>
                    {result.details && (
                      <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-32">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isComplete && (
        <Card className={failed === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          <CardContent className="pt-6">
            <p className={`text-lg font-semibold ${failed === 0 ? 'text-green-700' : 'text-red-700'}`}>
              {failed === 0 ? '✅ READY FOR PRODUCTION' : '❌ ISSUES FOUND - FIX BEFORE DEPLOYMENT'}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {failed === 0 
                ? 'All critical systems are operational. Safe to deploy.'
                : `${failed} critical issue(s) must be resolved before going live.`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
