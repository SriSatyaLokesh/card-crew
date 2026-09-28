import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";

import { HttpError } from "../errors/http-error.js";
import { toUserProfile } from "../users/user.types.js";
import type { UserProfile } from "../users/user.types.js";
import { hashPassword, verifyPassword } from "./password.util.js";
import { generateToken } from "./token.util.js";

export type SignupInput = {
  email: string;
  password: string;
  displayName: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthResult = {
  token: string;
  user: UserProfile;
};

export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  async signup(input: SignupInput): Promise<AuthResult> {
    const normalizedEmail = (input.email || "").trim().toLowerCase();
    const displayName = (input.displayName || "").trim();
    const password = input.password || "";

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new HttpError(400, "Valid email address is required");
    }

    if (!displayName) {
      throw new HttpError(400, "Display name is required");
    }

    if (password.length < 8) {
      throw new HttpError(400, "Password must be at least 8 characters");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new HttpError(409, "An account with this email already exists.");
    }

    const passwordHash = hashPassword(password);
    const userId = `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

    const user = await this.prisma.user.create({
      data: {
        id: userId,
        email: normalizedEmail,
        display_name: displayName,
        password_hash: passwordHash,
        status: "active",
      },
    });

    const token = generateToken({
      sub: user.id,
      email: user.email,
      display_name: user.display_name,
    });

    return {
      token,
      user: toUserProfile(user),
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const normalizedEmail = (input.email || "").trim().toLowerCase();
    const password = input.password || "";

    if (!normalizedEmail) {
      throw new HttpError(400, "Email is required");
    }

    if (!password) {
      throw new HttpError(400, "Password is required");
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new HttpError(404, "User does not exist. Please sign up first.");
    }

    if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(401, "Invalid email or password.");
    }

    if (user.status !== "active") {
      throw new HttpError(403, "Your account is not active.");
    }

    const token = generateToken({
      sub: user.id,
      email: user.email,
      display_name: user.display_name,
    });

    return {
      token,
      user: toUserProfile(user),
    };
  }

  async getMe(userId: string): Promise<UserProfile> {
    if (!userId) {
      throw new HttpError(401, "User ID is required");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    const profile = toUserProfile(user);
    return {
      ...profile,
      has_password: Boolean(user.password_hash),
    };
  }

  async updateProfile(
    userId: string,
    input: { displayName?: string; username?: string; avatarUrl?: string },
  ): Promise<{ user: UserProfile }> {
    if (!userId) {
      throw new HttpError(401, "User ID is required");
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing) {
      throw new HttpError(404, "User not found");
    }

    const dataToUpdate: Record<string, unknown> = {};

    if (input.displayName !== undefined) {
      const trimmed = input.displayName.trim();
      if (!trimmed) {
        throw new HttpError(400, "Display name cannot be empty");
      }
      if (trimmed.length > 80) {
        throw new HttpError(400, "Display name must be 80 characters or fewer");
      }
      dataToUpdate.display_name = trimmed;
    }

    if (input.username !== undefined) {
      const trimmed = input.username.trim().toLowerCase();
      if (trimmed) {
        if (!/^[a-z0-9_]{3,30}$/.test(trimmed)) {
          throw new HttpError(400, "Username must be 3-30 characters (letters, numbers, underscore only)");
        }
        if (trimmed !== existing.username) {
          const conflict = await this.prisma.user.findUnique({ where: { username: trimmed } });
          if (conflict && conflict.id !== userId) {
            throw new HttpError(409, "Username is already taken");
          }
        }
        dataToUpdate.username = trimmed;
      } else {
        dataToUpdate.username = null;
      }
    }

    if (input.avatarUrl !== undefined) {
      dataToUpdate.avatar_url = input.avatarUrl ? input.avatarUrl.trim() : null;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
    });

    return { user: toUserProfile(updated) };
  }

  async changePassword(
    userId: string,
    input: { currentPassword?: string; newPassword?: string; confirmPassword?: string; email?: string },
  ): Promise<{ message: string }> {
    if (!userId && !input.email) {
      throw new HttpError(401, "User ID is required");
    }

    const currentPassword = input.currentPassword || "";
    const newPassword = input.newPassword || "";
    const confirmPassword = input.confirmPassword || "";

    if (!newPassword) {
      throw new HttpError(400, "New password is required");
    }

    if (newPassword.length < 8) {
      throw new HttpError(400, "New password must be at least 8 characters");
    }

    if (newPassword !== confirmPassword) {
      throw new HttpError(400, "New passwords do not match");
    }

    let user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
        })
      : null;

    if (!user && input.email) {
      user = await this.prisma.user.findUnique({
        where: { email: input.email.trim().toLowerCase() },
      });
    }

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    // If user already has a password set, require and verify the current password
    if (user.password_hash) {
      if (!currentPassword) {
        throw new HttpError(400, "Current password is required");
      }
      if (!verifyPassword(currentPassword, user.password_hash)) {
        throw new HttpError(400, "Current password is incorrect");
      }
    }

    const newHash = hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password_hash: newHash },
    });

    return { message: "Password updated successfully" };
  }
}
