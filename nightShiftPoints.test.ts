import assert from 'node:assert/strict';
import { calculateNightShiftPointsForSchedule } from './src/data/initialData';

const cases: Array<{
  name: string;
  start: string;
  end: string;
  mode: any;
  expect: { d1: number; d2: number };
}> = [
  {
    name: 'Dưới 2 giờ -> 0 điểm',
    start: '22:00',
    end: '23:59',
    mode: 'standard',
    expect: { d1: 0, d2: 0 },
  },
  {
    name: 'Đủ 2 giờ -> 0.5 điểm',
    start: '22:00',
    end: '00:00',
    mode: 'standard',
    expect: { d1: 0.5, d2: 0 },
  },
  {
    name: '3 giờ 59 phút -> 0.5 điểm',
    start: '22:00',
    end: '01:59',
    mode: 'standard',
    expect: { d1: 0.5, d2: 0 },
  },
  {
    name: 'Đủ 4 giờ (chia theo ngày) -> 0.5 + 0.5',
    start: '22:00',
    end: '02:00',
    mode: 'standard',
    expect: { d1: 0.5, d2: 0.5 },
  },
  {
    name: 'Chỉ tính hôm sau: chỉ tính từ 00:00 (đủ 2 giờ -> 0.5)',
    start: '22:00',
    end: '02:00',
    mode: 'overnight_only_next_day',
    expect: { d1: 0, d2: 0.5 },
  },
  {
    name: 'Chia 0.5/0.5 (<=22:00 và >=02:00)',
    start: '21:00',
    end: '06:00',
    mode: 'overnight_half_split_if_22_to_after_2',
    expect: { d1: 0.5, d2: 0.5 },
  },
  {
    name: 'Tính chuẩn: 20:00-04:00 -> D1=0.5 (22-24), D2=1 (00-04)',
    start: '20:00',
    end: '04:00',
    mode: 'standard',
    expect: { d1: 0.5, d2: 1 },
  },
  {
    name: 'Chỉ tính hôm sau: 20:00-04:00 -> D2=1 (00-04)',
    start: '20:00',
    end: '04:00',
    mode: 'overnight_only_next_day',
    expect: { d1: 0, d2: 1 },
  },
];

cases.forEach(c => {
  const r = calculateNightShiftPointsForSchedule(c.start, c.end, c.mode);
  assert.equal(r.day1Points, c.expect.d1, c.name);
  assert.equal(r.day2Points, c.expect.d2, c.name);
});

console.log('nightShiftPoints.test.ts: OK');
