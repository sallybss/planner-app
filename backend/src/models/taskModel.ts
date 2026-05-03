import { Schema, model, Document } from "mongoose";
import { Task } from "../interfaces/task";

const taskSchema = new Schema<Task>(
  {
    title: { type: String, required: true, minlength: 1, maxlength: 255 },
    description: { type: String, required: false, maxlength: 4000 },
    status: {
      type: String,
      required: true,
      enum: ["todo", "in-progress", "done"],
      default: "todo"
    },
    priority: {
      type: String,
      required: false,
      enum: ["low", "medium", "high"],
      default: "medium"
    },
    owner: { type: String, ref: "User", required: true }
  },
  { timestamps: true }
);

type UpdateQuery<T> = {
  [key: string]: unknown;
} & {
  __v?: number;
  $set?: Partial<T> & { __v?: number };
  $setOnInsert?: Partial<T> & { __v?: number };
  $inc?: { __v?: number };
};

taskSchema.pre("findOneAndUpdate", function <T extends Document>(this: any) {
  const update = this.getUpdate() as UpdateQuery<T>;

  if (update.__v != null) delete update.__v;

  const keys: Array<"$set" | "$setOnInsert"> = ["$set", "$setOnInsert"];
  for (const key of keys) {
    if (update[key] != null && update[key]!.__v != null) {
      delete update[key]!.__v;
      if (Object.keys(update[key]!).length === 0) delete update[key];
    }
  }

  update.$inc = update.$inc || {};
  update.$inc.__v = 1;
});

export const taskModel = model<Task>("Task", taskSchema);
