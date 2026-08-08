#!/usr/bin/env node
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(import.meta.dirname, '../../app/dashboard/orders/page.tsx'),
  'utf8',
);

describe('orders late-fee completion flow', () => {
  it('passes the computed late fee into the completion update', () => {
    assert.match(source, /const nextExtraFees = \(order\.extraFees \|\| 0\) \+ extra/);
    assert.match(
      source,
      /await updateOrderStatus\(lateFeeOrderId, "completed", \{ extraFees: nextExtraFees \}\)/,
    );
  });

  it('does not persist extraFees in a separate stale-state update before completion', () => {
    const lateFeeStart = source.indexOf('const handleConfirmLateFee = async () => {');
    const lateFeeEnd = source.indexOf('const updateOrderStatus = async', lateFeeStart);
    const lateFeeBody = source.slice(lateFeeStart, lateFeeEnd);

    assert.doesNotMatch(lateFeeBody, /\.from\(["']rentals["']\)\.update\(\{ extraFees:/);
    assert.doesNotMatch(lateFeeBody, /setOrders\(prev => prev\.map/);
  });

  it('persists override fields together with status and revenue', () => {
    assert.match(
      source,
      /overrides: Partial<Pick<RentalOrder, "extraFees">> = \{\}/,
    );
    assert.match(source, /const orderForRevenue = \{ \.\.\.order, \.\.\.overrides \}/);
    assert.match(source, /const updateData = \{ \.\.\.overrides, status: newStatus, revenue \}/);
    assert.match(source, /setOrders\(\(prev\) => prev\.map/);
  });
});
