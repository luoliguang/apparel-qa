import express from "express";
import { prisma } from "../prismaClient";
import { requireAdmin } from "../middleware/auth";

const router = express.Router();

router.get("/", async (req, res) => {
  const { q, limit = "100", all } = req.query as {
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
    : Math.min(Number.parseInt(String(limit || "100"), 10) || 100, 300);

  const tags = await prisma.tag.findMany({
    where,
    orderBy: { name: "asc" },
    take,
    select: { id: true, name: true },
  });
  res.json(tags);
});

router.post("/", requireAdmin, async (req, res) => {
  const { name } = req.body as { name?: string };
  const trimmed = (name || "").trim();
  if (!trimmed) {
    return res.status(400).json({ message: "标签名称不能为空" });
  }

  const existing = await prisma.tag.findUnique({ where: { name: trimmed } });
  if (existing) {
    return res.status(200).json(existing);
  }

  const created = await prisma.tag.create({
    data: { name: trimmed },
    select: { id: true, name: true },
  });
  return res.status(201).json(created);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number.parseInt(String(req.params.id), 10);
  if (!id) {
    return res.status(400).json({ message: "无效的标签 ID" });
  }

  const usedCount = await prisma.questionTag.count({
    where: { tagId: id },
  });
  if (usedCount > 0) {
    return res.status(400).json({ message: "该标签已被使用，无法删除" });
  }

  await prisma.tag.delete({ where: { id } });
  return res.status(204).send();
});

export default router;

