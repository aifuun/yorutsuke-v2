/**
 * Tier 1: Direct Fetcher Template
 * Pattern: View → Adapter
 *
 * Use for: Simple read-only data fetching
 * Pillars: A (Nominal Typing)
 */

import { useQuery } from '@tanstack/react-query';

// ============================================
// Types (Pillar A: Nominal Typing)
// ============================================

// Branded type for ID
type UserId = string & { readonly __brand: unique symbol };

// Domain entity
interface User {
  id: UserId;
  name: string;
  email: string;
}

// ============================================
// Adapter
// ============================================

async function fetchUser(id: UserId): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new Error('Failed to fetch user');
  return response.json();
}

// ============================================
// View (Direct usage)
// ============================================

function UserProfile({ userId }: { userId: UserId }) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return null;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

// ============================================
// Type Helper (Pillar A: Boundary conversion)
// ============================================

function toUserId(raw: string): UserId {
  // Validate at boundary
  if (!raw || raw.length === 0) {
    throw new Error('Invalid user ID');
  }
  return raw as UserId;
}

export { UserProfile, fetchUser, toUserId };
export type { User, UserId };
