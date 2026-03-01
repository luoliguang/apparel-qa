import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type UserRole = "ADMIN" | "CUSTOMER";

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

const getTokenFromHeader = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
};

export const attachUser = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const token = getTokenFromHeader(req);
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "change_this_secret") as AuthUser;
    req.user = decoded;
  } catch {
    // ignore invalid tokens here; protected routes will enforce auth
  }

  next();
};

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = getTokenFromHeader(req);
  if (!token) {
    return res.status(401).json({ message: "未登录或登录已过期" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "change_this_secret") as AuthUser;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "登录状态无效，请重新登录" });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "需要管理员权限" });
    }
    next();
  });
};

