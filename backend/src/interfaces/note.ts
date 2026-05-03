import { Document } from "mongoose";
import { User } from "./user";

export interface Note extends Document {
  id: string;
  title: string;
  content: string;
  tone?: "charcoal" | "amber" | "mint" | "violet";
  owner: User["id"];
  createdAt: Date;
  updatedAt: Date;
}
