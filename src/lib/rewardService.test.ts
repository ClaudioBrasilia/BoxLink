import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addReward } from './rewardService';

// Mock Supabase
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockUpdateSelect = vi.fn(() => ({ single: mockSingle }));
const mockUpdateEq = vi.fn(() => ({ select: mockUpdateSelect }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockInsert = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      }
      if (table === 'reward_history') {
        return {
          insert: mockInsert,
        };
      }
      return {};
    },
  }),
}));

describe('rewardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add XP and coins and handle level up', async () => {
    // Mock existing profile: Level 1, 50 XP, 10 Coins
    mockSingle.mockResolvedValueOnce({ 
      data: { id: 'u1', name: 'Atleta', xp: 50, coins: 10, level: 1 }, 
      error: null 
    });
    
    // Mock update success
    mockUpdateSelect.mockResolvedValueOnce({ data: {}, error: null });

    // Level up happens at Level * 100 XP. 
    // Initial: 50 XP + 60 XP reward = 110 XP. 
    // Level 1 threshold: 1 * 100 = 100 XP. 
    // 110 >= 100 -> Level Up to 2!
    
    const result = await addReward('u1', 'wod_result', 60, 10, 'Test reward');

    expect(result).not.toBeNull();
    expect(result?.levelUp).toBe(true);
    expect(result?.newLevel).toBe(2);
    expect(result?.newXp).toBe(110);
    expect(result?.newCoins).toBe(20);

    expect(mockUpdate).toHaveBeenCalledWith({
      xp: 110,
      coins: 20,
      level: 2
    });
  });

  it('should not level up if threshold is not met', async () => {
     // Mock existing profile: Level 1, 10 XP
    mockSingle.mockResolvedValueOnce({ 
      data: { id: 'u1', name: 'Atleta', xp: 10, coins: 10, level: 1 }, 
      error: null 
    });
    
    mockUpdateSelect.mockResolvedValueOnce({ data: {}, error: null });

    const result = await addReward('u1', 'wod_result', 20, 5, 'Daily WOD');

    expect(result?.levelUp).toBe(false);
    expect(result?.newLevel).toBe(1);
    expect(result?.newXp).toBe(30);
  });
});
