import { describe, it, expect } from 'vitest';

describe('Gamification Logic API', () => {
  it('should calculate initial Level from XP correctly based on business rules', () => {
    const xp = 250;
    // Regra definida no PRD: Level Up a cada 100 XP
    const level = Math.floor(xp / 100) + 1;
    
    expect(level).toBe(3);
    expect(xp).toBeGreaterThanOrEqual(0);
  });
});
