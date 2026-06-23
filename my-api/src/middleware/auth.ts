import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-jwt-secret-key-12345";

export interface JwtPayload {
  userId: string;
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ success: false, error: "Unauthorized", message: "Missing or invalid token format" });
      return;
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      res.status(401).json({ success: false, error: "Unauthorized", message: "Token is empty" });
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      res.status(401).json({ success: false, error: "Unauthorized", message: "Invalid or expired token" });
      return;
    }

    const userId = decoded.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized", message: "Invalid token payload" });
      return;
    }

    const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRecords.length === 0) {
      res.status(401).json({ success: false, error: "Unauthorized", message: "User not found" });
      return;
    }

    const user = userRecords[0];
    if (!user.isActive) {
      res.status(401).json({ success: false, error: "Unauthorized", message: "User account is suspended" });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("JWT Auth Middleware error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};
