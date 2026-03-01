import express from "express";
import { prisma } from "../prismaClient";
import type { AuthRequest } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";

const router = express.Router();

const normalizeTagNames = (input: unknown): string[] | undefined => {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) return [];
  const names = input
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(names)).slice(0, 30);
};

const normalizeTagIds = (input: unknown): number[] | undefined => {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) return [];
  const ids = input
    .map((x) => (typeof x === "number" ? x : Number.parseInt(String(x), 10)))
    .filter((x) => Number.isFinite(x) && x > 0) as number[];
  return Array.from(new Set(ids)).slice(0, 50);
};

const resolveTagIds = async (tagIds: number[] | undefined, tagNames: string[] | undefined): Promise<number[] | undefined> => {
  if (tagIds === undefined && tagNames === undefined) return undefined;

  const ids = tagIds ?? [];
  const names = tagNames ?? [];

  const existingByName = names.length
    ? await prisma.tag.findMany({
        where: { name: { in: names } },
        select: { id: true, name: true },
      })
    : [];

  const nameToId = new Map(existingByName.map((t) => [t.name, t.id]));
  const missing = names.filter((n) => !nameToId.has(n));

  if (missing.length) {
    await prisma.$transaction(
      missing.map((n) =>
        prisma.tag.create({
          data: { name: n },
          select: { id: true },
        }),
      ),
    );
  }

  const allByName = names.length
    ? await prisma.tag.findMany({
        where: { name: { in: names } },
        select: { id: true },
      })
    : [];

  const final = Array.from(new Set([...ids, ...allByName.map((t) => t.id)]));
  return final;
};

router.get("/", async (req: AuthRequest, res) => {
  const { q, category, visibility, page = "1", pageSize = "20", orderBy } = req.query as {
    q?: string;
    category?: string;
    visibility?: "PUBLIC" | "LOGGED_IN" | "PRIVATE";
    page?: string;
    pageSize?: string;
    orderBy?: string;
  };

  const pageNum = Number.parseInt(String(page || "1"), 10) || 1;
  const take = Math.min(Number.parseInt(String(pageSize || "20"), 10) || 20, 100);
  const skip = (pageNum - 1) * take;

  const where: any = {};

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { content: { contains: q, mode: "insensitive" } },
    ];
  }

  if (!req.user) {
    where.visibility = "PUBLIC";
  } else if (req.user.role === "CUSTOMER") {
    where.visibility = { in: ["PUBLIC", "LOGGED_IN"] };
  }

  if (category) {
    where.category = {
      name: { contains: category, mode: "insensitive" },
    };
  }

  if (visibility && ["PUBLIC", "LOGGED_IN", "PRIVATE"].includes(visibility)) {
    where.visibility = visibility;
  }

  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      skip,
      take,
      orderBy:
        orderBy === "views"
          ? { viewCount: "desc" }
          : { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        content: true,
        viewCount: true,
        visibility: true,
        createdAt: true,
        images: {
          select: { imageUrl: true },
          take: 3,
        },
        category: {
          select: { id: true, name: true },
        },
        tags: {
          select: {
            tag: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.question.count({ where }),
  ]);

  res.json({
    items: items.map((q) => ({
      ...q,
      tags: q.tags.map((t) => t.tag),
    })),
    total,
    page: pageNum,
    pageSize: take,
  });
});

router.get("/:id", async (req: AuthRequest, res) => {
  const id = Number.parseInt(String(req.params.id), 10);
  if (!id) {
    return res.status(400).json({ message: "无效的问题 ID" });
  }

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      images: true,
      category: true,
      tags: {
        select: {
          tag: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!question) {
    return res.status(404).json({ message: "问题不存在" });
  }

  if (question.visibility === "PRIVATE") {
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(404).json({ message: "问题不存在" });
    }
  } else if (question.visibility === "LOGGED_IN" && !req.user) {
    return res.status(401).json({ message: "请先登录后查看该问题" });
  }

  await prisma.question.update({
    where: { id },
    data: {
      viewCount: { increment: 1 },
    },
  });

  return res.json({
    ...question,
    tags: question.tags.map((t) => t.tag),
  });
});

router.post("/", requireAdmin, async (req: AuthRequest, res) => {
  const { title, content, visibility = "PUBLIC", categoryId, imageUrls, tagIds, tagNames } = req.body as {
    title?: string;
    content?: string;
    visibility?: "PUBLIC" | "LOGGED_IN" | "PRIVATE";
    categoryId?: number;
    imageUrls?: string[];
    tagIds?: unknown;
    tagNames?: unknown;
  };

  if (!title || !content) {
    return res.status(400).json({ message: "标题和内容不能为空" });
  }

  const resolvedTagIds = await resolveTagIds(normalizeTagIds(tagIds), normalizeTagNames(tagNames));

  const question = await prisma.question.create({
    data: {
      title,
      content,
      visibility,
      categoryId: categoryId ?? null,
      createdById: req.user?.id ?? null,
      tags: resolvedTagIds
        ? {
            create: resolvedTagIds.map((id) => ({ tagId: id })),
          }
        : undefined,
      images: imageUrls && imageUrls.length > 0
        ? {
            create: imageUrls.map((url) => ({
              imageUrl: url,
            })),
          }
        : undefined,
    },
    include: {
      images: true,
      category: true,
      tags: {
        select: { tag: { select: { id: true, name: true } } },
      },
    },
  });

  return res.status(201).json({
    ...question,
    tags: question.tags.map((t) => t.tag),
  });
});

router.put("/:id", requireAdmin, async (req: AuthRequest, res) => {
  const id = Number.parseInt(String(req.params.id), 10);
  if (!id) {
    return res.status(400).json({ message: "无效的问题 ID" });
  }

  const { title, content, visibility, categoryId, imageUrls, tagIds, tagNames } = req.body as {
    title?: string;
    content?: string;
    visibility?: "PUBLIC" | "LOGGED_IN" | "PRIVATE";
    categoryId?: number | null;
    imageUrls?: string[];
    tagIds?: unknown;
    tagNames?: unknown;
  };

  const existing = await prisma.question.findUnique({
    where: { id },
    include: { images: true },
  });

  if (!existing) {
    return res.status(404).json({ message: "问题不存在" });
  }

  const updateData: any = {};
  if (title !== undefined) updateData.title = title;
  if (content !== undefined) updateData.content = content;
  if (visibility !== undefined) updateData.visibility = visibility;
  if (categoryId !== undefined) updateData.categoryId = categoryId;

  if (imageUrls) {
    updateData.images = {
      deleteMany: {},
      create: imageUrls.map((url) => ({ imageUrl: url })),
    };
  }

  const resolvedTagIds = await resolveTagIds(normalizeTagIds(tagIds), normalizeTagNames(tagNames));
  if (resolvedTagIds !== undefined) {
    updateData.tags = {
      deleteMany: {},
      create: resolvedTagIds.map((id) => ({ tagId: id })),
    };
  }

  const updated = await prisma.question.update({
    where: { id },
    data: updateData,
    include: {
      images: true,
      category: true,
      tags: {
        select: { tag: { select: { id: true, name: true } } },
      },
    },
  });

  return res.json({
    ...updated,
    tags: updated.tags.map((t) => t.tag),
  });
});

router.delete("/batch", requireAdmin, async (req, res) => {
  const { ids } = req.body as { ids?: unknown };
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "请提供要删除的问题 ID 列表" });
  }

  const normalizedIds = Array.from(
    new Set(
      ids
        .map((x) => (typeof x === "number" ? x : Number.parseInt(String(x), 10)))
        .filter((x) => Number.isFinite(x) && x > 0),
    ),
  ) as number[];

  if (!normalizedIds.length) {
    return res.status(400).json({ message: "无效的问题 ID 列表" });
  }

  const exists = await prisma.question.findMany({
    where: { id: { in: normalizedIds } },
    select: { id: true },
  });
  const existsIds = exists.map((x) => x.id);

  if (!existsIds.length) {
    return res.status(404).json({ message: "问题不存在" });
  }

  await prisma.$transaction([
    prisma.questionTag.deleteMany({ where: { questionId: { in: existsIds } } }),
    prisma.questionImage.deleteMany({ where: { questionId: { in: existsIds } } }),
    prisma.customerQuestionAnswer.updateMany({
      where: { linkedQuestionId: { in: existsIds } },
      data: { linkedQuestionId: null },
    }),
    prisma.question.deleteMany({ where: { id: { in: existsIds } } }),
  ]);

  return res.json({ deletedCount: existsIds.length });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number.parseInt(String(req.params.id), 10);
  if (!id) {
    return res.status(400).json({ message: "无效的问题 ID" });
  }

  const existing = await prisma.question.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return res.status(404).json({ message: "问题不存在" });
  }

  await prisma.$transaction([
    prisma.questionTag.deleteMany({ where: { questionId: id } }),
    prisma.questionImage.deleteMany({ where: { questionId: id } }),
    prisma.customerQuestionAnswer.updateMany({
      where: { linkedQuestionId: id },
      data: { linkedQuestionId: null },
    }),
    prisma.question.delete({ where: { id } }),
  ]);

  return res.status(204).send();
});

export default router;

