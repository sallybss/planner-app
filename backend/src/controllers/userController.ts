import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Joi, { type ValidationResult } from "joi";

import { userModel } from "../models/userModel";
import { type User } from "../interfaces/user";
import { connect, disconnect } from "../repository/database";

export async function registerUser(req: Request, res: Response) {
  try {
    const { error } = validateUserRegistrationInfo(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    await connect();

    const emailExists = await userModel.findOne({ email: req.body.email });
    if (emailExists) return res.status(400).json({ error: "Email already exists." });

    const salt = await bcrypt.genSalt(10);
    const passwordHashed = await bcrypt.hash(req.body.password, salt);

    const userObject = new userModel({
      name: req.body.name,
      email: req.body.email,
      password: passwordHashed
    });

    const savedUser = await userObject.save();
    return res.status(201).json({ error: null, data: { userId: savedUser._id } });
  } catch (error) {
    return res.status(500).send("Error registering user. Error: " + error);
  } finally {
    await disconnect();
  }
}

export async function loginUser(req: Request, res: Response) {
  try {
    const { error } = validateUserLoginInfo(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    await connect();

    const user: User | null = await userModel.findOne({ email: req.body.email });
    if (!user) return res.status(400).json({ error: "Password or email is wrong." });

    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Password or email is wrong." });

    const TOKEN_SECRET = process.env.TOKEN_SECRET;
    if (!TOKEN_SECRET) return res.status(500).json({ error: "Missing TOKEN_SECRET in env." });

    const userId = String(user.id);

    const token = jwt.sign(
      { id: userId, name: user.name, email: user.email },
      TOKEN_SECRET,
      { expiresIn: "2h" }
    );

    return res
      .status(200)
      .header("auth-token", token)
      .json({ error: null, data: { userId, token } });
  } catch (error) {
    return res.status(500).send("Error logging in user. Error: " + error);
  } finally {
    await disconnect();
  }
}

export function verifyToken(req: Request, res: Response, next: NextFunction) {
  const bearer = req.header("Authorization");
  const legacy = req.header("auth-token");

  const token =
    (bearer && bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : null) ||
    legacy ||
    null;

  if (!token) return res.status(401).json({ error: "Access Denied. Missing token." });

  try {
    const TOKEN_SECRET = process.env.TOKEN_SECRET;
    if (!TOKEN_SECRET) return res.status(500).json({ error: "Missing TOKEN_SECRET in env." });

    const decoded = jwt.verify(token, TOKEN_SECRET);
    (req as any).user = decoded;

    return next();
  } catch {
    return res.status(401).json({ error: "Invalid Token" });
  }
}

export function validateUserRegistrationInfo(data: User): ValidationResult {
  const schema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().min(6).max(255).required(),
    password: Joi.string().min(6).max(64).required()
  });

  return schema.validate(data);
}

export function validateUserLoginInfo(data: User): ValidationResult {
  const schema = Joi.object({
    email: Joi.string().email().min(6).max(255).required(),
    password: Joi.string().min(6).max(64).required()
  });

  return schema.validate(data);
}
