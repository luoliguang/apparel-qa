import express from "express";
import { prisma } from "../prismaClient";
import type { AuthRequest } from "../middleware/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = express.Router();

type NotificationPayload = {
  userId: number;
  type: "QUESTION_SUBMITTED" | "QUESTION_ANSWERED" | "QUESTION_STATUS_CHANGED";
  title: string;
  content: string;
  relatedType?: string;
  relatedId?: number;
};

const notificationDelegate = (prisma as any).notification as {
  create: (args: { data: NotificationPayload }) => Promise<unknown>;
  findFirst: (args: {
    where: {
      userId: number;
      type: NotificationPayload["type"];
      relatedType?: string;
      relatedId?: number;
      title: string;
      content: string;
      isRead: boolean;
      createdAt: { gte: Date };
    };
    select: { id: boolean };
  }) => Promise<{ id: number } | null>;
};

const createNotificationSafely = async (data: NotificationPayload) => {
  try {
    const duplicated = await notificationDelegate.findFirst({
      where: {
        userId: data.userId,
        type: data.type,
        relatedType: data.relatedType,
        relatedId: data.relatedId,
        title: data.title,
        content: data.content,
        isRead: false,
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      select: { id: true },
    });

    if (duplicated) {
      return true;
    }

    await notificationDelegate.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        content: data.content,
        relatedType: data.relatedType,
        relatedId: data.relatedId,
      },
    });
    return true;
  } catch (error) {
    console.error("创建通知失败", error);
    return false;
  }
};

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { title, description, imageUrls } = req.body as {
    title?: string;
    description?: string;
    imageUrls?: string[];
  };

  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  if (!title || !description) {
    return res.status(400).json({ message: "标题和描述不能为空" });
  }

  const created = await prisma.customerQuestion.create({
    data: {
      title,
      description,
      customerId: req.user.id,
      images: imageUrls && imageUrls.length > 0
        ? {
            create: imageUrls.map((url) => ({ imageUrl: url })),
          }
        : undefined,
    },
    include: {
      images: true,
      answers: true,
    },
  });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  if (admins.length) {
    await Promise.all(
      admins.map((admin) =>
        createNotificationSafely({
          userId: admin.id,
          type: "QUESTION_SUBMITTED",
          title: "有新的客户提问待处理",
          content: `问题：${title}`,
          relatedType: "CUSTOMER_QUESTION",
          relatedId: created.id,
        }),
      ),
    );
  }

  await createNotificationSafely({
    userId: req.user.id,
    type: "QUESTION_SUBMITTED",
    title: "你的问题提交成功",
    content: `我们已收到你的问题：${title}`,
    relatedType: "CUSTOMER_QUESTION",
    relatedId: created.id,
  });

  return res.status(201).json(created);
});

router.get("/my", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const items = await prisma.customerQuestion.findMany({
    where: {
      customerId: req.user.id,
    },
    orderBy: { createdAt: "desc" },
    include: {
      images: true,
      answers: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return res.json(items);
});

router.get("/", requireAdmin, async (req, res) => {
  const { status, q, page = "1", pageSize = "10" } = req.query as {
    status?: string;
    q?: string;
    page?: string;
    pageSize?: string;
  };

  const pageNum = Number.parseInt(String(page || "1"), 10) || 1;
  const take = Math.min(Number.parseInt(String(pageSize || "10"), 10) || 10, 100);
  const skip = (pageNum - 1) * take;

  const where: any = {};
  if (status) {
    where.status = status;
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.customerQuestion.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { id: true, email: true },
        },
        images: true,
        answers: {
          include: {
            answeredBy: {
              select: { id: true, email: true },
            },
            linkedQuestion: {
              select: { id: true, title: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.customerQuestion.count({ where }),
  ]);

  return res.json({ items, total, page: pageNum, pageSize: take });
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = Number.parseInt(String(req.params.id), 10);
  if (!id) {
    return res.status(400).json({ message: "无效的问题 ID" });
  }

  const existing = await prisma.customerQuestion.findUnique({
    where: { id },
    select: { id: true, customerId: true },
  });

  if (!existing) {
    return res.status(404).json({ message: "客户问题不存在" });
  }

  const isAdmin = req.user?.role === "ADMIN";
  const isOwner = req.user?.id === existing.customerId;
  if (!isAdmin && !isOwner) {
    return res.status(403).json({ message: "无权限删除该问题" });
  }

  await prisma.$transaction([
    prisma.customerQuestionAnswer.deleteMany({ where: { customerQuestionId: id } }),
    prisma.customerQuestionImage.deleteMany({ where: { customerQuestionId: id } }),
    prisma.customerQuestion.delete({ where: { id } }),
  ]);

  return res.status(204).send();
});

router.put("/:id/answer", requireAdmin, async (req: AuthRequest, res) => {
  const id = Number.parseInt(String(req.params.id), 10);
  if (!id) {
    return res.status(400).json({ message: "无效的问题 ID" });
  }

  const { answerContent, status, linkedQuestionId } = req.body as {
    answerContent?: string;
    status?: "PENDING" | "ANSWERED" | "CLOSED";
    linkedQuestionId?: number | null;
  };

  if (!answerContent && !status && linkedQuestionId === undefined) {
    return res.status(400).json({ message: "没有需要更新的内容" });
  }

  const existing = await prisma.customerQuestion.findUnique({
    where: { id },
  });

  if (!existing) {
    return res.status(404).json({ message: "客户问题不存在" });
  }

  const updates: any = {};
  if (status) {
    updates.status = status;
  } else if (answerContent) {
    updates.status = "ANSWERED";
  }

  await prisma.customerQuestion.update({
    where: { id },
    data: updates,
  });

  if (answerContent != null && answerContent !== "") {
    await prisma.customerQuestionAnswer.create({
      data: {
        answerContent,
        customerQuestionId: id,
        answeredById: req.user?.id ?? null,
        linkedQuestionId: linkedQuestionId ?? null,
      },
    });

    await createNotificationSafely({
      userId: existing.customerId,
      type: "QUESTION_ANSWERED",
      title: "你的问题已收到回复",
      content: existing.title,
      relatedType: "CUSTOMER_QUESTION",
      relatedId: id,
    });
  }


  const full = await prisma.customerQuestion.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, email: true } },
      images: true,
      answers: {
        include: {
          answeredBy: { select: { id: true, email: true } },
          linkedQuestion: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return res.json(full);
});

export default router;
