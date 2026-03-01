import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../prismaClient";
import type { AuthRequest, AuthUser } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

const createToken = (user: AuthUser) => {
  const secret = process.env.JWT_SECRET || "change_this_secret";
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn: "7d" },
  );
};

const NICKNAME_REGEX = /^[\u4e00-\u9fa5A-Za-z0-9_]{2,20}$/;

const toPublicUser = (user: {
  id: number;
  email: string;
  role: string;
  nickname?: string | null;
  avatarUrl?: string | null;
}) => ({
  id: user.id,
  email: user.email,
  role: user.role as "ADMIN" | "CUSTOMER",
  nickname: user.nickname || "",
  avatarUrl: user.avatarUrl || "",
});

router.post("/register", async (req, res) => {
  const { email, password, nickname } = req.body as {
    email?: string;
    password?: string;
    nickname?: string;
  };

  if (!email || !password) {
    return res.status(400).json({ message: "邮箱和密码不能为空" });
  }

  const finalNickname = (nickname || email.split("@")[0] || "用户").trim();
  if (!NICKNAME_REGEX.test(finalNickname)) {
    return res.status(400).json({ message: "昵称格式不合法：2-20位，仅支持中文、英文、数字、下划线" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(400).json({ message: "该邮箱已注册" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const adminExists = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: adminExists ? "CUSTOMER" : "ADMIN",
      nickname: finalNickname,
      avatarUrl: "",
    },
  });

  const publicUser = toPublicUser(user);
  const token = createToken(publicUser);

  return res.json({ token, user: publicUser });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ message: "邮箱和密码不能为空" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(400).json({ message: "邮箱或密码错误" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(400).json({ message: "邮箱或密码错误" });
  }

  const publicUser = toPublicUser(user);
  const token = createToken(publicUser);

  return res.json({ token, user: publicUser });
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        nickname: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "用户不存在" });
    }

    return res.json(toPublicUser(user));
  } catch (error: any) {
    if (error?.code === "P2022") {
      return res.status(500).json({ message: "数据库字段缺失，请先执行 Prisma 迁移" });
    }
    return res.status(500).json({ message: "获取用户信息失败" });
  }
});

router.patch("/me", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const { nickname, avatarUrl } = req.body as { nickname?: unknown; avatarUrl?: unknown };

  if (typeof nickname !== "string" && typeof avatarUrl !== "string") {
    return res.status(400).json({ message: "请至少提交一个可更新字段" });
  }

  const data: { nickname?: string; avatarUrl?: string } = {};

  if (typeof nickname === "string") {
    const trimmedNickname = nickname.trim();
    if (!NICKNAME_REGEX.test(trimmedNickname)) {
      return res.status(400).json({
        message: "昵称格式不合法：2-20位，仅支持中文、英文、数字、下划线",
      });
    }
    data.nickname = trimmedNickname;
  }

  if (typeof avatarUrl === "string") {
    const trimmedAvatarUrl = avatarUrl.trim();
    if (trimmedAvatarUrl.length > 512) {
      return res.status(400).json({ message: "头像地址过长" });
    }
    data.avatarUrl = trimmedAvatarUrl;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        nickname: true,
        avatarUrl: true,
      },
    });

    return res.json(toPublicUser(updated));
  } catch (error: any) {
    return res.status(500).json({
      message: "保存资料失败，请先执行数据库迁移后重试",
      detail: process.env.NODE_ENV === "development" ? error?.message : undefined,
    });
  }
});

export default router;

