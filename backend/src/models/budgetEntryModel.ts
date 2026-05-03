import { Schema, model, Document } from "mongoose";
import { BudgetEntry } from "../interfaces/budgetEntry";

const budgetEntrySchema = new Schema<BudgetEntry>(
  {
    month: { type: String, required: true, minlength: 7, maxlength: 7 },
    type: {
      type: String,
      required: true,
      enum: ["income", "fixed", "variable", "savings"]
    },
    category: { type: String, required: true, minlength: 1, maxlength: 120 },
    label: { type: String, required: true, minlength: 1, maxlength: 255 },
    amount: { type: Number, required: true, min: 0 },
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

budgetEntrySchema.pre("findOneAndUpdate", function <T extends Document>(this: any) {
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

export const budgetEntryModel = model<BudgetEntry>("BudgetEntry", budgetEntrySchema);
