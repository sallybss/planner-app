import { Document } from "mongoose";
import { User } from "./user";

export interface Event extends Document {
  id: string;
  title: string;
  description?: string;
  date: Date;
  startTime?: string;
  endTime?: string;
  color?: string;
  category?: string;
  owner: User["id"];
  createdAt: Date;
  updatedAt: Date;
}
