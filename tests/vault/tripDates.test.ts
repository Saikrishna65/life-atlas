import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tripCalendarLabel,bookingCalendarDay} from '../../src/lib/vault/dateLabels';
test('trip calendar labels stay on their saved day and early departures match the local trip day',()=>{
 assert.equal(tripCalendarLabel('2026-12-14T00:00:00.000Z','en-US'),'Dec 14');
 assert.equal(bookingCalendarDay('2026-12-13T21:30:00.000Z','Asia/Kolkata'),'2026-12-14');
 assert.equal(bookingCalendarDay('2026-12-14T03:00:00.000Z','America/Los_Angeles'),'2026-12-13');
});
