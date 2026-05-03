import { Document } from "mongoose";
import { User } from "./user";

export interface BudgetEntry extends Document {
  id: string;
  month: string;
  type: "income" | "fixed" | "variable" | "savings";
  category: string;
  label: string;
  amount: number;
  owner: User["id"];
  createdAt: Date;
  updatedAt: Date;
}
