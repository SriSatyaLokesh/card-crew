import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { api, clearStoredToken, getStoredToken } from "../lib/apiClient";
import type { UserProfile } from "../types/api";
import { AuthContext } from "./AuthContext";

const LOCAL_PROFILE_KEY = "cardcrew_local_profile";

function createUserSession(profile: UserProfile, token: string): Session {
  return {
    access_token: token,
    token_type: "bearer",
    expires_in: 86400 * 7,
    expires_at: Math.floor(Date.now() / 1000) + 86400 * 7,
    refresh_token: "refresh-" + profile.id,
    user: {
      id: profile.id,
      email: profile.email || "user@cardcrew.local",
      app_metadata: { provider: "email" },
      user_metadata: { display_name: profile.display_name },
      aud: "authenticated",
      created_at: profile.created_at,
    } as any,
  } as Session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_PROFILE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [session, setSession] = useState<Session | null>(() => {
    const token = getStoredToken();
    try {
      const saved = localStorage.getItem(LOCAL_PROFILE_KEY);
      if (token && saved) {
        return createUserSession(JSON.parse(saved), token);
      }
      return null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => {
    const token = getStoredToken();
    try {
      const saved = localStorage.getItem(LOCAL_PROFILE_KEY);
      return !(token && saved);
    } catch {
      return true;
    }
  });
  const [error, setError] = useState<string | null>(null);

  // Restore and verify authenticated user on app load from database
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .getMe()
      .then(({ user }) => {
        setProfile(user);
        setSession(createUserSession(user, token));
        localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(user));
      })
      .catch((err) => {
        // Only clear credentials if the server explicitly rejected the token as 401 Unauthorized
        if (err?.status === 401) {
          clearStoredToken();
          localStorage.removeItem(LOCAL_PROFILE_KEY);
          setProfile(null);
          setSession(null);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const { token, user } = await api.login(email, password);
      setProfile(user);
      setSession(createUserSession(user, token));
      localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(user));
    } catch (err: any) {
      const message = err?.message || "Login failed";
      setError(message);
      throw err;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    setError(null);
    try {
      const { token, user } = await api.signup(email, password, displayName);
      setProfile(user);
      setSession(createUserSession(user, token));
      localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(user));
    } catch (err: any) {
      const message = err?.message || "Signup failed";
      setError(message);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    clearStoredToken();
    localStorage.removeItem(LOCAL_PROFILE_KEY);
    setProfile(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const { user } = await api.getMe();
      setProfile(user);
      localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(user));
      const token = getStoredToken();
      if (token) {
        setSession(createUserSession(user, token));
      }
    } catch {
      // ignore
    }
  }, []);

  const updateProfileState = useCallback((updated: UserProfile) => {
    setProfile(updated);
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(updated));
    const token = getStoredToken();
    if (token) {
      setSession(createUserSession(updated, token));
    }
  }, []);

  const value = useMemo(
    () => ({ session, profile, loading, error, signIn, signUp, signOut, refreshProfile, updateProfileState }),
    [session, profile, loading, error, signIn, signUp, signOut, refreshProfile, updateProfileState],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
