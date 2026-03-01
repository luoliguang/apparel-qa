import express from "express";
import { prisma } from "../prismaClient";
import { requireAdmin } from "../middleware/auth";

const router = express.Router();

router.get("/", async (req, res) => {
  const { q, limit = "50", all } = req.query as {
    q?: string;
    limit?: string;
    all?: string;
  };

  const where = q
    ? {
        name: { contains: q, mode: "insensitive" as const },
      }
    : undefined;

  const take = all === "1"
    ? undefined
    : Math.min(Number.parseInt(String(limit || "50"), 10) || 50, 200);

  const categories = await prisma.category.findMany({
    where,
    orderBy: { name: "asc" },
    take,
  });
  res.json(categories);
});

router.post("/", requireAdmin, async (req, res) => {
  const { name, description } = req.body as { name?: string; description?: string | null };

  const normalizedName = (name || "").trim();
  if (!normalizedName) {
    return res.status(400).json({ message: "分类名称不能为空" });
  }

  const existing = await prisma.category.findFirst({
    where: { name: { equals: normalizedName, mode: "insensitive" } },
  });
  if (existing) {
    return res.status(409).json({ message: "分类已存在" });
  }

  const category = await prisma.category.create({
    data: {
      name: normalizedName,
      description: (description || "").trim() || null,
    },
  });

  return res.status(201).json(category);
});

router.put("/:id", requireAdmin, async (req, res) => {
  const id = Number.parseInt(String(req.params.id), 10);
  if (!id) {
    return res.status(400).json({ message: "无效的分类 ID" });
  }

  const { name, description } = req.body as { name?: string; description?: string | null };

  const updateData: any = {};

  if (name !== undefined) {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return res.status(400).json({ message: "分类名称不能为空" });
    }

    const duplicate = await prisma.category.findFirst({
      where: {
        id: { not: id },
        name: { equals: normalizedName, mode: "insensitive" },
      },
    });
    if (duplicate) {
      return res.status(409).json({ message: "分类名称已存在" });
    }

    updateData.name = normalizedName;
  }

  if (description !== undefined) {
    updateData.description = (description || "").trim() || null;
  }

  const category = await prisma.category.update({
    where: { id },
    data: updateData,
  });

  return res.json(category);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number.parseInt(String(req.params.id), 10);
  if (!id) {
    return res.status(400).json({ message: "无效的分类 ID" });
  }

  const questionCount = await prisma.question.count({
    where: { categoryId: id },
  });

  if (questionCount > 0) {
    return res
      .status(400)
      .json({ message: "该分类下已有问题，无法删除" });
  }

  await prisma.category.delete({ where: { id } });
  return res.status(204).send();
});

export default router;

