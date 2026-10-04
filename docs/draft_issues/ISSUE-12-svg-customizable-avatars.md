# Title: feat(profile): Customizable seed-based SVG avatars to eliminate binary photo storage bloat

**Labels**: `frontend`, `ui`, `profile`, `privacy`, `performance`, `p2-medium`  
**Milestone**: Milestone 8 - Profile Customization & SVG Identity Engine  

---

## 1. User Story
**As a** Card Crew user setting up my profile,  
**I want** to customize a crisp, expressive, seed-based vector SVG avatar (or have one deterministically generated from my handle),  
**So that** my profile looks distinct and modern without uploading heavy binary photos, risking privacy leaks, or causing slow network load times.

---

## 2. Brutal Audit Reasons & Problem Statement
From the quantitative UI/UX Brutal Audit & Infrastructure Review:
1. **Inefficient Binary Photo Storage**:
   - The current profile page relies on binary image uploads (PNG/JPEG) into Supabase storage buckets.
   - For a peer utility app, storing 3MB–8MB uncompressed mobile camera photos wastes storage bandwidth, triggers cold-start image download latency, and introduces content moderation liabilities.
2. **Generic Fallback Letter Rings**:
   - When a user has not uploaded a photo, the app renders a plain circle with a single initial (e.g., "S"), resulting in an uninspired, repetitive interface when browsing friend lists.
3. **No Avatar Customization Experience**:
   - Users cannot personalize their identity inside the app without finding an external image file on their device.

---

## 3. Technical Specifications

### 3.1 Database Migration for Avatar Seeds (`supabase/migrations/20261003000006_avatar_seeds.sql`)
```sql
-- Migration: Add avatar seed and style to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_seed TEXT,
ADD COLUMN IF NOT EXISTS avatar_style TEXT DEFAULT 'micah' CHECK (avatar_style IN ('micah', 'bottts', 'shapes', 'identicon', 'personas'));

-- Populate initial seeds from username for existing accounts
UPDATE public.profiles 
SET avatar_seed = COALESCE(username, id::TEXT)
WHERE avatar_seed IS NULL;
```

### 3.2 Dynamic Vector Avatar Component (`frontend/src/components/common/SvgAvatar.tsx`)
Create a lightweight, zero-dependency or CDN-cached vector generator:
- **Options**:
  - Deterministic SVG generation using DiceBear API (`https://api.dicebear.com/8.x/{style}/svg?seed={seed}`) with SVG caching.
  - Or local bundled SVG generator with geometric shapes/colors.
- **Fallbacks**: Accessible SVG initials if offline or image loading fails.

```tsx
import React, { useState } from 'react';

interface SvgAvatarProps {
  seed: string;
  style?: 'micah' | 'bottts' | 'shapes' | 'personas';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
}

export const SvgAvatar: React.FC<SvgAvatarProps> = ({
  seed,
  style = 'micah',
  size = 'md',
  className = '',
  alt = 'User avatar',
}) => {
  const [hasError, setHasError] = useState(false);

  const sizePixels = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
  };

  const dim = sizePixels[size];
  const avatarUrl = `https://api.dicebear.com/8.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=eef2ff,f0fdf4,fffbeb,fdf2f8`;

  if (hasError) {
    const initials = seed.slice(0, 2).toUpperCase();
    return (
      <div 
        style={{ width: dim, height: dim }}
        className={`rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs select-none ${className}`}
        aria-label={alt}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={alt}
      width={dim}
      height={dim}
      onError={() => setHasError(true)}
      className={`rounded-full aspect-square bg-slate-100 dark:bg-slate-800 object-cover select-none ring-1 ring-black/5 dark:ring-white/10 ${className}`}
      loading="lazy"
    />
  );
};
```

### 3.3 Interactive Avatar Studio (`AvatarStudioModal.tsx`)
In `ProfilePage.tsx`, users can open an "Avatar Studio":
- Choose visual style (`Micah`, `Bottts`, `Shapes`).
- Hit `[ 🎲 Randomize Seed ]` to roll through distinct avatars.
- Preview avatar in real-time.
- Save selection directly to `public.profiles` (`avatar_seed` and `avatar_style`).

---

## 4. Step-by-Step Implementation Guide
1. **Database Migration**:
   - Apply `supabase/migrations/20261003000006_avatar_seeds.sql`.
2. **Build `SvgAvatar.tsx`**:
   - Implement component in `frontend/src/components/common/SvgAvatar.tsx`.
3. **Build `AvatarStudioModal.tsx`**:
   - Create interactive modal in `frontend/src/components/profile/AvatarStudioModal.tsx`.
4. **Deploy Across Application**:
   - Replace standard image elements and initials circles across:
     - Navigation Bar (`Navbar.tsx`)
     - Requests List (`RequestItemCard.tsx`)
     - Friends Network (`FriendsPage.tsx`)
     - Chat View (`ChatPage.tsx`)
     - Dashboard Greeting (`DashboardPage.tsx`)

---

## 5. Security, Privacy & Integrity Boundaries
- **Zero Binary Upload Overhead**: Completely bypasses file storage permissions, eliminating malware upload vectors or NSFW content moderation issues.
- **Sanitized Seed Strings**: Avatar seed string is sanitized against script injection (`encodeURIComponent`).

---

## 6. Acceptance Criteria Checklist
- [ ] Profiles table stores `avatar_seed` and `avatar_style`.
- [ ] `SvgAvatar.tsx` renders deterministic SVGs across all avatar sizes.
- [ ] Users can randomize and save their avatar in `ProfilePage.tsx`.
- [ ] Network and list views display crisp vector avatars with zero blurriness on retina displays.
- [ ] Offline fallback displays clean initials badge if external avatar CDN is unreachable.

---

## 7. Verification & Test Plan
1. **Rendering Test**:
   - Render 20 avatars in friends list; verify page renders without image jitter and memory footprint remains $< 5\text{MB}$.
2. **Randomization Test**:
   - In profile page, roll 5 seeds and save; verify database is updated with the chosen seed.
