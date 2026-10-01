import assert from 'node:assert/strict'
import { test } from 'node:test'
import { effectiveStatus, localDate, validateDates } from '../src/eventDates.ts'

const event = { registration_start: '2026-10-04', registration_deadline: '2026-10-08', event_start: '2026-10-09', event_end: '2026-10-10', last_verified: '', status: 'open' as const }

test('registration opens on the start date and includes the entire deadline date', () => {
  assert.equal(effectiveStatus(event, '2026-10-03'), 'upcoming')
  assert.equal(effectiveStatus(event, '2026-10-04'), 'open')
  assert.equal(effectiveStatus(event, '2026-10-08'), 'open')
  assert.equal(effectiveStatus(event, '2026-10-09'), 'closed')
  assert.equal(effectiveStatus(event, '2026-10-10'), 'closed')
  assert.equal(effectiveStatus(event, '2026-10-11'), 'ended')
})

test('manual end states override the registration window', () => {
  assert.equal(effectiveStatus({ ...event, status: 'closed' }, '2026-10-01'), 'closed')
  assert.equal(effectiveStatus({ ...event, status: 'ended' }, '2026-10-06'), 'ended')
})

test('missing dates remain supported', () => {
  assert.equal(effectiveStatus({ ...event, registration_start: '', registration_deadline: '' }, '2026-10-01'), 'unknown')
  assert.equal(effectiveStatus({ ...event, registration_deadline: '' }, '2026-10-01'), 'upcoming')
  assert.equal(effectiveStatus({ ...event, registration_start: '' }, '2026-10-06'), 'open')
  assert.deepEqual(validateDates({ registration_start: '', registration_deadline: '', event_start: '', event_end: '', last_verified: '' }), [])
})

test('date validation rejects impossible dates and reversed ranges, permits same-day events', () => {
  assert.equal(validateDates({ ...event, registration_start: '2026-02-30' }).length, 1)
  assert.equal(validateDates({ ...event, registration_start: '2026-10-09' }).length, 1)
  assert.equal(validateDates({ ...event, event_end: '2026-10-08' }).length, 1)
  assert.deepEqual(validateDates({ ...event, registration_start: event.registration_deadline, event_end: event.event_start }), [])
  assert.equal(localDate(new Date(2026, 9, 1, 0, 0)), '2026-10-01')
})

