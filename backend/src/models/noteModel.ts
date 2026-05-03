import { Schema, model, Document } from "mongoose";
import { Note } from "../interfaces/note";

const noteSchema = new Schema<Note>(
  {
    title: { type: String, required: true, minlength: 1, maxlength: 255 },
    content: { type: String, required: true, minlength: 1, maxlength: 10000 },
    tone: {
      type: String,
      required: false,
      enum: ["charcoal", "amber", "mint", "violet"],
      default: "charcoal"
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

noteSchema.pre("findOneAndUpdate", function <T extends Document>(this: any) {
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

export const noteModel = model<Note>("Note", noteSchema);
