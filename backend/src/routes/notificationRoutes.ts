import express from "express";
import { prisma } from "../prismaClient";
import type { AuthRequest } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

const router = express.Router();


router.get("/", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const { unreadOnly, page = "1", pageSize = "20" } = req.query as {
    unreadOnly?: string;
    page?: string;
    pageSize?: string;
  };

  const pageNum = Number.parseInt(String(page || "1"), 10) || 1;
  const take = Math.min(Number.parseInt(String(pageSize || "20"), 10) || 20, 100);
  const skip = (pageNum - 1) * take;

  const where = {
    userId: req.user.id,
    ...(unreadOnly === "1" ? { isRead: false } : {}),
  };

  try {
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.notification.count({ where }),
    ]);

    return res.json({ items, total, page: pageNum, pageSize: take });
  } catch (error) {
    console.error("加载通知列表失败", error);
    return res.json({ items: [], total: 0, page: pageNum, pageSize: take });
  }
});

router.get("/unread-count", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  try {
    const count = await prisma.notification.count({
      where: {
        userId: req.user.id,
        isRead: false,
      },
    });

    return res.json({ count });
  } catch (error) {
    console.error("加载未读通知数失败", error);
    return res.json({ count: 0 });
  }
});

router.patch("/:id/read", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const id = Number.parseInt(String(req.params.id), 10);
  if (!id) {
    return res.status(400).json({ message: "无效通知 ID" });
  }

  const existing = await prisma.notification.findUnique({
    where: { id },
    select: { id: true, userId: true, isRead: true },
  });

  if (!existing || existing.userId !== req.user.id) {
    return res.status(404).json({ message: "通知不存在" });
  }

  if (existing.isRead) {
    return res.json({ id, isRead: true });
  }

  await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  return res.json({ id, isRead: true });
});

router.patch("/read-all", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const result = await prisma.notification.updateMany({
    where: {
      userId: req.user.id,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  return res.json({ updatedCount: result.count });
});

router.delete("/batch", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const { ids } = req.body as { ids?: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "请选择要删除的通知" });
  }

  const parsedIds = ids
    .map((id) => Number.parseInt(String(id), 10))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (parsedIds.length === 0) {
    return res.status(400).json({ message: "通知 ID 无效" });
  }

  const result = await prisma.notification.deleteMany({
    where: {
      userId: req.user.id,
      id: { in: parsedIds },
    },
  });

  return res.json({ deletedCount: result.count });
});

router.delete("/clear", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const result = await prisma.notification.deleteMany({
    where: {
      userId: req.user.id,
    },
  });

  return res.json({ deletedCount: result.count });
});

export default router;
