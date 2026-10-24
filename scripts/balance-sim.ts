// Runs many bot missions and reports survival rates (Doc 04 §10).
// Usage: npm run balance -- [missionsPerCell=300] [--csv]
import { writeFileSync } from 'node:fs';
import {
  createMission,
  defaultConfig,
  simulateDay,
  type Difficulty,
  type Location,
} from '../src/engine/index';
import { greedyScience, passive, sensible, type Bot } from './bots';

const BOTS: Record<string, Bot> = { passive, 'greedy-science': greedyScience, sensible };

const missionsPerCell = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 300);
const writeCsv = process.argv.includes('--csv');
const rows: string[] = [
  'seed,location,difficulty,bot,result,reason,day,score,stars,o2Kg,waterKg,foodKcal,avgDose',
];
const summary: string[] = [];

for (const location of ['mars', 'moon'] as Location[]) {
  for (const difficulty of ['training', 'standard', 'commander'] as Difficulty[]) {
    for (const [botName, bot] of Object.entries(BOTS)) {
      let survived = 0;
      const reasons: Record<string, number> = {};
      let scoreSum = 0;
      for (let i = 0; i < missionsPerCell; i++) {
        const seed = `BAL-${i}`;
        let s = createMission(defaultConfig({ seed, location, difficulty }));
        while (!s.outcome) s = simulateDay(s, bot(s)).next;
        const o = s.outcome;
        if (o.result === 'success') survived++;
        else reasons[o.reason ?? '?'] = (reasons[o.reason ?? '?'] ?? 0) + 1;
        scoreSum += o.score;
        const avgDose = s.crew.reduce((a, c) => a + c.doseMSv, 0) / s.crew.length;
        rows.push(
          [
            seed,
            location,
            difficulty,
            botName,
            o.result,
            o.reason ?? '',
            s.day,
            o.score,
            o.stars,
            s.resources.o2Kg.toFixed(1),
            s.resources.waterKg.toFixed(1),
            Math.round(s.resources.foodKcal),
            avgDose.toFixed(1),
          ].join(','),
        );
      }
      const rate = ((survived / missionsPerCell) * 100).toFixed(0).padStart(3);
      const why = Object.entries(reasons)
        .map(([r, n]) => `${r}:${n}`)
        .join(' ');
      summary.push(
        `${location.padEnd(5)} ${difficulty.padEnd(10)} ${botName.padEnd(15)} survival ${rate}%  avg score ${Math.round(
          scoreSum / missionsPerCell,
        )
          .toString()
          .padStart(4)}  ${why}`,
      );
    }
  }
}

console.log(summary.join('\n'));
if (writeCsv) {
  writeFileSync('balance-results.csv', rows.join('\n'));
  console.log('\nWrote balance-results.csv');
}
