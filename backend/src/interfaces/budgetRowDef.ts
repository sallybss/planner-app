import { Document } from "mongoose";
import { User } from "./user";

export interface BudgetRowDef extends Document {
  id: string;
  label: string;
  type: "income" | "fixed" | "variable" | "savings";
  owner: User["id"];
  createdAt: Date;
  updatedAt: Date;
}
