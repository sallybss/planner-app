import { Document } from "mongoose";

export interface Task extends Document {
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "done";
  priority?: "low" | "medium" | "high";
  owner: string;
}
