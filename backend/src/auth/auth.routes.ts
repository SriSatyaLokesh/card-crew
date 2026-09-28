import { Router } from "express";
import type { Request, Response, RequestHandler } from "express";

import { sendErrorResponse } from "../errors/send-error-response.js";
import { createRateLimitMiddleware } from "../middleware/rate-limit.js";
import type { AuthService } from "./auth.service.js";

type AuthRouterDependencies = {
  authService: AuthService;
  userAuthMiddleware: RequestHandler;
};

export function createAuthRouter({ authService, userAuthMiddleware }: AuthRouterDependencies) {
  const router = Router();

  const authRateLimit = createRateLimitMiddleware({
    windowMs: 60_000,
    maxRequests: 20,
    errorMessage: "Too many authentication attempts, please try again later",
  });

  router.post("/signup", authRateLimit, async (request, response) => {
    try {
      const { email, password, displayName, display_name } = request.body || {};
      const result = await authService.signup({
        email,
        password,
        displayName: displayName || display_name,
      });

      response.status(201).json(result);
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.get("/login", (_request, response) => {
    response.status(405).json({
      error: "Method Not Allowed. Please send a POST request with JSON body { email, password } to /auth/login, or visit the frontend at http://localhost:5173/login.",
    });
  });

  router.post("/login", authRateLimit, async (request, response) => {
    try {
      const { email, password } = request.body || {};
      const result = await authService.login({
        email,
        password,
      });

      response.status(200).json(result);
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.get("/me", userAuthMiddleware, async (request, response) => {
    try {
      const user = await authService.getMe(request.authUserId ?? "");
      response.status(200).json({ user });
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  const handlePhotoUpdate = async (request: Request, response: Response) => {
    try {
      const body = request.body || {};
      const photoData =
        body.avatarUrl ??
        body.avatar_url ??
        body.photo ??
        body.photoUrl ??
        body.photo_url ??
        body.image ??
        body.avatar ??
        "";
      const result = await authService.updateProfile(request.authUserId ?? "", {
        avatarUrl: photoData,
      });
      response.status(200).json(result);
    } catch (error) {
      sendErrorResponse(error, response);
    }
  };

  router.patch("/profile", userAuthMiddleware, async (request, response) => {
    try {
      const body = request.body || {};
      const {
        displayName,
        display_name,
        username,
        avatarUrl,
        avatar_url,
        photo,
        photoUrl,
        photo_url,
        image,
        avatar,
      } = body;

      const resolvedAvatar =
        avatarUrl !== undefined
          ? avatarUrl
          : avatar_url !== undefined
          ? avatar_url
          : photo !== undefined
          ? photo
          : photoUrl !== undefined
          ? photoUrl
          : photo_url !== undefined
          ? photo_url
          : image !== undefined
          ? image
          : avatar !== undefined
          ? avatar
          : undefined;

      const result = await authService.updateProfile(request.authUserId ?? "", {
        displayName: displayName ?? display_name,
        username,
        avatarUrl: resolvedAvatar,
      });
      response.status(200).json(result);
    } catch (error) {
      sendErrorResponse(error, response);
    }
  });

  router.post("/photo", userAuthMiddleware, handlePhotoUpdate);
  router.put("/photo", userAuthMiddleware, handlePhotoUpdate);
  router.patch("/photo", userAuthMiddleware, handlePhotoUpdate);
  router.post("/avatar", userAuthMiddleware, handlePhotoUpdate);
  router.put("/avatar", userAuthMiddleware, handlePhotoUpdate);
  router.patch("/avatar", userAuthMiddleware, handlePhotoUpdate);

  const handleChangePassword = async (request: Request, response: Response) => {
    try {
      const { currentPassword, current_password, newPassword, new_password, confirmPassword, confirm_password } = request.body || {};
      const result = await authService.changePassword(request.authUserId ?? "", {
        currentPassword: currentPassword ?? current_password,
        newPassword: newPassword ?? new_password,
        confirmPassword: confirmPassword ?? confirm_password,
        email: request.authEmail ?? undefined,
      });
      response.status(200).json(result);
    } catch (error) {
      sendErrorResponse(error, response);
    }
  };

  router.post("/change-password", userAuthMiddleware, handleChangePassword);
  router.put("/change-password", userAuthMiddleware, handleChangePassword);
  router.patch("/change-password", userAuthMiddleware, handleChangePassword);
  router.post("/password", userAuthMiddleware, handleChangePassword);
  router.put("/password", userAuthMiddleware, handleChangePassword);
  router.patch("/password", userAuthMiddleware, handleChangePassword);

  return router;
}
