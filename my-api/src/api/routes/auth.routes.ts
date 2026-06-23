import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "fallback-jwt-secret-key-12345";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: "Validation failed", details: parseResult.error.format() });
    return;
  }

  const { name, email, password } = parseResult.data;

  try {
    const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ success: false, error: "Conflict", message: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db.insert(users).values({
      name,
      email: email.toLowerCase(),
      passwordHash,
      isActive: true,
    }).returning();

    res.status(201).json({
      success: true,
      message: "User created",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, error: "Internal server error", message: error.message });
  }
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: "Validation failed", details: parseResult.error.format() });
    return;
  }

  const { email, password } = parseResult.data;

  try {
    const userRecords = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (userRecords.length === 0) {
      res.status(401).json({ success: false, error: "Unauthorized", message: "Invalid email or password" });
      return;
    }

    const user = userRecords[0];
    if (!user.isActive) {
      res.status(403).json({ success: false, error: "Forbidden", message: "User account is suspended" });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      res.status(401).json({ success: false, error: "Unauthorized", message: "Invalid email or password" });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      token,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: "Internal server error", message: error.message });
  }
});

router.get("/me", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
  });
});

export default router;
